import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Box3,
  Vector3,
} from 'three';
import {
  STANDARD_VIEWS,
  applyStandardView,
  createCameraFromCurrent,
  createViewerCamera,
  updateViewerCameraProjection,
  CAMERA_MODES,
} from './viewerCamera.js';

function makeBoxMesh(width, height, depth) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), new MeshBasicMaterial());
  return mesh;
}

describe('标准视角与正交相机', () => {
  it('STANDARD_VIEWS 六个视角的 direction 和 up 都是单位向量', () => {
    const keys = ['FRONT', 'BACK', 'RIGHT', 'LEFT', 'TOP', 'BOTTOM'];
    expect(Object.keys(STANDARD_VIEWS).sort()).toEqual(keys.sort());

    for (const key of keys) {
      const view = STANDARD_VIEWS[key];
      expect(view.direction.length()).toBeCloseTo(1, 6);
      expect(view.up.length()).toBeCloseTo(1, 6);
      expect(view.name).toBeTruthy();
    }
  });

  it('RIGHT 视图 direction 为 (-1,0,0)，up 为 (0,1,0)', () => {
    expect(STANDARD_VIEWS.RIGHT.direction.toArray()).toEqual([-1, 0, 0]);
    expect(STANDARD_VIEWS.RIGHT.up.toArray()).toEqual([0, 1, 0]);
  });

  it('applyStandardView 对正交相机：RIGHT 视图位置在 +X 侧、up=（0,1,0），模型装得下', () => {
    const mesh = makeBoxMesh(2, 4, 6); // x=2, y=4, z=6
    const box = new Box3().setFromObject(mesh);
    const camera = new OrthographicCamera();
    const aspect = 1;

    applyStandardView(camera, STANDARD_VIEWS.RIGHT, box, aspect);

    const center = box.getCenter(new Vector3());
    // 相机应在 +X 侧（center.x + distance）
    expect(camera.position.x).toBeGreaterThan(center.x);
    expect(camera.position.y).toBeCloseTo(center.y, 6);
    expect(camera.position.z).toBeCloseTo(center.z, 6);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);

    // 右视图看 YZ 平面：竖直方向是 Y（=4），水平方向是 Z（=6）
    // viewHeight 应 >= size.y（4），且 viewHeight*aspect >= size.z（6）
    const viewHeight = camera.userData.viewHeight;
    expect(viewHeight).toBeGreaterThanOrEqual(4);
    expect(viewHeight * aspect).toBeGreaterThanOrEqual(6);
  });

  it('applyStandardView 对正交相机：aspect=2 时水平方向被 fit 到 viewHeight*2', () => {
    const mesh = makeBoxMesh(2, 4, 20); // 水平方向 Z=20 很宽
    const box = new Box3().setFromObject(mesh);
    const camera = new OrthographicCamera();
    const aspect = 2;

    applyStandardView(camera, STANDARD_VIEWS.RIGHT, box, aspect);

    const viewHeight = camera.userData.viewHeight;
    // 水平尺寸 20，aspect=2 => 需要 viewHeight >= 20/2 = 10
    expect(viewHeight * aspect).toBeGreaterThanOrEqual(20);
  });

  it('applyStandardView 对透视相机：位置正确且不报错', () => {
    const mesh = makeBoxMesh(2, 4, 6);
    const box = new Box3().setFromObject(mesh);
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);

    expect(() => applyStandardView(camera, STANDARD_VIEWS.FRONT, box, 1)).not.toThrow();

    const center = box.getCenter(new Vector3());
    // 前视 direction (0,0,-1) => 相机在 +Z 侧
    expect(camera.position.z).toBeGreaterThan(center.z);
    expect(camera.position.x).toBeCloseTo(center.x, 6);
    expect(camera.position.y).toBeCloseTo(center.y, 6);
  });

  it('applyStandardView 对空包围盒提前返回不抛错', () => {
    const emptyBox = new Box3(); // isEmpty() === true
    const camera = new OrthographicCamera();

    expect(() => applyStandardView(camera, STANDARD_VIEWS.RIGHT, emptyBox, 1)).not.toThrow();
  });

  it('applyStandardView 设置 near/far', () => {
    const mesh = makeBoxMesh(2, 4, 6);
    const box = new Box3().setFromObject(mesh);
    const camera = new OrthographicCamera();

    applyStandardView(camera, STANDARD_VIEWS.RIGHT, box, 1);

    expect(camera.near).toBeGreaterThan(0);
    expect(camera.far).toBeGreaterThan(camera.near);
  });

  it('updateViewerCameraProjection 在 ortho 上保留 userData.viewHeight', () => {
    const camera = new OrthographicCamera();
    camera.userData.viewHeight = 5;
    updateViewerCameraProjection(camera, { width: 200, height: 100, target: new Vector3() });

    // aspect=2 => viewWidth=10, left=-5, right=5, top=2.5, bottom=-2.5
    expect(camera.top - camera.bottom).toBeCloseTo(5, 6);
    expect(camera.right - camera.left).toBeCloseTo(10, 6);
  });

  it('createCameraFromCurrent 透视->正交生成正交相机且位置一致', () => {
    const persp = new PerspectiveCamera(45, 1, 0.1, 1000);
    persp.position.set(3, 4, 5);
    const target = new Vector3(0, 0, 0);

    const ortho = createCameraFromCurrent(CAMERA_MODES.ORTHOGRAPHIC, persp, target, 1);

    expect(ortho.isOrthographicCamera).toBe(true);
    expect(ortho.position.toArray()).toEqual([3, 4, 5]);
    expect(ortho.near).toBeCloseTo(0.1, 6);
    expect(ortho.far).toBeCloseTo(1000, 6);
  });
});
