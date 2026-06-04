import * as THREE from 'three';
import { applyLookAtMeshHierarchy } from './lookAtScript.js';

import backColumnLookAtScript from '../script/BackColumn/lookAt.js?raw';
import frontColumnLookAtScript from '../script/FrontColumn/lookAt.js?raw';
import rodLookAtScript from '../script/Rod/lookAt.js?raw';
import shieldLookAtScript from '../script/Shield/lookAt.js?raw';

export const ZF18000_FOUR_LINK_LOOK_AT_TARGETS = [
  { name: 'BackColumn', script: backColumnLookAtScript },
  { name: 'FrontColumn', script: frontColumnLookAtScript },
  { name: 'Rod', script: rodLookAtScript },
  { name: 'Shield', script: shieldLookAtScript },
];

export function applyZf18000FourLinkLookAt(root) {
  if (!root) {
    return {
      ok: false,
      executed: [],
      moved: 0,
      missing: ['root'],
      errors: ['请先加载模型。'],
    };
  }

  root.updateWorldMatrix?.(true, true);

  const executed = [];
  const missing = [];
  const errors = [];
  let moved = 0;

  for (const item of ZF18000_FOUR_LINK_LOOK_AT_TARGETS) {
    root.updateWorldMatrix?.(true, true);
    const scopeNode = root.getObjectByName(item.name);
    if (!scopeNode) {
      missing.push(item.name);
      continue;
    }

    try {
      runLookAtScript(scopeNode, item.script);
      root.updateWorldMatrix?.(true, true);

      const result = applyLookAtMeshHierarchy(root, scopeNode);
      moved += result.moved ?? 0;
      executed.push(item.name);
    } catch (error) {
      errors.push(`${item.name}：${error?.message ?? String(error)}`);
    }
  }

  root.updateWorldMatrix?.(true, true);

  return {
    ok: missing.length === 0 && errors.length === 0,
    executed,
    moved,
    missing,
    errors,
  };
}

function runLookAtScript(node, script) {
  const execute = new Function('node', 'THREE', `"use strict";\n${script}`);
  execute(node, THREE);
}
