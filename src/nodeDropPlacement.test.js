import { describe, expect, it } from 'vitest';
import { getNodeDropPlacement } from './nodeDropPlacement.js';

describe('nodeDropPlacement', () => {
  it('按节点行内纵向位置判断投放位置', () => {
    const rect = { top: 100, height: 30 };

    expect(getNodeDropPlacement(105, rect)).toBe('before');
    expect(getNodeDropPlacement(115, rect)).toBe('inside');
    expect(getNodeDropPlacement(126, rect)).toBe('after');
  });

  it('节点行高度异常时默认放入节点内部', () => {
    expect(getNodeDropPlacement(100, { top: 100, height: 0 })).toBe('inside');
  });
});
