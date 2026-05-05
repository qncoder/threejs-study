import { describe, expect, it } from 'vitest';
import { copyNodeNameToClipboard, getNodeCopyName } from './nodeClipboard.js';

describe('nodeClipboard', () => {
  it('优先复制节点展示名称', async () => {
    const writes = [];
    const clipboard = {
      writeText: async (value) => writes.push(value),
    };

    const result = await copyNodeNameToClipboard(
      { displayName: '左前轮', name: 'wheel_lf' },
      clipboard,
    );

    expect(result).toEqual({ ok: true, text: '左前轮', error: '' });
    expect(writes).toEqual(['左前轮']);
  });

  it('展示名称为空时使用节点 name', () => {
    expect(getNodeCopyName({ displayName: '  ', name: 'mesh_01' })).toBe('mesh_01');
  });

  it('剪贴板不可用时返回错误', async () => {
    const result = await copyNodeNameToClipboard({ displayName: '节点' }, null);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('当前浏览器不支持复制到剪贴板');
  });
});
