import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  applyActionTemplateToBaseScene,
  createGltfJsonFromGeneratedScene,
  markGeneratedMeshNode,
} from '../src/zf18000LookAtGlbGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const defaultBaseFile = path.join(projectRoot, 'src', 'ZF18000.glb');
const defaultTemplateFile = path.join(projectRoot, 'src', 'ZF18000-scence-action.glb');
const defaultOutputFile = path.join(projectRoot, 'src', 'ZF18000-lookat-generated.glb');

const baseFile = path.resolve(projectRoot, process.argv[2] ?? defaultBaseFile);
const templateFile = path.resolve(projectRoot, process.argv[3] ?? defaultTemplateFile);
const outputFile = path.resolve(projectRoot, process.argv[4] ?? defaultOutputFile);

const baseGlb = parseGlb(await fs.readFile(baseFile));
const templateGlb = parseGlb(await fs.readFile(templateFile));

const baseScene = buildSceneFromGltf(baseGlb.json, {
  markMeshIndex: true,
  sceneName: path.basename(baseFile),
});
const templateScene = buildSceneFromGltf(templateGlb.json, {
  markMeshIndex: false,
  sceneName: path.basename(templateFile),
});

const result = applyActionTemplateToBaseScene(baseScene, templateScene);
const outputJson = createGltfJsonFromGeneratedScene(baseGlb.json, baseScene);
const outputBuffer = packGlb(outputJson, baseGlb.bin);

await fs.writeFile(outputFile, outputBuffer);

console.log(`已生成：${outputFile}`);
console.log(`新增控制节点：${result.created}`);
console.log(`复用原始节点：${result.reused}`);
console.log(`已执行脚本：${result.scriptsRun.length}`);
if (result.scriptsRun.length > 0) {
  console.log(result.scriptsRun.map((name) => `  - ${name}`).join('\n'));
}
console.log(`已挂到模板父级的 mesh：${result.attachedMeshes.length}`);
if (result.missingMeshes.length > 0) {
  console.log(`缺少 mesh：${result.missingMeshes.join('、')}`);
}
if (result.scriptErrors.length > 0) {
  console.log('脚本执行失败：');
  console.log(result.scriptErrors.map((error) => `  - ${error}`).join('\n'));
}

function parseGlb(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('文件不是 GLB 格式。');
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`只支持 GLB 2.0，当前版本是 ${version}。`);
  }

  const totalLength = buffer.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let bin = Buffer.alloc(0);

  while (offset < totalLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + chunkLength;

    if (chunkType === 'JSON') {
      json = JSON.parse(buffer.toString('utf8', start, end).trim());
    } else if (chunkType === 'BIN\0') {
      bin = buffer.subarray(start, end);
    }

    offset = end;
  }

  if (!json) {
    throw new Error('GLB 里没有 JSON chunk。');
  }

  return { json, bin };
}

function buildSceneFromGltf(json, { markMeshIndex, sceneName }) {
  const scene = new THREE.Scene();
  scene.name = sceneName;

  const nodeObjects = (json.nodes ?? []).map((node, index) => createObjectFromNode(json, node, index, markMeshIndex));
  (json.nodes ?? []).forEach((node, index) => {
    const object = nodeObjects[index];
    (node.children ?? []).forEach((childIndex) => {
      const child = nodeObjects[childIndex];
      if (child) object.add(child);
    });
  });

  const sceneIndex = json.scene ?? 0;
  const sceneDef = json.scenes?.[sceneIndex] ?? json.scenes?.[0] ?? {};
  (sceneDef.nodes ?? []).forEach((nodeIndex) => {
    const object = nodeObjects[nodeIndex];
    if (object) scene.add(object);
  });

  scene.updateWorldMatrix(true, true);
  return scene;
}

function createObjectFromNode(json, node, nodeIndex, markMeshIndex) {
  const object = new THREE.Object3D();
  object.name = node.name ?? `node_${nodeIndex}`;
  object.userData = cloneJson(node.extras ?? {});

  applyNodeTransform(object, node);

  if (node.mesh !== undefined && markMeshIndex) {
    markGeneratedMeshNode(object, node.mesh);
  } else if (node.mesh !== undefined) {
    object.isMesh = true;
    object.type = 'Mesh';
  }

  return object;
}

function applyNodeTransform(object, node) {
  if (Array.isArray(node.matrix)) {
    const matrix = new THREE.Matrix4();
    matrix.fromArray(node.matrix);
    matrix.decompose(object.position, object.quaternion, object.scale);
    return;
  }

  if (Array.isArray(node.translation)) {
    object.position.fromArray(node.translation);
  }
  if (Array.isArray(node.rotation)) {
    object.quaternion.fromArray(node.rotation);
  }
  if (Array.isArray(node.scale)) {
    object.scale.fromArray(node.scale);
  }
}

function packGlb(json, bin) {
  const jsonBuffer = padBuffer(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binBuffer = padBuffer(bin, 0x00);
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;

  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'utf8');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.write('JSON', 4, 4, 'utf8');

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.write('BIN\0', 4, 4, 'utf8');

  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer], totalLength);
}

function padBuffer(buffer, paddingByte) {
  const padding = (4 - (buffer.length % 4)) % 4;
  if (padding === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(padding, paddingByte)]);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
