import { Object3D } from 'three';
import { isViewerCreatedObject3D, markViewerCreatedObject3D } from './modelGrouping.js';
import { applyNodeTransform, readNodeTransform } from './modelTransform.js';
import {
  bindNodeControlScript,
  clearNodeControlScript,
  getBoundNodeControlScript,
} from './nodeScriptControl.js';

export const SESSION_STATE_VERSION = 1;

const STORAGE_PREFIX = 'ZF18000-glb-viewer:session:';
const SESSION_NODE_KEY = 'viewerSessionNodeKey';
const CREATED_KEY_PREFIX = 'created:';

export function ensureModelSessionNodeKeys(root) {
  if (!root) return;

  ensureUserData(root);
  if (!root.userData[SESSION_NODE_KEY]) {
    root.userData[SESSION_NODE_KEY] = 'root';
  }
  assignMissingChildKeys(root);
}

export function captureModelSessionState(root, {
  modelName = 'model.glb',
  selectedNodeUuid = '',
  hiddenNodeUuids = new Set(),
} = {}) {
  if (!root) {
    return {
      version: SESSION_STATE_VERSION,
      modelName,
      selectedNodeKey: '',
      hiddenNodeKeys: [],
      nodes: [],
    };
  }

  ensureModelSessionNodeKeys(root);
  const nodes = [];
  const keyByUuid = new Map();
  root.traverse((object) => {
    const key = getSessionNodeKey(object);
    keyByUuid.set(object.uuid, key);
    nodes.push({
      key,
      uuid: object.uuid,
      name: object.name,
      type: object.type,
      parentKey: object.parent ? getSessionNodeKey(object.parent) : '',
      childIndex: object.parent ? object.parent.children.indexOf(object) : -1,
      transform: readNodeTransform(object),
      controlScript: getBoundNodeControlScript(object),
      isViewerCreated: isViewerCreatedObject3D(object),
    });
  });

  return {
    version: SESSION_STATE_VERSION,
    modelName,
    selectedNodeKey: keyByUuid.get(selectedNodeUuid) ?? '',
    hiddenNodeKeys: [...hiddenNodeUuids].map((uuid) => keyByUuid.get(uuid)).filter(Boolean),
    nodes,
  };
}

export function restoreModelSessionState(root, state) {
  if (!root || !isCompatibleSessionState(state)) {
    return {
      restored: 0,
      created: 0,
      selectedNodeUuid: '',
      hiddenNodeUuids: new Set(),
    };
  }

  ensureModelSessionNodeKeys(root);
  const nodeByKey = collectNodeMap(root);
  const stateNodes = state.nodes.filter((node) => node?.key);
  const stateKeys = new Set(stateNodes.map((node) => node.key));
  removeMissingCreatedObjects(root, nodeByKey, stateKeys);

  let created = 0;
  for (const nodeState of stateNodes) {
    if (!nodeState.isViewerCreated || nodeByKey.has(nodeState.key)) continue;

    const object = markViewerCreatedObject3D(new Object3D());
    object.name = nodeState.name || '部件节点';
    ensureUserData(object);
    object.userData[SESSION_NODE_KEY] = nodeState.key;
    root.add(object);
    nodeByKey.set(nodeState.key, object);
    created += 1;
  }

  for (const nodeState of stateNodes) {
    if (nodeState.key === 'root') continue;

    const object = nodeByKey.get(nodeState.key);
    const parent = nodeByKey.get(nodeState.parentKey) ?? root;
    if (!object || !parent || object === root || object.parent === parent) continue;

    object.parent?.remove(object);
    parent.add(object);
  }

  for (const nodeState of stateNodes) {
    const object = nodeByKey.get(nodeState.key);
    const parent = nodeByKey.get(nodeState.parentKey);
    if (!object || !parent || object === root || nodeState.childIndex < 0) continue;

    moveChildToIndex(parent, object, nodeState.childIndex);
  }

  let restored = 0;
  for (const nodeState of stateNodes) {
    const object = nodeByKey.get(nodeState.key);
    if (!object) continue;

    object.name = nodeState.name ?? object.name;
    if (nodeState.controlScript) {
      bindNodeControlScript(object, nodeState.controlScript);
    } else {
      clearNodeControlScript(object);
    }
    if (nodeState.transform) {
      applyNodeTransform(object, nodeState.transform);
    }
    restored += 1;
  }

  root.updateWorldMatrix?.(true, true);
  return {
    restored,
    created,
    selectedNodeUuid: nodeByKey.get(state.selectedNodeKey)?.uuid ?? '',
    hiddenNodeUuids: new Set(
      (state.hiddenNodeKeys ?? [])
        .map((key) => nodeByKey.get(key)?.uuid)
        .filter(Boolean),
    ),
  };
}

export function modelSessionStorageKey(modelName) {
  return `${STORAGE_PREFIX}${encodeURIComponent(String(modelName || 'model.glb'))}`;
}

export function saveModelSessionState(storage, modelName, state) {
  if (!storage) return false;

  try {
    storage.setItem(modelSessionStorageKey(modelName), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadModelSessionState(storage, modelName) {
  if (!storage) return null;

  try {
    const value = storage.getItem(modelSessionStorageKey(modelName));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function clearModelSessionState(storage, modelName) {
  if (!storage) return false;

  try {
    storage.removeItem(modelSessionStorageKey(modelName));
    return true;
  } catch {
    return false;
  }
}

function assignMissingChildKeys(parent) {
  const parentKey = getSessionNodeKey(parent);
  parent.children.forEach((child, index) => {
    ensureUserData(child);
    if (!child.userData[SESSION_NODE_KEY]) {
      child.userData[SESSION_NODE_KEY] = isViewerCreatedObject3D(child)
        ? `${CREATED_KEY_PREFIX}${child.uuid}`
        : `${parentKey}/${index}:${child.type}:${encodeKeyPart(child.name)}`;
    }
    assignMissingChildKeys(child);
  });
}

function collectNodeMap(root) {
  const nodeByKey = new Map();
  root.traverse((object) => {
    nodeByKey.set(getSessionNodeKey(object), object);
  });
  return nodeByKey;
}

function removeMissingCreatedObjects(root, nodeByKey, stateKeys) {
  const removeList = [];
  root.traverse((object) => {
    if (object !== root && isViewerCreatedObject3D(object) && !stateKeys.has(getSessionNodeKey(object))) {
      removeList.push(object);
    }
  });

  for (const object of removeList) {
    object.parent?.remove(object);
    nodeByKey.delete(getSessionNodeKey(object));
  }
}

function moveChildToIndex(parent, object, childIndex) {
  const currentIndex = parent.children.indexOf(object);
  if (currentIndex < 0 || currentIndex === childIndex) return;

  parent.children.splice(currentIndex, 1);
  parent.children.splice(Math.min(childIndex, parent.children.length), 0, object);
}

function isCompatibleSessionState(state) {
  return Boolean(
    state
      && state.version === SESSION_STATE_VERSION
      && Array.isArray(state.nodes),
  );
}

function getSessionNodeKey(object) {
  return object?.userData?.[SESSION_NODE_KEY] ?? '';
}

function ensureUserData(object) {
  object.userData = object.userData ?? {};
}

function encodeKeyPart(value) {
  return encodeURIComponent(String(value ?? ''));
}
