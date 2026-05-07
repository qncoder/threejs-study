import { describe, expect, it } from 'vitest';
import { Group, Object3D, Scene } from 'three';
import { createEditedGlbFileName, exportModelAsGlb } from './modelExport.js';

describe('modelExport', () => {
  it('根据原 GLB 文件名生成修改后模型文件名', () => {
    expect(createEditedGlbFileName('F309.glb')).toBe('F309-edited.glb');
  });

  it('没有有效文件名时使用默认导出文件名', () => {
    expect(createEditedGlbFileName('')).toBe('model-edited.glb');
  });

  it('用二进制 GLB 参数导出当前模型对象', async () => {
    const model = new Group();
    model.name = 'Root';
    const child = new Object3D();
    child.name = 'child';
    model.add(child);
    const binary = new ArrayBuffer(8);
    const exporter = {
      parse(input, onDone, onError, options) {
        expect(input).toBeInstanceOf(Scene);
        expect(input).not.toBe(model);
        expect(input.name).toBe('Root');
        expect(input.children).toEqual([child]);
        expect(child.parent).toBe(model);
        expect(options).toMatchObject({ binary: true, onlyVisible: false });
        onDone(binary);
      },
    };

    await expect(exportModelAsGlb(model, exporter)).resolves.toBe(binary);
  });

  it('导出结果不是二进制数据时返回错误', async () => {
    const exporter = {
      parse(input, onDone) {
        onDone({ asset: { version: '2.0' } });
      },
    };

    await expect(exportModelAsGlb(new Object3D(), exporter)).rejects.toThrow('模型导出结果不是 GLB 二进制数据。');
  });
});
