const STEP = 0.01
const MOVE_DIRECTION = 1

const DRIVING_ROTATE_RATIO = 1
const HYDRAULIC_ROTATE_RATIO = 0.15
const SLIDING_LIFT_RATIO = 1.2

const findNode = name => node.children.find(n => n.name === name)
const pos = obj => obj.getWorldPosition(new THREE.Vector3())

const fixed = findNode('flap1_hydraulic_fixed')
const sliding = findNode('flap1_hydraulic_slidingshaft')
const driving = findNode('flap1_driving_shaft')

if (!fixed || !sliding || !driving) {
  console.warn('缺少节点', { fixed, sliding, driving })
  return
}

function moveWorld(obj, delta) {
  const p = pos(obj).add(delta)

  obj.parent.updateWorldMatrix(true, true)
  obj.parent.worldToLocal(p)
  obj.position.copy(p)

  obj.updateMatrix()
  obj.updateWorldMatrix(true, true)
}

function angleYZ(from, to) {
  return Math.atan2(to.z - from.z, to.y - from.y)
}

node.updateWorldMatrix(true, true)

const A = pos(fixed)
const B0 = pos(sliding)
const C = pos(driving)

const oldAngle = angleYZ(C, B0)

const dir = A.clone().sub(B0)
if (dir.lengthSq() < 1e-12) {
  console.warn('fixed 和 sliding 太近，无法计算方向')
  return
}

const delta = dir.normalize().multiplyScalar(STEP * MOVE_DIRECTION)

// 1. sliding 沿液压杆方向平移
moveWorld(sliding, delta)

node.updateWorldMatrix(true, true)

const B1 = pos(sliding)
const newAngle = angleYZ(C, B1)
const angleDelta = newAngle - oldAngle

// 2. 记录 fixed 旋转前位置，用来给 sliding 补高度变化
const fixedBefore = pos(fixed)

// 3. driving / fixed / sliding 都做角度变化
driving.rotation.x += angleDelta * DRIVING_ROTATE_RATIO
fixed.rotation.x += angleDelta * HYDRAULIC_ROTATE_RATIO
// sliding.rotation.x += angleDelta * HYDRAULIC_ROTATE_RATIO
//sliding.lookAt(pos(driving))
driving.updateMatrix()
driving.updateWorldMatrix(true, true)

fixed.updateMatrix()
fixed.updateWorldMatrix(true, true)
const slidingAngle = angleYZ(pos(sliding), pos(driving))

if (sliding.userData.flap1AngleOffset === undefined) {
  sliding.userData.flap1AngleOffset = sliding.rotation.x - slidingAngle
}

sliding.rotation.x = slidingAngle + sliding.userData.flap1AngleOffset
sliding.updateMatrix()
sliding.updateWorldMatrix(true, true)

// 4. sliding 额外跟随 fixed 的高度变化
const fixedAfter = pos(fixed)
const liftDelta = fixedAfter
  .clone()
  .sub(fixedBefore)
  .multiplyScalar(SLIDING_LIFT_RATIO)

moveWorld(sliding, liftDelta)

node.updateWorldMatrix(true, true)

console.log('flap1 hydraulic 动作完成', {
  angleDeltaDeg: angleDelta * 180 / Math.PI,
  liftDelta,
})
