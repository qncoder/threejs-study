import { describe, expect, it } from 'vitest';
import { Object3D, Scene } from 'three';
import {
  createDigitalTwinScriptSource,
  createScriptExportGlbFileName,
  createScriptExportModel,
  exportModelWithScriptsAsGlb,
} from './modelExport.js';

describe('createScriptExportGlbFileName', () => {
  it('按原文件名生成包含脚本的导出文件名', () => {
    expect(createScriptExportGlbFileName('ZF18000.glb')).toBe('ZF18000-scripts.glb');
    expect(createScriptExportGlbFileName('')).toBe('model-scripts.glb');
  });
});

describe('createDigitalTwinScriptSource', () => {
  it('去掉编辑器默认生成的变换模板行', () => {
    const source = [
      'setPosition(0, 0, 0);',
      'setRotationDeg(0, 0, 0);',
      'setScale(1, 1, 1);',
      '',
      'function loaded() {',
      '  this.visible = true;',
      '}',
    ].join('\n');

    expect(createDigitalTwinScriptSource(source)).toBe([
      'function loaded() {',
      '  this.visible = true;',
      '}',
    ].join('\n'));
  });

  it('删除所有编辑器变换辅助函数调用', () => {
    const source = [
      'function run() {',
      '  setPosition(1, 2, 3);',
      '  setRotationDeg(10, 20, 30);',
      '  setScale(2, 2, 2);',
      '  this.visible = true;',
      '}',
    ].join('\n');

    expect(createDigitalTwinScriptSource(source)).toBe([
      'function run() {',
      '  this.visible = true;',
      '}',
    ].join('\n'));
  });

  it('把当前节点引用从 node 改成 this', () => {
    const source = [
      'function loaded() {',
      '  node.position.y += 1;',
      '  node["visible"] = true;',
      '}',
    ].join('\n');

    expect(createDigitalTwinScriptSource(source)).toBe([
      'function loaded() {',
      '  this.position.y += 1;',
      '  this["visible"] = true;',
      '}',
    ].join('\n'));
  });

  it('不替换普通局部变量 node', () => {
    const source = [
      'function loaded() {',
      '  const node = this.parent;',
      '  nodeHelper(node);',
      '}',
    ].join('\n');

    expect(createDigitalTwinScriptSource(source)).toBe(source);
  });
});

describe('createScriptExportModel', () => {
  it('把节点 controlScripts 改成数字孪生项目需要的 scripts，且不修改原模型', () => {
    const root = new Scene();
    const arm = new Object3D();
    const child = new Object3D();

    arm.name = 'Arm';
    arm.userData = {
      other: '保留字段',
      controlScripts: [
        {
          id: 'loaded',
          name: 'loaded',
          script: [
            'setPosition(0, 0, 0);',
            'setRotationDeg(0, 0, 0);',
            'setScale(1, 1, 1);',
            '',
            'function loaded() {',
            '  this.visible = true;',
            '}',
          ].join('\n'),
          locked: true,
        },
        { id: 'run', name: 'run', script: 'function run() {\n  this.position.y += 1;\n}', locked: false },
      ],
      controlScript: 'node.lookAt(target);',
    };

    child.name = 'Legacy';
    child.userData = {
      controlScript: 'setScale(2, 2, 2);',
    };

    root.add(arm);
    arm.add(child);

    const exportModel = createScriptExportModel(root);
    const exportArm = exportModel.getObjectByName('Arm');
    const exportLegacy = exportModel.getObjectByName('Legacy');

    expect(exportModel).not.toBe(root);
    expect(exportArm).not.toBe(arm);
    expect(exportArm.userData.other).toBe('保留字段');
    expect(exportArm.userData.scripts).toEqual([
      {
        name: 'loaded',
        source: 'function loaded() {\n  this.visible = true;\n}',
        enabled: true,
        order: 1,
        target: { type: 'root' },
      },
      {
        name: 'run',
        source: 'function run() {\n  this.position.y += 1;\n}',
        enabled: true,
        order: 2,
        target: { type: 'root' },
      },
    ]);
    expect(exportArm.userData.script).toBeUndefined();
    expect(exportArm.userData.controlScripts).toBeUndefined();
    expect(exportArm.userData.controlScript).toBeUndefined();

    expect(exportLegacy.userData.scripts).toEqual([
      {
        name: '脚本 1',
        source: '',
        enabled: true,
        order: 1,
        target: { type: 'root' },
      },
    ]);
    expect(exportLegacy.userData.controlScript).toBeUndefined();

    expect(arm.userData.controlScripts).toHaveLength(2);
    expect(arm.userData.controlScript).toBe('node.lookAt(target);');
    expect(arm.userData.scripts).toBeUndefined();
    expect(child.userData.controlScript).toBe('setScale(2, 2, 2);');
  });
});

describe('exportModelWithScriptsAsGlb', () => {
  it('没有模型时返回和普通导出一致的错误', async () => {
    await expect(exportModelWithScriptsAsGlb(null)).rejects.toThrow('请先加载模型。');
  });

  it('导出时使用 scripts 字段版本的模型', async () => {
    const root = new Scene();
    const arm = new Object3D();
    let parsedModel = null;

    arm.userData = {
      controlScripts: [
        { id: 'run', name: 'run', script: 'setPosition(1, 2, 3);', locked: false },
      ],
    };
    root.add(arm);

    const exporter = {
      parse(model, onDone) {
        parsedModel = model;
        onDone(new ArrayBuffer(0));
      },
    };

    await expect(exportModelWithScriptsAsGlb(root, exporter)).resolves.toBeInstanceOf(
      ArrayBuffer,
    );

    const parsedArm = parsedModel.children[0];
    expect(parsedArm).not.toBe(arm);
    expect(parsedArm.userData.scripts).toEqual([
      {
        name: 'run',
        source: '',
        enabled: true,
        order: 1,
        target: { type: 'root' },
      },
    ]);
    expect(parsedArm.userData.controlScripts).toBeUndefined();
  });
});
