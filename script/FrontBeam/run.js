const STEP = 0.01
const MOVE_DIRECTION = 1 //控制正反方向 1 收缩 -1 伸展
const AObject = node.getObjectByName('frontbeam_pos')
const BObject = node.getObjectByName('frontbeam_hydraulic_fixed_pos')
const CObject = node.getObjectByName('frontbeam_hydraulic_slidingshaft_pos')
function customQuaternionLookAt(object, target) {
  const q = new THREE.Quaternion().setFromUnitVectors(
    object.getWorldDirection(new THREE.Vector3()), // 当前视线方向（世界系）
    target.clone().sub(object.getWorldPosition(new THREE.Vector3())).normalize() // 目标视线方向（世界系）
  )
  object.quaternion.premultiply(q)
}

function setWorldPosition(object, targetWorldPosition) {
  const localPosition = targetWorldPosition.clone()
  if(!localPosition || isNaN(localPosition.x) || isNaN(localPosition.y) || isNaN(localPosition.z)) return
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
console.log('Init', Init)
const getPointC = (BC) => {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const initC = InitC.clone()

  const minBC = Math.abs(Init.AB - Init.AC)
  const maxBC = Init.AB + Init.AC
  const safeBC = BC || THREE.MathUtils.clamp(BC, minBC, maxBC)


  const angleB = Math.acos((Init.AB * Init.AB + safeBC * safeBC - Init.AC * Init.AC) / (2 * Init.AB * safeBC))
  const BAUnit = A.clone().sub(B).normalize()
  const BCInitUnit = initC.clone().sub(B).normalize()

  const axis = new THREE.Vector3()
    .crossVectors(BAUnit, BCInitUnit)
    .normalize()

  if (axis.lengthSq() === 0) return initC

  return BAUnit
    .applyAxisAngle(axis, angleB)
    .multiplyScalar(safeBC)
    .add(B)
}
const InitC = CObject.getWorldPosition(new THREE.Vector3())
const nextBC = Init.BC - STEP * MOVE_DIRECTION
const C = getPointC(nextBC)
setWorldPosition(CObject, C)
node.updateWorldMatrix(true, true)
node.updateMatrix()

customQuaternionLookAt(BObject, CObject.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(CObject, BObject.getWorldPosition(new THREE.Vector3()))
customQuaternionLookAt(AObject, CObject.getWorldPosition(new THREE.Vector3()))
