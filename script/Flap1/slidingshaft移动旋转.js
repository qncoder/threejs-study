// 脚本只对 flap1_driving_shaft flap1_hydraulic_slidingshaft flap1_hydraulic_fixed 做
const STEP = 0.01
const MOVE_DIRECTION = 1

const DRIVING_ROTATE_RATIO = 1
const HYDRAULIC_ROTATE_RATIO = 0.15

const findNode = (name) => node.children.find((n) => n.name === name)
const pos = (obj) => obj.getWorldPosition(new THREE.Vector3())

const fixed = findNode('flap1_hydraulic_fixed')
const sliding = findNode('flap1_hydraulic_slidingshaft')
const driving = findNode('flap1_driving_shaft')

if (!fixed || !sliding || !driving) {
  console.warn('缺少节点', { fixed, sliding, driving })
  return
}

function angleYZ(from, to) {
  return Math.atan2(to.z - from.z, to.y - from.y)
}

function normalizeAngleDelta(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

function setWorldPosition(obj, worldPos) {
  const p = worldPos.clone()

  obj.parent.updateWorldMatrix(true, true)
  obj.parent.worldToLocal(p)
  obj.position.copy(p)

  obj.updateMatrix()
  obj.updateWorldMatrix(true, true)
}

function moveWorld(obj, delta) {
  setWorldPosition(obj, pos(obj).add(delta))
}

function syncWorldRotation(source, target, offsetKey) {
  node.updateWorldMatrix(true, true)

  const sourceWorldQ = source.getWorldQuaternion(new THREE.Quaternion())
  const targetWorldQ = target.getWorldQuaternion(new THREE.Quaternion())

  if (target.userData[offsetKey] === undefined) {
    target.userData[offsetKey] = sourceWorldQ.clone().invert().multiply(targetWorldQ)
  }

  const wantedWorldQ = sourceWorldQ.clone().multiply(target.userData[offsetKey])

  const parentWorldQ = target.parent.getWorldQuaternion(new THREE.Quaternion())
  const localQ = parentWorldQ.clone().invert().multiply(wantedWorldQ)

  target.quaternion.copy(localQ)
  target.updateMatrix()
  target.updateWorldMatrix(true, true)
}

function getFixedAxisWorld() {
  node.updateWorldMatrix(true, true)

  if (!fixed.userData.flap1HydraulicAxisLocal) {
    const fixedWorld = pos(fixed)
    const slidingWorld = pos(sliding)

    const axisWorldPoint = slidingWorld.clone()
    fixed.worldToLocal(axisWorldPoint)

    fixed.userData.flap1HydraulicAxisLocal = axisWorldPoint.clone().normalize()
  }

  const fixedWorld = pos(fixed)

  const axisEndWorld = fixed.userData.flap1HydraulicAxisLocal.clone().multiplyScalar(1)

  fixed.localToWorld(axisEndWorld)

  return axisEndWorld.sub(fixedWorld).normalize()
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

// 1. sliding 沿液压杆方向伸缩
const delta = dir.normalize().multiplyScalar(STEP * MOVE_DIRECTION)
moveWorld(sliding, delta)

node.updateWorldMatrix(true, true)

const B1 = pos(sliding)
const newAngle = angleYZ(C, B1)
const angleDelta = normalizeAngleDelta(newAngle - oldAngle)

// 2. 记录当前 fixed 到 sliding 的距离
const slidingDistance = pos(sliding).distanceTo(pos(fixed))

// 3. driving / fixed 旋转
driving.rotation.x += angleDelta * DRIVING_ROTATE_RATIO
fixed.rotation.x += angleDelta * HYDRAULIC_ROTATE_RATIO

driving.updateMatrix()
driving.updateWorldMatrix(true, true)

fixed.updateMatrix()
fixed.updateWorldMatrix(true, true)

// 4. 把 sliding 重新放回 fixed 当前轴线上
const fixedWorld = pos(fixed)
const axisWorld = getFixedAxisWorld()
const wantedSlidingWorld = fixedWorld.clone().add(axisWorld.multiplyScalar(slidingDistance))

setWorldPosition(sliding, wantedSlidingWorld)

// 5. sliding 的世界旋转跟 fixed 保持一致
syncWorldRotation(fixed, sliding, 'flap1FixedWorldRotationOffset')

node.updateWorldMatrix(true, true)

console.log('flap1 hydraulic 动作完成', {
  angleDeltaDeg: (angleDelta * 180) / Math.PI,
  fixedRotationXDeg: (fixed.rotation.x * 180) / Math.PI,
  slidingRotationXDeg: (sliding.rotation.x * 180) / Math.PI,
  slidingDistance,
})

// 改进版
const method2 = () => {
  // 脚本只对 flap1_driving_shaft flap1_hydraulic_slidingshaft flap1_hydraulic_fixed 做
  const STEP = 0.01
  const MOVE_DIRECTION = 1

  const DRIVING_ROTATE_RATIO = 1.6
  const HYDRAULIC_ROTATE_RATIO = 0.18

  const findNode = (name) => node.children.find((n) => n.name === name)
  const pos = (obj) => obj.getWorldPosition(new THREE.Vector3())

  const fixed = findNode('flap1_hydraulic_fixed')
  const sliding = findNode('flap1_hydraulic_slidingshaft')
  const driving = findNode('flap1_driving_shaft')

  if (!fixed || !sliding || !driving) {
    console.warn('缺少节点', { fixed, sliding, driving })
    return
  }

  function angleYZ(from, to) {
    return Math.atan2(to.z - from.z, to.y - from.y)
  }

  function normalizeAngleDelta(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2
    while (angle < -Math.PI) angle += Math.PI * 2
    return angle
  }

  function setWorldPosition(obj, worldPos) {
    const p = worldPos.clone()

    obj.parent.updateWorldMatrix(true, true)
    obj.parent.worldToLocal(p)
    obj.position.copy(p)

    obj.updateMatrix()
    obj.updateWorldMatrix(true, true)
  }

  function moveWorld(obj, delta) {
    setWorldPosition(obj, pos(obj).add(delta))
  }

  function syncWorldRotation(source, target, offsetKey) {
    node.updateWorldMatrix(true, true)

    const sourceWorldQ = source.getWorldQuaternion(new THREE.Quaternion())
    const targetWorldQ = target.getWorldQuaternion(new THREE.Quaternion())

    if (target.userData[offsetKey] === undefined) {
      target.userData[offsetKey] = sourceWorldQ.clone().invert().multiply(targetWorldQ)
    }

    const wantedWorldQ = sourceWorldQ.clone().multiply(target.userData[offsetKey])

    const parentWorldQ = target.parent.getWorldQuaternion(new THREE.Quaternion())
    const localQ = parentWorldQ.clone().invert().multiply(wantedWorldQ)

    target.quaternion.copy(localQ)
    target.updateMatrix()
    target.updateWorldMatrix(true, true)
  }

  function getFixedAxisWorld() {
    node.updateWorldMatrix(true, true)

    if (!fixed.userData.flap1HydraulicAxisLocal) {
      const fixedWorld = pos(fixed)
      const slidingWorld = pos(sliding)

      const axisWorldPoint = slidingWorld.clone()
      fixed.worldToLocal(axisWorldPoint)

      fixed.userData.flap1HydraulicAxisLocal = axisWorldPoint.clone().normalize()
    }

    const fixedWorld = pos(fixed)

    const axisEndWorld = fixed.userData.flap1HydraulicAxisLocal.clone().multiplyScalar(1)

    fixed.localToWorld(axisEndWorld)

    return axisEndWorld.sub(fixedWorld).normalize()
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

  // 1. sliding 沿液压杆方向伸缩
  const delta = dir.normalize().multiplyScalar(STEP * MOVE_DIRECTION)
  moveWorld(sliding, delta)

  node.updateWorldMatrix(true, true)

  const B1 = pos(sliding)
  const newAngle = angleYZ(C, B1)
  const angleDelta = normalizeAngleDelta(newAngle - oldAngle)

  // 2. 记录当前 fixed 到 sliding 的距离
  const slidingDistance = pos(sliding).distanceTo(pos(fixed))

  // 3. driving / fixed 旋转
  driving.rotation.x += angleDelta * DRIVING_ROTATE_RATIO
  fixed.rotation.x += angleDelta * HYDRAULIC_ROTATE_RATIO

  driving.updateMatrix()
  driving.updateWorldMatrix(true, true)

  fixed.updateMatrix()
  fixed.updateWorldMatrix(true, true)

  // 4. 把 sliding 重新放回 fixed 当前轴线上
  const fixedWorld = pos(fixed)
  const axisWorld = getFixedAxisWorld()
  const wantedSlidingWorld = fixedWorld.clone().add(axisWorld.multiplyScalar(slidingDistance))

  setWorldPosition(sliding, wantedSlidingWorld)

  // 5. sliding 的世界旋转跟 fixed 保持一致
  syncWorldRotation(fixed, sliding, 'flap1FixedWorldRotationOffset')

  node.updateWorldMatrix(true, true)

  console.log('flap1 hydraulic 动作完成', {
    angleDeltaDeg: (angleDelta * 180) / Math.PI,
    fixedRotationXDeg: (fixed.rotation.x * 180) / Math.PI,
    slidingRotationXDeg: (sliding.rotation.x * 180) / Math.PI,
    slidingDistance,
  })
}
