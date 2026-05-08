import { Object3D, Quaternion, Vector3 } from 'three'

const DEFAULT_OBJECT_NAME = '部件节点'
const CREATED_OBJECT_KEY = 'createdInViewer'

export function createPartObject3D(
  root,
  parentOrBaseName = root,
  optionsOrBaseName = DEFAULT_OBJECT_NAME
) {
  if (!root) {
    throw new Error('请先加载模型。')
  }

  const parent = typeof parentOrBaseName === 'string' ? root : (parentOrBaseName ?? root)
  const objectBaseName =
    typeof parentOrBaseName === 'string'
      ? parentOrBaseName
      : typeof optionsOrBaseName === 'string'
        ? optionsOrBaseName
        : (optionsOrBaseName?.baseName ?? DEFAULT_OBJECT_NAME)
  const inheritPositionFrom =
    typeof optionsOrBaseName === 'object'
      ? (optionsOrBaseName?.inheritPositionFrom ?? optionsOrBaseName?.inheritTransformFrom)
      : null
  const inheritRotationFrom =
    typeof optionsOrBaseName === 'object'
      ? (optionsOrBaseName?.inheritRotationFrom ?? optionsOrBaseName?.inheritTransformFrom)
      : null
  const inheritScaleFrom =
    typeof optionsOrBaseName === 'object'
      ? (optionsOrBaseName?.inheritScaleFrom ?? optionsOrBaseName?.inheritTransformFrom)
      : null

  const object = new Object3D()
  object.name = nextObjectName(root, objectBaseName)
  markViewerCreatedObject3D(object)
  root.updateWorldMatrix?.(true, true)
  const inheritedWorldPosition = inheritPositionFrom
    ? inheritPositionFrom.getWorldPosition(new Vector3())
    : null
  const inheritedWorldQuaternion = inheritRotationFrom
    ? inheritRotationFrom.getWorldQuaternion(new Quaternion())
    : null
  const inheritedWorldScale = inheritScaleFrom
    ? inheritScaleFrom.getWorldScale(new Vector3())
    : null
  const parentWorldQuaternion = inheritedWorldQuaternion
    ? parent.getWorldQuaternion(new Quaternion())
    : null
  const parentWorldScale = inheritedWorldScale ? parent.getWorldScale(new Vector3()) : null
  parent.add(object)
  if (inheritedWorldPosition) {
    object.position.copy(parent.worldToLocal(inheritedWorldPosition))
  }
  if (inheritedWorldQuaternion) {
    object.quaternion.copy(parentWorldQuaternion.invert().multiply(inheritedWorldQuaternion))
  }
  if (inheritedWorldScale) {
    object.scale.set(
      divideScale(inheritedWorldScale.x, parentWorldScale.x),
      divideScale(inheritedWorldScale.y, parentWorldScale.y),
      divideScale(inheritedWorldScale.z, parentWorldScale.z)
    )
  }
  root.updateWorldMatrix?.(true, true)
  return object
}

export function createSiblingPartObject3D(root, sibling, options = {}) {
  if (!sibling) {
    return createPartObject3D(root, root, options)
  }

  const parent = sibling.parent ?? root
  const object = createPartObject3D(root, parent, {
    ...options,
    baseName: options.baseName ?? sibling.name ?? DEFAULT_OBJECT_NAME,
    inheritPositionFrom: options.inheritPositionFrom ?? sibling,
    inheritRotationFrom: options.inheritRotationFrom,
    inheritScaleFrom: options.inheritScaleFrom,
  })
  moveNodeAfterSibling(object, sibling, parent)
  root.updateWorldMatrix?.(true, true)
  return object
}

export function initializeMeshObject3Ds(root) {
  if (!root) {
    return { created: 0, skipped: 0 }
  }

  root.updateWorldMatrix?.(true, true)
  const meshes = []
  root.traverse?.((object) => {
    if (object.isMesh) meshes.push(object)
  })

  let created = 0
  let skipped = 0
  meshes.forEach((mesh) => {
    if (!mesh.parent || isInitializedMeshObject(mesh)) {
      skipped += 1
      return
    }

    wrapMeshWithObject3D(root, mesh)
    created += 1
  })

  root.updateWorldMatrix?.(true, true)
  return { created, skipped }
}

function divideScale(value, parentValue) {
  return parentValue === 0 ? 1 : value / parentValue
}

function isInitializedMeshObject(mesh) {
  const parent = mesh.parent
  return Boolean(parent?.children.some((sibling) =>
    sibling !== mesh
      && sibling.type === 'Object3D'
      && sibling.userData?.[CREATED_OBJECT_KEY] === true
      && sibling.name === meshObjectName(mesh)
  ))
}

function wrapMeshWithObject3D(root, mesh) {
  const parent = mesh.parent

  const object = new Object3D()
  object.name = nextObjectName(root, meshObjectName(mesh))
  markViewerCreatedObject3D(object)
  object.position.copy(mesh.position)
  object.quaternion.copy(mesh.quaternion)
  object.scale.copy(mesh.scale)
  parent.add(object)
  moveNodeAfterSibling(object, mesh, parent)
  root.updateWorldMatrix?.(true, true)
  return object
}

function meshObjectName(mesh) {
  return `${mesh.name || DEFAULT_OBJECT_NAME}_pos`
}

function moveNodeAfterSibling(node, sibling, parent) {
  const nodeIndex = parent.children.indexOf(node)
  const siblingIndex = parent.children.indexOf(sibling)
  if (nodeIndex < 0 || siblingIndex < 0) return

  parent.children.splice(nodeIndex, 1)
  const adjustedSiblingIndex = parent.children.indexOf(sibling)
  parent.children.splice(adjustedSiblingIndex + 1, 0, node)
}

export function moveNodeToObject3D(root, node, target) {
  if (!root || !node || !target) {
    return { ok: false, reason: '缺少要移动的节点或目标 Object3D。' }
  }
  if (node === root) {
    return { ok: false, reason: '模型根节点不能拖进其他节点。' }
  }
  if (node === target) {
    return { ok: false, reason: '不能把节点拖到自己里面。' }
  }
  if (!target.isObject3D) {
    return { ok: false, reason: '只能拖到 Object3D 或 Mesh 节点里。' }
  }
  if (isAncestorOf(node, target)) {
    return { ok: false, reason: '不能把节点拖到自己的子节点里。' }
  }
  if (node.parent === target) {
    return { ok: true, moved: false }
  }

  root.updateWorldMatrix?.(true, true)
  target.attach(node)
  root.updateWorldMatrix?.(true, true)

  return { ok: true, moved: true }
}

export function moveNodeNextToObject3D(root, node, target, placement) {
  if (!root || !node || !target) {
    return { ok: false, reason: '缺少要移动的节点或目标节点。' }
  }
  if (!['before', 'after'].includes(placement)) {
    return { ok: false, reason: '缺少节点移动位置。' }
  }
  if (node === root) {
    return { ok: false, reason: '模型根节点不能移动。' }
  }
  if (node === target) {
    return { ok: false, reason: '不能把节点移动到自己旁边。' }
  }
  if (!target.parent) {
    return { ok: false, reason: '目标节点没有父节点。' }
  }
  if (isAncestorOf(node, target)) {
    return { ok: false, reason: '不能把节点移动到自己的子节点旁边。' }
  }

  const targetParent = target.parent
  const previousParent = node.parent
  const previousIndex = previousParent?.children.indexOf(node) ?? -1
  const targetIndexBeforeMove = targetParent.children.indexOf(target)
  const expectedPreviousParent = targetParent
  const expectedPreviousIndex =
    placement === 'before' ? targetIndexBeforeMove - 1 : targetIndexBeforeMove + 1
  if (previousParent === expectedPreviousParent && previousIndex === expectedPreviousIndex) {
    return { ok: true, moved: false }
  }

  root.updateWorldMatrix?.(true, true)
  targetParent.attach(node)

  const currentIndex = targetParent.children.indexOf(node)
  const targetIndex = targetParent.children.indexOf(target)
  if (currentIndex < 0 || targetIndex < 0) {
    return { ok: false, reason: '节点移动失败。' }
  }

  targetParent.children.splice(currentIndex, 1)
  const adjustedTargetIndex = targetParent.children.indexOf(target)
  const insertIndex = placement === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1
  targetParent.children.splice(insertIndex, 0, node)
  root.updateWorldMatrix?.(true, true)

  return { ok: true, moved: true }
}

export function deleteCreatedObject3D(root, node) {
  if (!root || !node) {
    return { ok: false, reason: '缺少要删除的节点。' }
  }
  if (node === root) {
    return { ok: false, reason: '模型根节点不能删除。' }
  }
  if (node.type !== 'Object3D' || node.userData?.[CREATED_OBJECT_KEY] !== true) {
    return { ok: false, reason: '只能删除当前会话中新建的 Object3D。' }
  }
  if (!node.parent) {
    return { ok: false, reason: '节点已经不在模型里。' }
  }

  const parent = node.parent
  while (node.children.length > 0) {
    parent.attach(node.children[0])
  }
  parent.remove(node)
  root.updateWorldMatrix?.(true, true)
  return { ok: true, reason: '' }
}

export function renameCreatedObject3D(root, node, nextName) {
  if (!root || !node) {
    return { ok: false, reason: '缺少要重命名的节点。' }
  }
  if (!isViewerCreatedObject3D(node)) {
    return { ok: false, reason: '只能重命名当前会话中新建的 Object3D。' }
  }

  const normalizedName = String(nextName ?? '').trim()
  if (!normalizedName) {
    return { ok: false, reason: '名称不能为空。' }
  }

  node.name = uniqueObjectName(root, normalizedName, node)
  root.updateWorldMatrix?.(true, true)
  return { ok: true, name: node.name }
}

export function isViewerCreatedObject3D(node) {
  return Boolean(node?.type === 'Object3D' && node.userData?.[CREATED_OBJECT_KEY] === true)
}

export function markViewerCreatedObject3D(node) {
  if (!node) return node

  node.userData = node.userData ?? {}
  node.userData[CREATED_OBJECT_KEY] = true
  return node
}

function nextObjectName(root, baseName) {
  return uniqueObjectName(root, baseName)
}

function uniqueObjectName(root, baseName, exclude = null) {
  const names = new Set()
  root.traverse?.((object) => {
    if (object !== exclude) names.add(object.name)
  })

  const numberedNamePattern = new RegExp(`^${escapeRegExp(baseName)} (\\d+)$`)
  let maxIndex = 0
  names.forEach((name) => {
    const match = numberedNamePattern.exec(name)
    if (match) {
      maxIndex = Math.max(maxIndex, Number(match[1]))
    }
  })

  if (!names.has(baseName) && maxIndex === 0) {
    return baseName
  }

  let index = maxIndex > 0 ? maxIndex + 1 : 1
  let name = `${baseName} ${index}`
  while (names.has(name)) {
    index += 1
    name = `${baseName} ${index}`
  }
  return name
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isAncestorOf(candidateAncestor, object) {
  let current = object.parent
  while (current) {
    if (current === candidateAncestor) return true
    current = current.parent
  }
  return false
}
