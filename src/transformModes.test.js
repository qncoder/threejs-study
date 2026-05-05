import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSFORM_MODE,
  TRANSFORM_MODES,
  normalizeTransformMode,
} from './transformModes.js';

describe('transformModes', () => {
  it('提供位置、旋转、缩放三个画布工具按钮', () => {
    expect(TRANSFORM_MODES).toEqual([
      { key: 'translate', label: '位置' },
      { key: 'rotate', label: '旋转' },
      { key: 'scale', label: '缩放' },
    ]);
  });

  it('节点选中后的默认模式是位置', () => {
    expect(DEFAULT_TRANSFORM_MODE).toBe('translate');
    expect(normalizeTransformMode('rotate')).toBe('rotate');
    expect(normalizeTransformMode('bad-mode')).toBe('translate');
  });
});
