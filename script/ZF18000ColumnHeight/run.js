const MOVE_DIRECTION = -1; // 1 = 伸出，-1 = 收回
const STEP = 0.02;
const STAGE1_MAX = 0.8;
const STAGE2_MAX = 0.8;
const RESET_STATE = false;
const EPSILON = 1e-6;
const STORE_KEY = '__zf18000ColumnHeightState';

const COLUMN_DEFINITIONS = [
  {
    key: 'front',
    label: '前立柱',
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
    nodeNames: {
      fixed: 'backcolumn_hydraulic_fixed_pos',
      fixedEnd: 'backcolumn_hydraulic_fixed_end',
      slidingShaft1: 'backcolumn_hydraulic_slidingshaft1_pos',
      slidingShaft2: 'backcolumn_hydraulic_slidingshaft2_pos',
    },
  },
];

const root = scene;
const moveDirection = Number(MOVE_DIRECTION);
const step = Number(STEP);

if (moveDirection !== 1 && moveDirection !== -1) {
  console.warn('MOVE_DIRECTION 只能是 1 或 -1：', MOVE_DIRECTION);
  return;
}

if (!Number.isFinite(step) || step <= 0) {
  console.warn('STEP 必须是大于 0 的数字：', STEP);
  return;
}

if (RESET_STATE) {
  delete root.userData[STORE_KEY];
  console.log('已清除 ZF18000 立柱初始姿态，下次执行会重新记录。');
  return;
}

const collectResult = collectColumns(root);
if (collectResult.missing.length > 0) {
  console.warn('ZF18000 立柱脚本缺少必要节点：', collectResult.missing);
  return;
}

const previousState = root.userData[STORE_KEY];
const needCapture = !previousState || !isSameColumnObjects(previousState.columns, collectResult.columns);

if (needCapture) {
  const captureResult = captureColumnState(collectResult.columns);
  if (!captureResult.ok) {
    console.warn(captureResult.error);
    return;
  }

  root.userData[STORE_KEY] = captureResult.state;
  console.log('已记录 ZF18000 前后立柱初始姿态。');
}

const state = root.userData[STORE_KEY];
const applyResult = applyColumnStep(root, state, moveDirection, step);

if (!applyResult.ok) {
  console.warn(applyResult.error);
  return;
}

const actionText = moveDirection > 0 ? '伸出' : '收回';
const logRows = applyResult.applied.map((column) => ({
    label: column.label,
    stage1: `${column.currentStage1.toFixed(4)} -> ${column.stage1.toFixed(4)}`,
    stage2: `${column.currentStage2.toFixed(4)} -> ${column.stage2.toFixed(4)}`,
  }));

if (applyResult.moved) {
  console.log(`已${actionText} ZF18000 前后立柱一步，STEP=${step}`, logRows);
} else {
  console.log(`ZF18000 前后立柱已无法继续${actionText}`, logRows);
}

function collectColumns(rootObject) {
  const columns = [];
  const missing = [];

  for (const definition of COLUMN_DEFINITIONS) {
    const nodes = {};
    let hasMissingNode = false;

    for (const [key, name] of Object.entries(definition.nodeNames)) {
      const object = rootObject.getObjectByName(name);
      if (!object) {
        missing.push(name);
        hasMissingNode = true;
        continue;
      }
      nodes[key] = object;
    }

    if (hasMissingNode) continue;

    columns.push({
      key: definition.key,
      label: definition.label,
      nodes,
    });
  }

  return { columns, missing };
}

function captureColumnState(columns) {
  const stateColumns = [];

  for (const column of columns) {
    const fixedWorld = readWorldPosition(column.nodes.fixed);
    const fixedEndWorld = readWorldPosition(column.nodes.fixedEnd);
    const direction = fixedEndWorld.clone().sub(fixedWorld);

    if (direction.lengthSq() <= EPSILON) {
      return {
        ok: false,
        error: `${column.label} 固定端和末端重合，无法计算伸缩方向。`,
      };
    }

    stateColumns.push({
      key: column.key,
      label: column.label,
      stage1Max: STAGE1_MAX,
      stage2Max: STAGE2_MAX,
      direction: direction.normalize(),
      nodes: column.nodes,
      initialWorld: {
        slidingShaft1: readWorldPosition(column.nodes.slidingShaft1),
        slidingShaft2: readWorldPosition(column.nodes.slidingShaft2),
      },
      movingGroups: {
        slidingShaft1: createMovingGroup(root, column.nodes.slidingShaft1, `${column.key === 'front' ? 'frontcolumn' : 'backcolumn'}_hydraulic_slidingshaft1_pos`),
        slidingShaft2: createMovingGroup(root, column.nodes.slidingShaft2, `${column.key === 'front' ? 'frontcolumn' : 'backcolumn'}_hydraulic_slidingshaft2_pos`),
      },
    });
  }

  return {
    ok: true,
    state: { columns: stateColumns },
  };
}

function applyColumnStep(rootObject, stateObject, moveDirectionValue, stepDistance) {
  const moves = [];
  const applied = [];
  let moved = false;

  rootObject.updateWorldMatrix?.(true, true);

  for (const column of stateObject.columns) {
    if (!column.nodes.slidingShaft1.parent || !column.nodes.slidingShaft2.parent) {
      return {
        ok: false,
        error: `${column.label} 的滑杆节点缺少父级，无法写回位置。`,
      };
    }

    const current = readColumnStage(column);
    let stepStage1 = 0;
    let stepStage2 = 0;

    if (moveDirectionValue > 0) {
      if (current.stage1 < column.stage1Max - EPSILON) {
        stepStage1 = Math.min(stepDistance, column.stage1Max - current.stage1);
      } else if (current.stage2 < column.stage2Max - EPSILON) {
        stepStage2 = Math.min(stepDistance, column.stage2Max - current.stage2);
      }
    } else if (current.stage2 > EPSILON) {
      stepStage2 = -Math.min(stepDistance, current.stage2);
    } else if (current.stage1 > EPSILON) {
      stepStage1 = -Math.min(stepDistance, current.stage1);
    }

    const stage1 = clamp(current.stage1 + stepStage1, 0, column.stage1Max);
    const stage2 = clamp(current.stage2 + stepStage2, 0, column.stage2Max);

    if (
      Math.abs(stage1 - current.stage1) > EPSILON
      || Math.abs(stage2 - current.stage2) > EPSILON
    ) {
      moved = true;
    }

    moves.push(
      ...createObjectMoves(column.movingGroups.slidingShaft1, column.direction, stage1),
      ...createObjectMoves(column.movingGroups.slidingShaft2, column.direction, stage1 + stage2),
    );

    applied.push({
      label: column.label,
      currentStage1: current.stage1,
      currentStage2: current.stage2,
      stage1,
      stage2,
    });
  }

  for (const move of moves) {
    setWorldPosition(move.object, move.targetWorld);
  }

  rootObject.updateWorldMatrix?.(true, true);

  return {
    ok: true,
    moved,
    applied,
  };
}

function readColumnStage(column) {
  const stage1 = clamp(
    readWorldPosition(column.nodes.slidingShaft1)
      .sub(column.initialWorld.slidingShaft1)
      .dot(column.direction),
    0,
    column.stage1Max,
  );
  const stage2 = clamp(
    readWorldPosition(column.nodes.slidingShaft2)
      .sub(column.initialWorld.slidingShaft2)
      .dot(column.direction) - stage1,
    0,
    column.stage2Max,
  );

  return { stage1, stage2 };
}

function readWorldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function createMovingGroup(rootObject, controlNode, controlNodeName) {
  const movingObjects = [
    {
      object: controlNode,
      initialWorld: readWorldPosition(controlNode),
    },
  ];
  const meshName = controlNodeName.replace(/_pos$/, '');
  const siblingMesh = rootObject.getObjectByName(meshName);

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

function isSameColumnObjects(previousColumns = [], nextColumns = []) {
  if (previousColumns.length !== nextColumns.length) return false;

  return previousColumns.every((previousColumn) => {
    const nextColumn = nextColumns.find((item) => item.key === previousColumn.key);
    if (!nextColumn) return false;

    return (
      previousColumn.nodes.fixed === nextColumn.nodes.fixed
      && previousColumn.nodes.fixedEnd === nextColumn.nodes.fixedEnd
      && previousColumn.nodes.slidingShaft1 === nextColumn.nodes.slidingShaft1
      && previousColumn.nodes.slidingShaft2 === nextColumn.nodes.slidingShaft2
    );
  });
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
