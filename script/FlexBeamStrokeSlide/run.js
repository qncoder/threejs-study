const AObject = node.getObjectByName('flexbeamstroke_hydraulic_fixed_pos')
const BObject = node.getObjectByName('flexbeamstroke_hydraulic_fixed_end')
const CObject = node.getObjectByName('flexbeamstroke_hydraulic_slidingshaft_pos')
const DObject = node.getObjectByName('frontdisstart1')
const EObject = node.getObjectByName('flexbeamstroke_pos')
const step = 0.01
const MOVE_DIRECTION = -1
const start = CObject.getWorldPosition(new THREE.Vector3())
const dir = AObject.getWorldPosition(new THREE.Vector3()).sub(BObject.getWorldPosition(new THREE.Vector3())).normalize()
const target = start.clone().addScaledVector(dir, step * MOVE_DIRECTION)
const delta = target.clone().sub(start)

function moveWorld(object, delta) {
  const p = object.getWorldPosition(new THREE.Vector3()).add(delta);
  object.parent.worldToLocal(p);
  object.position.copy(p);
  object.updateMatrixWorld(true);
}

moveWorld(CObject, delta)
moveWorld(DObject, delta)
moveWorld(EObject, delta)
AObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
BObject.lookAt(AObject.getWorldPosition(new THREE.Vector3()))
CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
DObject.lookAt(EObject.getWorldPosition(new THREE.Vector3()))
EObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
