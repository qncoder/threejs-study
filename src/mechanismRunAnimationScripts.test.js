import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const animationScripts = [
  '../script/TailBeam/run-animation.js',
  '../script/isRun/run-animation.js',
  '../script/FrontBeam/run-animation.js',
  '../script/FlexBeamStrokeSlide/run-animation.js',
  '../script/Flap1_ZF18000/run-animation.js',
];

function readScript(relativePath) {
  const scriptPath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(scriptPath, 'utf8');
}

describe('机构 run 动画脚本', () => {
  it.each(animationScripts)('%s 可以被脚本环境解析，并且会取消上一轮动画', (relativePath) => {
    const source = readScript(relativePath);

    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('cancelAnimationFrame');
    expect(() => new Function('node', 'THREE', 'scene', 'setPosition', 'setRotationDeg', 'setScale', 'deg', source))
      .not.toThrow();
  });
});
