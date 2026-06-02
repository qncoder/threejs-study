// 接着执行这个脚本 （mesh已经放入Object3d 当中）
const STEP = 0.01
const MOVE_DIRECTION = 1
const AObject = node.getObjectByName('flap1_driving_shaft_pos')
const BObject = node.getObjectByName('flap1_hydraulic_fixed_pos')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
const DObject = node.getObjectByName('flap1_output_shaft_pos')
const EObject = node.getObjectByName('flap1_pos')
console.log(AObject, BObject, CObject, DObject, EObject)
function setWorldPosition(object, targetWorldPosition) {
  const localPosition = targetWorldPosition.clone()
  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(localPosition)
  object.position.copy(localPosition)
}
function customQuaternionLookAt(object, target) {
  const q = new THREE.Quaternion().setFromUnitVectors(
    object.getWorldDirection(new THREE.Vector3()), // 当前视线方向（世界系）
    target.clone().sub(object.getWorldPosition(new THREE.Vector3())).normalize() // 目标视线方向（世界系）
  )
  object.quaternion.premultiply(q)
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
  const angleB = Math.acos((Init.AB * Init.AB + BC * BC - Init.AC * Init.AC) / (2 * Init.AB * BC))
  //顺时针旋转为负，逆时针为正
  const BAUnit = A.clone().sub(B).normalize() //获取向量ba的标准向量
  const pointC = BAUnit.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleB*1)
    .multiplyScalar(nextBC)
    .add(B)
  return pointC
}

function getPointD(C) {
  const E = EObject.getWorldPosition(new THREE.Vector3())
  const CE = C.distanceTo(E)
  const angleE = Math.acos((Init.DE * Init.DE + CE * CE - Init.DC * Init.DC) / (2 * Init.DE * CE))
  //顺时针旋转为负，逆时针为正
  const ECUnit = C.clone().sub(E).normalize() //获取向量ba的标准向量
  const pointD = ECUnit.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleE*-1)
    .multiplyScalar(Init.DE)
    .add(E)
  return pointD
}
const InitC = CObject.getWorldPosition(new THREE.Vector3())
const InitD = DObject.getWorldPosition(new THREE.Vector3())
const InitE = EObject.getWorldPosition(new THREE.Vector3())
const DCVector = InitD.clone().sub(InitC)
const nextBC = Init.BC - STEP * MOVE_DIRECTION
const C = getPointC(nextBC)
setWorldPosition(CObject, C)
const D = getPointD(C)
setWorldPosition(DObject, D)

node.updateWorldMatrix(true, true)
node.updateMatrix()
CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
// EObject.lookAt(DObject.getWorldPosition(new THREE.Vector3()))

customQuaternionLookAt(EObject,DObject.getWorldPosition(new THREE.Vector3()))
