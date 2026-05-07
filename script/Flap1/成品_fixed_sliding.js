const STEP = 0.01
const MOVE_DIRECTION = 1
const AObject = node.getObjectByName('flap1_driving_shaft')
const BObject = node.getObjectByName('flap1_hydraulic_fixed')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft')

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

function getTriangle() {
  node.updateWorldMatrix(true, true)
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const C = CObject.getWorldPosition(new THREE.Vector3())
  const AB = A.distanceTo(B)
  const AC = A.distanceTo(C)
  const BC = B.distanceTo(C)
  const angleA = Math.acos(
    (AB * AB + AC * AC - BC * BC) / (2 * AB * AC)
  )
  const angleB = Math.acos(
    (AB * AB + BC * BC - AC * AC) / (2 * AB * BC)
  )
  const angleC = Math.acos(
    (AC * AC + BC * BC - AB * AB) / (2 * AC * BC)
  )
  return {
    A,
    B,
    C,
    AB,
    AC,
    BC,
    angleA,
    angleB,
    angleC,
  }
}

const before = getTriangle()

const beforeBToCAngle = angleOnYZPlane(before.B, before.C)

const nextBC = before.BC + STEP * MOVE_DIRECTION

const nextAngleA = Math.acos(
  (before.AB * before.AB +
    before.AC * before.AC -
    nextBC * nextBC) /
    (2 * before.AB * before.AC)
)

const angleDeltaA = nextAngleA - before.angleA

AObject.rotation.x += angleDeltaA
AObject.updateMatrix()
AObject.updateWorldMatrix(true, true)

const ACVector = before.C.clone().sub(before.A)

const nextC = ACVector
  .applyAxisAngle(new THREE.Vector3(1, 0, 0), angleDeltaA)
  .add(before.A)

setWorldPosition(CObject, nextC)

const middle = getTriangle()

const afterBToCAngle = angleOnYZPlane(middle.B, middle.C)
const angleDeltaB = afterBToCAngle - beforeBToCAngle

BObject.rotation.x += angleDeltaB
BObject.updateMatrix()
BObject.updateWorldMatrix(true, true)

CObject.rotation.x += angleDeltaB
CObject.updateMatrix()
CObject.updateWorldMatrix(true, true)

node.updateWorldMatrix(true, true)

const after = getTriangle()
