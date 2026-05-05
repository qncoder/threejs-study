import { describe, expect, it } from 'vitest';
import { createNodeInfoSections } from './nodeInfoSections.js';

describe('nodeInfoSections', () => {
  it('把节点信息整理成可折叠分组', () => {
    const sections = createNodeInfoSections({
      displayName: 'Arm',
      type: 'Object3D',
      path: 'Scene/Arm',
      parentName: 'Scene',
      childCount: 2,
      depth: 1,
      isMesh: false,
      geometryType: '',
      materialNames: [],
      position: [1, 2, 3],
      rotationDeg: [0, 90, 0],
      scale: [1, 1, 1],
      worldPosition: [4, 5, 6],
      mechanismRole: {
        label: '前立柱',
        type: '驱动',
        confidence: 0.8,
        description: '负责升降',
        controlHint: '可绑定脚本',
      },
    });

    expect(sections.map((section) => section.key)).toEqual([
      'basic',
      'hierarchy',
      'role',
      'geometry',
      'transform',
    ]);
    expect(sections[0].items).toContainEqual({ label: '名称', value: 'Arm' });
    expect(sections[2].items).toContainEqual({ label: '调节建议', value: '可绑定脚本' });
  });
});
