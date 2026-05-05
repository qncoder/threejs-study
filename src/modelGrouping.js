import { Object3D } from 'three';

const DEFAULT_OBJECT_NAME = '部件节点';
const CREATED_OBJECT_KEY = 'createdInViewer';

export function createPartObject3D(root, baseName = DEFAULT_OBJECT_NAME) {
  if (!root) {
    throw new Error('请先加载模型。');
  }

  const object = new Object3D();
  object.name = nextObjectName(root, baseName);
  markViewerCreatedObject3D(object);
  root.add(object);
  root.updateWorldMatrix?.(true, true);
  return object;
}

export function moveNodeToObject3D(root, node, target) {
  if (!root || !node || !target) {
    return { ok: false, reason: '缺少要移动的节点或目标 Object3D。' };
  }
  if (node === root) {
    return { ok: false, reason: '模型根节点不能拖进其他节点。' };
  }
  if (node === target) {
    return { ok: false, reason: '不能把节点拖到自己里面。' };
  }
  if (!target.isObject3D) {
    return { ok: false, reason: '只能拖到 Object3D 或 Mesh 节点里。' };
  }
  if (isAncestorOf(node, target)) {
    return { ok: false, reason: '不能把节点拖到自己的子节点里。' };
  }
  if (node.parent === target) {
    return { ok: true, moved: false };
  }

  root.updateWorldMatrix?.(true, true);
  target.attach(node);
  root.updateWorldMatrix?.(true, true);

  return { ok: true, moved: true };
}

export function moveNodeNextToObject3D(root, node, target, placement) {
  if (!root || !node || !target) {
    return { ok: false, reason: '缺少要移动的节点或目标节点。' };
  }
  if (!['before', 'after'].includes(placement)) {
    return { ok: false, reason: '缺少节点移动位置。' };
  }
  if (node === root) {
    return { ok: false, reason: '模型根节点不能移动。' };
  }
  if (node === target) {
    return { ok: false, reason: '不能把节点移动到自己旁边。' };
  }
  if (!target.parent) {
    return { ok: false, reason: '目标节点没有父节点。' };
  }
  if (isAncestorOf(node, target)) {
    return { ok: false, reason: '不能把节点移动到自己的子节点旁边。' };
  }

  const targetParent = target.parent;
  const previousParent = node.parent;
  const previousIndex = previousParent?.children.indexOf(node) ?? -1;
  const targetIndexBeforeMove = targetParent.children.indexOf(target);
  const expectedPreviousParent = targetParent;
  const expectedPreviousIndex = placement === 'before'
    ? targetIndexBeforeMove - 1
    : targetIndexBeforeMove + 1;
  if (previousParent === expectedPreviousParent && previousIndex === expectedPreviousIndex) {
    return { ok: true, moved: false };
  }

  root.updateWorldMatrix?.(true, true);
  targetParent.attach(node);

  const currentIndex = targetParent.children.indexOf(node);
  const targetIndex = targetParent.children.indexOf(target);
  if (currentIndex < 0 || targetIndex < 0) {
    return { ok: false, reason: '节点移动失败。' };
  }

  targetParent.children.splice(currentIndex, 1);
  const adjustedTargetIndex = targetParent.children.indexOf(target);
  const insertIndex = placement === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
  targetParent.children.splice(insertIndex, 0, node);
  root.updateWorldMatrix?.(true, true);

  return { ok: true, moved: true };
}

export function deleteCreatedObject3D(root, node) {
  if (!root || !node) {
    return { ok: false, reason: '缺少要删除的节点。' };
  }
  if (node === root) {
    return { ok: false, reason: '模型根节点不能删除。' };
  }
  if (node.type !== 'Object3D' || node.userData?.[CREATED_OBJECT_KEY] !== true) {
    return { ok: false, reason: '只能删除当前会话中新建的 Object3D。' };
  }
  if (!node.parent) {
    return { ok: false, reason: '节点已经不在模型里。' };
  }

  const parent = node.parent;
  while (node.children.length > 0) {
    parent.attach(node.children[0]);
  }
  parent.remove(node);
  root.updateWorldMatrix?.(true, true);
  return { ok: true, reason: '' };
}

export function renameCreatedObject3D(root, node, nextName) {
  if (!root || !node) {
    return { ok: false, reason: '缺少要重命名的节点。' };
  }
  if (!isViewerCreatedObject3D(node)) {
    return { ok: false, reason: '只能重命名当前会话中新建的 Object3D。' };
  }

  const normalizedName = String(nextName ?? '').trim();
  if (!normalizedName) {
    return { ok: false, reason: '名称不能为空。' };
  }

  node.name = uniqueObjectName(root, normalizedName, node);
  root.updateWorldMatrix?.(true, true);
  return { ok: true, name: node.name };
}

export function isViewerCreatedObject3D(node) {
  return Boolean(node?.type === 'Object3D' && node.userData?.[CREATED_OBJECT_KEY] === true);
}

export function markViewerCreatedObject3D(node) {
  if (!node) return node;

  node.userData = node.userData ?? {};
  node.userData[CREATED_OBJECT_KEY] = true;
  return node;
}

function nextObjectName(root, baseName) {
  return uniqueObjectName(root, baseName);
}

function uniqueObjectName(root, baseName, exclude = null) {
  const names = new Set();
  root.traverse?.((object) => {
    if (object !== exclude) names.add(object.name);
  });

  let index = 1;
  let name = `${baseName}`;
  while (names.has(name)) {
    index += 1;
    name = `${baseName}`;
  }
  return name;
}

function isAncestorOf(candidateAncestor, object) {
  let current = object.parent;
  while (current) {
    if (current === candidateAncestor) return true;
    current = current.parent;
  }
  return false;
}
