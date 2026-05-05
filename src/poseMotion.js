import { applyNodeTransform } from './modelTransform.js';

export function normalizePosePayload(payload) {
  if (!payload || !Array.isArray(payload.nodes)) {
    return { ok: false, error: '姿态文件格式不正确。', pose: null };
  }

  const nodes = payload.nodes.filter(isPoseNode);
  if (nodes.length === 0) {
    return { ok: false, error: '姿态文件里没有节点姿态。', pose: null };
  }

  return {
    ok: true,
    error: '',
    pose: {
      modelName: payload.modelName ?? 'unknown',
      nodeCount: nodes.length,
      nodes,
    },
  };
}

export function clampPoseProgress(progress) {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(Math.max(progress, 0), 1);
}

export function applyPoseToModel(root, pose) {
  const objectsByPath = collectObjectsByPath(root);
  const appliedPaths = new Set();
  const missing = [];
  let applied = 0;

  for (const nodePose of pose.nodes ?? []) {
    const object = objectsByPath.get(nodePose.path);
    if (!object) {
      missing.push(nodePose.path);
      continue;
    }

    applyNodeTransform(object, nodePose);
    appliedPaths.add(nodePose.path);
    applied += 1;
  }

  root.updateWorldMatrix(true, true);
  return { applied, missing };
}

export function applyPoseTransition(root, startPose, endPose, progress) {
  const safeProgress = clampPoseProgress(progress);
  const startByPath = new Map((startPose.nodes ?? []).map((node) => [node.path, node]));
  const transitionNodes = [];
  const missing = [];

  for (const endNode of endPose.nodes ?? []) {
    const startNode = startByPath.get(endNode.path);
    if (!startNode) {
      missing.push(endNode.path);
      continue;
    }

    transitionNodes.push({
      path: endNode.path,
      position: interpolateArray(startNode.position, endNode.position, safeProgress),
      rotationDeg: interpolateArray(startNode.rotationDeg, endNode.rotationDeg, safeProgress),
      scale: interpolateArray(startNode.scale, endNode.scale, safeProgress),
    });
  }

  const result = applyPoseToModel(root, { nodes: transitionNodes });
  return {
    applied: result.applied,
    missing: [...missing, ...result.missing],
  };
}

function collectObjectsByPath(root) {
  const objects = new Map();

  function walk(object, parentPath) {
    const name = object.name || '(未命名)';
    const path = [...parentPath, name];
    objects.set(path.join('/'), object);
    object.children.forEach((child) => walk(child, path));
  }

  walk(root, []);
  return objects;
}

function isPoseNode(node) {
  return Boolean(
    node
      && typeof node.path === 'string'
      && isNumberArray(node.position, 3)
      && isNumberArray(node.rotationDeg, 3)
      && isNumberArray(node.scale, 3),
  );
}

function isNumberArray(value, length) {
  return Array.isArray(value)
    && value.length === length
    && value.every((item) => Number.isFinite(Number(item)));
}

function interpolateArray(start, end, progress) {
  return start.map((value, index) => value + (end[index] - value) * progress);
}
