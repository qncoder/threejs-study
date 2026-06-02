import { describe, expect, test } from 'vitest';
import { Object3D } from 'three';
import { createNodeScriptDialogState } from './nodeScriptControl.js';

describe('createNodeScriptDialogState', () => {
  test('创建底部脚本面板状态时不再保存浮动窗口坐标', () => {
    const node = new Object3D();
    const state = createNodeScriptDialogState({
      nodeUuid: node.uuid,
      node,
      row: {
        displayName: '后连杆',
        type: 'Object3D',
        path: 'root/后连杆',
      },
      transform: {
        position: [1, 2, 3],
        rotationDeg: [0, 0, 0],
        scale: [1, 1, 1],
      },
    });

    expect(state.open).toBe(true);
    expect(state.nodeTitle).toBe('后连杆');
    expect(state).not.toHaveProperty('x');
    expect(state).not.toHaveProperty('y');
  });
});
