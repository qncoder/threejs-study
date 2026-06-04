import { describe, expect, it } from 'vitest';
import {
  consumeNodeSelectionScrollRequest,
  createNodeSelectionScrollState,
  requestNodeSelectionScroll,
} from './nodeSelectionScroll.js';

describe('节点列表自动滚动', () => {
  it('只在画布选中时请求滚动，左侧列表选中时不请求', () => {
    const state = createNodeSelectionScrollState();

    requestNodeSelectionScroll(state, true);
    expect(consumeNodeSelectionScrollRequest(state)).toBe(true);
    expect(consumeNodeSelectionScrollRequest(state)).toBe(false);

    requestNodeSelectionScroll(state, false);
    expect(consumeNodeSelectionScrollRequest(state)).toBe(false);
  });
});
