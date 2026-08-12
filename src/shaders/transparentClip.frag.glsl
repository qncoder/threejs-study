// Transparent_Clip — 片元着色器
// 对应 Unity SurfaceDescriptionFunction：BaseColor×贴图、金属/光滑、法线、世界空间 Clip
//
// 注意：无 HDR/环境贴图时，不能把金属漫反射直接乘成 0，否则模型会整体发黑。

precision highp float;

uniform vec3 uBaseColor;
uniform float uOpacity;
uniform float uSmoothness;
uniform float uNormalStrength;
uniform float uMetalnessScale;
// 0 = Unity 包（R=metal, A=smoothness）
// 1 = glTF 包（B=metal, G=roughness）— ZF18000.glb 用这个
uniform float uMetalRoughPack;

uniform sampler2D uBaseMap;
uniform sampler2D uMetallicMap;
uniform sampler2D uNormalMap;
uniform vec4 uBaseMapST;

uniform float uEnableClipX;
uniform float uEnableClipY;
uniform float uEnableClipZ;
uniform float uClipPosX;
uniform float uClipPosY;
uniform float uClipPosZ;

uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewPosition;

vec3 applyNormalStrength(vec3 n, float strength) {
  return vec3(n.xy * strength, mix(1.0, n.z, clamp(strength, 0.0, 1.0)));
}

void main() {
  vec2 uvBase = vUv * uBaseMapST.xy + uBaseMapST.zw;
  vec4 baseMap = texture2D(uBaseMap, uvBase);
  vec4 baseColor = vec4(uBaseColor, 1.0) * baseMap;
  vec3 albedo = max(baseColor.rgb, vec3(0.02));

  vec4 metallicSample = texture2D(uMetallicMap, vUv);
  float metallic;
  float roughness;

  if (uMetalRoughPack > 0.5) {
    // glTF metallicRoughness：B 金属，G 粗糙
    metallic = clamp(metallicSample.b * uMetalnessScale, 0.0, 1.0);
    roughness = clamp(metallicSample.g, 0.04, 1.0);
    // UI Smoothness 作为全局光滑倾向（降低 roughness）
    roughness = clamp(roughness * (1.0 - uSmoothness * 0.65), 0.04, 1.0);
  } else {
    // Unity MetallicSmoothness：R 金属，A 光滑
    metallic = clamp(metallicSample.r * uMetalnessScale, 0.0, 1.0);
    float smoothVal = clamp(metallicSample.a * uSmoothness, 0.0, 1.0);
    roughness = clamp(1.0 - smoothVal, 0.04, 1.0);
  }

  float smoothVal = 1.0 - roughness;

  // 法线：几何法线为主，贴图轻扰动（无 TBN 时避免法线炸裂变黑）
  vec3 geomNormal = normalize(vWorldNormal);
  // 双面时保证朝向相机一侧有光
  if (!gl_FrontFacing) {
    geomNormal = -geomNormal;
  }
  vec3 normalMapSample = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
  vec3 strengthened = applyNormalStrength(normalMapSample, uNormalStrength);
  vec3 normal = normalize(mix(geomNormal, normalize(geomNormal + strengthened * 0.25), clamp(uNormalStrength, 0.0, 1.0) * 0.5));

  float alpha = baseColor.a * uOpacity;

  if (uEnableClipX > 0.5) {
    if (vWorldPosition.x < uClipPosX) alpha = 0.0;
  } else if (uEnableClipY > 0.5) {
    if (vWorldPosition.y < uClipPosY) alpha = 0.0;
  } else if (uEnableClipZ > 0.5) {
    if (vWorldPosition.z < uClipPosZ) alpha = 0.0;
  }

  if (alpha < 0.001) {
    discard;
  }

  vec3 lightDir = normalize(uLightDirection);
  vec3 viewDir = normalize(vViewPosition);
  float ndl = max(dot(normal, lightDir), 0.0);
  // 背光面也留一点光，避免整块死黑
  float wrap = ndl * 0.65 + 0.35;

  // 假环境：无 envMap 时金属也要靠 albedo * ambient 看见颜色
  vec3 ambient = uAmbientColor * albedo * mix(1.0, 1.35, metallic);

  // 非金属：正常漫反射；金属：保留一部分 tinted 漫反射（代替 IBL）
  vec3 diffuse = albedo * uLightColor * wrap * mix(1.0, 0.35, metallic);

  vec3 halfDir = normalize(lightDir + viewDir);
  float specPower = mix(12.0, 96.0, smoothVal);
  float spec = pow(max(dot(normal, halfDir), 0.0), specPower) * mix(0.15, 0.9, smoothVal);
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  vec3 specular = f0 * uLightColor * spec;

  vec3 finalRgb = ambient + diffuse + specular;

  // 防止数值过暗
  finalRgb = max(finalRgb, albedo * 0.12);

  gl_FragColor = vec4(finalRgb, alpha);
}
