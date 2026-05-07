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

function forwardDirection(object) {
  object.updateWorldMatrix(true, true)
  return new THREE.Vector3(0, 0, 1)
    .applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()))
    .normalize()
}

describe('fixed 和 sliding 互相看向', () => {
  test('fixed 与 sliding 的正前方都指向对方', () => {
    const node = new THREE.Group()
    const fixed = makePart('flap1_hydraulic_fixed', new THREE.Vector3(0, 0, 0))
    const sliding = makePart('flap1_hydraulic_slidingshaft', new THREE.Vector3(0, 0, 2))

    node.add(fixed, sliding)
    node.updateWorldMatrix(true, true)

    const script = readFileSync(
      resolve('script/Flap1/fixed和sliding互相看向.js'),
      'utf8',
    )

    runControlScript(node, script)

    const fixedToSliding = sliding.position.clone().sub(fixed.position).normalize()
    const slidingToFixed = fixed.position.clone().sub(sliding.position).normalize()

    expect(forwardDirection(fixed).dot(fixedToSliding)).toBeGreaterThan(0.999)
    expect(forwardDirection(sliding).dot(slidingToFixed)).toBeGreaterThan(0.999)
  })
})
