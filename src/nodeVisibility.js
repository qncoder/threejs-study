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
    if (!isNodeEffectivelyHidden(node, hiddenNodeUuids, root)) {
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

export function isNodeHiddenByAncestor(object, hiddenNodeUuids, stopAt = null) {
  if (!object?.parent || !hiddenNodeUuids?.size) return false;

  let current = object.parent;
  while (current && current !== stopAt) {
    if (hiddenNodeUuids.has(current.uuid)) return true;
    current = current.parent;
  }
  return false;
}

export function collectEffectivelyHiddenNodeUuids(root, hiddenNodeUuids) {
  const hidden = new Set();
  if (!root) return hidden;

  root.traverse?.((node) => {
    if (node === root || !node.uuid) return;
    if (isNodeEffectivelyHidden(node, hiddenNodeUuids, root)) {
      hidden.add(node.uuid);
    }
  });
  return hidden;
}

export function toggleHiddenNode(object, hiddenNodeUuids) {
  const next = new Set(hiddenNodeUuids ?? []);
  const targetUuids = collectVisibilityTargets(object);
  if (!targetUuids.length) return next;

  if (next.has(object.uuid)) {
    targetUuids.forEach((uuid) => next.delete(uuid));
  } else {
    targetUuids.forEach((uuid) => next.add(uuid));
  }
  return next;
}
