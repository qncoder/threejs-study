const DROP_TARGET_TYPES = new Set(['Object3D', 'Mesh']);

export function canDropNodeOnTarget(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return false;
  if (!sourceNode.uuid || !targetNode.uuid) return false;
  if (sourceNode.uuid === targetNode.uuid) return false;

  return DROP_TARGET_TYPES.has(targetNode.type);
}
