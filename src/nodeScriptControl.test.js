import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import {
  bindNodeControlScript,
  clearNodeControlScript,
  createNodeScriptDialogState,
  getBoundNodeControlScript,
  hasBoundNodeControlScript,
  runAndBindNodeControlScript,
  runNodeControlScript,
} from './nodeScriptControl.js';

describe('nodeScriptControl', () => {
  it('执行脚本修改节点位置、旋转和缩放', () => {
    const node = new Object3D();

    const result = runNodeControlScript(
      node,
      `
setPosition(1, 2, 3);
setRotationDeg(0, 90, 0);
setScale(1, 2, 1);
`,
    );

    expect(result).toEqual({ ok: true, error: '' });
    expect(node.position.toArray()).toEqual([1, 2, 3]);
    expect(node.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(node.scale.toArray()).toEqual([1, 2, 1]);
  });

  it('可以直接操作 node 对象', () => {
    const node = new Object3D();

    const result = runNodeControlScript(node, 'node.position.y = -5;');

    expect(result.ok).toBe(true);
    expect(node.position.y).toBe(-5);
  });

  it('脚本里可以访问 THREE', () => {
    const node = new Object3D();

    const result = runNodeControlScript(
      node,
      `
const v = new THREE.Vector3(1, 2, 3);
node.position.copy(v);
`,
    );

    expect(result).toEqual({ ok: true, error: '' });
    expect(node.position.toArray()).toEqual([1, 2, 3]);
  });

  it('脚本里可以访问 scene，用来创建模型外的辅助对象', () => {
    const node = new Object3D();
    const scene = new Object3D();

    const result = runNodeControlScript(
      node,
      `
const helper = new THREE.Object3D();
helper.name = 'debug-helper';
scene.add(helper);
`,
      { scene },
    );

    expect(result).toEqual({ ok: true, error: '' });
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0].name).toBe('debug-helper');
  });

  it('脚本报错时返回错误信息', () => {
    const node = new Object3D();

    const result = runNodeControlScript(node, 'throw new Error("bad script");');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('bad script');
  });

  it('执行成功后自动把脚本绑定到节点', () => {
    const node = new Object3D();
    const script = 'setPosition(4, 5, 6);';

    const result = runAndBindNodeControlScript(node, script);

    expect(result).toEqual({ ok: true, error: '' });
    expect(node.position.toArray()).toEqual([4, 5, 6]);
    expect(getBoundNodeControlScript(node)).toBe(script);
  });

  it('执行失败时不覆盖节点原来绑定的脚本', () => {
    const node = new Object3D();
    const originalScript = 'setPosition(1, 0, 0);';
    bindNodeControlScript(node, originalScript);

    const result = runAndBindNodeControlScript(node, 'throw new Error("bad script");');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('bad script');
    expect(getBoundNodeControlScript(node)).toBe(originalScript);
  });

  it('把控制脚本绑定到节点 userData，之后可以读取和清除', () => {
    const node = new Object3D();
    const script = 'setPosition(1, 0, 0);';

    const bindResult = bindNodeControlScript(node, script);

    expect(bindResult).toEqual({ ok: true, error: '' });
    expect(hasBoundNodeControlScript(node)).toBe(true);
    expect(getBoundNodeControlScript(node)).toBe(script);

    const clearResult = clearNodeControlScript(node);

    expect(clearResult).toEqual({ ok: true, error: '' });
    expect(hasBoundNodeControlScript(node)).toBe(false);
    expect(getBoundNodeControlScript(node)).toBe('');
  });

  it('按节点生成脚本弹窗状态，优先使用已绑定脚本', () => {
    const node = new Object3D();
    const script = 'setPosition(9, 8, 7);';
    bindNodeControlScript(node, script);

    const state = createNodeScriptDialogState({
      nodeUuid: 'node-1',
      node,
      row: {
        displayName: '前轮',
        type: 'Mesh',
        path: 'Root / 前轮',
      },
      transform: {
        position: [1, 2, 3],
        rotationDeg: [0, 90, 0],
        scale: [1, 1, 1],
      },
      position: { x: 24, y: 36 },
    });

    expect(state).toMatchObject({
      open: true,
      nodeUuid: 'node-1',
      nodeTitle: '前轮',
      nodeType: 'Mesh',
      nodePath: 'Root / 前轮',
      script,
      message: '当前节点已绑定脚本。',
      messageType: 'hint',
      x: 24,
      y: 36,
    });
  });

  it('未绑定脚本时按节点变换生成默认脚本', () => {
    const node = new Object3D();

    const state = createNodeScriptDialogState({
      nodeUuid: 'node-2',
      node,
      row: {
        displayName: '后轮',
        type: 'Object3D',
        path: 'Root / 后轮',
      },
      transform: {
        position: [1.12345, 2, 3],
        rotationDeg: [0, 45.56789, 0],
        scale: [1, 2, 1],
      },
      position: { x: 50, y: 60 },
    });

    expect(state.script).toContain('setPosition(1.1235, 2, 3);');
    expect(state.script).toContain('setRotationDeg(0, 45.5679, 0);');
    expect(state.script).toContain('setScale(1, 2, 1);');
    expect(state.message).toBe('可以编辑并执行当前节点脚本。');
  });
});
