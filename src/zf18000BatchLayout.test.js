import { describe, expect, it } from 'vitest';
import {
  ZF18000_BATCH_COUNT,
  ZF18000_BATCH_SPACING,
  createZf18000BatchPositions,
} from './zf18000BatchLayout.js';

describe('ZF18000 批量排列', () => {
  it('按当前配置创建从原点开始的位置', () => {
    const positions = createZf18000BatchPositions();

    expect(positions).toHaveLength(ZF18000_BATCH_COUNT);
    expect(positions[0]).toEqual({ index: 0, x: 0, y: 0, z: 0 });
    expect(positions[1]).toEqual({
      index: 1,
      x: ZF18000_BATCH_SPACING,
      y: 0,
      z: 0,
    });
    const lastIndex = ZF18000_BATCH_COUNT - 1;
    expect(positions[lastIndex]).toEqual({
      index: lastIndex,
      x: lastIndex * ZF18000_BATCH_SPACING,
      y: 0,
      z: 0,
    });
  });

  it('支持临时指定间隔 1', () => {
    const positions = createZf18000BatchPositions({ spacing: 1 });

    expect(positions[0]).toEqual({ index: 0, x: 0, y: 0, z: 0 });
    expect(positions[1]).toEqual({ index: 1, x: 1, y: 0, z: 0 });
    expect(positions[199]).toEqual({ index: 199, x: 199, y: 0, z: 0 });
  });
});
