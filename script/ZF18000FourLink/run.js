const DRIVE_PROGRESS = 0.5; // 0 ~ 1，0.5 是初始油缸长度
const DRIVE_RANGE_RATIO = 0.3; // 总调节范围，0.3 表示初始长度的 70% ~ 130%
const RESET_STATE = false;
const STORE_KEY = '__zf18000FourLinkState';
const EPSILON = 1e-6;

const NODE_NAMES = {
  hydraulicFixedAxis: 'frontrod_fixed',
  hydraulicSlidingShaft: 'frontrod_shield',
  crankMiddelFixed: 'backrod_fixed',
  crankMiddelSliding: 'backrod_shield',
  crankAfterFixed: 'shield',
  crankAfterSliding: 'topbeamcentertop',
};

const FOLLOWERS = {
};

const root = scene;

if (!root) {
  console.warn('请先加载 ZF18000 模型。');
  return;
}

if (RESET_STATE) {
  delete root.userData[STORE_KEY];
  console.log('已清除 ZF18000 四连杆初始姿态，下次执行会重新记录。');
  return;
}

root.updateWorldMatrix?.(true, true);

const collectResult = collectNodes(root, NODE_NAMES);
if (!collectResult.ok) {
  console.warn(collectResult.error, collectResult.missing);
  return;
}

const previousState = root.userData[STORE_KEY];
if (!previousState || !isSameNodes(previousState.nodes, collectResult.nodes)) {
  const captureResult = captureState(root, collectResult.nodes);
  if (!captureResult.ok) {
    console.warn(captureResult.error);
    return;
  }

  root.userData[STORE_KEY] = captureResult.state;
  console.log('已记录 ZF18000 四连杆初始姿态。');
}

const state = root.userData[STORE_KEY];
const progress = clamp(DRIVE_PROGRESS, 0, 1);
const targetAB = state.lengths.ab * (1 - DRIVE_RANGE_RATIO + DRIVE_RANGE_RATIO * 2 * progress);
const solutionResult = findSolution({
  ...state,
  lengths: {
    ...state.lengths,
    ab: targetAB,
  },
});

if (!solutionResult.ok) {
  console.warn(solutionResult.error);
  return;
}

const applyResult = applySolution(root, state, solutionResult.solution);
if (!applyResult.ok) {
  console.warn(applyResult.error);
  return;
}

console.log('已应用 ZF18000 四连杆。', {
  progress,
  ab: targetAB.toFixed(4),
  ac: solutionResult.solution.ac.toFixed(4),
  errorOffset: solutionResult.solution.errorOffset.toFixed(4),
  angABC: solutionResult.solution.angles.angABC.toFixed(2),
  angDCF: solutionResult.solution.angles.angDCF.toFixed(2),
  angCFE: solutionResult.solution.angles.angCFE.toFixed(2),
});

function collectNodes(rootObject, nodeNames) {
  const nodes = {};
  const missing = [];

  for (const [key, name] of Object.entries(nodeNames)) {
    const object = rootObject.getObjectByName(name);
    if (!object) {
      missing.push(name);
      continue;
    }
    nodes[key] = object;
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: 'ZF18000 四连杆脚本缺少必要节点：',
      missing,
    };
  }

  return { ok: true, nodes };
}

function captureState(rootObject, nodes) {
  const initialWorld = {};
  for (const key of Object.keys(NODE_NAMES)) {
    initialWorld[key] = readWorldPosition(nodes[key]);
  }

  const axis = new THREE.Vector3(1, 0, 0);
  const lengths = {
    ab: initialWorld.hydraulicFixedAxis.distanceTo(initialWorld.hydraulicSlidingShaft),
    bc: initialWorld.hydraulicFixedAxis.distanceTo(initialWorld.crankMiddelFixed),
    cd: initialWorld.crankMiddelSliding.distanceTo(initialWorld.crankMiddelFixed),
    ad: initialWorld.hydraulicSlidingShaft.distanceTo(initialWorld.crankMiddelSliding),
    de: initialWorld.crankMiddelSliding.distanceTo(initialWorld.crankAfterSliding),
    ef: initialWorld.crankAfterSliding.distanceTo(initialWorld.crankAfterFixed),
    cf: initialWorld.crankAfterFixed.distanceTo(initialWorld.crankMiddelFixed),
  };

  const movingGroups = createMovingGroups(rootObject, nodes, initialWorld);

  return {
    ok: true,
    state: {
      nodes,
      axis,
      initialWorld,
      lengths,
      angles: {
        ADE: calculateAngle(initialWorld.hydraulicSlidingShaft, initialWorld.crankMiddelSliding, initialWorld.crankAfterSliding),
        BCF: 360 - calculateAngle(initialWorld.hydraulicFixedAxis, initialWorld.crankMiddelFixed, initialWorld.crankAfterFixed),
      },
      search: {
        startAC: Math.max(EPSILON, lengths.ab * 0.04),
        endAC: Math.max(lengths.ab * 2, EPSILON * 10),
        step: Math.max((lengths.ab * 2) / 400, 0.005),
        zoomOut: 0.3,
        minStep: 0.00017,
        tolerance: 1,
        maxDepth: 12,
      },
      movingGroups,
    },
  };
}

function findSolution(state) {
  return iterateRange(state, state.search.startAC, state.search.endAC, state.search.step, 0);
}

function iterateRange(state, start, end, step, depth) {
  let bestAbsolute = null;
  let previousValid = null;
  const brackets = [];

  for (let ac = start; ac < end + EPSILON; ac += step) {
    const solveResult = solveFourLink(state, ac);
    if (!solveResult.ok) continue;

    const error = Math.abs(solveResult.errorOffset);
    if (!bestAbsolute || error < Math.abs(bestAbsolute.errorOffset)) {
      bestAbsolute = solveResult;
    }

    if (error <= state.search.tolerance) {
      solveResult.targetWorld = createTargets(state, solveResult);
      return { ok: true, solution: solveResult };
    }

    if (previousValid && isSignChanged(previousValid.errorOffset, solveResult.errorOffset)) {
      brackets.push({
        start: previousValid.ac < solveResult.ac ? previousValid : solveResult,
        end: previousValid.ac < solveResult.ac ? solveResult : previousValid,
        center: (previousValid.ac + solveResult.ac) / 2,
      });
    }

    previousValid = solveResult;
  }

  if (bestAbsolute && Math.abs(bestAbsolute.errorOffset) <= state.search.tolerance) {
    bestAbsolute.targetWorld = createTargets(state, bestAbsolute);
    return { ok: true, solution: bestAbsolute };
  }

  if (brackets.length === 0) {
    return {
      ok: false,
      error: bestAbsolute
        ? `找不到可用解，当前最小误差为 ${bestAbsolute.errorOffset.toFixed(4)}。`
        : '找不到可用解，搜索区间内没有有效三角形。',
    };
  }

  const nextStep = step * state.search.zoomOut;
  if (nextStep < state.search.minStep || depth >= state.search.maxDepth) {
    return {
      ok: false,
      error: `找不到满足容差的解，当前最小误差为 ${Math.abs(bestAbsolute.errorOffset).toFixed(4)}。`,
    };
  }

  const bracket = brackets.sort((left, right) => Math.abs(left.center - state.lengths.ab) - Math.abs(right.center - state.lengths.ab))[0];
  return iterateRange(state, bracket.start.ac, bracket.end.ac, nextStep, depth + 1);
}

function solveFourLink(state, ac) {
  const safeAC = Number(ac);
  const { ab, bc, cd, ad, de, ef, cf } = state.lengths;
  const { ADE, BCF } = state.angles;

  const angABC = lawOfCosinesAngleDeg(ab, bc, safeAC);
  const tempABC = lawOfCosinesAngleDeg(safeAC, bc, ab);
  const tempACD = lawOfCosinesAngleDeg(safeAC, cd, ad);
  const angADC = lawOfCosinesAngleDeg(ad, cd, safeAC);
  if ([angABC, tempABC, tempACD, angADC].some((item) => item == null)) {
    return { ok: false };
  }

  const angleCDE = ADE - angADC;
  const dceSquared = cd ** 2 + de ** 2 - 2 * cd * de * Math.cos(degToRad(angleCDE));
  if (!Number.isFinite(dceSquared) || dceSquared <= EPSILON) return { ok: false };

  const dce = Math.sqrt(dceSquared);
  const tempDCE = lawOfCosinesAngleDeg(cd, dce, de);
  const tempDCF = lawOfCosinesAngleDeg(dce, cf, ef);
  const angCFE = lawOfCosinesAngleDeg(cf, ef, dce);
  if ([tempDCE, tempDCF, angCFE].some((item) => item == null)) {
    return { ok: false };
  }

  return {
    ok: true,
    ac: safeAC,
    dce,
    errorOffset: BCF - (tempABC + tempACD) - (tempDCE + tempDCF),
    angles: {
      angABC,
      angADC,
      angDCF: tempDCE + tempDCF,
      angCFE,
    },
  };
}

function createTargets(state, solution) {
  return {
    hydraulicSlidingShaft: rockPoint(state.initialWorld.hydraulicFixedAxis, state.initialWorld.crankMiddelFixed, state.axis, solution.angles.angABC, state.lengths.ab),
    crankMiddelSliding: rockPoint(state.initialWorld.crankMiddelFixed, state.initialWorld.crankAfterFixed, state.axis, solution.angles.angDCF, state.lengths.cd),
    crankAfterSliding: rockPoint(state.initialWorld.crankAfterFixed, state.initialWorld.crankMiddelFixed, state.axis, -solution.angles.angCFE, state.lengths.ef),
  };
}

function applySolution(rootObject, state, solution) {
  if (!solution.targetWorld) {
    return { ok: false, error: '缺少四连杆解算结果。' };
  }

  for (const key of Object.keys(state.movingGroups)) {
    if (state.movingGroups[key].some((item) => !item.object.parent)) {
      return { ok: false, error: '运动点缺少父级，无法写回本地坐标。' };
    }
  }

  for (const key of Object.keys(state.movingGroups)) {
    const delta = solution.targetWorld[key].clone().sub(state.initialWorld[key]);
    for (const item of state.movingGroups[key]) {
      setWorldPosition(item.object, item.initialWorld.clone().add(delta));
    }
  }

  rootObject.updateWorldMatrix?.(true, true);
  return { ok: true };
}

function createMovingGroups(rootObject, nodes, initialWorld) {
  const groups = {};
  for (const key of ['hydraulicSlidingShaft', 'crankMiddelSliding', 'crankAfterSliding']) {
    const items = [
      {
        object: nodes[key],
        initialWorld: initialWorld[key].clone(),
      },
    ];

    for (const name of FOLLOWERS[key] ?? []) {
      const object = rootObject.getObjectByName(name);
      if (!object || items.some((item) => item.object === object || isDescendantOf(object, item.object))) continue;

      for (let index = items.length - 1; index >= 0; index -= 1) {
        if (isDescendantOf(items[index].object, object)) {
          items.splice(index, 1);
        }
      }

      items.push({
        object,
        initialWorld: readWorldPosition(object),
      });
    }

    groups[key] = items;
  }
  return groups;
}

function rockPoint(start, end, axis, angleDeg, length) {
  const direction = end.clone().sub(start).normalize();
  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), degToRad(angleDeg));
  return start.clone().add(direction.applyQuaternion(quaternion).normalize().multiplyScalar(length));
}

function lawOfCosinesAngleDeg(left, right, opposite) {
  const denominator = 2 * left * right;
  if (!Number.isFinite(denominator) || denominator <= EPSILON) return null;

  const cosine = (left ** 2 + right ** 2 - opposite ** 2) / denominator;
  if (!Number.isFinite(cosine) || cosine < -1 - EPSILON || cosine > 1 + EPSILON) return null;

  return radToDeg(Math.acos(clamp(cosine, -1, 1)));
}

function calculateAngle(startWorld, axisWorld, endWorld) {
  const from = startWorld.clone().sub(axisWorld);
  const to = endWorld.clone().sub(axisWorld);
  if (from.lengthSq() <= EPSILON || to.lengthSq() <= EPSILON) return 0;
  return radToDeg(from.normalize().angleTo(to.normalize()));
}

function readWorldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function setWorldPosition(object, targetWorld) {
  const local = targetWorld.clone();
  object.parent.updateWorldMatrix(true, true);
  object.parent.worldToLocal(local);
  object.position.copy(local);
  object.updateMatrix();
  object.updateWorldMatrix(true, true);
}

function isSameNodes(previousNodes = {}, nextNodes = {}) {
  return Object.keys(NODE_NAMES).every((key) => previousNodes[key] === nextNodes[key]);
}

function isDescendantOf(object, parent) {
  let current = object.parent;
  while (current) {
    if (current === parent) return true;
    current = current.parent;
  }
  return false;
}

function isSignChanged(left, right) {
  return (left < 0 && right > 0) || (left > 0 && right < 0);
}

function radToDeg(value) {
  return (value * 180) / Math.PI;
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}
