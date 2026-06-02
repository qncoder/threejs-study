import { describe, expect, test } from 'vitest';
import { createTransformDisplayRows } from './modelTransform.js';

describe('createTransformDisplayRows', () => {
  test('把位置、角度、缩放整理成右侧栏展示行', () => {
    expect(
      createTransformDisplayRows({
        position: [1, -2.3456, 0],
        rotationDeg: [90, 0.1234, -0],
        scale: [1, 1.5, 0.33333],
      }),
    ).toEqual([
      { key: 'position', label: '位置', values: ['1', '-2.346', '0'] },
      { key: 'rotationDeg', label: '角度', values: ['90', '0.123', '0'] },
      { key: 'scale', label: '缩放', values: ['1', '1.5', '0.333'] },
    ]);
  });
});
