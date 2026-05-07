import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Scene } from 'three';

export function createEditedGlbFileName(fileName) {
  const normalized = String(fileName ?? '').trim();
  const baseName = normalized.replace(/\.glb$/i, '').trim() || 'model';
  return `${baseName}-edited.glb`;
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

function createExportScene(model) {
  const scene = new Scene();
  scene.name = model.name || '';
  scene.children = [...model.children];
  scene.userData = { ...model.userData };
  return scene;
}
