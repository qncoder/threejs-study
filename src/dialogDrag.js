const EDGE_PADDING = 8;

export function createDialogDragState() {
  return {
    dragging: false,
    pointerX: 0,
    pointerY: 0,
    dialogX: 0,
    dialogY: 0,
  };
}

export function createDialogResizeState() {
  return {
    resizing: false,
    handle: '',
    pointerX: 0,
    pointerY: 0,
    layout: { x: 0, y: 0, width: 0, height: 0 },
  };
}

export function startDialogDrag({ pointerX, pointerY, dialogX, dialogY }) {
  return {
    dragging: true,
    pointerX: Number(pointerX) || 0,
    pointerY: Number(pointerY) || 0,
    dialogX: Number(dialogX) || 0,
    dialogY: Number(dialogY) || 0,
  };
}

export function startDialogResize({ handle, pointerX, pointerY, layout }) {
  return {
    resizing: true,
    handle: String(handle || ''),
    pointerX: Number(pointerX) || 0,
    pointerY: Number(pointerY) || 0,
    layout: normalizeLayout(layout),
  };
}

export function moveDialogByPointer(state, bounds) {
  if (!state?.dragging) return null;

  return clampDialogPosition({
    x: state.dialogX + Number(bounds.pointerX - state.pointerX),
    y: state.dialogY + Number(bounds.pointerY - state.pointerY),
    viewportWidth: bounds.viewportWidth,
    viewportHeight: bounds.viewportHeight,
    dialogWidth: bounds.dialogWidth,
    dialogHeight: bounds.dialogHeight,
  });
}

export function resizeDialogByPointer(state, options) {
  if (!state?.resizing) return null;

  const dx = Number(options.pointerX - state.pointerX) || 0;
  const dy = Number(options.pointerY - state.pointerY) || 0;
  const next = { ...state.layout };

  if (state.handle.includes('e')) {
    next.width = state.layout.width + dx;
  }
  if (state.handle.includes('s')) {
    next.height = state.layout.height + dy;
  }
  if (state.handle.includes('w')) {
    next.x = state.layout.x + dx;
    next.width = state.layout.width - dx;
  }
  if (state.handle.includes('n')) {
    next.y = state.layout.y + dy;
    next.height = state.layout.height - dy;
  }

  return clampDialogLayout({
    ...next,
    bounds: options.bounds,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
  });
}

export function clampDialogPosition({
  x,
  y,
  viewportWidth,
  viewportHeight,
  dialogWidth,
  dialogHeight,
}) {
  const maxX = Math.max(EDGE_PADDING, Number(viewportWidth) - Number(dialogWidth) - EDGE_PADDING);
  const maxY = Math.max(EDGE_PADDING, Number(viewportHeight) - Number(dialogHeight) - EDGE_PADDING);

  return {
    x: clamp(Number(x) || 0, EDGE_PADDING, maxX),
    y: clamp(Number(y) || 0, EDGE_PADDING, maxY),
  };
}

export function clampDialogLayout({
  x,
  y,
  width,
  height,
  bounds,
  minWidth = 480,
  minHeight = 360,
  maxWidth,
  maxHeight,
}) {
  const safeBounds = normalizeBounds(bounds);
  const largestWidth = Number.isFinite(Number(maxWidth))
    ? Number(maxWidth)
    : safeBounds.width - EDGE_PADDING * 2;
  const largestHeight = Number.isFinite(Number(maxHeight))
    ? Number(maxHeight)
    : safeBounds.height - EDGE_PADDING * 2;
  const nextMaxWidth = Math.max(1, largestWidth);
  const nextMaxHeight = Math.max(1, largestHeight);
  const nextMinWidth = Math.min(Number(minWidth) || 1, nextMaxWidth);
  const nextMinHeight = Math.min(Number(minHeight) || 1, nextMaxHeight);
  const nextWidth = clamp(Number(width) || nextMinWidth, nextMinWidth, nextMaxWidth);
  const nextHeight = clamp(Number(height) || nextMinHeight, nextMinHeight, nextMaxHeight);
  const minX = safeBounds.x + EDGE_PADDING;
  const minY = safeBounds.y + EDGE_PADDING;
  const maxX = Math.max(minX, safeBounds.x + safeBounds.width - nextWidth - EDGE_PADDING);
  const maxY = Math.max(minY, safeBounds.y + safeBounds.height - nextHeight - EDGE_PADDING);

  return {
    x: clamp(Number(x) || minX, minX, maxX),
    y: clamp(Number(y) || minY, minY, maxY),
    width: nextWidth,
    height: nextHeight,
  };
}

export function stopDialogDrag() {
  return createDialogDragState();
}

export function stopDialogResize() {
  return createDialogResizeState();
}

function normalizeLayout(layout = {}) {
  return {
    x: Number(layout.x) || 0,
    y: Number(layout.y) || 0,
    width: Number(layout.width) || 0,
    height: Number(layout.height) || 0,
  };
}

function normalizeBounds(bounds = {}) {
  return {
    x: Number(bounds.x) || 0,
    y: Number(bounds.y) || 0,
    width: Number(bounds.width) || 0,
    height: Number(bounds.height) || 0,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
