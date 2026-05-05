import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { describe, expect, test } from 'vitest'

function makePart(name, position) {
  const part = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial(),
  )
  part.name = name
  part.position.copy(position)
  return part
}

function runControlScript(node, script) {
  const execute = new Function(
    'node',
    'setPosition',
    'setRotationDeg',
    'setScale',
    'deg',
    'THREE',
    'scene',
    `"use strict";\n${script}`,
  )

  execute(
    node,
    () => {},
    () => {},
    () => {},
    (value) => (value * Math.PI) / 180,
    THREE,
    null,
  )
}

describe('flap2Action', () => {
  test('同时驱动液压滑杆和 flap 输出轴动作', () => {
    const node = new THREE.Group()
    node.name = 'flap-root'

    const fixed = makePart('flap1_hydraulic_fixed', new THREE.Vector3(0, 1, 1))
    const sliding = makePart('flap1_hydraulic_slidingshaft', new THREE.Vector3(0, 0, 0))
    const driving = makePart('flap1_driving_shaft', new THREE.Vector3(0, -1, 0))
    const pivot = makePart('flap1_pivot', new THREE.Vector3(0, 0.2, 0.1))
    const flap1 = makePart('flap1', new THREE.Vector3(0, 0.4, 0.2))
    const output = makePart('flap1_output_shaft', new THREE.Vector3(0, 0.5, 0.5))

    node.add(fixed, sliding, driving, pivot, flap1, output)
    node.updateWorldMatrix(true, true)

    const beforeSliding = sliding.getWorldPosition(new THREE.Vector3())
    const beforePivot = pivot.getWorldPosition(new THREE.Vector3())
    const beforeOutputQ = output.quaternion.clone()

    const script = readFileSync(resolve('script/Flap1/flap2Action.js'), 'utf8')
    runControlScript(node, script)

    expect(sliding.getWorldPosition(new THREE.Vector3()).distanceTo(beforeSliding)).toBeGreaterThan(0)
    expect(pivot.getWorldPosition(new THREE.Vector3()).distanceTo(beforePivot)).toBeGreaterThan(0)
    expect(flap1.rotation.x).toBeGreaterThan(0)
    expect(output.quaternion.angleTo(beforeOutputQ)).toBeGreaterThan(0)
    expect(Math.abs(driving.rotation.x)).toBeGreaterThan(0)
    expect(Math.abs(fixed.rotation.x)).toBeGreaterThan(0)
  })
})
