import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

const scriptPath = fileURLToPath(new URL('../script/TailBeam/newRun.js', import.meta.url));
const tailBeamRunScript = readFileSync(scriptPath, 'utf8');

function createTailBeamNode() {
  const node = new THREE.Object3D();
  node.name = 'TailBeam';

  const tailbeam = new THREE.Object3D();
  tailbeam.name = 'tailbeam_pos';
  tailbeam.position.set(0, 0, 0);

  const fixed = new THREE.Object3D();
  fixed.name = 'tailbeam_hydraulic_fixed_pos';
  fixed.position.set(0, 1, 0);

  const sliding = new THREE.Object3D();
  sliding.name = 'tailbeam_hydraulic_slidingshaft_pos';
  sliding.position.set(0, 0, 1);

  node.add(tailbeam, fixed, sliding);
  node.updateWorldMatrix(true, true);

  return { node, tailbeam, fixed, sliding };
}

function runTailBeamScript(node) {
  const execute = new Function('node', 'THREE', `"use strict";\n${tailBeamRunScript}`);
  execute(node, THREE);
  node.updateWorldMatrix(true, true);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

describe('TailBeam/newRun.js', () => {
  it('缩短油缸距离时，会旋转尾梁和固定缸，活动杆位置保持不动', () => {
    const { node, tailbeam, fixed, sliding } = createTailBeamNode();
    const initialTailbeamQuaternion = tailbeam.quaternion.clone();
    const initialFixedQuaternion = fixed.quaternion.clone();
    const initialSlidingWorld = worldPosition(sliding);
    const initialLength = worldPosition(fixed).distanceTo(initialSlidingWorld);

    runTailBeamScript(node);

    const nextLength = worldPosition(fixed).distanceTo(worldPosition(sliding));

    expect(nextLength).toBeCloseTo(initialLength - 0.01, 6);
    expect(tailbeam.quaternion.angleTo(initialTailbeamQuaternion)).toBeGreaterThan(0);
    expect(fixed.quaternion.angleTo(initialFixedQuaternion)).toBeGreaterThan(0);
    expect(worldPosition(sliding).distanceTo(initialSlidingWorld)).toBeCloseTo(0, 6);
  });

  it('按 ZF18000 模型里的尾梁点位计算时，油缸长度会缩短一步', () => {
    const node = new THREE.Object3D();
    node.name = 'TailBeam';
    node.rotation.x = Math.PI / 2;
    node.position.set(0, -0.15030916035175323, -0.1821410208940506);

    const tailbeam = new THREE.Object3D();
    tailbeam.name = 'tailbeam_pos';
    tailbeam.position.set(0, -3.1796669960021973, -2.121121406555176);

    const fixed = new THREE.Object3D();
    fixed.name = 'tailbeam_hydraulic_fixed_pos';
    fixed.position.set(-0.001570968539454043, -2.7840118408203125, -1.7237695455551147);

    const sliding = new THREE.Object3D();
    sliding.name = 'tailbeam_hydraulic_slidingshaft_pos';
    sliding.position.set(0, -3.4202167987823486, -0.8539233803749084);

    node.add(tailbeam, fixed, sliding);
    node.updateWorldMatrix(true, true);

    const initialSlidingWorld = worldPosition(sliding);
    const initialLength = worldPosition(fixed).distanceTo(initialSlidingWorld);

    runTailBeamScript(node);

    const nextLength = worldPosition(fixed).distanceTo(worldPosition(sliding));

    expect(nextLength).toBeCloseTo(initialLength - 0.01, 6);
    expect(worldPosition(sliding).distanceTo(initialSlidingWorld)).toBeCloseTo(0, 6);
    expect(tailbeam.rotation.x).not.toBeCloseTo(Math.PI / 2, 6);
    expect(fixed.quaternion.length()).toBeCloseTo(1, 6);
    expect(sliding.quaternion.length()).toBeCloseTo(1, 6);
  });
});
