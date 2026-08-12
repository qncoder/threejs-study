import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Scene } from 'three';
import { getBoundNodeControlScripts } from './nodeScriptControl.js';

export function createEditedGlbFileName(fileName) {
  const normalized = String(fileName ?? '').trim();
  const baseName = normalized.replace(/\.glb$/i, '').trim() || 'model';
  return `${baseName}-edited.glb`;
}

export function createScriptExportGlbFileName(fileName) {
  const normalized = String(fileName ?? '').trim();
  const baseName = normalized.replace(/\.glb$/i, '').trim() || 'model';
  return `${baseName}-scripts.glb`;
}

export function exportModelAsGlb(model, exporter = new GLTFExporter()) {
  return new Promise((resolve, reject) => {
    if (!model) {
      reject(new Error('请先加载模型。'));
      return;
    }

    const exportRoot = model instanceof Scene ? model : createExportScene(model);

    exporter.parse(
      exportRoot,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          reject(new Error('模型导出结果不是 GLB 二进制数据。'));
          return;
        }
        resolve(result);
      },
      reject,
      { binary: true, onlyVisible: false },
    );
  });
}

export function exportModelWithScriptsAsGlb(model, exporter = new GLTFExporter()) {
  if (!model) {
    return exportModelAsGlb(model, exporter);
  }

  return exportModelAsGlb(createScriptExportModel(model), exporter);
}

export function createScriptExportModel(model) {
  const exportModel = model.clone(true);

  exportModel.traverse((object) => {
    const scripts = getBoundNodeControlScripts(object);
    if (!scripts.length) return;

    object.userData = { ...object.userData };
    object.userData.scripts = scripts.map((entry, index) => createDigitalTwinScript(entry, index));
    delete object.userData.script;
    delete object.userData.controlScripts;
    delete object.userData.controlScript;
  });

  return exportModel;
}

export function createDigitalTwinScript(entry, index = 0) {
  return {
    name: String(entry?.name ?? `脚本 ${index + 1}`).trim() || `脚本 ${index + 1}`,
    source: createDigitalTwinScriptSource(entry?.script),
    enabled: true,
    order: index + 1,
    target: { type: 'root' },
  };
}

export function createDigitalTwinScriptSource(script) {
  return String(script ?? '')
    .split(/\r?\n/)
    .filter((line) => !isDefaultTransformScriptLine(line))
    .join('\n')
    .replace(/\bnode(?=\s*(?:\.|\[))/g, 'this')
    .trim();
}

function isDefaultTransformScriptLine(line) {
  const text = String(line ?? '').trim();

  return (
    /^setPosition\([^)]*\);?$/.test(text) ||
    /^setRotationDeg\([^)]*\);?$/.test(text) ||
    /^setScale\([^)]*\);?$/.test(text)
  );
}

function createExportScene(model) {
  const scene = new Scene();
  scene.name = model.name || '';
  scene.children = [...model.children];
  scene.userData = { ...model.userData };
  return scene;
}
