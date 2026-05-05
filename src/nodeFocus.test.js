import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { createNodeFocusTarget } from './nodeFocus.js';

function rounded(vector) {
  return vector.toArray().map((value) => Number(value.toFixed(4)));
}

describe('nodeFocus', () => {
  it('根据节点包围盒生成相机位置和观察目标', () => {
    const node = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    node.position.set(3, 0, 0);
    node.updateWorldMatrix(true, true);
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(10, 10, 10);

    const target = createNodeFocusTarget(node, camera);

    expect(rounded(target.center)).toEqual([3, 0, 0]);
    expect(target.distance).toBeGreaterThan(2);
    expect(target.position.distanceTo(target.center)).toBeCloseTo(target.distance);
  });

  it('节点没有包围盒时回退到世界坐标', () => {
    const node = new Object3D();
    node.position.set(1, 2, 3);
    node.updateWorldMatrix(true, true);
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.copy(new Vector3(5, 5, 5));

    const target = createNodeFocusTarget(node, camera);

    expect(rounded(target.center)).toEqual([1, 2, 3]);
    expect(target.distance).toBeGreaterThan(0);
  });
});
