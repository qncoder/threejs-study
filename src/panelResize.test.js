import { describe, expect, it } from 'vitest';
import { clampPanelWidth } from './panelResize.js';

describe('panelResize', () => {
  it('把面板宽度限制在最小值和最大值之间', () => {
    expect(clampPanelWidth(200, 280, 720)).toBe(280);
    expect(clampPanelWidth(480, 280, 720)).toBe(480);
    expect(clampPanelWidth(900, 280, 720)).toBe(720);
  });
});
