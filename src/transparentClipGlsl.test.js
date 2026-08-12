import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import {
  createTransparentClipSharedUniforms,
  getTransparentClipShaderSources,
  updateTransparentClipUniforms,
} from './transparentClipGlsl.js';

describe('transparentClipGlsl', () => {
  it('提供可编译形态的 GLSL 源码字符串', () => {
    const { vertexShader, fragmentShader } = getTransparentClipShaderSources();
    expect(vertexShader).toContain('gl_Position');
    expect(fragmentShader).toContain('discard');
    expect(fragmentShader).toContain('uClipPosX');
    expect(fragmentShader).toContain('uEnableClipX');
    // 避免金属无 IBL 时整模发黑
    expect(fragmentShader).toContain('uMetalRoughPack');
    expect(fragmentShader).toContain('假环境');
  });

  it('共享 uniforms 可按 UI 状态更新（含轴互斥）', () => {
    const uniforms = createTransparentClipSharedUniforms();
    updateTransparentClipUniforms(uniforms, {
      baseColor: '#ff0000',
      opacity: 0.5,
      smoothness: 0.8,
      clipAxis: 'Y',
      clipPosY: 1.25,
    });

    expect(uniforms.uBaseColor.value).toBeInstanceOf(Color);
    expect(uniforms.uBaseColor.value.r).toBeGreaterThan(0.9);
    expect(uniforms.uOpacity.value).toBe(0.5);
    expect(uniforms.uSmoothness.value).toBe(0.8);
    expect(uniforms.uEnableClipX.value).toBe(0);
    expect(uniforms.uEnableClipY.value).toBe(1);
    expect(uniforms.uEnableClipZ.value).toBe(0);
    expect(uniforms.uClipPosY.value).toBe(1.25);
  });

  it('clipAxis none 时三轴全关', () => {
    const uniforms = createTransparentClipSharedUniforms({ enableClipX: true });
    updateTransparentClipUniforms(uniforms, { clipAxis: 'none' });
    expect(uniforms.uEnableClipX.value).toBe(0);
    expect(uniforms.uEnableClipY.value).toBe(0);
    expect(uniforms.uEnableClipZ.value).toBe(0);
  });
});
