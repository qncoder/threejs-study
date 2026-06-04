import { Quaternion, Vector3 } from 'three';

const EPSILON = 1e-6;
const MIN_SEARCH_STEP = 0.00017;
const DEFAULT_ZOOM_OUT = 0.3;
const DEFAULT_TOLERANCE = 1;
const DEFAULT_MAX_DEPTH = 12;
export const DEFAULT_FOUR_LINK_NODE_NAMES = {
  hydraulicFixedAxis: 'frontrod_fixed',
  hydraulicSlidingShaft: 'frontrod_shield',
  crankMiddelFixed: 'backrod_fixed',
  crankMiddelSliding: 'backrod_shield',
  crankAfterFixed: 'shield',
  crankAfterSliding: 'topbeamcentertop',
};

export const DEFAULT_FOUR_LINK_FOLLOWERS = {
};

const MOVING_NODE_KEYS = ['hydraulicSlidingShaft', 'crankMiddelSliding', 'crankAfterSliding'];
const REQUIRED_NODE_KEYS = [
  'hydraulicFixedAxis',
  'hydraulicSlidingShaft',
  'crankMiddelFixed',
  'crankMiddelSliding',
  'crankAfterFixed',
  'crankAfterSliding',
];

export function createFourLinkState(root, nodeNames, options = {}) {
  if (!root) {
    return {
      ok: false,
      error: '请先加载模型。',
      missing: [...REQUIRED_NODE_KEYS],
    };
  }

  root.updateWorldMatrix?.(true, true);
  const { nodes, missing } = readRequiredNodes(root, nodeNames);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `缺少必要节点：${missing.join('、')}`,
      missing,
    };
  }

  const initialWorld = createInitialWorldMap(nodes);
  const axisResult = resolveRotationAxis(nodes, initialWorld, options, root);
  if (!axisResult.ok) {
    return {
      ok: false,
      error: axisResult.error,
      missing: [],
    };
  }

  const lengths = createLengthMap(initialWorld);
  const currentAC = initialWorld.hydraulicSlidingShaft.distanceTo(initialWorld.crankMiddelFixed);
  const angles = {
    ADE: calculateAngle(initialWorld.hydraulicSlidingShaft, initialWorld.crankMiddelSliding, initialWorld.crankAfterSliding),
    BCF: 360 - calculateAngle(initialWorld.hydraulicFixedAxis, initialWorld.crankMiddelFixed, initialWorld.crankAfterFixed),
  };
  const initialSolveAngles = {
    angABC: calculateAngle(initialWorld.hydraulicSlidingShaft, initialWorld.hydraulicFixedAxis, initialWorld.crankMiddelFixed),
    angDCF: calculateAngle(initialWorld.crankMiddelSliding, initialWorld.crankMiddelFixed, initialWorld.crankAfterFixed),
    angCFE: calculateAngle(initialWorld.crankMiddelFixed, initialWorld.crankAfterFixed, initialWorld.crankAfterSliding),
  };
  const search = createSearchState(lengths, options.search);
  const movingGroups = createMovingGroups(root, nodes, initialWorld, options.movingNodeFollowers);

  return {
    ok: true,
    error: '',
    missing: [],
    state: {
      root,
      nodeNames: { ...nodeNames },
      nodes,
      axis: axisResult.axis,
      initialWorld,
      lengths,
      angles,
      initialSolveAngles,
      currentAC,
      search,
      movingGroups,
    },
  };
}

export function solveFourLink(state, ac) {
  if (!state) {
    return { ok: false, error: '四连杆状态未初始化。' };
  }

  const safeAC = Number(ac);
  if (!Number.isFinite(safeAC) || safeAC <= EPSILON) {
    return { ok: false, error: 'ac 不是有效长度。' };
  }

  const { ab, bc, cd, ad, de, ef, cf } = state.lengths;
  const { ADE, BCF } = state.angles;

  const angABC = lawOfCosinesAngleDeg(ab, bc, safeAC, 'ab/bc/ac');
  if (!angABC.ok) return angABC;

  const tempABC = lawOfCosinesAngleDeg(safeAC, bc, ab, 'ac/bc/ab');
  if (!tempABC.ok) return tempABC;

  const tempACD = lawOfCosinesAngleDeg(safeAC, cd, ad, 'ac/cd/ad');
  if (!tempACD.ok) return tempACD;

  const angADC = lawOfCosinesAngleDeg(ad, cd, safeAC, 'ad/cd/ac');
  if (!angADC.ok) return angADC;

  const angleCDE = ADE - angADC.angleDeg;
  const dceSquared = cd ** 2 + de ** 2 - 2 * cd * de * Math.cos(degToRad(angleCDE));
  if (!Number.isFinite(dceSquared) || dceSquared <= EPSILON) {
    return { ok: false, error: '三角形不成立：cd/de/angleCDE 无法求出有效 dce。' };
  }

  const dce = Math.sqrt(dceSquared);
  const tempDCE = lawOfCosinesAngleDeg(cd, dce, de, 'cd/dce/de');
  if (!tempDCE.ok) return tempDCE;

  const tempDCF = lawOfCosinesAngleDeg(dce, cf, ef, 'dce/cf/ef');
  if (!tempDCF.ok) return tempDCF;

  const angDCF = tempDCE.angleDeg + tempDCF.angleDeg;
  const angCFE = lawOfCosinesAngleDeg(cf, ef, dce, 'cf/ef/dce');
  if (!angCFE.ok) return angCFE;

  return {
    ok: true,
    ac: safeAC,
    dce,
    errorOffset: BCF - (tempABC.angleDeg + tempACD.angleDeg) - (tempDCE.angleDeg + tempDCF.angleDeg),
    angles: {
      angABC: angABC.angleDeg,
      angADC: angADC.angleDeg,
      angDCF,
      angCFE: angCFE.angleDeg,
    },
    segments: {
      tempABC: tempABC.angleDeg,
      tempACD: tempACD.angleDeg,
      tempDCE: tempDCE.angleDeg,
      tempDCF: tempDCF.angleDeg,
      angleCDE,
    },
  };
}

export function findFourLinkSolution(state, options = {}) {
  if (!state) {
    return { ok: false, error: '四连杆状态未初始化。' };
  }

  const workingState = createWorkingState(state, options);
  const search = workingState.search;
  const result = iterateFourLinkRange(
    workingState,
    search.startAC,
    search.endAC,
    search.step,
    search,
    0,
  );

  if (!result.ok) return result;

  const targetWorld = computeSolutionTargets(workingState, result.solution);
  if (!targetWorld.ok) return targetWorld;

  return {
    ok: true,
    solution: {
      ...result.solution,
      targetWorld: targetWorld.targetWorld,
      driver: {
        ab: workingState.lengths.ab,
        ad: workingState.lengths.ad,
        ADE: workingState.angles.ADE,
      },
    },
  };
}

export function applyFourLinkSolution(root, state, solution) {
  if (!root) {
    return { ok: false, error: '请先加载模型。' };
  }
  if (!state?.movingGroups) {
    return { ok: false, error: '四连杆状态未初始化。' };
  }
  if (!solution?.targetWorld) {
    return { ok: false, error: '缺少四连杆解算结果。' };
  }

  root.updateWorldMatrix?.(true, true);
  const parentError = validateMovingParents(state);
  if (parentError) return { ok: false, error: parentError };

  for (const key of MOVING_NODE_KEYS) {
    const baseInitial = state.initialWorld[key];
    const baseTarget = solution.targetWorld[key];
    const delta = baseTarget.clone().sub(baseInitial);

    for (const item of state.movingGroups[key]) {
      setWorldPosition(item.object, item.initialWorld.clone().add(delta));
    }
  }

  root.updateWorldMatrix?.(true, true);
  return {
    ok: true,
    applied: MOVING_NODE_KEYS,
  };
}

export function resetFourLink(root, state) {
  if (!root) {
    return { ok: false, error: '请先加载模型。' };
  }
  if (!state?.movingGroups) {
    return { ok: false, error: '四连杆状态未初始化。' };
  }

  root.updateWorldMatrix?.(true, true);
  const parentError = validateMovingParents(state);
  if (parentError) return { ok: false, error: parentError };

  for (const key of MOVING_NODE_KEYS) {
    for (const item of state.movingGroups[key]) {
      setWorldPosition(item.object, item.initialWorld.clone());
    }
  }

  root.updateWorldMatrix?.(true, true);
  return {
    ok: true,
    applied: MOVING_NODE_KEYS,
  };
}

export function rockPointByAngle(startWorld, endWorld, axis, angleDeg, length) {
  const start = toVector3(startWorld);
  const end = toVector3(endWorld);
  const rotationAxis = toVector3(axis);
  const safeLength = Number(length);

  if (!start || !end || !rotationAxis || !Number.isFinite(safeLength) || safeLength <= EPSILON) {
    return { ok: false, error: 'RockPoint 输入无效。' };
  }

  if (rotationAxis.lengthSq() <= EPSILON) {
    return { ok: false, error: '旋转轴长度为 0。' };
  }

  const direction = end.clone().sub(start);
  if (direction.lengthSq() <= EPSILON) {
    return { ok: false, error: '起点和参考点重合，无法计算方向。' };
  }

  const quaternion = new Quaternion().setFromAxisAngle(rotationAxis.clone().normalize(), degToRad(angleDeg));
  const rotated = direction.normalize().applyQuaternion(quaternion).normalize();
  return {
    ok: true,
    targetWorld: start.clone().add(rotated.multiplyScalar(safeLength)),
  };
}

function readRequiredNodes(root, nodeNames = {}) {
  const nodes = {};
  const missing = [];

  for (const key of REQUIRED_NODE_KEYS) {
    const name = String(nodeNames?.[key] ?? '').trim();
    const object = name ? root.getObjectByName(name) : null;
    if (!object) {
      missing.push(name || key);
      continue;
    }
    nodes[key] = object;
  }

  return { nodes, missing };
}

function createInitialWorldMap(nodes) {
  return Object.fromEntries(
    REQUIRED_NODE_KEYS.map((key) => [key, nodes[key].getWorldPosition(new Vector3())]),
  );
}

function createLengthMap(initialWorld) {
  return {
    ab: initialWorld.hydraulicFixedAxis.distanceTo(initialWorld.hydraulicSlidingShaft),
    bc: initialWorld.hydraulicFixedAxis.distanceTo(initialWorld.crankMiddelFixed),
    cd: initialWorld.crankMiddelSliding.distanceTo(initialWorld.crankMiddelFixed),
    ad: initialWorld.hydraulicSlidingShaft.distanceTo(initialWorld.crankMiddelSliding),
    de: initialWorld.crankMiddelSliding.distanceTo(initialWorld.crankAfterSliding),
    ef: initialWorld.crankAfterSliding.distanceTo(initialWorld.crankAfterFixed),
    cf: initialWorld.crankAfterFixed.distanceTo(initialWorld.crankMiddelFixed),
  };
}

function createSearchState(lengths, overrides = {}) {
  const endAC = Number.isFinite(Number(overrides.endAC))
    ? Number(overrides.endAC)
    : Math.max(lengths.ab * 2, EPSILON * 10);
  const startAC = Number.isFinite(Number(overrides.startAC))
    ? Number(overrides.startAC)
    : Math.max(EPSILON, endAC * 0.02);
  const step = Number.isFinite(Number(overrides.step))
    ? Number(overrides.step)
    : Math.max(endAC / 400, 0.005);

  return {
    startAC,
    endAC,
    step,
    zoomOut: Number.isFinite(Number(overrides.zoomOut)) ? Number(overrides.zoomOut) : DEFAULT_ZOOM_OUT,
    tolerance: Number.isFinite(Number(overrides.tolerance)) ? Number(overrides.tolerance) : DEFAULT_TOLERANCE,
    minStep: Number.isFinite(Number(overrides.minStep)) ? Number(overrides.minStep) : MIN_SEARCH_STEP,
    maxDepth: Number.isFinite(Number(overrides.maxDepth)) ? Number(overrides.maxDepth) : DEFAULT_MAX_DEPTH,
  };
}

function createMovingGroups(root, nodes, initialWorld, followers = {}) {
  const groups = {};

  for (const key of MOVING_NODE_KEYS) {
    const items = [
      {
        object: nodes[key],
        initialWorld: initialWorld[key].clone(),
      },
    ];
    const followerNames = normalizeFollowerNames(followers[key]);

    for (const name of followerNames) {
      const object = root.getObjectByName(name);
      if (!object || items.some((item) => item.object === object || isDescendantOf(object, item.object))) {
        continue;
      }

      for (let index = items.length - 1; index >= 0; index -= 1) {
        if (isDescendantOf(items[index].object, object)) {
          items.splice(index, 1);
        }
      }

      items.push({
        object,
        initialWorld: object.getWorldPosition(new Vector3()),
      });
    }

    groups[key] = items;
  }

  return groups;
}

function normalizeFollowerNames(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  const name = String(value ?? '').trim();
  return name ? [name] : [];
}

function resolveRotationAxis(nodes, initialWorld, options, root) {
  const explicitAxis = toVector3(options.axis);
  if (explicitAxis) {
    if (explicitAxis.lengthSq() <= EPSILON) {
      return { ok: false, error: '旋转轴长度为 0。' };
    }
    return { ok: true, axis: explicitAxis.normalize() };
  }

  const axisReferenceName = String(options.axisReference ?? '').trim();
  if (axisReferenceName) {
    const axisReference = root.getObjectByName(axisReferenceName);
    if (!axisReference) {
      return { ok: false, error: `找不到旋转轴参考节点：${axisReferenceName}` };
    }
    axisReference.updateWorldMatrix?.(true, true);
    const axis = new Vector3(1, 0, 0).transformDirection(axisReference.matrixWorld);
    if (axis.lengthSq() <= EPSILON) {
      return { ok: false, error: '旋转轴参考节点的世界 X 方向无效。' };
    }
    return { ok: true, axis: axis.normalize() };
  }

  const planeNormal = derivePlaneNormal(initialWorld);
  if (!planeNormal.ok) {
    return planeNormal;
  }

  const positiveAxis = planeNormal.axis;
  const negativeAxis = positiveAxis.clone().multiplyScalar(-1);
  const positiveError = measureAxisRebuildError(initialWorld, positiveAxis);
  const negativeError = measureAxisRebuildError(initialWorld, negativeAxis);
  return {
    ok: true,
    axis: positiveError <= negativeError ? positiveAxis : negativeAxis,
  };
}

function derivePlaneNormal(initialWorld) {
  const pointSets = [
    ['hydraulicFixedAxis', 'hydraulicSlidingShaft', 'crankMiddelFixed'],
    ['hydraulicSlidingShaft', 'crankMiddelSliding', 'crankAfterSliding'],
    ['hydraulicFixedAxis', 'crankMiddelFixed', 'crankAfterFixed'],
    ['hydraulicFixedAxis', 'hydraulicSlidingShaft', 'crankMiddelSliding'],
    ['crankMiddelFixed', 'crankMiddelSliding', 'crankAfterSliding'],
  ];

  for (const [aKey, bKey, cKey] of pointSets) {
    const ab = initialWorld[bKey].clone().sub(initialWorld[aKey]);
    const ac = initialWorld[cKey].clone().sub(initialWorld[aKey]);
    const normal = new Vector3().crossVectors(ab, ac);
    if (normal.lengthSq() > EPSILON) {
      return { ok: true, axis: normal.normalize() };
    }
  }

  return { ok: false, error: '无法从初始六点推算旋转轴。' };
}

function measureAxisRebuildError(initialWorld, axis) {
  const angABC = calculateAngle(initialWorld.hydraulicSlidingShaft, initialWorld.hydraulicFixedAxis, initialWorld.crankMiddelFixed);
  const angDCF = calculateAngle(initialWorld.crankMiddelSliding, initialWorld.crankMiddelFixed, initialWorld.crankAfterFixed);
  const angCFE = calculateAngle(initialWorld.crankMiddelFixed, initialWorld.crankAfterFixed, initialWorld.crankAfterSliding);

  const rebuiltB = rockPointByAngle(
    initialWorld.hydraulicFixedAxis,
    initialWorld.crankMiddelFixed,
    axis,
    angABC,
    initialWorld.hydraulicFixedAxis.distanceTo(initialWorld.hydraulicSlidingShaft),
  );
  const rebuiltD = rockPointByAngle(
    initialWorld.crankMiddelFixed,
    initialWorld.crankAfterFixed,
    axis,
    angDCF,
    initialWorld.crankMiddelFixed.distanceTo(initialWorld.crankMiddelSliding),
  );
  const rebuiltE = rockPointByAngle(
    initialWorld.crankAfterFixed,
    initialWorld.crankMiddelFixed,
    axis,
    -angCFE,
    initialWorld.crankAfterFixed.distanceTo(initialWorld.crankAfterSliding),
  );

  if (!rebuiltB.ok || !rebuiltD.ok || !rebuiltE.ok) return Number.POSITIVE_INFINITY;

  return rebuiltB.targetWorld.distanceTo(initialWorld.hydraulicSlidingShaft)
    + rebuiltD.targetWorld.distanceTo(initialWorld.crankMiddelSliding)
    + rebuiltE.targetWorld.distanceTo(initialWorld.crankAfterSliding);
}

function createWorkingState(state, options) {
  const lengths = {
    ...state.lengths,
    ab: Number.isFinite(Number(options.ab)) ? Number(options.ab) : state.lengths.ab,
    ad: Number.isFinite(Number(options.ad)) ? Number(options.ad) : state.lengths.ad,
  };
  const angles = {
    ...state.angles,
    ADE: Number.isFinite(Number(options.ADE)) ? Number(options.ADE) : state.angles.ADE,
  };

  return {
    ...state,
    lengths,
    angles,
    preferredAC: Number.isFinite(Number(options.preferredAC))
      ? Number(options.preferredAC)
      : (Number.isFinite(Number(state.preferredAC)) ? Number(state.preferredAC) : state.currentAC),
    search: createSearchState(lengths, {
      ...state.search,
      ...(options.search ?? {}),
    }),
  };
}

function iterateFourLinkRange(state, start, end, step, search, depth) {
  let bestAbsolute = null;
  let previousValid = null;
  const brackets = [];

  for (let ac = start; ac < end + EPSILON; ac += step) {
    const solveResult = solveFourLink(state, ac);
    if (!solveResult.ok) continue;

    const absoluteError = Math.abs(solveResult.errorOffset);
    if (!bestAbsolute || absoluteError < Math.abs(bestAbsolute.errorOffset)) {
      bestAbsolute = solveResult;
    }

    if (absoluteError <= search.tolerance) {
      return { ok: true, solution: solveResult };
    }

    if (previousValid && isSignChanged(previousValid.errorOffset, solveResult.errorOffset)) {
      brackets.push({
        start: previousValid.ac < solveResult.ac ? previousValid : solveResult,
        end: previousValid.ac < solveResult.ac ? solveResult : previousValid,
        minError: Math.min(Math.abs(previousValid.errorOffset), absoluteError),
        center: (previousValid.ac + solveResult.ac) / 2,
      });
    }

    previousValid = solveResult;
  }

  if (bestAbsolute && Math.abs(bestAbsolute.errorOffset) <= search.tolerance) {
    return { ok: true, solution: bestAbsolute };
  }

  if (brackets.length === 0) {
    return {
      ok: false,
      error: bestAbsolute
        ? `找不到可用解，当前最小误差为 ${bestAbsolute.errorOffset.toFixed(6)}。`
        : '找不到可用解，搜索区间内没有有效三角形。',
    };
  }

  const nextBracket = pickClosestBracket(brackets, state.preferredAC);
  const nextStep = step * search.zoomOut;
  if (nextStep < search.minStep || depth >= search.maxDepth) {
    return {
      ok: false,
      error: `找不到满足容差的解，当前最小误差为 ${Math.abs(bestAbsolute.errorOffset).toFixed(6)}。`,
    };
  }

  return iterateFourLinkRange(
    state,
    nextBracket.start.ac,
    nextBracket.end.ac,
    nextStep,
    search,
    depth + 1,
  );
}

function computeSolutionTargets(state, solution) {
  const targetB = rockPointByAngle(
    state.initialWorld.hydraulicFixedAxis,
    state.initialWorld.crankMiddelFixed,
    state.axis,
    solution.angles.angABC,
    state.lengths.ab,
  );
  if (!targetB.ok) return targetB;

  const targetD = rockPointByAngle(
    state.initialWorld.crankMiddelFixed,
    state.initialWorld.crankAfterFixed,
    state.axis,
    solution.angles.angDCF,
    state.lengths.cd,
  );
  if (!targetD.ok) return targetD;

  const targetE = rockPointByAngle(
    state.initialWorld.crankAfterFixed,
    state.initialWorld.crankMiddelFixed,
    state.axis,
    -solution.angles.angCFE,
    state.lengths.ef,
  );
  if (!targetE.ok) return targetE;

  return {
    ok: true,
    targetWorld: {
      hydraulicSlidingShaft: targetB.targetWorld,
      crankMiddelSliding: targetD.targetWorld,
      crankAfterSliding: targetE.targetWorld,
    },
  };
}

function validateMovingParents(state) {
  for (const key of MOVING_NODE_KEYS) {
    if (state.movingGroups[key].some((item) => !item.object.parent)) {
      return '运动点缺少父级，无法写回本地坐标。';
    }
  }

  return '';
}

function lawOfCosinesAngleDeg(left, right, opposite, label) {
  const denominator = 2 * left * right;
  if (!Number.isFinite(denominator) || denominator <= EPSILON) {
    return { ok: false, error: `三角形不成立：${label} 的分母无效。` };
  }

  const cosine = safeAcosInput((left ** 2 + right ** 2 - opposite ** 2) / denominator);
  if (cosine == null) {
    return { ok: false, error: `三角形不成立：${label} 不能组成有效角度。` };
  }

  const angleDeg = radToDeg(Math.acos(cosine));
  if (!Number.isFinite(angleDeg)) {
    return { ok: false, error: `三角形不成立：${label} 角度无效。` };
  }

  return { ok: true, angleDeg };
}

function safeAcosInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number < -1 - EPSILON || number > 1 + EPSILON) return null;
  return clamp(number, -1, 1);
}

function calculateAngle(startWorld, axisWorld, endWorld) {
  const from = startWorld.clone().sub(axisWorld);
  const to = endWorld.clone().sub(axisWorld);
  if (from.lengthSq() <= EPSILON || to.lengthSq() <= EPSILON) return 0;
  return radToDeg(from.normalize().angleTo(to.normalize()));
}

function setWorldPosition(object, targetWorld) {
  const local = targetWorld.clone();
  object.parent.updateWorldMatrix(true, true);
  object.parent.worldToLocal(local);
  object.position.copy(local);
  object.updateMatrix();
  object.updateWorldMatrix(true, true);
}

function toVector3(value) {
  if (value instanceof Vector3) return value.clone();
  if (Array.isArray(value) && value.length === 3) {
    const numbers = value.map((item) => Number(item));
    if (numbers.every((item) => Number.isFinite(item))) {
      return new Vector3(numbers[0], numbers[1], numbers[2]);
    }
  }
  return null;
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

function pickClosestBracket(brackets, preferredAC) {
  if (brackets.length === 1) return brackets[0];

  const target = Number.isFinite(Number(preferredAC)) ? Number(preferredAC) : null;
  return [...brackets].sort((left, right) => {
    if (target != null) {
      const leftDistance = Math.abs(left.center - target);
      const rightDistance = Math.abs(right.center - target);
      if (Math.abs(leftDistance - rightDistance) > EPSILON) {
        return leftDistance - rightDistance;
      }
    }

    if (Math.abs(left.minError - right.minError) > EPSILON) {
      return left.minError - right.minError;
    }

    return left.start.ac - right.start.ac;
  })[0];
}
