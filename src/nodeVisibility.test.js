import { describe, expect, test } from 'vitest'
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three'
import {
  areAllNodesHidden,
  isNodeEffectivelyHidden,
  isNodeHiddenByAncestor,
  toggleHiddenNode,
} from './nodeVisibility.js'

function createMesh(name) {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
  mesh.name = name
  return mesh
}

describe('nodeVisibility', () => {
  test('父级 Object3D 隐藏后，子级 Object3D 和 Mesh 都视为隐藏', () => {
    const root = new Object3D()
    const parent = new Object3D()
    const childObject = new Object3D()
    const childMesh = createMesh('childMesh')

    root.add(parent)
    parent.add(childObject)
    childObject.add(childMesh)

    const hiddenNodeUuids = new Set([parent.uuid])

    expect(isNodeEffectivelyHidden(parent, hiddenNodeUuids, root)).toBe(true)
    expect(isNodeEffectivelyHidden(childObject, hiddenNodeUuids, root)).toBe(true)
    expect(isNodeEffectivelyHidden(childMesh, hiddenNodeUuids, root)).toBe(true)
    expect(isNodeHiddenByAncestor(childObject, hiddenNodeUuids, root)).toBe(true)
    expect(isNodeHiddenByAncestor(childMesh, hiddenNodeUuids, root)).toBe(true)
  })

  test('只隐藏父级也能识别为整棵子树都已隐藏', () => {
    const root = new Object3D()
    const parent = new Object3D()
    const childObject = new Object3D()
    const childMesh = createMesh('childMesh')

    root.add(parent)
    parent.add(childObject)
    childObject.add(childMesh)

    expect(areAllNodesHidden(root, new Set([parent.uuid]))).toBe(true)
  })

  test('父级 Object3D 显示时会一起显示子节点', () => {
    const root = new Object3D()
    const parent = new Object3D()
    const childObject = new Object3D()
    const childMesh = createMesh('childMesh')

    root.add(parent)
    parent.add(childObject)
    childObject.add(childMesh)

    const hiddenNodeUuids = new Set([parent.uuid, childObject.uuid, childMesh.uuid])
    const nextHiddenNodeUuids = toggleHiddenNode(parent, hiddenNodeUuids)

    expect(nextHiddenNodeUuids.has(parent.uuid)).toBe(false)
    expect(nextHiddenNodeUuids.has(childObject.uuid)).toBe(false)
    expect(nextHiddenNodeUuids.has(childMesh.uuid)).toBe(false)
    expect(isNodeEffectivelyHidden(childMesh, nextHiddenNodeUuids, root)).toBe(false)
  })
})
