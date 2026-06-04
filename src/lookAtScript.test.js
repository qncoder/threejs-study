import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import {
  applyLookAtMeshHierarchy,
  restoreLookAtMeshHierarchy,
} from './lookAtScript.js';

describe('lookAt 脚本层级处理', () => {
  it('执行后把当前节点下所有 mesh 挂到对应 _pos，解锁后恢复成同级', () => {
    const root = new Object3D();
    const scope = new Object3D();
    scope.name = 'scope';
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    const alphaMesh = new Mesh(geometry, material);
    alphaMesh.name = 'alpha';
    const alphaPos = new Object3D();
    alphaPos.name = 'alpha_pos';
    const betaMesh = new Mesh(geometry, material);
    betaMesh.name = 'beta';
    const betaPos = new Object3D();
    betaPos.name = 'beta_pos';
    const outsideMesh = new Mesh(geometry, material);
    outsideMesh.name = 'outside';
    const outsidePos = new Object3D();
    outsidePos.name = 'outside_pos';

    root.add(scope);
    root.add(outsideMesh);
    root.add(outsidePos);
    scope.add(alphaMesh);
    scope.add(alphaPos);
    scope.add(betaMesh);
    scope.add(betaPos);

    const attachResult = applyLookAtMeshHierarchy(root, scope);
    expect(attachResult.moved).toBe(2);
    expect(alphaMesh.parent).toBe(alphaPos);
    expect(betaMesh.parent).toBe(betaPos);
    expect(outsideMesh.parent).toBe(root);

    const restoreResult = restoreLookAtMeshHierarchy(root, scope);
    expect(restoreResult.moved).toBe(2);
    expect(alphaMesh.parent).toBe(scope);
    expect(betaMesh.parent).toBe(scope);
    expect(scope.children.indexOf(alphaMesh)).toBeLessThan(scope.children.indexOf(alphaPos));
    expect(scope.children.indexOf(betaMesh)).toBeLessThan(scope.children.indexOf(betaPos));
  });
});
