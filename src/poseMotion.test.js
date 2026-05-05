import { describe, expect, it } from 'vitest';
import { Group, Object3D } from 'three';
import {
  applyPoseToModel,
  applyPoseTransition,
  clampPoseProgress,
  normalizePosePayload,
} from './poseMotion.js';
import { readNodeTransform } from './modelTransform.js';

function sampleModel() {
  const root = new Group();
  root.name = 'Scene';

  const arm = new Object3D();
  arm.name = 'Arm';
  const child = new Object3D();
  child.name = 'Child';

  arm.add(child);
  root.add(arm);
  root.updateWorldMatrix(true, true);

  return { root, arm, child };
}

function pose(nodes) {
  return {
    modelName: 'test.glb',
    nodes,
  };
}

describe('poseMotion', () => {
  it('校验并整理姿态文件', () => {
    const payload = normalizePosePayload(
      pose([
        {
          path: 'Scene/Arm',
          position: [1, 2, 3],
          rotationDeg: [0, 10, 0],
          scale: [1, 1, 1],
        },
      ]),
    );

    expect(payload.ok).toBe(true);
    expect(payload.pose.nodes).toHaveLength(1);
  });

  it('姿态文件缺少节点时返回错误', () => {
    const payload = normalizePosePayload({ modelName: 'bad.glb', nodes: [] });

    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('没有节点姿态');
  });

  it('按 path 把单份姿态应用到当前模型', () => {
    const { root, arm } = sampleModel();
    const result = applyPoseToModel(
      root,
      pose([
        {
          path: 'Scene/Arm',
          position: [1, 2, 3],
          rotationDeg: [0, 90, 0],
          scale: [1, 2, 1],
        },
      ]),
    );

    expect(result).toEqual({ applied: 1, missing: [] });
    expect(readNodeTransform(arm)).toEqual({
      position: [1, 2, 3],
      rotationDeg: [0, 90, 0],
      scale: [1, 2, 1],
    });
  });

  it('在起始姿态和结束姿态之间插值', () => {
    const { root, arm } = sampleModel();
    const start = pose([
      { path: 'Scene/Arm', position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
    ]);
    const end = pose([
      { path: 'Scene/Arm', position: [10, 4, -2], rotationDeg: [0, 90, 0], scale: [2, 3, 1] },
    ]);

    const result = applyPoseTransition(root, start, end, 0.5);

    expect(result).toEqual({ applied: 1, missing: [] });
    expect(readNodeTransform(arm)).toEqual({
      position: [5, 2, -1],
      rotationDeg: [0, 45, 0],
      scale: [1.5, 2, 1],
    });
  });

  it('限制姿态进度范围', () => {
    expect(clampPoseProgress(-1)).toBe(0);
    expect(clampPoseProgress(0.25)).toBe(0.25);
    expect(clampPoseProgress(2)).toBe(1);
  });
});
