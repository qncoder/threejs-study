export function findSelectableNodeUuid(hitObject, rows, hiddenNodeUuids = new Set()) {
  if (!hitObject || !Array.isArray(rows) || rows.length === 0) return '';
  if (hasHiddenSelfOrAncestor(hitObject, hiddenNodeUuids)) return '';

  const rowsByUuid = new Map(rows.map((row) => [row.uuid, row]));
  const hitRow = findClosestRow(hitObject, rowsByUuid);
  if (!hitRow) return '';
  if (hiddenNodeUuids.has(hitRow.uuid)) return '';

  const roleKey = hitRow.mechanismRole?.key;
  if (!roleKey) return hitRow.uuid;

  let current = hitObject;
  while (current) {
    const row = rowsByUuid.get(current.uuid);
    if (row?.name === roleKey) return hiddenNodeUuids.has(row.uuid) ? '' : row.uuid;
    current = current.parent;
  }

  return hitRow.uuid;
}

function hasHiddenSelfOrAncestor(object, hiddenNodeUuids) {
  if (!hiddenNodeUuids?.size) return false;

  let current = object;
  while (current) {
    if (hiddenNodeUuids.has(current.uuid)) return true;
    current = current.parent;
  }
  return false;
}

function findClosestRow(object, rowsByUuid) {
  let current = object;
  while (current) {
    const row = rowsByUuid.get(current.uuid);
    if (row) return row;
    current = current.parent;
  }
  return null;
}
