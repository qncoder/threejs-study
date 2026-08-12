import {
  Color,
  DataTexture,
  DoubleSide,
  FrontSide,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  Vector4,
} from 'three';

import vertexShader from './shaders/transparentClip.vert.glsl?raw';
import fragmentShader from './shaders/transparentClip.frag.glsl?raw';

let whiteTexture = null;
/** 金属度默认 0：绝不能用白贴图当 metalness 回退，否则 metallic=1 会整模发黑 */
let blackTexture = null;
/** glTF 风格中性 metal-rough：G=roughness≈0.5, B=metalness=0 */
let neutralMetalRoughTexture = null;
/** 平坦法线 (0.5,0.5,1) */
let flatNormalTexture = null;

function makeSolidTexture(r, g, b, a = 255) {
  const data = new Uint8Array([r, g, b, a]);
  const texture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  texture.needsUpdate = true;
  return texture;
}

function getWhiteTexture() {
  if (!whiteTexture) whiteTexture = makeSolidTexture(255, 255, 255, 255);
  return whiteTexture;
}

function getBlackTexture() {
  if (!blackTexture) blackTexture = makeSolidTexture(0, 0, 0, 255);
  return blackTexture;
}

function getNeutralMetalRoughTexture() {
  // R unused, G roughness 128, B metalness 0, A 255
  if (!neutralMetalRoughTexture) neutralMetalRoughTexture = makeSolidTexture(0, 128, 0, 255);
  return neutralMetalRoughTexture;
}

function getFlatNormalTexture() {
  if (!flatNormalTexture) flatNormalTexture = makeSolidTexture(128, 128, 255, 255);
  return flatNormalTexture;
}

/**
 * 创建一组可被多个 ShaderMaterial 共享的 uniforms（改一处全员更新）。
 */
export function createTransparentClipSharedUniforms(initial = {}) {
  return {
    uBaseColor: { value: new Color(initial.baseColor ?? '#ffffff') },
    uOpacity: { value: initial.opacity ?? 0.72 },
    uSmoothness: { value: initial.smoothness ?? 0.5 },
    uNormalStrength: { value: initial.normalStrength ?? 1 },
    uMetalnessScale: { value: initial.metalnessScale ?? 1 },
    // ZF18000.glb 默认 glTF 通道；Unity 贴图可改 0
    uMetalRoughPack: { value: initial.metalRoughPack ?? 1 },
    uBaseMapST: {
      value:
        initial.baseMapST instanceof Vector4
          ? initial.baseMapST
          : new Vector4(
              initial.baseMapST?.[0] ?? 1,
              initial.baseMapST?.[1] ?? 1,
              initial.baseMapST?.[2] ?? 0,
              initial.baseMapST?.[3] ?? 0,
            ),
    },
    uEnableClipX: { value: initial.enableClipX ? 1 : 0 },
    uEnableClipY: { value: initial.enableClipY ? 1 : 0 },
    uEnableClipZ: { value: initial.enableClipZ ? 1 : 0 },
    uClipPosX: { value: initial.clipPosX ?? 0 },
    uClipPosY: { value: initial.clipPosY ?? 0 },
    uClipPosZ: { value: initial.clipPosZ ?? 0 },
    uLightDirection: { value: new Vector3(0.55, 0.9, 0.4).normalize() },
    uLightColor: { value: new Color('#ffffff') },
    // 无 envMap 时环境光要够亮，否则金属/阴影面发黑
    uAmbientColor: { value: new Color('#9aa4b2') },
  };
}

/**
 * @param {object} sharedUniforms createTransparentClipSharedUniforms() 的返回值
 * @param {{ map?: object, metalnessMap?: object, normalMap?: object, side?: number }} maps
 */
export function createTransparentClipShaderMaterial(sharedUniforms, maps = {}) {
  const white = getWhiteTexture();
  const metalRoughFallback = getNeutralMetalRoughTexture();
  const flatNormal = getFlatNormalTexture();

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      // 共享引用：页面改 shared 即全部 mesh 生效
      uBaseColor: sharedUniforms.uBaseColor,
      uOpacity: sharedUniforms.uOpacity,
      uSmoothness: sharedUniforms.uSmoothness,
      uNormalStrength: sharedUniforms.uNormalStrength,
      uMetalnessScale: sharedUniforms.uMetalnessScale,
      uMetalRoughPack: sharedUniforms.uMetalRoughPack,
      uBaseMapST: sharedUniforms.uBaseMapST,
      uEnableClipX: sharedUniforms.uEnableClipX,
      uEnableClipY: sharedUniforms.uEnableClipY,
      uEnableClipZ: sharedUniforms.uEnableClipZ,
      uClipPosX: sharedUniforms.uClipPosX,
      uClipPosY: sharedUniforms.uClipPosY,
      uClipPosZ: sharedUniforms.uClipPosZ,
      uLightDirection: sharedUniforms.uLightDirection,
      uLightColor: sharedUniforms.uLightColor,
      uAmbientColor: sharedUniforms.uAmbientColor,
      // 每 mesh 贴图
      uBaseMap: { value: maps.map ?? white },
      uMetallicMap: { value: maps.metalnessMap ?? metalRoughFallback },
      uNormalMap: { value: maps.normalMap ?? flatNormal },
    },
    transparent: true,
    depthWrite: false,
    side: maps.side ?? DoubleSide,
    lights: false,
    toneMapped: true,
  });
  material.userData.isTransparentClipGlsl = true;
  return material;
}

/**
 * 把模型上所有 Mesh 换成 GLSL Transparent_Clip 材质。
 * @returns {{ materials: import('three').ShaderMaterial[], sharedUniforms: object }}
 */
export function applyTransparentClipGlslToModel(root, sharedUniforms) {
  const materials = [];
  const white = getWhiteTexture();
  const metalRoughFallback = getNeutralMetalRoughTexture();
  const flatNormal = getFlatNormalTexture();

  root.traverse((object) => {
    if (!object.isMesh) return;

    const sources = Array.isArray(object.material) ? object.material : [object.material];
    const nextList = sources.map((source) => {
      // glTF 常把 metalnessMap/roughnessMap 指同一张 ORM 贴图
      const metalRoughMap =
        source?.metalnessMap ?? source?.roughnessMap ?? source?.specularMap ?? metalRoughFallback;
      const material = createTransparentClipShaderMaterial(sharedUniforms, {
        map: source?.map ?? white,
        metalnessMap: metalRoughMap,
        normalMap: source?.normalMap ?? flatNormal,
        side: DoubleSide,
      });
      materials.push(material);
      return material;
    });

    object.material = nextList.length === 1 ? nextList[0] : nextList;
  });

  return { materials, sharedUniforms };
}

/**
 * 用 UI 状态写入共享 uniforms（GLSL 侧立刻生效）。
 */
export function updateTransparentClipUniforms(sharedUniforms, state) {
  if (!sharedUniforms) return;

  if (state.baseColor != null) {
    sharedUniforms.uBaseColor.value.set(state.baseColor);
  }
  if (state.opacity != null) sharedUniforms.uOpacity.value = state.opacity;
  if (state.smoothness != null) sharedUniforms.uSmoothness.value = state.smoothness;
  if (state.normalStrength != null) sharedUniforms.uNormalStrength.value = state.normalStrength;
  if (state.metalnessScale != null) sharedUniforms.uMetalnessScale.value = state.metalnessScale;

  // 互斥 else-if：与 Unity / transparentClip.js 一致
  const axis = state.clipAxis; // 'X' | 'Y' | 'Z' | 'none'
  sharedUniforms.uEnableClipX.value = axis === 'X' ? 1 : 0;
  sharedUniforms.uEnableClipY.value = axis === 'Y' ? 1 : 0;
  sharedUniforms.uEnableClipZ.value = axis === 'Z' ? 1 : 0;

  if (state.clipPosX != null) sharedUniforms.uClipPosX.value = state.clipPosX;
  if (state.clipPosY != null) sharedUniforms.uClipPosY.value = state.clipPosY;
  if (state.clipPosZ != null) sharedUniforms.uClipPosZ.value = state.clipPosZ;

  for (const material of state.materials ?? []) {
    if (!material) continue;
    material.side = state.doubleSided ? DoubleSide : FrontSide;
    material.needsUpdate = true;
  }
}

export function getTransparentClipShaderSources() {
  return { vertexShader, fragmentShader };
}
