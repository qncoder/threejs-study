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

export function startDialogDrag({ pointerX, pointerY, dialogX, dialogY }) {
  return {
    dragging: true,
    pointerX: Number(pointerX) || 0,
    pointerY: Number(pointerY) || 0,
    dialogX: Number(dialogX) || 0,
    dialogY: Number(dialogY) || 0,
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

export function stopDialogDrag() {
  return createDialogDragState();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
