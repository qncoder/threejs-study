const STEP = 0.01
const MOVE_DIRECTION = 1
const FRAME_INTERVAL = 16

// BC 行程限位，按你的模型实际距离调整
const MIN_BC = 0.35
const MAX_BC = 1.2

const ROTATE_AXIS = new THREE.Vector3(1, 0, 0)

if (node.userData.flap1AnimationId) {
  cancelAnimationFrame(node.userData.flap1AnimationId)
  node.userData.flap1AnimationId = 0
}

const AObject = node.getObjectByName('flap1_driving_shaft_pos')
const BObject = node.getObjectByName('flap1_hydraulic_fixed_pos')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
const DObject = node.getObjectByName('flap1_output_shaft_pos')
const EObject = node.getObjectByName('flap1')

if (!AObject) throw new Error('找不到 flap1_driving_shaft_pos')
if (!BObject) throw new Error('找不到 flap1_hydraulic_fixed_pos')
if (!CObject) throw new Error('找不到 flap1_hydraulic_slidingshaft_pos')
if (!DObject) throw new Error('找不到 flap1_output_shaft_pos')
if (!EObject) throw new Error('找不到 flap1')

function setWorldPosition(object, targetWorldPosition) {
  const localPosition = targetWorldPosition.clone()
  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(localPosition)
  object.position.copy(localPosition)
}

function setWorldQuaternion(object, targetWorldQuaternion) {
  const parentWorldQuaternion = new THREE.Quaternion()
  object.parent.updateWorldMatrix(true, true)
  object.parent.getWorldQuaternion(parentWorldQuaternion)
  object.quaternion.copy(parentWorldQuaternion.invert().multiply(targetWorldQuaternion))
}

function getTriangleABC() {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const C = CObject.getWorldPosition(new THREE.Vector3())

  return {
    AB: A.distanceTo(B),
    AC: A.distanceTo(C),
    BC: B.distanceTo(C),
  }
}

function getPointC(BC) {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())

  const cosB = (initABC.AB * initABC.AB + BC * BC - initABC.AC * initABC.AC) / (2 * initABC.AB * BC)
  const angleB = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1))
  const BAUnit = A.clone().sub(B).normalize()

  return BAUnit
    .applyAxisAngle(ROTATE_AXIS, angleB)
    .multiplyScalar(BC)
    .add(B)
}

function getPointD(C, E, CDLength, EDLength, oldD) {
  const EC = C.clone().sub(E)
  const ECLength = EC.length()

  if (ECLength <= 0.000001) return null
  if (ECLength > CDLength + EDLength || ECLength < Math.abs(EDLength - CDLength)) return null

  const ex = EC.clone().normalize()

  const x = (EDLength * EDLength - CDLength * CDLength + ECLength * ECLength) / (2 * ECLength)
  const h2 = EDLength * EDLength - x * x
  const h = Math.sqrt(Math.max(0, h2))

  const ey = new THREE.Vector3().crossVectors(ROTATE_AXIS, ex).normalize()
  const base = E.clone().add(ex.clone().multiplyScalar(x))

  const D1 = base.clone().add(ey.clone().multiplyScalar(h))
  const D2 = base.clone().add(ey.clone().multiplyScalar(-h))

  return D1.distanceTo(oldD) <= D2.distanceTo(oldD) ? D1 : D2
}

function getSignedAngle(fromVector, toVector) {
  const from = fromVector.clone().normalize()
  const to = toVector.clone().normalize()
  const cross = new THREE.Vector3().crossVectors(from, to)
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1)

  return Math.atan2(ROTATE_AXIS.dot(cross), dot)
}

function isDescendantOf(child, parent) {
  let current = child
  while (current) {
    if (current === parent) return true
    current = current.parent
  }
  return false
}

function stopAnimation() {
  if (node.userData.flap1AnimationId) {
    cancelAnimationFrame(node.userData.flap1AnimationId)
  }

  node.userData.flap1AnimationId = 0
}

const initABC = getTriangleABC()

const initC = CObject.getWorldPosition(new THREE.Vector3())
const initD = DObject.getWorldPosition(new THREE.Vector3())
const initE = EObject.getWorldPosition(new THREE.Vector3())

const initCDLength = initC.distanceTo(initD)
const initEDLength = initE.distanceTo(initD)
const initEDVector = initD.clone().sub(initE)
const initEWorldQuaternion = EObject.getWorldQuaternion(new THREE.Quaternion())

let currentBC = THREE.MathUtils.clamp(initABC.BC, MIN_BC, MAX_BC)
let lastD = initD.clone()
let lastFrameTime = 0

function applyFrame() {
  const nextBCRaw = currentBC - STEP * MOVE_DIRECTION
  const nextBC = THREE.MathUtils.clamp(nextBCRaw, MIN_BC, MAX_BC)

  // 已经到限位了，不再继续叠加
  if (nextBC === currentBC) {
    stopAnimation()
    return
  }

  currentBC = nextBC

  const nextC = getPointC(currentBC)
  const nextD = getPointD(nextC, initE, initCDLength, initEDLength, lastD)

  if (!nextD) {
    stopAnimation()
    return
  }

  setWorldPosition(CObject, nextC)
  node.updateWorldMatrix(true, true)

  const nextEDVector = nextD.clone().sub(initE)
  let deltaAngle = getSignedAngle(initEDVector, nextEDVector)

  // 如果 flap1_pos 转反了，把上一行改成：
  // let deltaAngle = -getSignedAngle(initEDVector, nextEDVector)

  const rotateDelta = new THREE.Quaternion().setFromAxisAngle(ROTATE_AXIS, deltaAngle)
  const nextEWorldQuaternion = rotateDelta.multiply(initEWorldQuaternion)

  setWorldQuaternion(EObject, nextEWorldQuaternion)
  setWorldPosition(EObject, initE)

  node.updateWorldMatrix(true, true)

  if (!isDescendantOf(DObject, EObject)) {
    setWorldPosition(DObject, nextD)
  }

  node.updateWorldMatrix(true, true)
  node.updateMatrix()

  CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
  BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
  AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))

  if (!isDescendantOf(DObject, EObject)) {
    DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
  }

  lastD = nextD.clone()

  // 这一帧刚好到限位，应用完后停止
  if (currentBC === MIN_BC || currentBC === MAX_BC) {
    stopAnimation()
  }
}

function animate(time) {
  if (!node.userData.flap1AnimationId) return

  if (time - lastFrameTime >= FRAME_INTERVAL) {
    lastFrameTime = time
    applyFrame()
  }

  if (node.userData.flap1AnimationId) {
    node.userData.flap1AnimationId = requestAnimationFrame(animate)
  }
}

node.userData.flap1AnimationId = requestAnimationFrame(animate)
