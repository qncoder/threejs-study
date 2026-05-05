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

function deg(value) {
  return (value * Math.PI) / 180;
}
