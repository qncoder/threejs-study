import { describe, expect, it } from 'vitest';
import { canDropNodeOnTarget } from './nodeDropRules.js';

describe('nodeDropRules', () => {
  it('左侧节点列表允许拖到 Object3D 或 Mesh 上', () => {
    expect(canDropNodeOnTarget({ uuid: 'source' }, { uuid: 'target-object', type: 'Object3D' })).toBe(true);
    expect(canDropNodeOnTarget({ uuid: 'source' }, { uuid: 'target-mesh', type: 'Mesh' })).toBe(true);
  });

  it('没有拖拽节点、拖到自己或拖到其他类型时不允许投放', () => {
    expect(canDropNodeOnTarget(null, { uuid: 'target-object', type: 'Object3D' })).toBe(false);
    expect(canDropNodeOnTarget({ uuid: 'same' }, { uuid: 'same', type: 'Mesh' })).toBe(false);
    expect(canDropNodeOnTarget({ uuid: 'source' }, { uuid: 'target-group', type: 'Group' })).toBe(false);
  });
});
