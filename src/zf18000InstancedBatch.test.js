import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { runNodeControlScript } from './nodeScriptControl.js';
import {
  createZf18000ControlRigScriptContext,
  createZf18000InstancedBatch,
  syncControlRigToInstancedBatch,
} from './zf18000InstancedBatch.js';

describe('ZF18000 InstancedMesh 批量创建', () => {
  it('把模板 mesh 转成带有多个位置矩阵的 InstancedMesh', () => {
    const root = new Object3D();
    const holder = new Object3D();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

    holder.position.set(2, 0, 0);
    mesh.name = 'part';
    mesh.position.set(0, 3, 0);
    holder.add(mesh);
    root.add(holder);

    const positions = [
      { index: 0, x: 0, y: 0, z: 0 },
      { index: 1, x: 10, y: 0, z: 0 },
    ];

    const result = createZf18000InstancedBatch(root, positions);
    const instancedMesh = result.root.children[0];
    const matrix = instancedMesh.instanceMatrix.array;

    expect(result.instanceCount).toBe(2);
    expect(result.meshCount).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(instancedMesh.isInstancedMesh).toBe(true);
    expect(instancedMesh.count).toBe(2);
    expect(matrix[12]).toBe(2);
    expect(matrix[13]).toBe(3);
    expect(matrix[14]).toBe(0);
    expect(matrix[28]).toBe(12);
    expect(matrix[29]).toBe(3);
    expect(matrix[30]).toBe(0);
  });

  it('把控制节点算出的 mesh 矩阵同步到指定实例', () => {
    const templateRoot = new Object3D();
    const templateMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    templateMesh.name = 'part';
    templateRoot.add(templateMesh);

    const result = createZf18000InstancedBatch(templateRoot, [
      { index: 0, x: 0, y: 0, z: 0 },
      { index: 1, x: 10, y: 0, z: 0 },
    ]);

    const rig = new Object3D();
    const rigHolder = new Object3D();
    const rigMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    rigMesh.name = 'part';
    rig.position.set(10, 0, 0);
    rigHolder.position.set(2, 0, 0);
    rigMesh.position.set(0, 3, 0);
    rigHolder.add(rigMesh);
    rig.add(rigHolder);

    const syncResult = syncControlRigToInstancedBatch(rig, 1, result.records, result.root);
    const matrix = result.records[0].instancedMesh.instanceMatrix.array;

    expect(syncResult.updated).toBe(1);
    expect(matrix[28]).toBe(12);
    expect(matrix[29]).toBe(3);
    expect(matrix[30]).toBe(0);
  });

  it('批量脚本里的 scene 可以按名字找到隐藏控制模型里的节点', () => {
    const displayScene = new Object3D();
    const rig = new Object3D();
    const scriptNode = new Object3D();
    const supportPivot = new Object3D();

    supportPivot.name = 'SupportPivot';
    supportPivot.quaternion.set(0.2, 0.3, 0.4, 0.5).normalize();
    rig.add(scriptNode);
    rig.add(supportPivot);

    const result = runNodeControlScript(
      scriptNode,
      "scene.getObjectByName('SupportPivot').quaternion.set(0, 0, 0, 1)",
      createZf18000ControlRigScriptContext(rig, displayScene)
    );

    expect(result.ok).toBe(true);
    expect(supportPivot.quaternion.x).toBe(0);
    expect(supportPivot.quaternion.y).toBe(0);
    expect(supportPivot.quaternion.z).toBe(0);
    expect(supportPivot.quaternion.w).toBe(1);
  });
});
