const STEP = 0.01
const MOVE_DIRECTION = 1
const ROTATE_AXIS = new THREE.Vector3(1, 0, 0)
const AObject = node.getObjectByName('flap1_driving_shaft_pos')
const BObject = node.getObjectByName('flap1_hydraulic_fixed_pos')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
const DObject = node.getObjectByName('flap1_output_shaft_pos')
const EObject = node.getObjectByName('flap1_pos')
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

const Init = getTriangle()
function getTriangle() {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const C = CObject.getWorldPosition(new THREE.Vector3())
  const D = DObject.getWorldPosition(new THREE.Vector3())
  const E = EObject.getWorldPosition(new THREE.Vector3())
  return {
    AB: A.distanceTo(B),
    AC: A.distanceTo(C),
    BC: B.distanceTo(C),
    DC: D.distanceTo(C),
    DE: D.distanceTo(E),
  }
}
function getPointC(BC) {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const cosB = (Init.AB * Init.AB + BC * BC - Init.AC * Init.AC) / (2 * Init.AB * BC)
  const angleB = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1))
  //顺时针旋转为负，逆时针为正
  const BAUnit = A.clone().sub(B).normalize() //获取向量ba的标准向量
  const pointC = BAUnit.applyAxisAngle(ROTATE_AXIS, angleB)
    .multiplyScalar(BC)
    .add(B)
  return pointC
}

function getPointD(C) {
  const E = EObject.getWorldPosition(new THREE.Vector3())
  const CE = C.distanceTo(E)
  const cosE = (Init.DE * Init.DE + CE * CE - Init.DC * Init.DC) / (2 * Init.DE * CE)
  const angleE = Math.acos(THREE.MathUtils.clamp(cosE, -1, 1))
  //顺时针旋转为负，逆时针为正
  const ECUnit = C.clone().sub(E).normalize() //获取向量ba的标准向量
  const pointD = ECUnit.applyAxisAngle(ROTATE_AXIS, -angleE)
    .multiplyScalar(Init.DE)
    .add(E)
  return pointD
}

function getSignedAngle(fromVector, toVector) {
  const from = fromVector.clone().normalize()
  const to = toVector.clone().normalize()
  const cross = new THREE.Vector3().crossVectors(from, to)
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1)
  return Math.atan2(ROTATE_AXIS.dot(cross), dot)
}

const InitD = DObject.getWorldPosition(new THREE.Vector3())
const InitE = EObject.getWorldPosition(new THREE.Vector3())
const InitEDVector = InitD.clone().sub(InitE)
const InitEWorldQuaternion = EObject.getWorldQuaternion(new THREE.Quaternion())
const nextBC = Init.BC - STEP * MOVE_DIRECTION
const C = getPointC(nextBC)
setWorldPosition(CObject, C)
const D = getPointD(C)
setWorldPosition(DObject, D)

const nextEDVector = D.clone().sub(InitE)
const deltaAngle = getSignedAngle(InitEDVector, nextEDVector)
const rotateDelta = new THREE.Quaternion().setFromAxisAngle(ROTATE_AXIS, deltaAngle)
const nextEWorldQuaternion = rotateDelta.multiply(InitEWorldQuaternion)
setWorldQuaternion(EObject, nextEWorldQuaternion)
setWorldPosition(EObject, InitE)

node.updateWorldMatrix(true, true)
node.updateMatrix()
CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
