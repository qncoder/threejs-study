import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Quaternion, Vector3 } from 'three';
import {
  createPartObject3D,
  createSiblingPartObject3D,
  deleteCreatedObject3D,
  moveNodeNextToObject3D,
  moveNodeToObject3D,
  renameCreatedObject3D,
} from './modelGrouping.js';

function worldPosition(object) {
  return object.getWorldPosition(new Vector3()).toArray().map((value) => Number(value.toFixed(4)));
}

function worldQuaternion(object) {
  return object.getWorldQuaternion(new Quaternion()).toArray().map((value) => Number(value.toFixed(4)));
}

function worldScale(object) {
  return object.getWorldScale(new Vector3()).toArray().map((value) => Number(value.toFixed(4)));
}

describe('modelGrouping', () => {
  it('新建 Object3D 后放到模型根节点下，并生成不重复名称', () => {
    const root = new Group();
    root.name = 'Scene';
    const existing = new Object3D();
    existing.name = '部件节点 1';
    root.add(existing);

    const node = createPartObject3D(root);

    expect(node).toBeInstanceOf(Object3D);
    expect(node.type).toBe('Object3D');
    expect(node.name).toBe('部件节点 2');
    expect(node.parent).toBe(root);
  });

  it('可以把新建 Object3D 放到指定父节点下', () => {
    const root = new Group();
    root.name = 'Scene';
    const parent = new Object3D();
    parent.name = 'parent';
    root.add(parent);

    const node = createPartObject3D(root, parent);

    expect(node).toBeInstanceOf(Object3D);
    expect(node.parent).toBe(parent);
    expect(parent.children).toContain(node);
  });

  it('右键在节点上新建 Object3D 时，创建同级节点并只复制名称和位置', () => {
    const root = new Group();
    const group = new Object3D();
    group.name = 'group';
    group.position.set(5, 0, 0);
    group.rotation.set(0, Math.PI / 6, 0);
    group.scale.set(2, 2, 2);
    const target = new Object3D();
    target.name = 'target';
    target.position.set(1, 2, 3);
    target.rotation.set(0.1, 0.2, 0.3);
    target.scale.set(2, 3, 4);
    const other = new Object3D();
    other.name = 'other';
    group.add(target, other);
    root.add(group);
    root.updateWorldMatrix(true, true);

    const node = createSiblingPartObject3D(root, target);

    expect(node.parent).toBe(group);
    expect(group.children).toEqual([target, node, other]);
    expect(node.name).toBe('target 1');
    expect(worldPosition(node)).toEqual(worldPosition(target));
    expect(node.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(node.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('把一个 Object3D 拖到另一个 Object3D 下面时保持世界坐标不跳变', () => {
    const root = new Group();
    root.name = 'Scene';
    root.position.set(10, 0, 0);
    const sourceParent = new Object3D();
    sourceParent.name = 'source-parent';
    sourceParent.position.set(2, 0, 0);
    const part = new Object3D();
    part.name = 'part';
    part.position.set(0, 3, 0);
    const target = new Object3D();
    target.name = 'target';
    target.position.set(-4, 0, 1);
    sourceParent.add(part);
    root.add(sourceParent, target);
    root.updateWorldMatrix(true, true);
    const before = worldPosition(part);

    const result = moveNodeToObject3D(root, part, target);

    expect(result).toEqual({ ok: true, moved: true });
    expect(part.parent).toBe(target);
    expect(worldPosition(part)).toEqual(before);
  });

  it('移动父 Object3D 时，里面的部件会一起移动', () => {
    const root = new Group();
    const parent = createPartObject3D(root);
    const part = new Object3D();
    part.name = 'part';
    part.position.set(1, 0, 0);
    root.add(part);
    root.updateWorldMatrix(true, true);

    moveNodeToObject3D(root, part, parent);
    parent.position.x += 5;
    root.updateWorldMatrix(true, true);

    expect(worldPosition(part)).toEqual([6, 0, 0]);
  });

  it('允许把 Object3D 拖到 Mesh 下面并保持世界坐标不跳变', () => {
    const root = new Group();
    root.name = 'Scene';
    const part = new Object3D();
    part.name = 'part';
    part.position.set(1, 2, 3);
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.name = 'mesh-target';
    mesh.position.set(5, 0, 0);
    root.add(part, mesh);
    root.updateWorldMatrix(true, true);
    const before = worldPosition(part);

    const result = moveNodeToObject3D(root, part, mesh);

    expect(result).toEqual({ ok: true, moved: true });
    expect(part.parent).toBe(mesh);
    expect(worldPosition(part)).toEqual(before);
  });

  it('把节点移到目标节点前面时保持世界坐标不跳变', () => {
    const root = new Group();
    root.position.set(10, 0, 0);
    const sourceParent = new Object3D();
    sourceParent.name = 'source-parent';
    sourceParent.position.set(2, 0, 0);
    const part = new Object3D();
    part.name = 'part';
    part.position.set(0, 3, 0);
    const target = new Object3D();
    target.name = 'target';
    target.position.set(-4, 0, 1);
    const afterTarget = new Object3D();
    afterTarget.name = 'after-target';
    sourceParent.add(part);
    root.add(sourceParent, target, afterTarget);
    root.updateWorldMatrix(true, true);
    const before = worldPosition(part);

    const result = moveNodeNextToObject3D(root, part, target, 'before');

    expect(result).toEqual({ ok: true, moved: true });
    expect(part.parent).toBe(root);
    expect(root.children).toEqual([sourceParent, part, target, afterTarget]);
    expect(worldPosition(part)).toEqual(before);
  });

  it('把节点移到目标节点后面时保持世界坐标不跳变', () => {
    const root = new Group();
    root.position.set(10, 0, 0);
    const beforeTarget = new Object3D();
    beforeTarget.name = 'before-target';
    const target = new Object3D();
    target.name = 'target';
    target.position.set(-4, 0, 1);
    const sourceParent = new Object3D();
    sourceParent.name = 'source-parent';
    sourceParent.position.set(2, 0, 0);
    const part = new Object3D();
    part.name = 'part';
    part.position.set(0, 3, 0);
    sourceParent.add(part);
    root.add(beforeTarget, target, sourceParent);
    root.updateWorldMatrix(true, true);
    const before = worldPosition(part);

    const result = moveNodeNextToObject3D(root, part, target, 'after');

    expect(result).toEqual({ ok: true, moved: true });
    expect(part.parent).toBe(root);
    expect(root.children).toEqual([beforeTarget, target, part, sourceParent]);
    expect(worldPosition(part)).toEqual(before);
  });

  it('不能把节点拖到自己的子节点里', () => {
    const root = new Group();
    const parent = new Object3D();
    parent.name = 'parent';
    const child = new Object3D();
    child.name = 'child';
    parent.add(child);
    root.add(parent);

    const result = moveNodeToObject3D(root, parent, child);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('不能把节点拖到自己的子节点里。');
  });

  it('只允许删除当前会话中新建的 Object3D', () => {
    const root = new Group();
    const created = createPartObject3D(root);
    const original = new Object3D();
    original.name = 'original';
    root.add(original);

    const deleted = deleteCreatedObject3D(root, created);
    const blocked = deleteCreatedObject3D(root, original);

    expect(deleted).toEqual({ ok: true, reason: '' });
    expect(created.parent).toBeNull();
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('只能删除当前会话中新建的 Object3D。');
    expect(original.parent).toBe(root);
  });

  it('允许重命名当前会话中新建的 Object3D，并避免空名称和重名', () => {
    const root = new Group();
    const created = createPartObject3D(root);
    const existing = new Object3D();
    existing.name = '车门';
    root.add(existing);

    expect(renameCreatedObject3D(root, created, '车门')).toEqual({ ok: true, name: '车门 1' });
    expect(created.name).toBe('车门 1');

    expect(renameCreatedObject3D(root, created, '  ')).toEqual({
      ok: false,
      reason: '名称不能为空。',
    });
  });

  it('不允许重命名模型原有 Object3D', () => {
    const root = new Group();
    const original = new Object3D();
    original.name = 'original';
    root.add(original);

    const result = renameCreatedObject3D(root, original, 'new-name');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('只能重命名当前会话中新建的 Object3D。');
    expect(original.name).toBe('original');
  });
});
