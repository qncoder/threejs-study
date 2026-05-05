import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import {
  SCRIPT_DEBUG_HELPER_NAMES,
  removeScriptDebugHelpers,
} from './scriptDebugHelpers.js';

describe('scriptDebugHelpers', () => {
  it('清除脚本画在 scene 下的辅助对象', () => {
    const scene = new Group();
    const keep = new Group();
    keep.name = 'keep';

    const abc = new Group();
    abc.name = SCRIPT_DEBUG_HELPER_NAMES[0];

    const motion = new Group();
    motion.name = SCRIPT_DEBUG_HELPER_NAMES[1];

    scene.add(keep, abc, motion);

    const removed = removeScriptDebugHelpers(scene);

    expect(removed).toBe(2);
    expect(scene.children).toEqual([keep]);
  });

  it('没有 scene 时返回 0', () => {
    expect(removeScriptDebugHelpers(null)).toBe(0);
  });
});
