const AXIS_LABELS = ['X', 'Y', 'Z'];

export function readNodeTransform(object) {
  return {
    position: vectorToArray(object.position),
    rotationDeg: [
      roundNumber(radToDeg(object.rotation.x), 3),
      roundNumber(radToDeg(object.rotation.y), 3),
      roundNumber(radToDeg(object.rotation.z), 3),
    ],
    scale: vectorToArray(object.scale),
  };
}

export function applyNodeTransform(object, transform) {
  const errors = validateTransform(transform);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  object.position.set(...toNumberArray(transform.position));
  object.rotation.set(...toNumberArray(transform.rotationDeg).map(degToRad));
  object.scale.set(...toNumberArray(transform.scale));
  object.updateMatrix();
  object.updateWorldMatrix(true, true);

  return { ok: true, errors: [] };
}

export function captureOriginalNodeTransforms(root) {
  const originals = new Map();
  root.traverse((object) => {
    originals.set(object.uuid, readNodeTransform(object));
  });
  return originals;
}

export function resetNodeTransform(object, originals) {
  const original = originals.get(object.uuid);
  if (!original) return false;

  applyNodeTransform(object, original);
  return true;
}

export function resetAllNodeTransforms(root, originals) {
  let count = 0;
  root.traverse((object) => {
    if (resetNodeTransform(object, originals)) count += 1;
  });
  root.updateWorldMatrix(true, true);
  return count;
}

export function cloneTransform(transform) {
  return {
    position: [...transform.position],
    rotationDeg: [...transform.rotationDeg],
    scale: [...transform.scale],
  };
}

export function createTransformDisplayRows(transform) {
  return [
    { key: 'position', label: '位置', values: formatDisplayVector(transform?.position) },
    { key: 'rotationDeg', label: '角度', values: formatDisplayVector(transform?.rotationDeg) },
    { key: 'scale', label: '缩放', values: formatDisplayVector(transform?.scale) },
  ];
}

function validateTransform(transform) {
  const errors = [];
  validateVector('位置', transform?.position, errors);
  validateVector('旋转', transform?.rotationDeg, errors);
  validateVector('缩放', transform?.scale, errors);
  return errors;
}

function validateVector(label, value, errors) {
  if (!Array.isArray(value) || value.length !== 3) {
    errors.push(`${label} 不是三维数组`);
    return;
  }

  value.forEach((item, index) => {
    if (item === '' || item === null || !Number.isFinite(Number(item))) {
      errors.push(`${label} ${AXIS_LABELS[index]} 不是有效数字`);
    }
  });
}

function toNumberArray(value) {
  return value.map((item) => Number(item));
}

function vectorToArray(vector) {
  return [roundNumber(vector.x), roundNumber(vector.y), roundNumber(vector.z)];
}

function formatDisplayVector(value) {
  return AXIS_LABELS.map((_axis, index) => formatDisplayNumber(value?.[index]));
}

function formatDisplayNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';

  const rounded = roundNumber(number, 3);
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function radToDeg(value) {
  return (value * 180) / Math.PI;
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function roundNumber(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
