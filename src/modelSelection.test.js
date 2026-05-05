import { describe, expect, it } from 'vitest';
import { Group, Mesh, Object3D } from 'three';
import { findSelectableNodeUuid } from './modelSelection.js';

function buildTree() {
  const root = new Group();
  root.name = 'Scene';

  const frontColumn = new Object3D();
  frontColumn.name = 'FrontColumn';

  const fixed = new Mesh();
  fixed.name = 'frontcolumn_hydraulic_fixed';
  frontColumn.add(fixed);
  root.add(frontColumn);

  const looseMesh = new Mesh();
  looseMesh.name = 'loose_mesh';
  root.add(looseMesh);

  return { root, frontColumn, fixed, looseMesh };
}

describe('modelSelection', () => {
  it('点击机构子网格时选中所属总成节点', () => {
    const { frontColumn, fixed } = buildTree();
    const rows = [
      {
        uuid: frontColumn.uuid,
        name: 'FrontColumn',
        mechanismRole: { key: 'FrontColumn' },
      },
      {
        uuid: fixed.uuid,
        name: 'frontcolumn_hydraulic_fixed',
        mechanismRole: { key: 'FrontColumn' },
      },
    ];

    expect(findSelectableNodeUuid(fixed, rows)).toBe(frontColumn.uuid);
  });

  it('没有机构总成时选中命中的网格本身', () => {
    const { looseMesh } = buildTree();
    const rows = [{ uuid: looseMesh.uuid, name: 'loose_mesh', mechanismRole: null }];

    expect(findSelectableNodeUuid(looseMesh, rows)).toBe(looseMesh.uuid);
  });

  it('命中对象不在节点列表里时返回空字符串', () => {
    const object = new Object3D();

    expect(findSelectableNodeUuid(object, [])).toBe('');
  });

  it('命中隐藏节点时返回空字符串', () => {
    const { looseMesh } = buildTree();
    const rows = [{ uuid: looseMesh.uuid, name: 'loose_mesh', mechanismRole: null }];

    expect(findSelectableNodeUuid(looseMesh, rows, new Set([looseMesh.uuid]))).toBe('');
  });
});
