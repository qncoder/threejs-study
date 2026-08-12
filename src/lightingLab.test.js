import { describe, expect, it } from 'vitest';
import { MathUtils } from 'three';
import {
  LIGHT_PRESETS,
  LIGHT_TYPES,
  applyLightConfig,
  configureLightShadow,
  createLightConfigs,
  createLightHelper,
  createLightObject,
  resolveVisibleLightIds,
  rotateAroundY,
  scaleLightConfig,
} from './lightingLab.js';

function presetById(id) {
  return LIGHT_PRESETS.find((preset) => preset.id === id);
}

function configById(configs, id) {
  return configs.find((config) => config.id === id);
}

describe('灯光预设', () => {
  it('六种灯光 API 各有一条预设', () => {
    const types = LIGHT_PRESETS.map((preset) => preset.type);
    expect(types).toEqual([
      LIGHT_TYPES.AMBIENT,
      LIGHT_TYPES.HEMISPHERE,
      LIGHT_TYPES.DIRECTIONAL,
      LIGHT_TYPES.POINT,
      LIGHT_TYPES.SPOT,
      LIGHT_TYPES.RECT_AREA,
    ]);
  });

  it('createLightConfigs 每次返回独立副本，改动不会污染预设', () => {
    const first = createLightConfigs(1);
    const second = createLightConfigs(1);

    configById(first, 'directional').position.x = 999;
    configById(first, 'spot').sliders[0].max = 999;

    expect(configById(second, 'directional').position.x).toBe(presetById('directional').position.x);
    expect(presetById('spot').sliders[0].max).toBe(89);
  });
});

describe('scaleLightConfig', () => {
  it('位置与长度类滑杆按半径缩放', () => {
    const config = scaleLightConfig(presetById('spot'), 4);

    expect(config.position).toEqual({ x: -6.4, y: 9.2, z: 5.6 });
    expect(config.positionRange).toBe(12);

    const distanceSlider = config.sliders.find((slider) => slider.key === 'distance');
    expect(distanceSlider.max).toBe(24);

    const angleSlider = config.sliders.find((slider) => slider.key === 'angleDeg');
    expect(angleSlider.max).toBe(89);
  });

  it('点光/聚光强度按半径平方缩放，辐照度类灯光不缩放', () => {
    const point = scaleLightConfig(presetById('point'), 3);
    expect(point.intensity).toBe(presetById('point').intensity * 9);
    expect(point.intensityMax).toBe(presetById('point').intensityMax * 9);

    const directional = scaleLightConfig(presetById('directional'), 3);
    expect(directional.intensity).toBe(presetById('directional').intensity);
  });

  it('非法半径回退为 1', () => {
    const config = scaleLightConfig(presetById('point'), 0);
    expect(config.intensity).toBe(presetById('point').intensity);
  });
});

describe('resolveVisibleLightIds', () => {
  const configs = [
    { id: 'a', enabled: true },
    { id: 'b', enabled: false },
    { id: 'c', enabled: true },
  ];

  it('没有 solo 时返回所有勾选的灯', () => {
    expect(resolveVisibleLightIds(configs)).toEqual(new Set(['a', 'c']));
  });

  it('solo 时只返回那一盏，即使它没有被勾选', () => {
    expect(resolveVisibleLightIds(configs, 'b')).toEqual(new Set(['b']));
  });

  it('solo 指向不存在的灯时退回普通模式', () => {
    expect(resolveVisibleLightIds(configs, 'missing')).toEqual(new Set(['a', 'c']));
  });
});

describe('rotateAroundY', () => {
  it('绕 Y 轴旋转 90° 后 X 与 Z 互换，高度不变', () => {
    const rotated = rotateAroundY({ x: 2, y: 5, z: 0 }, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0, 6);
    expect(rotated.y).toBe(5);
    expect(rotated.z).toBeCloseTo(-2, 6);
  });
});

describe('createLightObject', () => {
  it('按类型创建对应的 three 灯光', () => {
    const configs = createLightConfigs(1);
    expect(createLightObject(configById(configs, 'ambient')).light.isAmbientLight).toBe(true);
    expect(createLightObject(configById(configs, 'hemisphere')).light.isHemisphereLight).toBe(true);
    expect(createLightObject(configById(configs, 'point')).light.isPointLight).toBe(true);
    expect(createLightObject(configById(configs, 'rectArea')).light.isRectAreaLight).toBe(true);
  });

  it('平行光与聚光带出 target 对象，其余为 null', () => {
    const configs = createLightConfigs(1);
    const spot = createLightObject(configById(configs, 'spot'));
    expect(spot.target).toBe(spot.light.target);
    expect(createLightObject(configById(configs, 'ambient')).target).toBeNull();
  });

  it('未知类型返回 null', () => {
    expect(createLightObject({ type: 'unknown' })).toBeNull();
  });
});

describe('applyLightConfig', () => {
  it('把聚光灯参数写回灯光对象', () => {
    const config = scaleLightConfig(presetById('spot'), 1);
    const { light } = createLightObject(config);

    Object.assign(config, {
      color: '#ff0000',
      intensity: 7,
      angleDeg: 45,
      penumbra: 0.8,
      distance: 12,
      decay: 1.5,
      position: { x: 1, y: 2, z: 3 },
    });
    applyLightConfig(light, config);

    expect(light.color.getHexString()).toBe('ff0000');
    expect(light.intensity).toBe(7);
    expect(light.angle).toBeCloseTo(MathUtils.degToRad(45), 6);
    expect(light.penumbra).toBe(0.8);
    expect(light.distance).toBe(12);
    expect(light.decay).toBe(1.5);
    expect(light.position.toArray()).toEqual([1, 2, 3]);
  });

  it('半球光的地面色单独生效', () => {
    const config = scaleLightConfig(presetById('hemisphere'), 1);
    const { light } = createLightObject(config);

    applyLightConfig(light, { ...config, color: '#ffffff', groundColor: '#00ff00' });

    expect(light.color.getHexString()).toBe('ffffff');
    expect(light.groundColor.getHexString()).toBe('00ff00');
  });

  it('不支持阴影的灯光不会被打开 castShadow', () => {
    const config = scaleLightConfig(presetById('ambient'), 1);
    const { light } = createLightObject(config);

    applyLightConfig(light, { ...config, castShadow: true });

    expect(light.castShadow).toBe(false);
  });

  it('orbitAngle 只改变灯光实际位置，不修改配置里的基准坐标', () => {
    const config = scaleLightConfig(presetById('point'), 1);
    const { light } = createLightObject(config);
    config.position = { x: 3, y: 1, z: 0 };

    applyLightConfig(light, config, { orbitAngle: Math.PI / 2 });

    expect(light.position.x).toBeCloseTo(0, 6);
    expect(light.position.z).toBeCloseTo(-3, 6);
    expect(config.position).toEqual({ x: 3, y: 1, z: 0 });
  });

  it('面光源按 lookAt 目标转向', () => {
    const config = scaleLightConfig(presetById('rectArea'), 1);
    const { light } = createLightObject(config);
    config.position = { x: 0, y: 0, z: 5 };

    applyLightConfig(light, config, { lookAt: { x: 0, y: 0, z: 0 } });

    expect(light.rotation.y).toBeCloseTo(0, 6);
    expect(light.width).toBe(config.width);
    expect(light.height).toBe(config.height);
  });
});

describe('configureLightShadow', () => {
  it('平行光的正交阴影相机按模型半径展开', () => {
    const { light } = createLightObject(scaleLightConfig(presetById('directional'), 1));

    configureLightShadow(light, { radius: 5, mapSize: 1024 });

    expect(light.shadow.mapSize.x).toBe(1024);
    expect(light.shadow.camera.right).toBe(8);
    expect(light.shadow.camera.bottom).toBe(-8);
    expect(light.shadow.camera.far).toBe(60);
  });

  it('没有 shadow 的灯光原样返回', () => {
    const { light } = createLightObject(scaleLightConfig(presetById('ambient'), 1));
    expect(configureLightShadow(light, { radius: 5 })).toBe(light);
  });
});

describe('createLightHelper', () => {
  it('环境光没有 helper', () => {
    const config = scaleLightConfig(presetById('ambient'), 1);
    expect(createLightHelper(createLightObject(config).light, config)).toBeNull();
  });

  it('面光源 helper 需要挂到灯光下', () => {
    const config = scaleLightConfig(presetById('rectArea'), 1);
    const result = createLightHelper(createLightObject(config).light, config, 1);
    expect(result.attachToLight).toBe(true);
  });

  it('平行光 helper 挂在场景下', () => {
    const config = scaleLightConfig(presetById('directional'), 1);
    const result = createLightHelper(createLightObject(config).light, config, 1);
    expect(result.attachToLight).toBe(false);
    expect(result.helper.isObject3D).toBe(true);
  });
});
