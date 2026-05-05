import { Box3, Vector3 } from 'three';

export function createNodeFocusTarget(object, camera) {
  if (!object || !camera) return null;

  object.updateWorldMatrix?.(true, true);
  const box = new Box3().setFromObject(object);
  const center = box.isEmpty()
    ? object.getWorldPosition(new Vector3())
    : box.getCenter(new Vector3());
  const size = box.isEmpty() ? new Vector3(1, 1, 1) : box.getSize(new Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const distance = maxSize * 2.4;
  const direction = camera.position.clone().sub(center).normalize();
  if (direction.lengthSq() === 0) {
    direction.set(1, 0.6, 1).normalize();
  }

  return {
    center,
    position: center.clone().add(direction.multiplyScalar(distance)),
    distance,
    box,
  };
}

export function applyNodeFocusTarget(camera, controls, target) {
  if (!camera || !controls || !target) return false;

  camera.position.copy(target.position);
  camera.lookAt(target.center);
  camera.updateProjectionMatrix();
  controls.target.copy(target.center);
  controls.update();
  return true;
}
