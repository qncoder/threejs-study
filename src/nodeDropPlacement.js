export const NODE_DROP_PLACEMENTS = {
  BEFORE: 'before',
  INSIDE: 'inside',
  AFTER: 'after',
};

export function getNodeDropPlacement(clientY, rect) {
  const height = Number(rect?.height ?? 0);
  if (height <= 0) return NODE_DROP_PLACEMENTS.INSIDE;

  const offsetRatio = (Number(clientY) - Number(rect?.top ?? 0)) / height;
  if (offsetRatio < 0.3) return NODE_DROP_PLACEMENTS.BEFORE;
  if (offsetRatio > 0.7) return NODE_DROP_PLACEMENTS.AFTER;
  return NODE_DROP_PLACEMENTS.INSIDE;
}
