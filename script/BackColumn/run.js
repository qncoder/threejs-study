// BackColumn 双段伸缩柱 —— 顺序伸 stepper
//
// 前置条件：
//   节点列表中已经把 BackColumn 下每个 hydraulic mesh 拖入对应的 _pos Object3D
//   （包含 _end 标记），这样 _pos 是 mesh + _end 的父节点，移动 _pos 就移动它们。
//
// 几何：
//   A     = backcolumn_hydraulic_fixed_pos              固定缸（锚点，不动）
//   A_end = backcolumn_hydraulic_fixed_end              固定缸顶部
//   B     = backcolumn_hydraulic_slidingshaft1_pos      外段活塞杆
//   C     = backcolumn_hydraulic_slidingshaft2_pos      内段活塞杆
//
//   axisDir = normalize(A_end.world - A.world)
//
// 顺序伸出（MOVE_DIRECTION = 1）：先把 B 沿 axisDir 推到 STAGE1_MAX，再推 C
// 顺序收回（MOVE_DIRECTION = -1）：反之，先把 C 收回，再把 B 收回
//
// 每次点 "执行" 推进 STEP；首次执行会用 userData.backColumnInit 记录当前位置
// 作为冲程零点。若想把当前位置当作新的零点，设 RESET_INIT = true 执行一次即可。

const STEP           = 0.02   // 每次执行推进的轴向距离（按真实模型尺度调）
const MOVE_DIRECTION = 1      // 1 = 伸出（举升），-1 = 收回
const STAGE1_MAX     = 0.8    // 外段最大冲程
const STAGE2_MAX     = 0.8    // 内段最大冲程
const RESET_INIT     = false  // true = 清掉 init，把当前位置当作新零点
const EPSILON        = 1e-6

const A     = node.getObjectByName('backcolumn_hydraulic_fixed_pos')
const A_end = node.getObjectByName('backcolumn_hydraulic_fixed_end')
const B     = node.getObjectByName('backcolumn_hydraulic_slidingshaft1_pos')
const C     = node.getObjectByName('backcolumn_hydraulic_slidingshaft2_pos')

if (!A || !A_end || !B || !C) {
  console.warn('BackColumn 缺少必要节点', { A, A_end, B, C })
  return
}

if (RESET_INIT) {
  delete node.userData.backColumnInit
  console.log('BackColumn 初始姿态已重置（下次执行会把当前位置当作新零点）')
  return
}

function worldPos(obj) {
  return obj.getWorldPosition(new THREE.Vector3())
}

function setWorldPosition(obj, targetWorld) {
  const local = targetWorld.clone()
  obj.parent.updateWorldMatrix(true, true)
  obj.parent.worldToLocal(local)
  obj.position.copy(local)
  obj.updateMatrix()
  obj.updateWorldMatrix(true, true)
}

// 首次执行记录初始姿态作为冲程零点。userData 不会被 modelSessionState 持久化，
// 刷新页面后会重新捕获 —— 所以重新加载后请先把柱体手动恢复到收回位再开始驱动。
if (!node.userData.backColumnInit) {
  node.userData.backColumnInit = {
    A:    worldPos(A).toArray(),
    Aend: worldPos(A_end).toArray(),
    B:    worldPos(B).toArray(),
    C:    worldPos(C).toArray(),
  }
  console.log('记录 BackColumn 初始姿态（当前位置 = 完全收回）')
}

const init = node.userData.backColumnInit
const A_init    = new THREE.Vector3().fromArray(init.A)
const Aend_init = new THREE.Vector3().fromArray(init.Aend)
const B_init    = new THREE.Vector3().fromArray(init.B)
const C_init    = new THREE.Vector3().fromArray(init.C)

const axisDir = Aend_init.clone().sub(A_init).normalize()

// 当前各段已伸出的冲程（沿 axisDir 投影），相对初始姿态
const stage1Current = worldPos(B).sub(B_init).dot(axisDir)
const stage2Current = worldPos(C).sub(C_init).dot(axisDir) - stage1Current

let stepStage1 = 0
let stepStage2 = 0

if (MOVE_DIRECTION > 0) {
  // 伸出：先 stage1 满冲程，再 stage2
  if (stage1Current < STAGE1_MAX - EPSILON) {
    stepStage1 = Math.min(STEP, STAGE1_MAX - stage1Current)
  } else if (stage2Current < STAGE2_MAX - EPSILON) {
    stepStage2 = Math.min(STEP, STAGE2_MAX - stage2Current)
  } else {
    console.log(
      'BackColumn 已到最大冲程  stage1=' + stage1Current.toFixed(4)
      + '  stage2=' + stage2Current.toFixed(4)
    )
    return
  }
} else {
  // 收回：先 stage2 收完，再 stage1
  if (stage2Current > EPSILON) {
    stepStage2 = -Math.min(STEP, stage2Current)
  } else if (stage1Current > EPSILON) {
    stepStage1 = -Math.min(STEP, stage1Current)
  } else {
    console.log('BackColumn 已收回到初始位置')
    return
  }
}

// B 沿轴位移 stepStage1；C 跟着 B 走（stage1 部分）再加自己的 stepStage2
const B_target = worldPos(B).add(axisDir.clone().multiplyScalar(stepStage1))
const C_target = worldPos(C).add(axisDir.clone().multiplyScalar(stepStage1 + stepStage2))

setWorldPosition(B, B_target)
setWorldPosition(C, C_target)

node.updateWorldMatrix(true, true)

console.log(
  'BackColumn step  stage1 ' + stage1Current.toFixed(4) + ' → '
  + (stage1Current + stepStage1).toFixed(4)
  + '  stage2 ' + stage2Current.toFixed(4) + ' → '
  + (stage2Current + stepStage2).toFixed(4)
)
