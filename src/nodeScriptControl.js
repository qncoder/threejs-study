import * as THREE from 'three';

const CONTROL_SCRIPT_KEY = 'controlScript';

export function runNodeControlScript(node, script, context = {}) {
  if (!node) return { ok: false, error: '没有选中节点' };

  const helpers = createNodeHelpers(node);

  try {
    const execute = new Function(
      'node',
      'setPosition',
      'setRotationDeg',
      'setScale',
      'deg',
      'THREE',
      'scene',
      `"use strict";\n${script}`,
    );
    execute(
      node,
      helpers.setPosition,
      helpers.setRotationDeg,
      helpers.setScale,
      helpers.deg,
      THREE,
      context.scene ?? null,
    );
    node.updateMatrix();
    node.updateWorldMatrix(true, true);
    return { ok: true, error: '' };
  } catch (error) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}

export function runAndBindNodeControlScript(node, script, context = {}) {
  const runResult = runNodeControlScript(node, script, context);
  if (!runResult.ok) return runResult;

  return bindNodeControlScript(node, script);
}

export function bindNodeControlScript(node, script) {
  if (!node) return { ok: false, error: '没有选中节点' };

  node.userData = node.userData ?? {};
  node.userData[CONTROL_SCRIPT_KEY] = String(script ?? '');
  return { ok: true, error: '' };
}

export function clearNodeControlScript(node) {
  if (!node) return { ok: false, error: '没有选中节点' };

  if (node.userData) {
    delete node.userData[CONTROL_SCRIPT_KEY];
  }
  return { ok: true, error: '' };
}

export function getBoundNodeControlScript(node) {
  const script = node?.userData?.[CONTROL_SCRIPT_KEY];
  return typeof script === 'string' ? script : '';
}

export function hasBoundNodeControlScript(node) {
  return getBoundNodeControlScript(node).length > 0;
}

export function createNodeScriptDialogState({
  nodeUuid,
  node,
  row,
  transform,
}) {
  const hasBoundScript = hasBoundNodeControlScript(node);

  return {
    open: true,
    nodeUuid,
    nodeTitle: row.displayName,
    nodeType: row.type,
    nodePath: row.path,
    script: getBoundNodeControlScript(node) || createTransformScript(transform),
    message: hasBoundScript ? '当前节点已绑定脚本。' : '可以编辑并执行当前节点脚本。',
    messageType: 'hint',
  };
}

export function createTransformScript(transform) {
  const position = transform.position.map(formatScriptNumber).join(', ');
  const rotation = transform.rotationDeg.map(formatScriptNumber).join(', ');
  const scale = transform.scale.map(formatScriptNumber).join(', ');

  return [
    `setPosition(${position});`,
    `setRotationDeg(${rotation});`,
    `setScale(${scale});`,
    '',
    '// 也可以直接操作当前节点：',
    '// node.position.y -= 10;',
    '// node.rotation.z = deg(15);',
  ].join('\n');
}

function createNodeHelpers(node) {
  return {
    setPosition: (x, y, z) => {
      node.position.set(Number(x), Number(y), Number(z));
    },
    setRotationDeg: (x, y, z) => {
      node.rotation.set(deg(Number(x)), deg(Number(y)), deg(Number(z)));
    },
    setScale: (x, y, z) => {
      node.scale.set(Number(x), Number(y), Number(z));
    },
    deg,
  };
}

function formatScriptNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

function deg(value) {
  return (value * Math.PI) / 180;
}
