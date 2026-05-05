import { describe, expect, it } from 'vitest';
import { Group, Object3D } from 'three';
import { createPartObject3D, deleteCreatedObject3D, moveNodeToObject3D } from './modelGrouping.js';
import { applyNodeTransform, readNodeTransform } from './modelTransform.js';
import { captureModelEditState, restoreModelEditState } from './modelHistory.js';

describe('modelHistory', () => {
  it('能恢复节点变换', () => {
    const root = new Group();
    const child = new Object3D();
    child.name = 'child';
    root.add(child);
    const state = captureModelEditState(root);

    applyNodeTransform(child, {
      position: [2, 3, 4],
      rotationDeg: [10, 20, 30],
      scale: [1.5, 1.2, 0.8],
    });

    const result = restoreModelEditState(root, state);

    expect(result.restored).toBe(2);
    expect(readNodeTransform(child)).toEqual({
      position: [0, 0, 0],
      rotationDeg: [0, 0, 0],
      scale: [1, 1, 1],
    });
  });

  it('能恢复拖拽换父级', () => {
    const root = new Group();
    const parentA = new Object3D();
    const parentB = new Object3D();
    const child = new Object3D();
    parentA.add(child);
    root.add(parentA, parentB);
    const state = captureModelEditState(root);

    moveNodeToObject3D(root, child, parentB);
    restoreModelEditState(root, state);

    expect(child.parent).toBe(parentA);
    expect(parentA.children).toEqual([child]);
  });

  it('能撤回新增和删除当前会话中新建的 Object3D', () => {
    const root = new Group();
    const beforeCreate = captureModelEditState(root);

    const created = createPartObject3D(root);
    restoreModelEditState(root, beforeCreate);
    expect(created.parent).toBeNull();
    expect(root.children).toEqual([]);

    root.add(created);
    const beforeDelete = captureModelEditState(root);
    deleteCreatedObject3D(root, created);
    restoreModelEditState(root, beforeDelete);

    expect(created.parent).toBe(root);
    expect(root.children).toEqual([created]);
  });
});
