import { describe, expect, it } from 'vitest';
import {
  CONNECTION_DRAFT,
  enrichNodeRowsWithRoles,
  findMechanismRole,
  getConnectionsForPart,
} from './mechanismRoles.js';

describe('mechanismRoles', () => {
  it('按模型节点名称识别机构角色', () => {
    expect(findMechanismRole({ name: 'Base', path: 'F309/Base' })).toMatchObject({
      key: 'Base',
      label: '底座',
      type: '固定基座',
    });

    expect(findMechanismRole({ name: 'FrontColumn', path: 'F309/FrontColumn' })).toMatchObject({
      key: 'FrontColumn',
      label: '前立柱油缸组',
      type: '主驱动',
    });

    expect(findMechanismRole({ name: 'Shield', path: 'F309/Shield' })).toMatchObject({
      key: 'Shield',
      label: '掩护梁',
      type: '主要从动件',
    });
  });

  it('子节点沿用所属总成的机构角色', () => {
    const role = findMechanismRole({
      name: 'frontcolumn_hydraulic_slidingshaft1',
      path: 'F309/FrontColumn/frontcolumn_hydraulic_slidingshaft1',
    });

    expect(role).toMatchObject({
      key: 'FrontColumn',
      label: '前立柱油缸组',
      type: '主驱动',
    });
  });

  it('未知节点不强行归类', () => {
    expect(findMechanismRole({ name: 'camera_helper', path: 'F309/camera_helper' })).toBeNull();
  });

  it('可以给节点列表补充角色信息', () => {
    const rows = enrichNodeRowsWithRoles([
      { name: 'Base', path: 'F309/Base' },
      { name: 'tailbeam_hydraulic_fixed', path: 'F309/TailBeam/tailbeam_hydraulic_fixed' },
      { name: 'other', path: 'F309/other' },
    ]);

    expect(rows[0].mechanismRole.label).toBe('底座');
    expect(rows[1].mechanismRole.label).toBe('尾梁');
    expect(rows[2].mechanismRole).toBeNull();
  });

  it('连接草案能按部件名称查找', () => {
    expect(CONNECTION_DRAFT).toContainEqual(
      expect.objectContaining({
        from: 'FlexBeamStroke',
        to: 'Shield',
      }),
    );

    expect(getConnectionsForPart('Shield')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'FlexBeamStroke', to: 'Shield' }),
        expect.objectContaining({ from: 'Shield', to: 'TailBeam' }),
      ]),
    );
  });
});
