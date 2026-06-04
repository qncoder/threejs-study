import * as THREE from 'three';

const CONTROL_SCRIPT_KEY = 'controlScript';
const CONTROL_SCRIPT_LIST_KEY = 'controlScripts';

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

  return setBoundNodeControlScripts(node, [createControlScriptEntry({ script })]);
}

export function setBoundNodeControlScripts(node, scripts) {
  if (!node) return { ok: false, error: '没有选中节点' };

  const entries = normalizeControlScriptEntries(scripts);
  node.userData = node.userData ?? {};

  if (!entries.length) {
    delete node.userData[CONTROL_SCRIPT_LIST_KEY];
    delete node.userData[CONTROL_SCRIPT_KEY];
    return { ok: true, error: '' };
  }

  node.userData[CONTROL_SCRIPT_LIST_KEY] = entries.map((entry) => ({ ...entry }));
  node.userData[CONTROL_SCRIPT_KEY] = entries[0].script;
  return { ok: true, error: '' };
}

export function clearNodeControlScript(node) {
  if (!node) return { ok: false, error: '没有选中节点' };

  if (node.userData) {
    delete node.userData[CONTROL_SCRIPT_LIST_KEY];
    delete node.userData[CONTROL_SCRIPT_KEY];
  }
  return { ok: true, error: '' };
}

export function getBoundNodeControlScripts(node) {
  const scripts = normalizeControlScriptEntries(node?.userData?.[CONTROL_SCRIPT_LIST_KEY]);
  if (scripts.length > 0) return scripts;

  const legacyScript = typeof node?.userData?.[CONTROL_SCRIPT_KEY] === 'string'
    ? node.userData[CONTROL_SCRIPT_KEY]
    : '';

  return legacyScript
    ? [createControlScriptEntry({ id: 'legacy-control-script', name: '脚本 1', script: legacyScript })]
    : [];
}

export function getBoundNodeControlScript(node, scriptId = '') {
  const scripts = getBoundNodeControlScripts(node);
  if (!scripts.length) return '';
  if (scriptId) {
    return scripts.find((item) => item.id === scriptId)?.script ?? '';
  }

  return scripts[0].script;
}

export function hasBoundNodeControlScript(node) {
  return getBoundNodeControlScripts(node).length > 0;
}

export function createControlScriptEntry({
  id = '',
  name = '',
  script = '',
  locked = false,
} = {}) {
  return normalizeControlScriptEntries([{ id, name, script, locked }])[0];
}

export function createNodeScriptDialogState({
  nodeUuid,
  node,
  row,
  transform,
}) {
  const scripts = getBoundNodeControlScripts(node);
  const dialogScripts = scripts.length > 0
    ? scripts
    : [createControlScriptEntry({
      name: '脚本 1',
      script: createTransformScript(transform),
    })];
  const activeScript = dialogScripts[0];
  const hasBoundScript = scripts.length > 0;

  return {
    open: true,
    nodeUuid,
    nodeTitle: row.displayName,
    nodeType: row.type,
    nodePath: row.path,
    scripts: dialogScripts,
    activeScriptId: activeScript.id,
    script: activeScript.script,
    scriptName: activeScript.name,
    message: activeScript.locked
      ? '当前脚本已锁定，先解锁再编辑。'
      : hasBoundScript
      ? `当前节点已绑定 ${scripts.length} 个脚本。`
      : '当前节点还没有脚本，可以新建一个。',
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

function normalizeControlScriptEntries(scripts) {
  if (!Array.isArray(scripts)) return [];

  const entries = [];
  scripts.forEach((item, index) => {
    if (typeof item === 'string') {
      entries.push(createControlScriptEntry({
        name: createDefaultControlScriptName(index),
        script: item,
      }));
      return;
    }

    if (!item || typeof item !== 'object') return;

    entries.push({
      id: normalizeControlScriptId(item.id),
      name: normalizeControlScriptName(item.name, index),
      script: String(item.script ?? ''),
      locked: normalizeControlScriptLocked(item.locked),
    });
  });

  return entries;
}

function normalizeControlScriptId(value) {
  const text = String(value ?? '').trim();
  return text || createControlScriptId();
}

function normalizeControlScriptName(value, index) {
  const text = String(value ?? '').trim();
  return text || createDefaultControlScriptName(index);
}

function normalizeControlScriptLocked(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function createDefaultControlScriptName(index) {
  return `脚本 ${index + 1}`;
}

function createControlScriptId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `script-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
