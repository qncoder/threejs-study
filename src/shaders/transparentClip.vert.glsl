// Transparent_Clip — 顶点着色器（对应 Unity 顶点透传 + 世界坐标）
// Three.js 自动注入：modelMatrix / viewMatrix / projectionMatrix / normalMatrix 等

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewPosition;

void main() {
  vUv = uv;

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // 世界空间法线（与 uLightDirection 同空间；勿用 normalMatrix，那是视图空间）
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  vec4 mvPosition = viewMatrix * worldPosition;
  vViewPosition = -mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
