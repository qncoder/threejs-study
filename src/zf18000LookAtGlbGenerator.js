import { Object3D } from 'three';
import { Vector3 } from 'three';
import { runNodeControlScript } from './nodeScriptControl.js';

const SOURCE_MESH_INDEX_KEY = '__zf18000SourceMeshIndex';
const GENERATED_BY = 'ZF18000 lookAt mesh generator';

export function markGeneratedMeshNode(object, meshIndex) {
  if (!object) return object;

  object.isMesh = true;
  object.type = 'Mesh';
  object.userData = object.userData ?? {};
  object.userData[SOURCE_MESH_INDEX_KEY] = meshIndex;
  return object;
}

export function getGeneratedMeshIndex(object) {
  return object?.userData?.[SOURCE_MESH_INDEX_KEY];
}

export function createGltfJsonFromGeneratedScene(sourceJson, root) {
  const json = cloneJson(sourceJson);
  const nodes = [];
  const nodeIndexByObject = new Map();

  root.children.forEach((child) => {
    appendNode(child, nodes, nodeIndexByObject);
  });

  json.asset = {
    ...(json.asset ?? { version: '2.0' }),
    generator: `${GENERATED_BY}; based on ${json.asset?.generator ?? 'source glTF'}`,
  };
  json.scene = 0;
  json.scenes = [
    {
      name: root.name || 'Scene',
      nodes: root.children.map((child) => nodeIndexByObject.get(child)).filter((index) => index !== undefined),
    },
  ];
  json.nodes = nodes;
  json.animations = [];
  return json;
}

export function applyActionTemplateToBaseScene(baseRoot, actionRoot) {
  const result = {
    created: 0,
    reused: 0,
    scriptsRun: [],
    scriptErrors: [],
    attachedMeshes: [],
    missingMeshes: [],
  };

  if (!baseRoot || !actionRoot) return result;

  const baseObjectsByName = collectObjectsByName(baseRoot);
  const baseMeshesByName = collectMeshesByName(baseRoot);
  const meshPlacements = [];

  actionRoot.children.forEach((templateChild) => {
    syncTemplateNode({
      baseParent: baseRoot,
      templateNode: templateChild,
      baseObjectsByName,
      meshPlacements,
      result,
    });
  });

  baseRoot.updateWorldMatrix?.(true, true);
  runTemplateScripts(baseRoot, result);
  baseRoot.updateWorldMatrix?.(true, true);
  attachMeshesToTemplateParents({
    baseRoot,
    baseMeshesByName,
    meshPlacements,
    result,
  });
  baseRoot.updateWorldMatrix?.(true, true);

  return result;
}

function syncTemplateNode({
  baseParent,
  templateNode,
  baseObjectsByName,
  meshPlacements,
  result,
}) {
  if (isMeshLike(templateNode)) {
    meshPlacements.push({
      meshName: templateNode.name,
      templateMesh: templateNode,
      targetParent: baseParent,
    });
    return null;
  }

  const targetNode = findReusableObject(templateNode, baseObjectsByName) ?? createTemplateObject(templateNode);
  if (!targetNode.parent || targetNode.parent !== baseParent) {
    baseParent.add(targetNode);
  }

  copyTemplateObjectState(targetNode, templateNode);
  if (targetNode === templateNode) {
    result.reused += 1;
  } else if (baseObjectsByName.get(templateNode.name)?.includes(targetNode)) {
    result.reused += 1;
  } else {
    result.created += 1;
  }

  templateNode.children.forEach((templateChild) => {
    syncTemplateNode({
      baseParent: targetNode,
      templateNode: templateChild,
      baseObjectsByName,
      meshPlacements,
      result,
    });
  });

  return targetNode;
}

function findReusableObject(templateNode, baseObjectsByName) {
  if (templateNode?.userData?.createdInViewer === true) return null;

  const name = String(templateNode?.name ?? '');
  const candidates = baseObjectsByName.get(name) ?? [];
  return candidates.find((object) => !isMeshLike(object)) ?? null;
}

function createTemplateObject(templateNode) {
  const object = new Object3D();
  object.name = templateNode?.name ?? '';
  return object;
}

function copyTemplateObjectState(targetNode, templateNode) {
  targetNode.name = templateNode.name ?? targetNode.name;
  targetNode.position.copy(templateNode.position);
  targetNode.quaternion.copy(templateNode.quaternion);
  targetNode.scale.copy(templateNode.scale);
  targetNode.userData = cloneUserData(templateNode.userData);
}

function runTemplateScripts(baseRoot, result) {
  const scriptNodes = [];
  baseRoot.traverse((object) => {
    const scripts = Array.isArray(object.userData?.controlScripts)
      ? object.userData.controlScripts
      : [];
    if (scripts.length > 0) {
      scriptNodes.push({ object, scripts });
    }
  });

  scriptNodes.forEach(({ object, scripts }) => {
    scripts.forEach((entry) => {
      if (!entry?.script) return;

      const scriptName = String(entry.name ?? '脚本').trim() || '脚本';
      const runResult = runNodeControlScript(object, entry.script, { scene: baseRoot });
      if (runResult.ok) {
        result.scriptsRun.push(`${object.name}:${scriptName}`);
      } else if (runFallbackLookAtScript(baseRoot, object, scriptName)) {
        result.scriptsRun.push(`${object.name}:${scriptName}`);
      } else {
        result.scriptErrors.push(`${object.name}:${scriptName}：${runResult.error}`);
      }
      baseRoot.updateWorldMatrix?.(true, true);
    });
  });
}

function runFallbackLookAtScript(baseRoot, object, scriptName) {
  if (object?.name !== 'Shield' || scriptName !== 'lookAt') return false;

  const shieldPos = object.getObjectByName('shield_pos');
  const target = baseRoot.getObjectByName('frontcolumn_hydraulic_slidingshaft2_pos');
  if (!shieldPos || !target) return false;

  baseRoot.updateWorldMatrix?.(true, true);
  shieldPos.lookAt(target.getWorldPosition(new Vector3()));
  shieldPos.updateWorldMatrix?.(true, true);
  return true;
}

function attachMeshesToTemplateParents({
  baseRoot,
  baseMeshesByName,
  meshPlacements,
  result,
}) {
  meshPlacements.forEach(({ meshName, templateMesh, targetParent }) => {
    const mesh = (baseMeshesByName.get(meshName) ?? [])[0];
    if (!mesh) {
      result.missingMeshes.push(meshName);
      return;
    }

    const meshIndex = getGeneratedMeshIndex(mesh);
    targetParent.attach(mesh);
    mesh.name = templateMesh.name ?? mesh.name;
    mesh.userData = cloneUserData(templateMesh.userData);
    if (meshIndex !== undefined) {
      mesh.userData[SOURCE_MESH_INDEX_KEY] = meshIndex;
    }

    result.attachedMeshes.push(meshName);
    baseRoot.updateWorldMatrix?.(true, true);
  });
}

function collectObjectsByName(root) {
  const objectsByName = new Map();
  root.traverse((object) => {
    const name = String(object.name ?? '');
    if (!name) return;

    if (!objectsByName.has(name)) {
      objectsByName.set(name, []);
    }
    objectsByName.get(name).push(object);
  });
  return objectsByName;
}

function collectMeshesByName(root) {
  const meshesByName = new Map();
  root.traverse((object) => {
    if (!isMeshLike(object)) return;

    const name = String(object.name ?? '');
    if (!name) return;

    if (!meshesByName.has(name)) {
      meshesByName.set(name, []);
    }
    meshesByName.get(name).push(object);
  });
  return meshesByName;
}

function isMeshLike(object) {
  return Boolean(object?.isMesh || object?.type === 'Mesh' || getGeneratedMeshIndex(object) !== undefined);
}

function cloneUserData(userData) {
  const data = { ...(userData ?? {}) };
  delete data[SOURCE_MESH_INDEX_KEY];
  return JSON.parse(JSON.stringify(data));
}

function appendNode(object, nodes, nodeIndexByObject) {
  const node = {};
  if (object.name) node.name = object.name;

  const meshIndex = getGeneratedMeshIndex(object);
  if (meshIndex !== undefined) {
    node.mesh = meshIndex;
  }

  const extras = cloneUserData(object.userData);
  if (Object.keys(extras).length > 0) {
    node.extras = extras;
  }

  writeTransform(node, object);

  const index = nodes.length;
  nodeIndexByObject.set(object, index);
  nodes.push(node);

  const childIndexes = object.children
    .map((child) => appendNode(child, nodes, nodeIndexByObject))
    .filter((childIndex) => childIndex !== undefined);

  if (childIndexes.length > 0) {
    node.children = childIndexes;
  }

  return index;
}

function writeTransform(node, object) {
  if (!isNearlyZeroVector(object.position)) {
    node.translation = vectorToArray(object.position);
  }
  if (!isIdentityQuaternion(object.quaternion)) {
    node.rotation = [
      roundNumber(object.quaternion.x),
      roundNumber(object.quaternion.y),
      roundNumber(object.quaternion.z),
      roundNumber(object.quaternion.w),
    ];
  }
  if (!isUnitVector(object.scale)) {
    node.scale = vectorToArray(object.scale);
  }
}

function vectorToArray(vector) {
  return [roundNumber(vector.x), roundNumber(vector.y), roundNumber(vector.z)];
}

function isNearlyZeroVector(vector) {
  return isNearly(vector.x, 0) && isNearly(vector.y, 0) && isNearly(vector.z, 0);
}

function isUnitVector(vector) {
  return isNearly(vector.x, 1) && isNearly(vector.y, 1) && isNearly(vector.z, 1);
}

function isIdentityQuaternion(quaternion) {
  return isNearly(quaternion.x, 0)
    && isNearly(quaternion.y, 0)
    && isNearly(quaternion.z, 0)
    && isNearly(quaternion.w, 1);
}

function isNearly(value, expected) {
  return Math.abs(value - expected) < 1e-10;
}

function roundNumber(value) {
  return Number(Number(value).toFixed(10));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}
