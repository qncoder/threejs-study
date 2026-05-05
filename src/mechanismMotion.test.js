import { describe, expect, it } from 'vitest';
import { Group, Object3D } from 'three';
import { captureOriginalNodeTransforms, readNodeTransform } from './modelTransform.js';
import { applyMechanismMotion, clampMotionProgress } from './mechanismMotion.js';

function namedObject(name) {
  const object = new Object3D();
  object.name = name;
  return object;
}

function sampleRig() {
  const root = new Group();
  root.name = 'Scene';

  const base = namedObject('Base');
  const frontColumn = namedObject('FrontColumn');
  const frontColumnFixed = namedObject('frontcolumn_hydraulic_fixed');
  const slidingShaft1 = namedObject('frontcolumn_hydraulic_slidingshaft1');
  const slidingShaft2 = namedObject('frontcolumn_hydraulic_slidingshaft2');
  const topBeam = namedObject('TopBeam');
  const rod = namedObject('Rod');
  const shield = namedObject('Shield');
  const tailBeam = namedObject('TailBeam');
  const flexBeamStroke = namedObject('FlexBeamStroke');

  frontColumn.add(frontColumnFixed, slidingShaft1, slidingShaft2);
  root.add(base, frontColumn, topBeam, rod, shield, tailBeam, flexBeamStroke);
  root.updateWorldMatrix(true, true);

  return {
    root,
    base,
    frontColumn,
    frontColumnFixed,
    slidingShaft1,
    slidingShaft2,
    topBeam,
    rod,
    shield,
    tailBeam,
    flexBeamStroke,
  };
}

describe('mechanismMotion', () => {
  it('限制动作进度范围', () => {
    expect(clampMotionProgress(-0.5)).toBe(0);
    expect(clampMotionProgress(0.4)).toBe(0.4);
    expect(clampMotionProgress(1.5)).toBe(1);
  });

  it('主液压下收时外筒不动，只让第一节第二节和顶梁下降', () => {
    const rig = sampleRig();
    const originals = captureOriginalNodeTransforms(rig.root);

    const result = applyMechanismMotion(rig.root, originals, 1);

    expect(result.applied).toEqual(
      expect.arrayContaining([
        'frontcolumn_hydraulic_slidingshaft1',
        'frontcolumn_hydraulic_slidingshaft2',
        'TopBeam',
        'Rod',
        'Shield',
        'TailBeam',
      ]),
    );
    expect(readNodeTransform(rig.base)).toEqual(originals.get(rig.base.uuid));
    expect(readNodeTransform(rig.frontColumn)).toEqual(originals.get(rig.frontColumn.uuid));
    expect(readNodeTransform(rig.frontColumnFixed)).toEqual(originals.get(rig.frontColumnFixed.uuid));
    expect(rig.slidingShaft1.position.y).toBeLessThan(0);
    expect(rig.slidingShaft2.position.y).toBeLessThan(0);
    expect(rig.topBeam.position.y).toBeLessThan(0);
    expect(rig.rod.rotation.z).not.toBe(0);
    expect(rig.shield.rotation.z).not.toBe(0);
    expect(rig.tailBeam.rotation.z).not.toBe(0);
  });

  it('动作演示不改变节点缩放，避免看起来像油缸被拉伸', () => {
    const rig = sampleRig();
    rig.frontColumn.scale.set(1, 2, 1);
    rig.slidingShaft1.scale.set(1, 3, 1);
    rig.slidingShaft2.scale.set(1, 4, 1);
    rig.flexBeamStroke.scale.set(0.8, 1.2, 0.8);
    const originals = captureOriginalNodeTransforms(rig.root);

    applyMechanismMotion(rig.root, originals, 1);

    for (const object of Object.values(rig)) {
      if (!object.uuid) continue;
      expect(readNodeTransform(object).scale).toEqual(originals.get(object.uuid).scale);
    }
  });

  it('每次都从初始变换计算，避免反复拖动后累积偏移', () => {
    const rig = sampleRig();
    const originals = captureOriginalNodeTransforms(rig.root);

    applyMechanismMotion(rig.root, originals, 1);
    const first = readNodeTransform(rig.topBeam);
    applyMechanismMotion(rig.root, originals, 1);
    const second = readNodeTransform(rig.topBeam);

    expect(second).toEqual(first);
  });

  it('进度为 0 时回到初始姿态', () => {
    const rig = sampleRig();
    const originals = captureOriginalNodeTransforms(rig.root);

    applyMechanismMotion(rig.root, originals, 1);
    applyMechanismMotion(rig.root, originals, 0);

    expect(readNodeTransform(rig.topBeam)).toEqual(originals.get(rig.topBeam.uuid));
    expect(readNodeTransform(rig.shield)).toEqual(originals.get(rig.shield.uuid));
  });
});
