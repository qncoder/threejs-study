import { Vector3 } from 'three';

const EPSILON = 1e-6;

const COLUMN_DEFINITIONS = [
  {
    key: 'front',
    label: '前立柱',
    stage1Max: 0.8,
    stage2Max: 0.8,
    nodeNames: {
      fixed: 'frontcolumn_hydraulic_fixed_pos',
      fixedEnd: 'frontcolumn_hydraulic_fixed_end',
      slidingShaft1: 'frontcolumn_hydraulic_slidingshaft1_pos',
      slidingShaft2: 'frontcolumn_hydraulic_slidingshaft2_pos',
    },
  },
  {
    key: 'back',
    label: '后立柱',
    stage1Max: 0.8,
    stage2Max: 0.8,
    nodeNames: {
      fixed: 'backcolumn_hydraulic_fixed_pos',
      fixedEnd: 'backcolumn_hydraulic_fixed_end',
      slidingShaft1: 'backcolumn_hydraulic_slidingshaft1_pos',
      slidingShaft2: 'backcolumn_hydraulic_slidingshaft2_pos',
    },
  },
];

export function createColumnMotionState(root) {
  if (!root) {
    return {
      ok: false,
      error: '请先加载模型。',
      missing: allRequiredNodeNames(),
    };
  }

  root.updateWorldMatrix?.(true, true);
  const missing = [];
  const columns = [];

  for (const definition of COLUMN_DEFINITIONS) {
    const nodes = readColumnNodes(root, definition.nodeNames, missing);
    if (!nodes) continue;

    const fixedWorld = readWorldPosition(nodes.fixed);
    const fixedEndWorld = readWorldPosition(nodes.fixedEnd);
    const direction = fixedEndWorld.clone().sub(fixedWorld);

    if (direction.lengthSq() <= EPSILON) {
      return {
        ok: false,
        error: `${definition.label} 固定端和末端重合，无法计算伸缩方向。`,
        missing: [],
      };
    }

    if (!nodes.slidingShaft1.parent || !nodes.slidingShaft2.parent) {
      return {
        ok: false,
        error: `${definition.label} 的滑杆节点缺少父级，无法写回位置。`,
        missing: [],
      };
    }

    columns.push({
      key: definition.key,
      label: definition.label,
      stage1Max: definition.stage1Max,
      stage2Max: definition.stage2Max,
      direction: direction.normalize(),
      nodes,
      initialWorld: {
        slidingShaft1: readWorldPosition(nodes.slidingShaft1),
        slidingShaft2: readWorldPosition(nodes.slidingShaft2),
      },
      movingGroups: {
        slidingShaft1: createMovingGroup(root, nodes.slidingShaft1, definition.nodeNames.slidingShaft1),
        slidingShaft2: createMovingGroup(root, nodes.slidingShaft2, definition.nodeNames.slidingShaft2),
      },
    });
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: `缺少必要节点：${missing.join('、')}`,
      missing,
    };
  }

  return {
    ok: true,
    error: '',
    missing: [],
    state: { columns },
  };
}

export function applyColumnHeight(root, state, progress) {
  if (!root) {
    return { ok: false, error: '请先加载模型。' };
  }
  if (!state?.columns?.length) {
    return { ok: false, error: '立柱状态未初始化。' };
  }
  if (!Number.isFinite(Number(progress))) {
    return { ok: false, error: 'progress 不是有效数字。' };
  }

  const safeProgress = clampProgress(progress);
  const moves = [];
  const applied = [];

  root.updateWorldMatrix?.(true, true);

  for (const column of state.columns) {
    const parentError = validateColumnParents(column);
    if (parentError) {
      return { ok: false, error: `${column.label}${parentError}` };
    }

    const progressDirection = safeProgress < 0 ? -1 : 1;
    const moveDirection = column.direction.clone().multiplyScalar(progressDirection);
    const totalStroke = (column.stage1Max + column.stage2Max) * Math.abs(safeProgress);
    const stage1 = clamp(totalStroke, 0, column.stage1Max);
    const stage2 = clamp(totalStroke - column.stage1Max, 0, column.stage2Max);

    moves.push(
      ...createObjectMoves(column.movingGroups.slidingShaft1, moveDirection, stage1),
      ...createObjectMoves(column.movingGroups.slidingShaft2, moveDirection, stage1 + stage2),
    );

    applied.push({
      key: column.key,
      label: column.label,
      stage1,
      stage2,
    });
  }

  for (const move of moves) {
    setWorldPosition(move.object, move.targetWorld);
  }

  root.updateWorldMatrix?.(true, true);

  return {
    ok: true,
    error: '',
    progress: safeProgress,
    applied,
  };
}

export function resetColumnHeight(root, state) {
  return applyColumnHeight(root, state, 0);
}

function readColumnNodes(root, nodeNames, missing) {
  const nodes = {};
  let hasMissingNode = false;

  for (const [key, name] of Object.entries(nodeNames)) {
    const object = root.getObjectByName(name);
    if (!object) {
      missing.push(name);
      hasMissingNode = true;
      continue;
    }
    nodes[key] = object;
  }

  return hasMissingNode ? null : nodes;
}

function readWorldPosition(object) {
  return object.getWorldPosition(new Vector3());
}

function validateColumnParents(column) {
  const movingObjects = [
    ...column.movingGroups.slidingShaft1,
    ...column.movingGroups.slidingShaft2,
  ];

  if (movingObjects.some((item) => !item.object.parent)) {
    return '的滑杆节点缺少父级，无法写回位置。';
  }

  return '';
}

function createMovingGroup(root, controlNode, controlNodeName) {
  const movingObjects = [
    {
      object: controlNode,
      initialWorld: readWorldPosition(controlNode),
    },
  ];
  const meshName = controlNodeName.replace(/_pos$/, '');
  const siblingMesh = root.getObjectByName(meshName);

  if (siblingMesh && siblingMesh !== controlNode && !isDescendantOf(siblingMesh, controlNode)) {
    movingObjects.push({
      object: siblingMesh,
      initialWorld: readWorldPosition(siblingMesh),
    });
  }

  return movingObjects;
}

function createObjectMoves(movingObjects, direction, distance) {
  return movingObjects.map((item) => ({
    object: item.object,
    targetWorld: item.initialWorld
      .clone()
      .add(direction.clone().multiplyScalar(distance)),
  }));
}

function setWorldPosition(object, targetWorld) {
  const local = targetWorld.clone();
  object.parent.updateWorldMatrix(true, true);
  object.parent.worldToLocal(local);
  object.position.copy(local);
  object.updateMatrix();
  object.updateWorldMatrix(true, true);
}

function clampProgress(progress) {
  return clamp(Number(progress), -1, 1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

function allRequiredNodeNames() {
  return COLUMN_DEFINITIONS.flatMap((definition) => Object.values(definition.nodeNames));
}

function isDescendantOf(object, parent) {
  let current = object.parent;
  while (current) {
    if (current === parent) return true;
    current = current.parent;
  }
  return false;
}
