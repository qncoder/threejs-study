export function filterNodeRowsByKeyword(rows, keyword) {
  const normalizedKeyword = String(keyword ?? '').trim().toLowerCase();
  if (!normalizedKeyword) return rows;

  return rows.filter((node) =>
    [node.name, node.displayName, node.type, node.parentName, node.path]
      .some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword)),
  );
}

export function collectSearchVisibleNodeUuids(rows, keyword) {
  const matchedRows = filterNodeRowsByKeyword(rows, keyword);
  const normalizedKeyword = String(keyword ?? '').trim();
  if (!normalizedKeyword) return null;

  const visibleUuids = new Set();
  matchedRows.forEach((matchedRow) => {
    visibleUuids.add(matchedRow.uuid);
    rows.forEach((row) => {
      if (row.uuid === matchedRow.uuid) return;
      if (row.depth > matchedRow.depth && row.path?.startsWith(`${matchedRow.path}/`)) {
        visibleUuids.add(row.uuid);
      }
    });
  });

  return visibleUuids;
}
