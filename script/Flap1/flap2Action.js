const STEP = 0.01
const ACTION_SCALE = 0.2

const SLIDE_RATIO = 1
const OUTPUT_AROUND_DEG = 0.1
const OUTPUT_SELF_DEG = 2.4 * 1.6
const FLAP_DEG = 2 * 1.8

const findNode = name => node.children.find(n => n.name === name)

const fixed = findNode('flap1_hydraulic_fixed')
const sliding = findNode('flap1_hydraulic_slidingshaft')
const pivot = findNode('flap1_pivot')
const flap1 = findNode('flap1')
const output = findNode('flap1_output_shaft')

if (!fixed || !sliding || !pivot || !flap1 || !output) {
  console.warn('缺少节点', { fixed, sliding, pivot, flap1, output })
  return
}

function centerOf(object) {
  return new THREE.Box3()
    .setFromObject(object)
    .getCenter(new THREE.Vector3())
}

function moveWorld(object, delta) {
  const p = object.getWorldPosition(new THREE.Vector3()).add(delta)

  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(p)
  object.position.copy(p)

  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

function rotateAroundPivot(object, pivotWorld, moveDeg, selfDeg) {
  const axis = new THREE.Vector3(1, 0, 0).normalize()
  const moveQ = new THREE.Quaternion().setFromAxisAngle(axis, deg(moveDeg))
  const selfQ = new THREE.Quaternion().setFromAxisAngle(axis, deg(selfDeg))

  const p = object.getWorldPosition(new THREE.Vector3())
  p.sub(pivotWorld).applyQuaternion(moveQ).add(pivotWorld)

  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(p)
  object.position.copy(p)

  object.quaternion.premultiply(selfQ)

  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

node.updateWorldMatrix(true, true)

const dir = centerOf(fixed)
  .sub(centerOf(sliding))
  .normalize()

const delta = dir.multiplyScalar(STEP * ACTION_SCALE * SLIDE_RATIO)

moveWorld(sliding, delta)
moveWorld(pivot, delta)

node.updateWorldMatrix(true, true)

rotateAroundPivot(
  output,
  pivot.getWorldPosition(new THREE.Vector3()),
  OUTPUT_AROUND_DEG * ACTION_SCALE,
  OUTPUT_SELF_DEG * ACTION_SCALE
)

console.log(deg(FLAP_DEG * ACTION_SCALE))
flap1.rotation.x += deg(FLAP_DEG * ACTION_SCALE)
console.log(flap1.rotation.x)
flap1.updateMatrix()
flap1.updateWorldMatrix(true, true)

node.updateWorldMatrix(true, true)
