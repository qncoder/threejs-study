import { Box3, Vector3 } from 'three';

const UNNAMED = '(未命名)';
const NO_PARENT = '(无)';

export function collectModelInfo(model, gltf = {}, file = {}) {
  const materials = new Set();
  let nodeCount = 0;
  let meshCount = 0;
  let triangleCount = 0;

  model.updateWorldMatrix?.(true, true);
  model.traverse((object) => {
    nodeCount += 1;
    if (!object.isMesh) return;

    meshCount += 1;
    materialList(object.material).forEach((material) => materials.add(material.uuid ?? material.type));

    const positionCount = object.geometry?.attributes?.position?.count ?? 0;
    const indexCount = object.geometry?.index?.count ?? 0;
    triangleCount += indexCount ? indexCount / 3 : positionCount / 3;
  });

  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  return {
    fileName: file.name ?? 'unknown.glb',
    fileSize: formatBytes(file.size ?? 0),
    nodeCount,
    meshCount,
    materialCount: materials.size,
    triangleCount: roundNumber(triangleCount, 0),
    animationCount: gltf.animations?.length ?? 0,
    size: formatVector(size, ' x '),
    center: vectorToArray(center),
  };
}

export function collectNodeRows(model) {
  const rows = [];
  model.updateWorldMatrix?.(true, true);

  walkObject(model, 0, [], rows);
  return rows;
}

export function createStructureExport({ modelInfo, nodes, exportedAt = new Date().toISOString() }) {
  return {
    exportedAt,
    model: modelInfo,
    nodeCount: nodes.length,
    nodes,
  };
}

export function createPoseExport({ modelName, nodes, exportedAt = new Date().toISOString() }) {
  return {
    exportedAt,
    modelName,
    nodeCount: nodes.length,
    nodes: nodes.map((node) => ({
      uuid: node.uuid,
      name: node.name,
      path: node.path,
      parentName: node.parentName,
      position: node.position,
      rotationDeg: node.rotationDeg,
      scale: node.scale,
      worldPosition: node.worldPosition,
    })),
  };
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${roundNumber(size, size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function walkObject(object, depth, parentPath, rows) {
  object.updateWorldMatrix?.(true, false);
  const displayName = object.name || UNNAMED;
  const path = [...parentPath, displayName];
  const worldPosition = object.getWorldPosition(new Vector3());

  rows.push({
    uuid: object.uuid,
    name: object.name || UNNAMED,
    displayName,
    path: path.join('/'),
    type: object.type || 'Object3D',
    depth,
    parentName: object.parent?.name || NO_PARENT,
    childCount: object.children?.length ?? 0,
    isMesh: Boolean(object.isMesh),
    geometryType: object.geometry?.type ?? '',
    materialNames: materialList(object.material).map((material) => material.name || material.type || 'Material'),
    position: vectorToArray(object.position),
    rotation: vectorToArray(object.rotation),
    rotationDeg: [
      roundNumber(radToDeg(object.rotation.x), 3),
      roundNumber(radToDeg(object.rotation.y), 3),
      roundNumber(radToDeg(object.rotation.z), 3),
    ],
    scale: vectorToArray(object.scale),
    worldPosition: vectorToArray(worldPosition),
  });

  object.children.forEach((child) => walkObject(child, depth + 1, path, rows));
}

function materialList(material) {
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

function vectorToArray(vector) {
  return [roundNumber(vector.x), roundNumber(vector.y), roundNumber(vector.z)];
}

function formatVector(vector, separator = ', ') {
  return vectorToArray(vector).join(separator);
}

function radToDeg(value) {
  return (value * 180) / Math.PI;
}

function roundNumber(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
