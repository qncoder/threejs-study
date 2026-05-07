/*
  flap1 液压杆联动脚本（简化注释版）

  作用范围：
  - flap1_hydraulic_fixed：液压杆固定端
  - flap1_hydraulic_slidingshaft：液压杆伸缩端
  - flap1_driving_shaft：被液压杆带动旋转的轴

  大致流程：
  1. 让伸缩端 sliding 朝固定端 fixed 移动一小步；
  2. 根据 sliding 移动前后的角度变化，带动 driving 和 fixed 旋转；
  3. fixed 旋转后，把 sliding 重新放回 fixed 当前的轴线上；
  4. 让 sliding 的世界旋转继续跟 fixed 保持一致。
*/

// 每次运行时，sliding 移动的距离。数值越大，动作越快。
const STEP = 0.01

// 如果移动方向反了，把 1 改成 -1。
const MOVE_DIRECTION = 1

// driving 跟随角度变化的比例。
// 原文件直接执行的版本是 1；如果想用原文件 method2 的效果，可以改成 1.6。
const DRIVING_ROTATE_RATIO = 1.6

// fixed 跟随角度变化的比例。
// 原文件直接执行的版本是 0.15；如果想用原文件 method2 的效果，可以改成 0.18。
const FIXED_ROTATE_RATIO = 0.17

const ROTATION_OFFSET_KEY = 'flap1FixedWorldRotationOffset'
const AXIS_CACHE_KEY = 'flap1HydraulicAxisLocal'

const findNode = name => node.children.find(child => child.name === name)
const worldPosition = object => object.getWorldPosition(new THREE.Vector3())
const radToDeg = rad => (rad * 180) / Math.PI

const fixed = findNode('flap1_hydraulic_fixed_pos')
const sliding = findNode('flap1_hydraulic_slidingshaft_pos')
const driving = findNode('flap1_driving_shaft')

if (!fixed || !sliding || !driving) {
  console.warn('缺少 flap1 液压杆相关节点', { fixed, sliding, driving })
  return
}

// 在 YZ 平面上看两个点之间的角度。
// 这里用它判断 sliding 移动后，driving 需要补多少 X 轴旋转。
function angleOnYZPlane(from, to) {
  return Math.atan2(to.z - from.z, to.y - from.y)
}

// 把角度差限制在 -180 度到 180 度之间，避免跨过边界时突然转一大圈。
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

// 直接设置物体的世界坐标。
// Three.js 里 position 是相对父级的坐标，所以要先把世界坐标转成父级坐标。
function setWorldPosition(object, targetWorldPosition) {
  const localPosition = targetWorldPosition.clone()

  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(localPosition)
  object.position.copy(localPosition)

  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

function moveInWorld(object, worldDelta) {
  setWorldPosition(object, worldPosition(object).add(worldDelta))
}

// 让 target 的世界旋转跟 source 保持一致，同时保留第一次运行时两者原本的旋转差。
function keepWorldRotationOffset(source, target, offsetKey) {
  node.updateWorldMatrix(true, true)

  const sourceWorldQ = source.getWorldQuaternion(new THREE.Quaternion())
  const targetWorldQ = target.getWorldQuaternion(new THREE.Quaternion())

  if (!target.userData[offsetKey]) {
    target.userData[offsetKey] = sourceWorldQ.clone().invert().multiply(targetWorldQ)
  }

  const wantedWorldQ = sourceWorldQ.clone().multiply(target.userData[offsetKey])
  const parentWorldQ = target.parent.getWorldQuaternion(new THREE.Quaternion())
  const wantedLocalQ = parentWorldQ.clone().invert().multiply(wantedWorldQ)

  target.quaternion.copy(wantedLocalQ)
  target.updateMatrix()
  target.updateWorldMatrix(true, true)
}

// fixed 本身会旋转，所以要记录一条“在 fixed 本地坐标里的轴线”。
// 后面每次都把这条轴线换算回世界坐标，用来重新摆放 sliding。
function getFixedAxisInWorld() {
  node.updateWorldMatrix(true, true)

  if (!fixed.userData[AXIS_CACHE_KEY]) {
    const slidingWorld = worldPosition(sliding)
    const slidingInFixedLocal = slidingWorld.clone()

    fixed.worldToLocal(slidingInFixedLocal)
    fixed.userData[AXIS_CACHE_KEY] = slidingInFixedLocal.normalize()
  }

  const fixedWorld = worldPosition(fixed)
  const axisEndWorld = fixed.userData[AXIS_CACHE_KEY].clone()

  fixed.localToWorld(axisEndWorld)
  return axisEndWorld.sub(fixedWorld).normalize()
}

function runFlap1HydraulicAction() {
  node.updateWorldMatrix(true, true)

  const fixedBefore = worldPosition(fixed)
  const slidingBefore = worldPosition(sliding)
  const drivingWorld = worldPosition(driving)

  const angleBefore = angleOnYZPlane(drivingWorld, slidingBefore)

  // sliding 朝 fixed 的方向移动一小步，模拟液压杆伸缩。
  const moveDirection = fixedBefore.clone().sub(slidingBefore)
  if (moveDirection.lengthSq() < 1e-12) {
    console.warn('fixed 和 sliding 太近，无法计算移动方向')
    return
  }

  const moveDelta = moveDirection
    .normalize()
    .multiplyScalar(STEP * MOVE_DIRECTION)

  moveInWorld(sliding, moveDelta)
  node.updateWorldMatrix(true, true)

  // 对比移动前后的角度，得到这次需要旋转多少。
  const slidingAfterMove = worldPosition(sliding)
  const angleAfter = angleOnYZPlane(drivingWorld, slidingAfterMove)
  const angleDelta = normalizeAngle(angleAfter - angleBefore)

  // 先记住 fixed 到 sliding 的距离。
  // fixed 转完以后，sliding 还要保持这个距离放回 fixed 轴线上。
  const slidingDistance = worldPosition(sliding).distanceTo(worldPosition(fixed))

  driving.rotation.x += angleDelta * DRIVING_ROTATE_RATIO
  fixed.rotation.x += angleDelta * FIXED_ROTATE_RATIO

  driving.updateMatrix()
  driving.updateWorldMatrix(true, true)
  fixed.updateMatrix()
  fixed.updateWorldMatrix(true, true)

  // fixed 转过以后，重新计算它当前在世界坐标里的轴线，并把 sliding 放到轴线上。
  const fixedWorld = worldPosition(fixed)
  const fixedAxisWorld = getFixedAxisInWorld()
  const wantedSlidingWorld = fixedWorld.add(
    fixedAxisWorld.multiplyScalar(slidingDistance)
  )

  setWorldPosition(sliding, wantedSlidingWorld)
  keepWorldRotationOffset(fixed, sliding, ROTATION_OFFSET_KEY)

  node.updateWorldMatrix(true, true)

  console.log('flap1 液压杆动作完成', {
    angleDeltaDeg: radToDeg(angleDelta),
    fixedRotationXDeg: radToDeg(fixed.rotation.x),
    slidingRotationXDeg: radToDeg(sliding.rotation.x),
    slidingDistance,
  })
}

runFlap1HydraulicAction()
