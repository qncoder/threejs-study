import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, Object3D, BoxGeometry } from 'three';
import { bindNodeControlScript, getBoundNodeControlScript } from './nodeScriptControl.js';
import { createPartObject3D, isViewerCreatedObject3D, moveNodeToObject3D } from './modelGrouping.js';
import { applyNodeTransform, readNodeTransform } from './modelTransform.js';
import {
  captureModelSessionState,
  clearModelSessionState,
  ensureModelSessionNodeKeys,
  loadModelSessionState,
  modelSessionStorageKey,
  restoreModelSessionState,
  saveModelSessionState,
} from './modelSessionState.js';

function createModel() {
  const root = new Group();
  root.name = 'Scene';

  const parent = new Object3D();
  parent.name = 'parent';
  const child = new Object3D();
  child.name = 'child';
  parent.add(child);

  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.name = 'mesh';
  root.add(parent, mesh);
  root.updateWorldMatrix(true, true);

  return { root, parent, child, mesh };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('modelSessionState', () => {
  it('保存为 JSON 后还能恢复原始节点的父级、变换、脚本和选择状态', () => {
    const source = createModel();
    ensureModelSessionNodeKeys(source.root);
    moveNodeToObject3D(source.root, source.child, source.mesh);
    applyNodeTransform(source.child, {
      position: [1, 2, 3],
      rotationDeg: [10, 20, 30],
      scale: [1.5, 1.2, 0.8],
    });
    bindNodeControlScript(source.child, 'setPosition(4, 5, 6);');

    const captured = captureModelSessionState(source.root, {
      modelName: 'F309.glb',
      selectedNodeUuid: source.child.uuid,
      hiddenNodeUuids: new Set([source.child.uuid]),
    });
    const state = JSON.parse(JSON.stringify(captured));
    const target = createModel();
    ensureModelSessionNodeKeys(target.root);

    const result = restoreModelSessionState(target.root, state);

    expect(result.restored).toBeGreaterThan(0);
    expect(result.selectedNodeUuid).toBe(target.child.uuid);
    expect(result.hiddenNodeUuids).toEqual(new Set([target.child.uuid]));
    expect(target.child.parent).toBe(target.mesh);
    expect(readNodeTransform(target.child)).toEqual({
      position: [1, 2, 3],
      rotationDeg: [10, 20, 30],
      scale: [1.5, 1.2, 0.8],
    });
    expect(getBoundNodeControlScript(target.child)).toBe('setPosition(4, 5, 6);');
  });

  it('恢复时会重建会话中新建的 Object3D，并保留里面的原始节点', () => {
    const source = createModel();
    ensureModelSessionNodeKeys(source.root);
    const created = createPartObject3D(source.root);
    created.name = '临时部件';
    moveNodeToObject3D(source.root, source.child, created);
    applyNodeTransform(created, {
      position: [3, 0, 0],
      rotationDeg: [0, 45, 0],
      scale: [2, 2, 2],
    });
    bindNodeControlScript(created, 'node.position.x += 1;');

    const state = JSON.parse(JSON.stringify(captureModelSessionState(source.root, {
      modelName: 'F309.glb',
      selectedNodeUuid: created.uuid,
      hiddenNodeUuids: new Set(),
    })));
    const target = createModel();
    ensureModelSessionNodeKeys(target.root);

    const result = restoreModelSessionState(target.root, state);
    const restoredCreated = target.root.children.find((item) => item.name === '临时部件');

    expect(result.created).toBe(1);
    expect(result.selectedNodeUuid).toBe(restoredCreated.uuid);
    expect(isViewerCreatedObject3D(restoredCreated)).toBe(true);
    expect(target.child.parent).toBe(restoredCreated);
    expect(readNodeTransform(restoredCreated)).toEqual({
      position: [3, 0, 0],
      rotationDeg: [0, 45, 0],
      scale: [2, 2, 2],
    });
    expect(getBoundNodeControlScript(restoredCreated)).toBe('node.position.x += 1;');
  });

  it('可以按模型名写入、读取和清除 sessionStorage 数据', () => {
    const storage = createMemoryStorage();
    const state = { version: 1, modelName: 'F309.glb', nodes: [] };

    saveModelSessionState(storage, 'F309.glb', state);

    expect(storage.getItem(modelSessionStorageKey('F309.glb'))).toBe(JSON.stringify(state));
    expect(loadModelSessionState(storage, 'F309.glb')).toEqual(state);

    clearModelSessionState(storage, 'F309.glb');

    expect(loadModelSessionState(storage, 'F309.glb')).toBeNull();
  });
});
