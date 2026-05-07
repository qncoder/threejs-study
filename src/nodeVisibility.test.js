import { describe, expect, it } from 'vitest';
import { Mesh, Object3D } from 'three';
import {
  collectVisibilityTargets,
  createAllHiddenNodeSet,
  isNodeEffectivelyHidden,
  toggleHiddenNode,
} from './nodeVisibility.js';

describe('nodeVisibility', () => {
  it('Object3D 隐藏时影响整棵子树，Mesh 隐藏时只影响自己', () => {
    const parent = new Object3D();
    parent.uuid = 'parent';
    const child = new Object3D();
    child.uuid = 'child';
    const mesh = new Mesh();
    mesh.uuid = 'mesh';
    child.add(mesh);
    parent.add(child);

    expect(collectVisibilityTargets(parent)).toEqual(['parent', 'child', 'mesh']);
    expect(collectVisibilityTargets(mesh)).toEqual(['mesh']);
  });

  it('父节点隐藏时子节点也视为隐藏', () => {
    const parent = new Object3D();
    parent.uuid = 'parent';
    const child = new Mesh();
    child.uuid = 'child';
    parent.add(child);

    expect(isNodeEffectivelyHidden(child, new Set(['parent']))).toBe(true);
    expect(isNodeEffectivelyHidden(child, new Set(['child']))).toBe(true);
    expect(isNodeEffectivelyHidden(parent, new Set(['child']))).toBe(false);
  });

  it('切换隐藏状态时返回新的 Set', () => {
    const hidden = new Set(['old']);
    const object = new Object3D();
    object.uuid = 'target';

    const next = toggleHiddenNode(object, hidden);

    expect([...hidden]).toEqual(['old']);
    expect(next.has('target')).toBe(true);
    expect(toggleHiddenNode(object, next).has('target')).toBe(false);
  });

  it('全部隐藏时跳过模型根节点，隐藏其余节点', () => {
    const root = new Object3D();
    root.uuid = 'root';
    const child = new Object3D();
    child.uuid = 'child';
    const mesh = new Mesh();
    mesh.uuid = 'mesh';
    child.add(mesh);
    root.add(child);

    expect(createAllHiddenNodeSet(root)).toEqual(new Set(['child', 'mesh']));
  });
});
