import {
  Group,
  InstancedMesh,
  Matrix4,
} from 'three'
export const ZF18000_BATCH_COUNT = 300;
export const ZF18000_BATCH_SPACING = 2;

export function createZf18000BatchPositions({
  count = ZF18000_BATCH_COUNT,
  spacing = ZF18000_BATCH_SPACING,
} = {}) {
  return Array.from({ length: count }, (_, index) => ({
    index,
    x: index * spacing,
    y: 0,
    z: 0,
  }));
}


export function createInstancedBatchFromTemplate(templateModel, positions) {
  const batchRoot = new Group()
  batchRoot.name = 'ZF18000InstancedBatchRoot'

  templateModel.updateWorldMatrix(true, true)

  const rootInverseMatrix = new Matrix4()
  rootInverseMatrix.copy(templateModel.matrixWorld).invert()

  const meshLocalMatrix = new Matrix4()
  const modelMatrix = new Matrix4()
  const instanceMatrix = new Matrix4()

  templateModel.traverse((child) => {
    if (!child.isMesh) return
    if (child.isSkinnedMesh) return

    // 这个矩阵表示：当前 mesh 在单台模型里的位置
    meshLocalMatrix.multiplyMatrices(rootInverseMatrix, child.matrixWorld)

    const instancedMesh = new InstancedMesh(
      child.geometry,
      child.material,
      positions.length,
    )

    instancedMesh.name = `${child.name || 'mesh'}_instances`
    instancedMesh.castShadow = child.castShadow
    instancedMesh.receiveShadow = child.receiveShadow
    instancedMesh.frustumCulled = false

    positions.forEach((position, index) => {
      // 这个矩阵表示：第 index 台模型根节点的位置
      modelMatrix.makeTranslation(position.x, position.y, position.z)

      // 最终位置 = 第几台模型的位置 * 当前 mesh 在单台模型里的位置
      instanceMatrix.multiplyMatrices(modelMatrix, meshLocalMatrix)

      instancedMesh.setMatrixAt(index, instanceMatrix)
    })

    instancedMesh.instanceMatrix.needsUpdate = true
    instancedMesh.computeBoundingBox()
    instancedMesh.computeBoundingSphere()

    batchRoot.add(instancedMesh)
  })

  return batchRoot
}
