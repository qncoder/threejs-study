import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { applyZf18000FourLinkLookAt } from './zf18000FourLinkLookAt.js';

describe('ZF18000 四连杆 lookAt 预处理', () => {
  it('会执行四个部位的 lookAt，并把 mesh 挂到对应的 _pos 下面', () => {
    const root = new Object3D();
    const meshMaterial = new MeshBasicMaterial();
    const geometry = new BoxGeometry(1, 1, 1);
    const v = (x, y, z) => new Vector3(x, y, z);

    const backColumn = new Object3D();
    backColumn.name = 'BackColumn';
    root.add(backColumn);

    const frontColumn = new Object3D();
    frontColumn.name = 'FrontColumn';
    root.add(frontColumn);

    const rod = new Object3D();
    rod.name = 'Rod';
    root.add(rod);

    const shieldContainer = new Object3D();
    shieldContainer.name = 'ShieldContainer';
    root.add(shieldContainer);

    const shield = new Object3D();
    shield.name = 'Shield';
    shieldContainer.add(shield);

    const addMeshPair = (parent, meshName, posName, meshPosition, posPosition) => {
      const pos = new Object3D();
      pos.name = posName;
      pos.position.copy(posPosition);
      parent.add(pos);

      const mesh = new Mesh(geometry, meshMaterial);
      mesh.name = meshName;
      mesh.position.copy(meshPosition);
      parent.add(mesh);

      return { mesh, pos };
    };

    const rodPairs = {
      frontrod_fixed: addMeshPair(rod, 'frontrod_fixed', 'frontrod_fixed_pos', v(0.2, 0, 0), v(0, 0, 0)),
      backrod_fixed: addMeshPair(rod, 'backrod_fixed', 'backrod_fixed_pos', v(1.2, 0, 0), v(1, 0, 0)),
      frontrod_shield: addMeshPair(rod, 'frontrod_shield', 'frontrod_shield_pos', v(0.2, 1, 0), v(0, 1, 0)),
      backrod_shield: addMeshPair(rod, 'backrod_shield', 'backrod_shield_pos', v(1.2, 1, 0), v(1, 1, 0)),
    };

    const backColumnPairs = {
      fixed: addMeshPair(backColumn, 'backcolumn_hydraulic_fixed', 'backcolumn_hydraulic_fixed_pos', v(4.2, 0, 0), v(4, 0, 0)),
      sliding: addMeshPair(backColumn, 'backcolumn_hydraulic_slidingshaft2', 'backcolumn_hydraulic_slidingshaft2_pos', v(4.2, 1, 0), v(4, 1, 0)),
    };

    const frontColumnPairs = {
      fixed: addMeshPair(frontColumn, 'frontcolumn_hydraulic_fixed', 'frontcolumn_hydraulic_fixed_pos', v(6.2, 0, 0), v(6, 0, 0)),
      sliding: addMeshPair(frontColumn, 'frontcolumn_hydraulic_slidingshaft2', 'frontcolumn_hydraulic_slidingshaft2_pos', v(6.2, 1, 0), v(6, 1, 0)),
    };

    const shieldPairs = {
      shield: addMeshPair(shield, 'shield', 'shield_pos', v(8.2, 0, 0), v(8, 0, 0)),
    };

    root.updateWorldMatrix(true, true);

    const result = applyZf18000FourLinkLookAt(root);

    expect(result.ok).toBe(true);
    expect(result.executed).toEqual(['BackColumn', 'FrontColumn', 'Rod', 'Shield']);
    expect(result.missing).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.moved).toBe(9);

    expect(rodPairs.frontrod_fixed.mesh.parent).toBe(rodPairs.frontrod_fixed.pos);
    expect(rodPairs.backrod_fixed.mesh.parent).toBe(rodPairs.backrod_fixed.pos);
    expect(rodPairs.frontrod_shield.mesh.parent).toBe(rodPairs.frontrod_shield.pos);
    expect(rodPairs.backrod_shield.mesh.parent).toBe(rodPairs.backrod_shield.pos);
    expect(backColumnPairs.fixed.mesh.parent).toBe(backColumnPairs.fixed.pos);
    expect(backColumnPairs.sliding.mesh.parent).toBe(backColumnPairs.sliding.pos);
    expect(frontColumnPairs.fixed.mesh.parent).toBe(frontColumnPairs.fixed.pos);
    expect(frontColumnPairs.sliding.mesh.parent).toBe(frontColumnPairs.sliding.pos);
    expect(shieldPairs.shield.mesh.parent).toBe(shieldPairs.shield.pos);
  });
});
