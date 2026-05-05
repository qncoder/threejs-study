import { describe, expect, it } from 'vitest';
import { Group, Object3D } from 'three';
import {
  applyNodeTransform,
  captureOriginalNodeTransforms,
  readNodeTransform,
  resetAllNodeTransforms,
  resetNodeTransform,
} from './modelTransform.js';

function sampleTree() {
  const root = new Group();
  root.name = 'root';
  root.position.set(1, 2, 3);

  const child = new Object3D();
  child.name = 'child';
  child.position.set(0.5, 0, 0);
  child.rotation.set(0, Math.PI / 2, 0);
  child.scale.set(1, 2, 1);

  root.add(child);
  root.updateWorldMatrix(true, true);
  return { root, child };
}

describe('modelTransform', () => {
  it('读取节点局部位置、旋转角度和缩放', () => {
    const { child } = sampleTree();

    expect(readNodeTransform(child)).toEqual({
      position: [0.5, 0, 0],
      rotationDeg: [0, 90, 0],
      scale: [1, 2, 1],
    });
  });

  it('把输入的局部变换应用到节点', () => {
    const { child } = sampleTree();

    const result = applyNodeTransform(child, {
      position: [2, -1, 0.25],
      rotationDeg: [10, 20, 30],
      scale: [1.5, 1.25, 0.75],
    });

    expect(result).toEqual({ ok: true, errors: [] });
    expect(readNodeTransform(child)).toEqual({
      position: [2, -1, 0.25],
      rotationDeg: [10, 20, 30],
      scale: [1.5, 1.25, 0.75],
    });
  });

  it('输入不是数字时不修改节点', () => {
    const { child } = sampleTree();
    const before = readNodeTransform(child);

    const result = applyNodeTransform(child, {
      position: [1, Number.NaN, 3],
      rotationDeg: [0, 0, 0],
      scale: [1, 1, 1],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('位置 Y 不是有效数字');
    expect(readNodeTransform(child)).toEqual(before);
  });

  it('输入为空时不修改节点', () => {
    const { child } = sampleTree();
    const before = readNodeTransform(child);

    const result = applyNodeTransform(child, {
      position: [1, '', 3],
      rotationDeg: [0, 0, 0],
      scale: [1, 1, 1],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('位置 Y 不是有效数字');
    expect(readNodeTransform(child)).toEqual(before);
  });

  it('可以重置当前节点到初始变换', () => {
    const { root, child } = sampleTree();
    const originals = captureOriginalNodeTransforms(root);
    applyNodeTransform(child, {
      position: [9, 8, 7],
      rotationDeg: [45, 0, 0],
      scale: [3, 3, 3],
    });

    const result = resetNodeTransform(child, originals);

    expect(result).toBe(true);
    expect(readNodeTransform(child)).toEqual({
      position: [0.5, 0, 0],
      rotationDeg: [0, 90, 0],
      scale: [1, 2, 1],
    });
  });

  it('可以重置整棵模型树', () => {
    const { root, child } = sampleTree();
    const originals = captureOriginalNodeTransforms(root);
    applyNodeTransform(root, {
      position: [4, 4, 4],
      rotationDeg: [0, 10, 0],
      scale: [2, 2, 2],
    });
    applyNodeTransform(child, {
      position: [9, 8, 7],
      rotationDeg: [45, 0, 0],
      scale: [3, 3, 3],
    });

    const count = resetAllNodeTransforms(root, originals);

    expect(count).toBe(2);
    expect(readNodeTransform(root).position).toEqual([1, 2, 3]);
    expect(readNodeTransform(child)).toEqual({
      position: [0.5, 0, 0],
      rotationDeg: [0, 90, 0],
      scale: [1, 2, 1],
    });
  });
});
