import { Group, InstancedMesh, Matrix4 } from 'three';

export function createZf18000ControlRigScriptContext(rig) {
  return {
    scene: rig ?? null,
  };
}

export function createZf18000InstancedBatch(templateModel, positions) {
  const root = new Group();
  root.name = 'ZF18000InstancedBatchRoot';

  if (!templateModel || !Array.isArray(positions) || positions.length === 0) {
    return { root, records: [], meshCount: 0, instanceCount: 0 };
  }

  templateModel.updateWorldMatrix(true, true);

  const records = [];
  let meshCount = 0;
  const rootInverseMatrix = new Matrix4().copy(templateModel.matrixWorld).invert();
  const modelMatrix = new Matrix4();

  templateModel.traverse((child) => {
    if (!child.isMesh) return;
    if (child.isSkinnedMesh) return;

    const meshLocalMatrix = new Matrix4().multiplyMatrices(rootInverseMatrix, child.matrixWorld);
    const instanceMatrix = new Matrix4();
    const instancedMesh = new InstancedMesh(child.geometry, child.material, positions.length);

    instancedMesh.name = `${child.name || 'mesh'}_instances`;
    instancedMesh.castShadow = child.castShadow;
    instancedMesh.receiveShadow = child.receiveShadow;
    instancedMesh.frustumCulled = false;

    positions.forEach((position, index) => {
      modelMatrix.makeTranslation(position.x, position.y, position.z);
      instanceMatrix.multiplyMatrices(modelMatrix, meshLocalMatrix);
      instancedMesh.setMatrixAt(index, instanceMatrix);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.computeBoundingBox();
    instancedMesh.computeBoundingSphere();
    root.add(instancedMesh);
    records.push({
      meshName: child.name || '',
      instancedMesh,
    });
    meshCount += 1;
  });

  return {
    root,
    records,
    meshCount,
    instanceCount: positions.length,
  };
}

export function syncControlRigToInstancedBatch(rig, instanceIndex, records, batchRoot) {
  if (!rig || !Array.isArray(records) || !batchRoot) {
    return { updated: 0, missing: [] };
  }

  rig.updateWorldMatrix(true, true);
  batchRoot.updateWorldMatrix(true, false);

  const meshesByName = new Map();
  rig.traverse((child) => {
    if (!child.isMesh || child.isSkinnedMesh) return;
    if (!meshesByName.has(child.name)) {
      meshesByName.set(child.name, child);
    }
  });

  const batchRootInverseMatrix = new Matrix4().copy(batchRoot.matrixWorld).invert();
  const instanceMatrix = new Matrix4();
  const missing = [];
  let updated = 0;

  records.forEach((record) => {
    const mesh = meshesByName.get(record.meshName);
    if (!mesh) {
      missing.push(record.meshName);
      return;
    }

    mesh.updateWorldMatrix(true, false);
    instanceMatrix.multiplyMatrices(batchRootInverseMatrix, mesh.matrixWorld);
    record.instancedMesh.setMatrixAt(instanceIndex, instanceMatrix);
    record.instancedMesh.instanceMatrix.needsUpdate = true;
    record.instancedMesh.computeBoundingBox();
    record.instancedMesh.computeBoundingSphere();
    updated += 1;
  });

  return { updated, missing };
}
