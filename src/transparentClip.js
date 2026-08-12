import { Plane, Vector3 } from 'three';

/**
 * 对应 Unity Transparent_Clip 的世界空间剖切：
 * 三个轴互斥（else-if），启用轴上 worldPos < clipPos 的一侧被裁掉。
 *
 * Three.js Plane：distance = normal·x + constant，distance < 0 的一侧被裁。
 * X = clipPos → normal (1,0,0), constant = -clipPos → x < clipPos 被裁。
 *
 * @param {{
 *   enableClipX?: boolean,
 *   enableClipY?: boolean,
 *   enableClipZ?: boolean,
 *   clipPosX?: number,
 *   clipPosY?: number,
 *   clipPosZ?: number,
 * }} options
 * @returns {Plane[]}
 */
export function buildTransparentClipPlanes(options = {}) {
  const {
    enableClipX = false,
    enableClipY = false,
    enableClipZ = false,
    clipPosX = 0,
    clipPosY = 0,
    clipPosZ = 0,
  } = options;

  if (enableClipX) {
    return [new Plane(new Vector3(1, 0, 0), -clipPosX)];
  }
  if (enableClipY) {
    return [new Plane(new Vector3(0, 1, 0), -clipPosY)];
  }
  if (enableClipZ) {
    return [new Plane(new Vector3(0, 0, 1), -clipPosZ)];
  }
  return [];
}
