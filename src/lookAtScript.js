import {
  moveNodeNextToObject3D,
  moveNodeToObject3D,
} from './modelGrouping.js';

export const LOOK_AT_SCRIPT_NAME = 'lookAt';

export function isLookAtScriptName(name) {
  return String(name ?? '').trim() === LOOK_AT_SCRIPT_NAME;
}

export function applyLookAtMeshHierarchy(root, scopeNode) {
  return moveLookAtMeshHierarchy(root, scopeNode, 'attach');
}

export function restoreLookAtMeshHierarchy(root, scopeNode) {
  return moveLookAtMeshHierarchy(root, scopeNode, 'restore');
}

function moveLookAtMeshHierarchy(root, scopeNode, mode) {
  if (!root || !scopeNode) {
    return { moved: 0, names: [] };
  }

  const meshObjects = collectMeshObjects(scopeNode);
  const names = [];

  meshObjects.forEach((mesh) => {
    const meshName = String(mesh.name ?? '').trim();
    if (!meshName || meshName.endsWith('_pos')) return;

    if (mode === 'attach') {
      const pos = root.getObjectByName(`${meshName}_pos`);
      if (!pos || pos === mesh) return;

      const result = moveNodeToObject3D(root, mesh, pos);
      if (result.ok && result.moved !== false) {
        names.push(meshName);
      }
      return;
    }

    const parent = mesh.parent;
    if (!parent || !String(parent.name ?? '').trim().endsWith('_pos')) return;

    const result = moveNodeNextToObject3D(root, mesh, parent, 'before');
    if (result.ok && result.moved !== false) {
      names.push(meshName);
    }
  });

  return { moved: names.length, names };
}

function collectMeshObjects(scopeNode) {
  const meshes = [];
  const seen = new Set();

  scopeNode.traverse?.((object) => {
    if (!object?.isMesh) return;
    if (seen.has(object.uuid)) return;

    seen.add(object.uuid);
    meshes.push(object);
  });

  return meshes;
}
