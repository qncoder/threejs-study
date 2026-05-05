import { describe, expect, it } from 'vitest';
import {
  clampDialogPosition,
  createDialogDragState,
  moveDialogByPointer,
  startDialogDrag,
  stopDialogDrag,
} from './dialogDrag.js';

describe('dialogDrag', () => {
  it('开始拖动时记录鼠标和弹窗原始位置', () => {
    const state = startDialogDrag({
      pointerX: 100,
      pointerY: 80,
      dialogX: 320,
      dialogY: 140,
    });

    expect(state).toEqual({
      dragging: true,
      pointerX: 100,
      pointerY: 80,
      dialogX: 320,
      dialogY: 140,
    });
  });

  it('拖动时按鼠标偏移计算新位置', () => {
    const state = startDialogDrag({
      pointerX: 100,
      pointerY: 80,
      dialogX: 320,
      dialogY: 140,
    });

    expect(moveDialogByPointer(state, {
      pointerX: 130,
      pointerY: 100,
      viewportWidth: 1200,
      viewportHeight: 800,
      dialogWidth: 500,
      dialogHeight: 300,
    })).toEqual({ x: 350, y: 160 });
  });

  it('弹窗位置不会被拖出窗口边界', () => {
    expect(clampDialogPosition({
      x: -100,
      y: 900,
      viewportWidth: 1200,
      viewportHeight: 800,
      dialogWidth: 500,
      dialogHeight: 300,
    })).toEqual({ x: 8, y: 492 });
  });

  it('停止拖动后清空拖动状态', () => {
    expect(stopDialogDrag()).toEqual(createDialogDragState());
  });
});
