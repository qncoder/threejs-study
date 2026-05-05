export function filterCollapsedNodeRows(rows, collapsedNodeUuids) {
  if (!collapsedNodeUuids?.size) return rows;

  const visibleRows = [];
  let hiddenUntilDepth = null;

  rows.forEach((row) => {
    if (hiddenUntilDepth !== null) {
      if (row.depth > hiddenUntilDepth) return;
      hiddenUntilDepth = null;
    }

    visibleRows.push(row);
    if (collapsedNodeUuids.has(row.uuid)) {
      hiddenUntilDepth = row.depth;
    }
  });

  return visibleRows;
}
