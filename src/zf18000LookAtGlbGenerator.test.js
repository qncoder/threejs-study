import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import {
  applyActionTemplateToBaseScene,
  createGltfJsonFromGeneratedScene,
  markGeneratedMeshNode,
} from './zf18000LookAtGlbGenerator.js';

function namedObject(name, position = new Vector3()) {
  const object = new Object3D();
  object.name = name;
  object.position.copy(position);
  return object;
}

describe('ZF18000 action 模板生成', () => {
  it('先执行模板里的 lookAt 脚本，再按模板把 mesh 挂到对应 _pos 下', () => {
    const baseRoot = namedObject('base-root');
    const arm = namedObject('Arm');
    const beamMesh = markGeneratedMeshNode(namedObject('beam', new Vector3(1, 0, 0)), 7);
    arm.add(beamMesh);
    baseRoot.add(arm);

    const templateRoot = namedObject('template-root');
    const templateArm = namedObject('Arm');
    templateArm.userData.controlScripts = [
      {
        name: 'lookAt',
        script: [
          'const beamPos = node.getObjectByName("beam_pos")',
          'const target = node.getObjectByName("target")',
          'beamPos.lookAt(target.getWorldPosition(new THREE.Vector3()))',
        ].join('\n'),
      },
    ];
    const templateBeamPos = namedObject('beam_pos');
    const templateTarget = namedObject('target', new Vector3(0, 0, 5));
    const templateBeamMesh = markGeneratedMeshNode(namedObject('beam'), 7);
    templateBeamPos.add(templateBeamMesh);
    templateArm.add(templateBeamPos);
    templateArm.add(templateTarget);
    templateRoot.add(templateArm);

    const result = applyActionTemplateToBaseScene(baseRoot, templateRoot);

    const generatedArm = baseRoot.getObjectByName('Arm');
    const generatedBeamPos = baseRoot.getObjectByName('beam_pos');
    const generatedBeam = baseRoot.getObjectByName('beam');

    expect(result.created).toBe(2);
    expect(result.scriptsRun).toEqual(['Arm:lookAt']);
    expect(result.attachedMeshes).toEqual(['beam']);
    expect(generatedBeam.parent).toBe(generatedBeamPos);

    const direction = new Vector3();
    generatedBeamPos.getWorldDirection(direction);
    expect(direction.z).toBeGreaterThan(0.99);
    expect(generatedArm.userData.controlScripts[0].name).toBe('lookAt');

    const json = createGltfJsonFromGeneratedScene(
      {
        asset: { version: '2.0' },
        meshes: [{}, {}, {}, {}, {}, {}, {}, { name: 'beamMesh' }],
        materials: [],
        accessors: [],
        bufferViews: [],
        buffers: [{ byteLength: 0 }],
      },
      baseRoot,
    );
    const armNodeIndex = json.scenes[0].nodes[0];
    const armNode = json.nodes[armNodeIndex];
    const beamPosNode = json.nodes.find((node) => node.name === 'beam_pos');
    const beamNode = json.nodes.find((node) => node.name === 'beam');

    expect(json.asset.generator).toContain('ZF18000');
    expect(armNode.extras.controlScripts[0].name).toBe('lookAt');
    expect(beamPosNode.children).toContain(json.nodes.indexOf(beamNode));
    expect(beamNode.mesh).toBe(7);
  });

  it('Shield 的旧 lookAt 脚本按父级找不到目标时，会回退到整棵场景里查找', () => {
    const baseRoot = namedObject('base-root');
    const frontColumn = namedObject('FrontColumn');
    const frontColumnPos = namedObject('frontcolumn_hydraulic_slidingshaft2_pos', new Vector3(0, 0, 5));
    frontColumn.add(frontColumnPos);
    baseRoot.add(frontColumn);

    const rod = namedObject('Rod');
    const backrodShield = namedObject('backrod_shield');
    const shield = namedObject('Shield');
    const shieldMesh = markGeneratedMeshNode(namedObject('shield'), 3);
    shield.add(shieldMesh);
    backrodShield.add(shield);
    rod.add(backrodShield);
    baseRoot.add(rod);

    const templateRoot = namedObject('template-root');
    const templateRod = namedObject('Rod');
    const templateBackrodShield = namedObject('backrod_shield');
    const templateShield = namedObject('Shield');
    templateShield.userData.controlScripts = [
      {
        name: 'lookAt',
        script: [
          'const shield_pos = node.getObjectByName("shield_pos")',
          'const frontcolumn_hydraulic_slidingshaft2_pos = node.parent.parent.getObjectByName("frontcolumn_hydraulic_slidingshaft2_pos")',
          'shield_pos.lookAt(frontcolumn_hydraulic_slidingshaft2_pos.getWorldPosition(new THREE.Vector3()))',
        ].join('\n'),
      },
    ];
    const templateShieldPos = namedObject('shield_pos');
    const templateShieldMesh = markGeneratedMeshNode(namedObject('shield'), 3);
    templateShieldPos.add(templateShieldMesh);
    templateShield.add(templateShieldPos);
    templateBackrodShield.add(templateShield);
    templateRod.add(templateBackrodShield);
    templateRoot.add(templateRod);

    const result = applyActionTemplateToBaseScene(baseRoot, templateRoot);
    const generatedShieldPos = baseRoot.getObjectByName('shield_pos');
    const direction = new Vector3();
    generatedShieldPos.getWorldDirection(direction);

    expect(result.scriptErrors).toEqual([]);
    expect(result.scriptsRun).toContain('Shield:lookAt');
    expect(direction.z).toBeGreaterThan(0.99);
  });
});
