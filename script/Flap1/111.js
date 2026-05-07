
const STEP = 0.01
const MOVE_DIRECTION = 1
const AObject = node.getObjectByName('flap1_driving_shaft')
const BObject = node.getObjectByName('flap1_hydraulic_fixed')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft')
const DObject = node.getObjectByName('flap1_output_shaft')
const flap1 = node.getObjectByName('flap1')
const slidingshaft_pos = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
const fixed_pos = node.getObjectByName('flap1_hydraulic_fixed_pos')
const slidingshaft = slidingshaft_pos.getWorldPosition(new THREE.Vector3())
const fixed = fixed_pos.getWorldPosition(new THREE.Vector3())
function setWorldPosition(object, targetWorldPosition) {
  const localPosition = targetWorldPosition.clone()
  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(localPosition)
  object.position.copy(localPosition)
  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}



function angleOnYZPlane(from, to) {
  return Math.atan2(to.z - from.z, to.y - from.y)
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

function getTriangle() {
  node.updateWorldMatrix(true, true)
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const C = CObject.getWorldPosition(new THREE.Vector3())
  const AB = A.distanceTo(B)
  const AC = A.distanceTo(C)
  const BC = B.distanceTo(C)
   console.log('C',A.distanceTo(C))
  node.updateWorldMatrix(true, true)
  return { AB, AC, BC }
}
function UpdatePoint() {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())

  return { A, B }
}

function getPointC(lenthBC) {
console.log(lenthBC)
  node.updateWorldMatrix(true, true)
  const { A, B } = UpdatePoint()
  const BC = lenthBC
  const angleB = Math.acos((Init.AB * Init.AB + BC * BC - Init.AC * Init.AC) / (2 * Init.AB * BC))
  //顺时针旋转为正，逆时针为负
  const angleBSign = 1
  const BAUnit = A.clone().sub(B).normalize() //获取向量ba的标准向量
  const pointC = BAUnit.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleB * angleBSign)
    .multiplyScalar(nextBC)
    .add(B)
  return pointC
}

const Init = getTriangle()

const nextBC = Init.BC - STEP
console.log(nextBC )
const C = getPointC(nextBC)

setWorldPosition(CObject, C)

fixed_pos.lookAt(slidingshaft)
slidingshaft_pos.lookAt(fixed)
