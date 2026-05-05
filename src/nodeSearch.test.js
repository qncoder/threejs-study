import { describe, expect, it } from 'vitest';
import {
  collectSearchVisibleNodeUuids,
  filterNodeRowsByKeyword,
} from './nodeSearch.js';

const rows = [
  { uuid: 'root', name: 'Scene', displayName: 'Scene', type: 'Group', parentName: '(无)', path: 'Scene', depth: 0 },
  { uuid: 'body', name: 'Body', displayName: 'Body', type: 'Object3D', parentName: 'Scene', path: 'Scene/Body', depth: 1 },
  { uuid: 'door', name: 'Door', displayName: 'Door', type: 'Object3D', parentName: 'Body', path: 'Scene/Body/Door', depth: 2 },
  { uuid: 'door-mesh', name: 'DoorMesh', displayName: 'DoorMesh', type: 'Mesh', parentName: 'Door', path: 'Scene/Body/Door/DoorMesh', depth: 3 },
  { uuid: 'wheel', name: 'Wheel', displayName: 'Wheel', type: 'Mesh', parentName: 'Body', path: 'Scene/Body/Wheel', depth: 2 },
];

describe('nodeSearch', () => {
  it('按名称、类型、父节点和路径筛选节点行', () => {
    expect(filterNodeRowsByKeyword(rows, 'door').map((row) => row.uuid)).toEqual(['door', 'door-mesh']);
    expect(filterNodeRowsByKeyword(rows, 'group').map((row) => row.uuid)).toEqual(['root']);
    expect(filterNodeRowsByKeyword(rows, 'scene/body/wheel').map((row) => row.uuid)).toEqual(['wheel']);
    expect(filterNodeRowsByKeyword(rows, '  ').map((row) => row.uuid)).toEqual(rows.map((row) => row.uuid));
  });

  it('只看搜索结果时，命中 Object3D 会包含它下面的子节点', () => {
    expect([...collectSearchVisibleNodeUuids(rows, 'door')]).toEqual(['door', 'door-mesh']);
  });

  it('没有关键词时不限制模型显示', () => {
    expect(collectSearchVisibleNodeUuids(rows, '')).toBeNull();
  });
});
