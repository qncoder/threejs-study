import { describe, expect, it } from 'vitest';
import {
  closeNodeContextMenu,
  createClosedNodeContextMenu,
  getNodeContextMenuItems,
  openNodeContextMenu,
} from './nodeContextMenu.js';

describe('nodeContextMenu', () => {
  it('提供固定的节点右键菜单项', () => {
    expect(getNodeContextMenuItems().map((item) => item.action)).toEqual([
      'edit-script',
      'show-info',
      'delete',
      'focus',
    ]);
  });

  it('打开菜单时记录节点和鼠标位置，关闭时清空', () => {
    const opened = openNodeContextMenu(createClosedNodeContextMenu(), {
      nodeUuid: 'node-1',
      x: 120,
      y: 80,
    });

    expect(opened).toMatchObject({
      open: true,
      nodeUuid: 'node-1',
      x: 120,
      y: 80,
    });
    expect(closeNodeContextMenu(opened)).toEqual(createClosedNodeContextMenu());
  });

  it('菜单靠近窗口底部或右侧时会向内避让', () => {
    const opened = openNodeContextMenu(createClosedNodeContextMenu(), {
      nodeUuid: 'node-1',
      x: 790,
      y: 580,
      viewportWidth: 800,
      viewportHeight: 600,
      menuWidth: 160,
      menuHeight: 176,
      margin: 8,
    });

    expect(opened).toMatchObject({
      open: true,
      nodeUuid: 'node-1',
      x: 632,
      y: 416,
    });
  });
});
