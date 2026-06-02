// FrontColumn 双段伸缩柱 —— 顺序伸 stepper
//
// 与 BackColumn 完全同构，只是节点前缀不同：
//   backcolumn_*  →  frontcolumn_*
//   userData.backColumnInit  →  userData.frontColumnInit
//
// 几何、运动模型、使用方法见 script/BackColumn/run.js 顶部的说明。

const STEP           = 0.02
const MOVE_DIRECTION = 1
const STAGE1_MAX     = 0.8
const STAGE2_MAX     = 0.8
const RESET_INIT     = false
const EPSILON        = 1e-6

const A     = node.getObjectByName('frontcolumn_hydraulic_fixed_pos')
const A_end = node.getObjectByName('frontcolumn_hydraulic_fixed_end')
const B     = node.getObjectByName('frontcolumn_hydraulic_slidingshaft1_pos')
const C     = node.getObjectByName('frontcolumn_hydraulic_slidingshaft2_pos')

if (!A || !A_end || !B || !C) {
  console.warn('FrontColumn 缺少必要节点', { A, A_end, B, C })
  return
}

if (RESET_INIT) {
  delete node.userData.frontColumnInit
  console.log('FrontColumn 初始姿态已重置（下次执行会把当前位置当作新零点）')
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

if (!node.userData.frontColumnInit) {
  node.userData.frontColumnInit = {
    A:    worldPos(A).toArray(),
    Aend: worldPos(A_end).toArray(),
    B:    worldPos(B).toArray(),
    C:    worldPos(C).toArray(),
  }
  console.log('记录 FrontColumn 初始姿态（当前位置 = 完全收回）')
}

const init = node.userData.frontColumnInit
const A_init    = new THREE.Vector3().fromArray(init.A)
const Aend_init = new THREE.Vector3().fromArray(init.Aend)
const B_init    = new THREE.Vector3().fromArray(init.B)
const C_init    = new THREE.Vector3().fromArray(init.C)

const axisDir = Aend_init.clone().sub(A_init).normalize()

const stage1Current = worldPos(B).sub(B_init).dot(axisDir)
const stage2Current = worldPos(C).sub(C_init).dot(axisDir) - stage1Current

let stepStage1 = 0
let stepStage2 = 0

if (MOVE_DIRECTION > 0) {
  if (stage1Current < STAGE1_MAX - EPSILON) {
    stepStage1 = Math.min(STEP, STAGE1_MAX - stage1Current)
  } else if (stage2Current < STAGE2_MAX - EPSILON) {
    stepStage2 = Math.min(STEP, STAGE2_MAX - stage2Current)
  } else {
    console.log(
      'FrontColumn 已到最大冲程  stage1=' + stage1Current.toFixed(4)
      + '  stage2=' + stage2Current.toFixed(4)
    )
    return
  }
} else {
  if (stage2Current > EPSILON) {
    stepStage2 = -Math.min(STEP, stage2Current)
  } else if (stage1Current > EPSILON) {
    stepStage1 = -Math.min(STEP, stage1Current)
  } else {
    console.log('FrontColumn 已收回到初始位置')
    return
  }
}

const B_target = worldPos(B).add(axisDir.clone().multiplyScalar(stepStage1))
const C_target = worldPos(C).add(axisDir.clone().multiplyScalar(stepStage1 + stepStage2))

setWorldPosition(B, B_target)
setWorldPosition(C, C_target)

node.updateWorldMatrix(true, true)

console.log(
  'FrontColumn step  stage1 ' + stage1Current.toFixed(4) + ' → '
  + (stage1Current + stepStage1).toFixed(4)
  + '  stage2 ' + stage2Current.toFixed(4) + ' → '
  + (stage2Current + stepStage2).toFixed(4)
)
