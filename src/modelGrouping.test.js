import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { initializeMeshObject3Ds } from './modelGrouping.js';

describe('mesh 自动包裹', () => {
  it('遇到同名 _pos 或已经在 _pos 里面的 mesh 时，不再重复创建', () => {
    const root = new Object3D();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();

    const alphaMesh = new Mesh(geometry, material);
    alphaMesh.name = 'alpha';
    const alphaPos = new Object3D();
    alphaPos.name = 'alpha_pos';

    const betaPos = new Object3D();
    betaPos.name = 'beta_pos';
    const betaMesh = new Mesh(geometry, material);
    betaMesh.name = 'beta';

    const gammaMesh = new Mesh(geometry, material);
    gammaMesh.name = 'gamma';

    root.add(alphaMesh);
    root.add(alphaPos);
    root.add(betaPos);
    betaPos.add(betaMesh);
    root.add(gammaMesh);

    const result = initializeMeshObject3Ds(root);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(2);
    expect(alphaMesh.parent).toBe(root);
    expect(betaMesh.parent).toBe(betaPos);
    expect(root.getObjectByName('gamma_pos')).toBeTruthy();
    expect(root.getObjectByName('alpha_pos 1')).toBeUndefined();
    expect(root.getObjectByName('beta_pos 1')).toBeUndefined();
  });
});
