export function clampPanelWidth(width, min = 280, max = 720) {
  const nextWidth = Number(width);
  if (!Number.isFinite(nextWidth)) return min;
  return Math.min(Math.max(nextWidth, min), max);
}
