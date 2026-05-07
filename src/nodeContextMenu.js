const MENU_ITEMS = [
  { action: 'create-object3d', label: '新建 Object3D' },
  { action: 'edit-script', label: '编辑脚本' },
  { action: 'show-info', label: '查看信息' },
  { action: 'delete', label: '删除' },
  { action: 'focus', label: '聚焦' },
];

export function getNodeContextMenuItems() {
  return MENU_ITEMS.map((item) => ({ ...item }));
}

export function createClosedNodeContextMenu() {
  return {
    open: false,
    nodeUuid: '',
    x: 0,
    y: 0,
  };
}

export function openNodeContextMenu(_state, {
  nodeUuid,
  x,
  y,
  viewportWidth = 0,
  viewportHeight = 0,
  menuWidth = 132,
  menuHeight = 144,
  margin = 8,
}) {
  const left = Number(x) || 0;
  const top = Number(y) || 0;

  return {
    open: true,
    nodeUuid: nodeUuid || '',
    x: clampMenuPosition(left, viewportWidth, menuWidth, margin),
    y: clampMenuPosition(top, viewportHeight, menuHeight, margin),
  };
}

export function closeNodeContextMenu() {
  return createClosedNodeContextMenu();
}

function clampMenuPosition(position, viewportSize, menuSize, margin) {
  const size = Number(viewportSize) || 0;
  if (size <= 0) return position;

  const safeMargin = Math.max(0, Number(margin) || 0);
  const maxPosition = Math.max(safeMargin, size - (Number(menuSize) || 0) - safeMargin);
  return Math.min(Math.max(position, safeMargin), maxPosition);
}
