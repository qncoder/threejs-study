import {
  AmbientLight,
  DirectionalLight,
  DirectionalLightHelper,
  HemisphereLight,
  HemisphereLightHelper,
  MathUtils,
  PointLight,
  PointLightHelper,
  RectAreaLight,
  SpotLight,
  SpotLightHelper,
} from 'three';
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';

export const LIGHT_TYPES = {
  AMBIENT: 'ambient',
  HEMISPHERE: 'hemisphere',
  DIRECTIONAL: 'directional',
  POINT: 'point',
  SPOT: 'spot',
  RECT_AREA: 'rectArea',
};

// 预设里的长度都是「模型包围球半径的倍数」，强度分两类：
// - 无缩放：辐照度类（环境光/半球光/平行光/面光源），与模型大小无关
// - square：点光/聚光是坎德拉，照度按 1/d² 衰减，模型放大 r 倍要 r² 倍强度才一样亮
const INTENSITY_SCALING_SQUARE = 'square';

export const LIGHT_PRESETS = [
  {
    id: 'ambient',
    type: LIGHT_TYPES.AMBIENT,
    label: '环境光',
    api: 'THREE.AmbientLight(color, intensity)',
    summary: '无方向地照亮全部物体，没有明暗过渡，也不产生阴影。',
    note: '单独打开时支架是一张没有立体感的剪影，通常只用来提亮暗部。',
    enabled: true,
    color: '#dbeafe',
    intensity: 0.35,
    intensityMax: 3,
    supportsShadow: false,
    supportsHelper: false,
    position: null,
    sliders: [],
  },
  {
    id: 'hemisphere',
    type: LIGHT_TYPES.HEMISPHERE,
    label: '半球光',
    api: 'THREE.HemisphereLight(skyColor, groundColor, intensity)',
    summary: '从上方天空色渐变到下方地面色，模拟户外天光加地面反弹光。',
    note: '顶面偏天空色、底面偏地面色，比环境光更有体积感，同样不产生阴影。',
    enabled: true,
    color: '#bfdbfe',
    groundColor: '#78350f',
    intensity: 0.9,
    intensityMax: 5,
    supportsShadow: false,
    supportsHelper: true,
    showHelper: false,
    position: { x: 0, y: 2.2, z: 0 },
    sliders: [],
  },
  {
    id: 'directional',
    type: LIGHT_TYPES.DIRECTIONAL,
    label: '平行光',
    api: 'THREE.DirectionalLight(color, intensity)',
    summary: '光线互相平行，只看方向不看距离，等价于太阳光。',
    note: '阴影用正交相机投射，适合当主光；移动位置只改变照射角度，不会衰减。',
    enabled: true,
    color: '#fff7e6',
    intensity: 2.4,
    intensityMax: 10,
    supportsShadow: true,
    castShadow: true,
    supportsHelper: true,
    showHelper: true,
    position: { x: 1.3, y: 1.8, z: 1.1 },
    sliders: [],
  },
  {
    id: 'point',
    type: LIGHT_TYPES.POINT,
    label: '点光源',
    api: 'THREE.PointLight(color, intensity, distance, decay)',
    summary: '从一个点向四面八方发光，亮度随距离按 1/d² 衰减，像一只裸灯泡。',
    note: 'distance = 0 表示不截断，decay = 2 是物理正确衰减；阴影用立方体贴图，开销最大。',
    enabled: false,
    color: '#ffd9a0',
    intensity: 12,
    intensityMax: 80,
    intensityScaling: INTENSITY_SCALING_SQUARE,
    supportsShadow: true,
    castShadow: true,
    supportsHelper: true,
    showHelper: true,
    position: { x: 1.4, y: 1.2, z: -1.3 },
    distance: 0,
    decay: 2,
    sliders: [
      { key: 'distance', label: 'distance 截断距离（0=不限）', min: 0, max: 6, step: 0.1, scale: 'radius' },
      { key: 'decay', label: 'decay 衰减指数', min: 0, max: 4, step: 0.05 },
    ],
  },
  {
    id: 'spot',
    type: LIGHT_TYPES.SPOT,
    label: '聚光灯',
    api: 'THREE.SpotLight(color, intensity, distance, angle, penumbra, decay)',
    summary: '锥形光束照向 target，可调开合角与边缘虚化，像舞台追光。',
    note: 'angle 是锥半角（上限 90°），penumbra 控制光斑边缘软硬；这里 target 固定在支架中心。',
    enabled: false,
    color: '#e0f2fe',
    intensity: 25,
    intensityMax: 120,
    intensityScaling: INTENSITY_SCALING_SQUARE,
    supportsShadow: true,
    castShadow: true,
    supportsHelper: true,
    showHelper: true,
    position: { x: -1.6, y: 2.3, z: 1.4 },
    distance: 0,
    decay: 2,
    angleDeg: 26,
    penumbra: 0.35,
    sliders: [
      { key: 'angleDeg', label: 'angle 锥角(°)', min: 2, max: 89, step: 1 },
      { key: 'penumbra', label: 'penumbra 边缘虚化', min: 0, max: 1, step: 0.01 },
      { key: 'distance', label: 'distance 截断距离（0=不限）', min: 0, max: 6, step: 0.1, scale: 'radius' },
      { key: 'decay', label: 'decay 衰减指数', min: 0, max: 4, step: 0.05 },
    ],
  },
  {
    id: 'rectArea',
    type: LIGHT_TYPES.RECT_AREA,
    label: '矩形面光源',
    api: 'THREE.RectAreaLight(color, intensity, width, height)',
    summary: '一块发光矩形，产生柔和的宽面高光，像影棚柔光板或长条灯管。',
    note: '只对 MeshStandardMaterial / MeshPhysicalMaterial 生效，不支持阴影；使用前需 RectAreaLightUniformsLib.init()。',
    enabled: false,
    color: '#93c5fd',
    intensity: 8,
    intensityMax: 40,
    supportsShadow: false,
    supportsHelper: true,
    showHelper: true,
    position: { x: -1.8, y: 1.2, z: -1.5 },
    width: 1.4,
    height: 0.9,
    sliders: [
      { key: 'width', label: 'width 灯板宽', min: 0.1, max: 4, step: 0.05, scale: 'radius' },
      { key: 'height', label: 'height 灯板高', min: 0.1, max: 4, step: 0.05, scale: 'radius' },
    ],
  },
];

const DEFAULT_POSITION_RANGE = 3;

// 把预设按模型包围球半径换算成真实场景尺寸，返回全新对象（预设本身不被改写）
export function scaleLightConfig(preset, radius = 1) {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const intensityFactor = preset.intensityScaling === INTENSITY_SCALING_SQUARE ? r * r : 1;

  const config = {
    ...preset,
    intensity: preset.intensity * intensityFactor,
    intensityMax: preset.intensityMax * intensityFactor,
    position: preset.position
      ? { x: preset.position.x * r, y: preset.position.y * r, z: preset.position.z * r }
      : null,
    positionRange: (preset.positionRange ?? DEFAULT_POSITION_RANGE) * r,
    sliders: (preset.sliders ?? []).map((slider) => (
      slider.scale === 'radius'
        ? { ...slider, min: slider.min * r, max: slider.max * r, step: slider.step * r }
        : { ...slider }
    )),
  };

  for (const slider of preset.sliders ?? []) {
    if (slider.scale === 'radius') {
      config[slider.key] = (preset[slider.key] ?? 0) * r;
    }
  }

  return config;
}

export function createLightConfigs(radius = 1) {
  return LIGHT_PRESETS.map((preset) => scaleLightConfig(preset, radius));
}

// solo 优先：指定了某盏灯就只看它，否则看所有勾选的灯
export function resolveVisibleLightIds(configs, soloId = null) {
  const list = Array.isArray(configs) ? configs : [];
  if (soloId && list.some((config) => config.id === soloId)) {
    return new Set([soloId]);
  }
  return new Set(list.filter((config) => config.enabled).map((config) => config.id));
}

export function rotateAroundY(position, angle = 0) {
  if (!position) return null;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: position.x * cos + position.z * sin,
    y: position.y,
    z: -position.x * sin + position.z * cos,
  };
}

export function createLightObject(config) {
  if (!config) return null;

  switch (config.type) {
    case LIGHT_TYPES.AMBIENT:
      return { light: new AmbientLight(config.color, config.intensity), target: null };
    case LIGHT_TYPES.HEMISPHERE:
      return {
        light: new HemisphereLight(config.color, config.groundColor, config.intensity),
        target: null,
      };
    case LIGHT_TYPES.DIRECTIONAL: {
      const light = new DirectionalLight(config.color, config.intensity);
      return { light, target: light.target };
    }
    case LIGHT_TYPES.POINT:
      return {
        light: new PointLight(config.color, config.intensity, config.distance ?? 0, config.decay ?? 2),
        target: null,
      };
    case LIGHT_TYPES.SPOT: {
      const light = new SpotLight(
        config.color,
        config.intensity,
        config.distance ?? 0,
        MathUtils.degToRad(config.angleDeg ?? 30),
        config.penumbra ?? 0,
        config.decay ?? 2,
      );
      return { light, target: light.target };
    }
    case LIGHT_TYPES.RECT_AREA:
      return {
        light: new RectAreaLight(config.color, config.intensity, config.width ?? 1, config.height ?? 1),
        target: null,
      };
    default:
      return null;
  }
}

// 把面板上的配置写回 three 灯光对象。orbitAngle 用于「绕支架旋转」动画，
// 它只影响灯光的实际位置，不会污染面板里的基准坐标。
export function applyLightConfig(light, config, { orbitAngle = 0, lookAt = null } = {}) {
  if (!light || !config) return light;

  if (light.color && config.color) light.color.set(config.color);
  if (light.isHemisphereLight && config.groundColor) light.groundColor.set(config.groundColor);
  if (Number.isFinite(config.intensity)) light.intensity = config.intensity;

  if (config.position) {
    const placed = orbitAngle ? rotateAroundY(config.position, orbitAngle) : config.position;
    light.position.set(placed.x, placed.y, placed.z);
  }

  if (light.isPointLight || light.isSpotLight) {
    light.distance = config.distance ?? 0;
    light.decay = config.decay ?? 2;
  }

  if (light.isSpotLight) {
    light.angle = MathUtils.degToRad(config.angleDeg ?? 30);
    light.penumbra = config.penumbra ?? 0;
  }

  if (light.isRectAreaLight) {
    light.width = config.width ?? 1;
    light.height = config.height ?? 1;
  }

  light.castShadow = Boolean(config.supportsShadow && config.castShadow);

  // 面光源没有 target，只能靠自身朝向决定照射方向
  if (lookAt && light.isRectAreaLight) {
    light.lookAt(lookAt.x, lookAt.y, lookAt.z);
  }

  return light;
}

// 阴影相机跟着模型尺寸走：范围太小会裁掉阴影，太大则浪费精度
export function configureLightShadow(light, { radius = 1, mapSize = 2048 } = {}) {
  if (!light?.shadow) return light;

  const r = Number.isFinite(radius) && radius > 0 ? radius : 1;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = r * 0.01;
  light.shadow.camera.near = r * 0.05;
  light.shadow.camera.far = r * 12;

  if (light.isDirectionalLight) {
    const extent = r * 1.6;
    light.shadow.camera.left = -extent;
    light.shadow.camera.right = extent;
    light.shadow.camera.top = extent;
    light.shadow.camera.bottom = -extent;
  }

  light.shadow.camera.updateProjectionMatrix();
  return light;
}

// 返回 helper 及其挂载方式：RectAreaLightHelper 必须作为灯光子对象才能跟随灯光变换
export function createLightHelper(light, config, size = 1) {
  if (!light || !config?.supportsHelper) return null;

  switch (config.type) {
    case LIGHT_TYPES.HEMISPHERE:
      return { helper: new HemisphereLightHelper(light, size), attachToLight: false };
    case LIGHT_TYPES.DIRECTIONAL:
      return { helper: new DirectionalLightHelper(light, size), attachToLight: false };
    case LIGHT_TYPES.POINT:
      return { helper: new PointLightHelper(light, size * 0.3), attachToLight: false };
    case LIGHT_TYPES.SPOT:
      return { helper: new SpotLightHelper(light), attachToLight: false };
    case LIGHT_TYPES.RECT_AREA:
      return { helper: new RectAreaLightHelper(light), attachToLight: true };
    default:
      return null;
  }
}
