export const DEFAULT_TRANSFORM_MODE = 'translate';

export const TRANSFORM_MODES = [
  { key: 'translate', label: '位置' },
  { key: 'rotate', label: '旋转' },
  { key: 'scale', label: '缩放' },
];

export function normalizeTransformMode(mode) {
  return TRANSFORM_MODES.some((item) => item.key === mode) ? mode : DEFAULT_TRANSFORM_MODE;
}
