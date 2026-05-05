import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import {
  bindNodeControlScript,
  clearNodeControlScript,
  getBoundNodeControlScript,
  hasBoundNodeControlScript,
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
});
