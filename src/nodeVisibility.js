export function collectVisibilityTargets(object) {
  if (!object) return [];
  if (object.isMesh) return [object.uuid];

  const uuids = [];
  object.traverse?.((node) => uuids.push(node.uuid));
  return uuids;
}

export function createAllHiddenNodeSet(root) {
  const hidden = new Set();
  if (!root) return hidden;

  root.traverse?.((node) => {
    if (node !== root && node.uuid) hidden.add(node.uuid);
  });
  return hidden;
}

export function areAllNodesHidden(root, hiddenNodeUuids) {
  if (!root) return false;

  let hasTarget = false;
  let allHidden = true;
  root.traverse?.((node) => {
    if (node === root || !node.uuid) return;

    hasTarget = true;
    if (!hiddenNodeUuids?.has(node.uuid)) {
      allHidden = false;
    }
  });
  return hasTarget && allHidden;
}

export function isNodeEffectivelyHidden(object, hiddenNodeUuids, stopAt = null) {
  if (!object || !hiddenNodeUuids?.size) return false;

  let current = object;
  while (current && current !== stopAt) {
    if (hiddenNodeUuids.has(current.uuid)) return true;
    current = current.parent;
  }
  return false;
}

export function toggleHiddenNode(object, hiddenNodeUuids) {
  const next = new Set(hiddenNodeUuids ?? []);
  if (!object?.uuid) return next;

  if (next.has(object.uuid)) {
    next.delete(object.uuid);
  } else {
    next.add(object.uuid);
  }
  return next;
}
