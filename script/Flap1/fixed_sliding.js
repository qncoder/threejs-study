const STEP = 0.01
const MOVE_DIRECTION = 1
const AObject = node.getObjectByName('flap1_driving_shaft')
const BObject = node.getObjectByName('flap1_hydraulic_fixed')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft')
const DObject = node.getObjectByName('flap1_output_shaft')
const flap1 = node.getObjectByName('flap1')

function setWorldPosition(object, targetWorldPosition) {
  const localPosition = targetWorldPosition.clone()
  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(localPosition)
  object.position.copy(localPosition)
  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

function rotateAroundWorldPoint(object, pivotWorld, angle) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle)
  const worldPosition = object.getWorldPosition(new THREE.Vector3())

  worldPosition.sub(pivotWorld).applyQuaternion(q).add(pivotWorld)
  setWorldPosition(object, worldPosition)

  const currentWorldQ = object.getWorldQuaternion(new THREE.Quaternion())
  const wantedWorldQ = q.clone().multiply(currentWorldQ)
  const parentWorldQ = object.parent
    ? object.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion()

  object.quaternion.copy(parentWorldQ.clone().invert().multiply(wantedWorldQ))
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
  const angleA = Math.acos((AB * AB + AC * AC - BC * BC) / (2 * AB * AC))
  const angleB = Math.acos((AB * AB + BC * BC - AC * AC) / (2 * AB * BC))
  const angleC = Math.acos((AC * AC + BC * BC - AB * AB) / (2 * AC * BC))
  return { A, B, C, AB, AC, BC, angleA, angleB, angleC }
}

const before = getTriangle()

const beforeAToCAngle = angleOnYZPlane(before.A, before.C)
const beforeBToCAngle = angleOnYZPlane(before.B, before.C)
const beforeBToAAngle = angleOnYZPlane(before.B, before.A)

const nextBC = before.BC + STEP * MOVE_DIRECTION
const nextAngleB = Math.acos(
  (before.AB * before.AB + nextBC * nextBC - before.AC * before.AC) / (2 * before.AB * nextBC)
)
const angleBSign = normalizeAngle(beforeBToCAngle - beforeBToAAngle) >= 0 ? 1 : -1
const BAUnit = before.A
  .clone()
  .sub(before.B)
  .normalize()
const nextC = BAUnit
  .applyAxisAngle(new THREE.Vector3(1, 0, 0), nextAngleB * angleBSign)
  .multiplyScalar(nextBC)
  .add(before.B)

setWorldPosition(CObject, nextC)

const moved = getTriangle()
const afterAToCAngle = angleOnYZPlane(moved.A, moved.C)
const angleDeltaA = normalizeAngle(afterAToCAngle - beforeAToCAngle)

AObject.rotation.x += angleDeltaA
AObject.updateMatrix()
AObject.updateWorldMatrix(true, true)

if (flap1) {
  rotateAroundWorldPoint(flap1, before.A, angleDeltaA)
}

const afterBToCAngle = angleOnYZPlane(moved.B, moved.C)
const angleDeltaB = normalizeAngle(afterBToCAngle - beforeBToCAngle)

BObject.rotation.x += angleDeltaB
// BObject.updateMatrix()
// BObject.updateWorldMatrix(true, true)

CObject.rotation.x += angleDeltaB
// CObject.updateMatrix()
// CObject.updateWorldMatrix(true, true)
DObject.rotation.x += angleDeltaB
node.updateWorldMatrix(true, true)

const after = getTriangle()
