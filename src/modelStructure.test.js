import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three';
import {
  collectModelInfo,
  collectNodeRows,
  createPoseExport,
  createStructureExport,
  formatBytes,
} from './modelStructure.js';

function sampleModel() {
  const root = new Group();
  root.name = 'F309-root';
  root.position.set(1, 2, 3);

  const arm = new Object3D();
  arm.name = 'front-arm';
  arm.position.set(0.5, 0, 0);
  arm.rotation.set(0, Math.PI / 2, 0);

  const mesh = new Mesh(new BoxGeometry(2, 3, 2), new MeshBasicMaterial());
  mesh.name = 'front-arm-mesh';
  mesh.position.set(0, 1, 0);

  arm.add(mesh);
  root.add(arm);
  root.updateWorldMatrix(true, true);

  return { root, arm, mesh };
}

describe('modelStructure', () => {
  it('统计模型节点、网格、材质、三角面和包围盒', () => {
    const { root } = sampleModel();

    const info = collectModelInfo(root, { animations: [{ name: 'move' }] }, {
      name: 'F309.glb',
      size: 2048,
    });

    expect(info).toMatchObject({
      fileName: 'F309.glb',
      fileSize: '2 KB',
      nodeCount: 3,
      meshCount: 1,
      materialCount: 1,
      triangleCount: 12,
      animationCount: 1,
    });
    expect(info.size).toBe('2 x 3 x 2');
    expect(info.center).toEqual([1.5, 3, 3]);
  });

  it('整理节点列表，保留层级、局部变换和世界坐标', () => {
    const { root, arm, mesh } = sampleModel();

    const rows = collectNodeRows(root);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2]);
    expect(rows[0]).toMatchObject({
      uuid: root.uuid,
      name: 'F309-root',
      displayName: 'F309-root',
      type: 'Group',
      parentName: '(无)',
      childCount: 1,
      isMesh: false,
    });
    expect(rows[1]).toMatchObject({
      uuid: arm.uuid,
      name: 'front-arm',
      parentName: 'F309-root',
      position: [0.5, 0, 0],
      rotationDeg: [0, 90, 0],
    });
    expect(rows[2]).toMatchObject({
      uuid: mesh.uuid,
      name: 'front-arm-mesh',
      parentName: 'front-arm',
      childCount: 0,
      isMesh: true,
      geometryType: 'BoxGeometry',
      materialNames: ['MeshBasicMaterial'],
    });
  });

  it('生成结构导出数据，便于后续离线分析', () => {
    const { root } = sampleModel();
    const info = collectModelInfo(root, { animations: [] }, { name: 'F309.glb', size: 512 });
    const rows = collectNodeRows(root);

    const payload = createStructureExport({
      modelInfo: info,
      nodes: rows,
      exportedAt: '2026-04-28T00:00:00.000Z',
    });

    expect(payload.model).toEqual(info);
    expect(payload.nodeCount).toBe(3);
    expect(payload.nodes[1]).toMatchObject({
      name: 'front-arm',
      path: 'F309-root/front-arm',
    });
    expect(payload.exportedAt).toBe('2026-04-28T00:00:00.000Z');
  });

  it('生成当前模型姿态导出数据，只保留节点位置、旋转和缩放', () => {
    const { root } = sampleModel();
    const rows = collectNodeRows(root);

    const payload = createPoseExport({
      modelName: 'F309.glb',
      nodes: rows,
      exportedAt: '2026-04-28T00:00:00.000Z',
    });

    expect(payload).toMatchObject({
      exportedAt: '2026-04-28T00:00:00.000Z',
      modelName: 'F309.glb',
      nodeCount: 3,
    });
    expect(payload.nodes[1]).toEqual({
      uuid: rows[1].uuid,
      name: 'front-arm',
      path: 'F309-root/front-arm',
      parentName: 'F309-root',
      position: [0.5, 0, 0],
      rotationDeg: [0, 90, 0],
      scale: [1, 1, 1],
      worldPosition: rows[1].worldPosition,
    });
    expect(payload.nodes[1].geometryType).toBeUndefined();
  });

  it('格式化文件大小', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});
