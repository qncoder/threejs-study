export function createNodeSelectionScrollState() {
  return {
    shouldScroll: false,
  };
}

export function requestNodeSelectionScroll(state, shouldScroll) {
  if (!state) return;

  state.shouldScroll = shouldScroll === true;
}

export function consumeNodeSelectionScrollRequest(state) {
  if (!state) return false;

  const shouldScroll = state.shouldScroll === true;
  state.shouldScroll = false;
  return shouldScroll;
}
