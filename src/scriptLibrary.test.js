import { describe, expect, it } from 'vitest';
import {
  createScriptLibraryItems,
  createScriptNameFromFileName,
  loadScriptLibraryItemSource,
} from './scriptLibrary.js';

describe('脚本库', () => {
  it('把 script 目录里的模块整理成可展示的列表', () => {
    const modules = {
      '../script/TailBeam/TailBeam.js': async () => 'tail',
      '../script/FrontColumn/run.js': async () => 'front',
      '../script/BackColumn/lookAt.js': async () => 'back',
    };

    const items = createScriptLibraryItems(modules);

    expect(items.map((item) => item.name)).toEqual([
      'BackColumn/lookAt',
      'FrontColumn/run',
      'TailBeam/TailBeam',
    ]);
    expect(items[0]).toMatchObject({
      id: '../script/BackColumn/lookAt.js',
      path: '../script/BackColumn/lookAt.js',
      fileName: 'lookAt.js',
    });
  });

  it('读取脚本库条目的源码文本', async () => {
    const item = createScriptLibraryItems({
      '../script/FrontColumn/run.js': async () => 'setPosition(1, 2, 3);',
    })[0];

    await expect(loadScriptLibraryItemSource(item)).resolves.toBe('setPosition(1, 2, 3);');
  });

  it('根据上传文件名生成脚本名', () => {
    expect(createScriptNameFromFileName('TailBeamMotion.js')).toBe('TailBeamMotion');
    expect(createScriptNameFromFileName('')).toBe('上传脚本');
  });
});
