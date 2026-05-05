import { describe, expect, it } from 'vitest';
import { filterCollapsedNodeRows } from './nodeCollapse.js';

describe('nodeCollapse', () => {
  it('折叠 Object3D 后隐藏它下面的所有后代行，但保留自身', () => {
    const rows = [
      { uuid: 'root', name: 'root', type: 'Group', depth: 0 },
      { uuid: 'parent', name: 'parent', type: 'Object3D', depth: 1 },
      { uuid: 'child-object', name: 'child-object', type: 'Object3D', depth: 2 },
      { uuid: 'mesh', name: 'mesh', type: 'Mesh', depth: 3 },
      { uuid: 'sibling', name: 'sibling', type: 'Object3D', depth: 1 },
    ];

    const visibleRows = filterCollapsedNodeRows(rows, new Set(['parent']));

    expect(visibleRows.map((row) => row.uuid)).toEqual(['root', 'parent', 'sibling']);
  });

  it('没有折叠节点时保持原列表顺序', () => {
    const rows = [
      { uuid: 'a', depth: 0 },
      { uuid: 'b', depth: 1 },
    ];

    expect(filterCollapsedNodeRows(rows, new Set())).toEqual(rows);
  });
});
