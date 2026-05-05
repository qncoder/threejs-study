import { applyNodeTransform, cloneTransform } from './modelTransform.js';

const MOTION_RULES = [
  {
    name: 'frontcolumn_hydraulic_slidingshaft1',
    position: [0, -0.18, 0],
  },
  {
    name: 'frontcolumn_hydraulic_slidingshaft2',
    position: [0, -0.34, 0],
  },
  {
    name: 'TopBeam',
    position: [0, -0.28, -0.04],
    rotationDeg: [0, 0, 3],
  },
  {
    name: 'Rod',
    position: [0, -0.06, 0],
    rotationDeg: [0, 0, 8],
  },
  {
    name: 'Shield',
    position: [0, -0.08, 0.03],
    rotationDeg: [0, 0, -8],
  },
  {
    name: 'TailBeam',
    position: [0, -0.04, 0.06],
    rotationDeg: [0, 0, 10],
  },
  {
    name: 'FlexBeamStroke',
    position: [0, -0.03, -0.03],
    rotationDeg: [0, 0, -5],
  },
  {
    name: 'BackStroke',
    position: [0, -0.02, 0.03],
    rotationDeg: [0, 0, 4],
  },
];

export function clampMotionProgress(progress) {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(Math.max(progress, 0), 1);
}

export function applyMechanismMotion(root, originals, progress) {
  if (!root || !originals) {
    return { applied: [], missing: MOTION_RULES.map((rule) => rule.name) };
  }

  const safeProgress = clampMotionProgress(progress);
  const objectsByName = collectObjectsByName(root);
  const applied = [];
  const missing = [];

  for (const rule of MOTION_RULES) {
    const name = rule.name;
    const object = objectsByName.get(name);
    if (!object) {
      missing.push(name);
      continue;
    }

    applyRuleToObject(object, originals, rule, safeProgress);
    applied.push(name);
  }

  root.updateWorldMatrix(true, true);
  return { applied, missing };
}

function collectObjectsByName(root) {
  const objects = new Map();
  root.traverse((object) => {
    if (object.name && !objects.has(object.name)) {
      objects.set(object.name, object);
    }
  });
  return objects;
}

function applyRuleToObject(object, originals, rule, progress) {
  const original = originals.get(object.uuid);
  if (!original) return;

  applyNodeTransform(object, addRuleDelta(original, rule, progress));
}

function addRuleDelta(original, rule, progress) {
  const next = cloneTransform(original);
  addScaled(next.position, rule.position, progress);
  addScaled(next.rotationDeg, rule.rotationDeg, progress);
  return next;
}

function addScaled(target, delta = [], progress) {
  for (let index = 0; index < target.length; index += 1) {
    target[index] += (delta[index] ?? 0) * progress;
  }
}
