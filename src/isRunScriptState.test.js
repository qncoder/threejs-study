import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const runCopyPath = fileURLToPath(new URL('../script/isRun/run copy.js', import.meta.url));

describe('script/isRun/run copy.js 批量状态缓存', () => {
  it('按当前控制模型区分缓存，避免不同支架共用同一个状态', () => {
    const source = readFileSync(runCopyPath, 'utf8');

    expect(source).toContain('const sceneKey = scene?.uuid || node?.uuid ||');
    expect(source).toContain('window[STORE_KEY][sceneKey]');
    expect(source).not.toContain('window.step');
    expect(source).not.toContain('const group = window[STORE_KEY]');
  });
});
