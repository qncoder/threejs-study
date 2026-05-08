// 接着执行这个脚本 （mesh已经放入Object3d 当中）
const STEP = 0.01
const MOVE_DIRECTION = 1
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

const Init = getTriangle()
function getTriangle() {
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
  const angleB = Math.acos((Init.AB * Init.AB + BC * BC - Init.AC * Init.AC) / (2 * Init.AB * BC))
  //顺时针旋转为正，逆时针为负
  const BAUnit = A.clone().sub(B).normalize() //获取向量ba的标准向量
  const pointC = BAUnit.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleB)
    .multiplyScalar(nextBC)
    .add(B)
  return pointC
}
const InitC = CObject.getWorldPosition(new THREE.Vector3())
const InitD = DObject.getWorldPosition(new THREE.Vector3())
const InitE = EObject.getWorldPosition(new THREE.Vector3())
const DCVector = InitD.clone().sub(InitC)
const nextBC = Init.BC - STEP*MOVE_DIRECTION
const C = getPointC(nextBC)
setWorldPosition(CObject, C)
const D = C.clone().add(DCVector)
setWorldPosition(DObject, D)

node.updateWorldMatrix(true, true)
node.updateMatrix()
CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
EObject.lookAt(DObject.getWorldPosition(new THREE.Vector3()))
