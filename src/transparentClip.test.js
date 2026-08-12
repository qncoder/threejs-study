import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildTransparentClipPlanes } from './transparentClip.js';

describe('buildTransparentClipPlanes', () => {
  it('无开关时返回空数组', () => {
    expect(buildTransparentClipPlanes({})).toEqual([]);
  });

  it('X 轴：world x < clipPos 一侧被裁（distance < 0）', () => {
    const [plane] = buildTransparentClipPlanes({
      enableClipX: true,
      clipPosX: 2,
    });
    expect(plane).toBeTruthy();
    expect(plane.distanceToPoint(new Vector3(1, 0, 0))).toBeLessThan(0);
    expect(plane.distanceToPoint(new Vector3(3, 0, 0))).toBeGreaterThan(0);
  });

  it('Y / Z 轴同理', () => {
    const [planeY] = buildTransparentClipPlanes({
      enableClipY: true,
      clipPosY: 0,
    });
    expect(planeY.distanceToPoint(new Vector3(0, -1, 0))).toBeLessThan(0);
    expect(planeY.distanceToPoint(new Vector3(0, 1, 0))).toBeGreaterThan(0);

    const [planeZ] = buildTransparentClipPlanes({
      enableClipZ: true,
      clipPosZ: -1,
    });
    expect(planeZ.distanceToPoint(new Vector3(0, 0, -2))).toBeLessThan(0);
    expect(planeZ.distanceToPoint(new Vector3(0, 0, 0))).toBeGreaterThan(0);
  });

  it('三个轴互斥，X 优先于 Y/Z（对应 Unity else-if）', () => {
    const planes = buildTransparentClipPlanes({
      enableClipX: true,
      enableClipY: true,
      enableClipZ: true,
      clipPosX: 1,
      clipPosY: 2,
      clipPosZ: 3,
    });
    expect(planes).toHaveLength(1);
    expect(planes[0].normal).toMatchObject({ x: 1, y: 0, z: 0 });
    expect(planes[0].constant).toBe(-1);
  });

  it('仅 Y 开启时使用 Y', () => {
    const planes = buildTransparentClipPlanes({
      enableClipY: true,
      clipPosY: 5,
    });
    expect(planes).toHaveLength(1);
    expect(planes[0].normal).toMatchObject({ x: 0, y: 1, z: 0 });
    expect(planes[0].constant).toBe(-5);
  });
});
