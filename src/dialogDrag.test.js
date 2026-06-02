import { describe, expect, test } from 'vitest';
import {
  clampDialogLayout,
  resizeDialogByPointer,
  startDialogResize,
} from './dialogDrag.js';

describe('dialog layout helpers', () => {
  test('把浮窗位置和尺寸限制在视口范围内', () => {
    expect(
      clampDialogLayout({
        x: 900,
        y: 700,
        width: 1200,
        height: 800,
        bounds: { x: 100, y: 50, width: 1000, height: 700 },
        minWidth: 480,
        minHeight: 360,
      }),
    ).toEqual({
      x: 108,
      y: 58,
      width: 984,
      height: 684,
    });
  });

  test('从右下角拖拽时按指针位移调整尺寸', () => {
    const state = startDialogResize({
      handle: 'se',
      pointerX: 500,
      pointerY: 420,
      layout: { x: 120, y: 80, width: 640, height: 420 },
    });

    expect(
      resizeDialogByPointer(state, {
        pointerX: 620,
        pointerY: 500,
        bounds: { x: 0, y: 0, width: 1200, height: 800 },
        minWidth: 480,
        minHeight: 360,
      }),
    ).toEqual({
      x: 120,
      y: 80,
      width: 760,
      height: 500,
    });
  });
});
