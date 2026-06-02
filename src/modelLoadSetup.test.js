import { describe, expect, test } from 'vitest'
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three'
import { prepareLoadedModelStructure } from './modelLoadSetup.js'
import { markViewerCreatedObject3D } from './modelGrouping.js'

function createMesh(name) {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
  mesh.name = name
  return mesh
}

describe('prepareLoadedModelStructure', () => {
  test('新加载的模型会自动给每个 mesh 增加同级 Object3D', () => {
    const root = new Object3D()
    const mesh = createMesh('flap1')
    root.add(mesh)

    const result = prepareLoadedModelStructure(root)

    expect(result.meshObjectResult).toEqual({ created: 1, skipped: 0 })
    expect(root.children.map((child) => child.name)).toEqual(['flap1', 'flap1_pos'])
    expect(root.children[1].type).toBe('Object3D')
    expect(root.children[1].userData.createdInViewer).toBe(true)
  })

  test('会先恢复会话，再初始化 mesh Object3D，避免重复新增', () => {
    const root = new Object3D()
    const mesh = createMesh('flap1')
    root.add(mesh)

    const result = prepareLoadedModelStructure(root, () => {
      const restoredObject = markViewerCreatedObject3D(new Object3D())
      restoredObject.name = 'flap1_pos'
      root.add(restoredObject)
      return { restored: 1, created: 1 }
    })

    expect(result.sessionResult).toEqual({ restored: 1, created: 1 })
    expect(result.meshObjectResult).toEqual({ created: 0, skipped: 1 })
    expect(root.children.map((child) => child.name)).toEqual(['flap1', 'flap1_pos'])
  })
})
