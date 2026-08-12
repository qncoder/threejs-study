import { MathUtils, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';

export const CAMERA_MODES = {
  PERSPECTIVE: 'perspective',
  ORTHOGRAPHIC: 'orthographic',
};

const DEFAULT_FOV = 45;
const MIN_VIEW_HEIGHT = 0.1;

// 六个轴对齐的标准视角。direction 是相机看向模型的方向（从相机指向目标），
// up 是相机的“上”方向。进入正交模式默认用 RIGHT（右视图，沿 +X 看 YZ 平面）。
export const STANDARD_VIEWS = {
  FRONT: { name: '前', direction: new Vector3(0, 0, -1), up: new Vector3(0, 1, 0) },
  BACK: { name: '后', direction: new Vector3(0, 0, 1), up: new Vector3(0, 1, 0) },
  RIGHT: { name: '右', direction: new Vector3(-1, 0, 0), up: new Vector3(0, 1, 0) },
  LEFT: { name: '左', direction: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0) },
  TOP: { name: '顶', direction: new Vector3(0, -1, 0), up: new Vector3(0, 0, -1) },
  BOTTOM: { name: '底', direction: new Vector3(0, 1, 0), up: new Vector3(0, 0, 1) },
};

const STANDARD_VIEW_MARGIN = 1.1;
const STANDARD_VIEW_DISTANCE_FACTOR = 2.1;

// 轴对齐包围盒在某个单位轴上的投影长度（方向沿轴对齐时即对应分量绝对值之和）
function projectedExtent(size, axis) {
  return Math.abs(size.x * axis.x) + Math.abs(size.y * axis.y) + Math.abs(size.z * axis.z);
}

// 把相机对齐到某个轴对齐标准视角，并按包围盒 fit 画面。
// 对正交相机按投影平面尺寸计算 viewHeight，使模型刚好装下；对透视相机只摆位。
// box 为空时无操作（不抛错）。
export function applyStandardView(camera, view, box, aspect) {
  if (!camera || !view || !box || box.isEmpty()) return;

  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const distance = maxSize * STANDARD_VIEW_DISTANCE_FACTOR;

  camera.position.copy(center).addScaledVector(view.direction, -distance);
  camera.up.copy(view.up);
  camera.lookAt(center);
  camera.near = Math.max(distance / 200, 0.01);
  camera.far = distance * 100;

  if (camera.isOrthographicCamera) {
    const screenUp = view.up;
    const screenRight = new Vector3().crossVectors(view.direction, view.up);
    const projectedHeight = projectedExtent(size, screenUp);
    const projectedWidth = projectedExtent(size, screenRight);
    const viewHeight = Math.max(
      projectedHeight,
      projectedWidth / Math.max(aspect, 1e-6),
    ) * STANDARD_VIEW_MARGIN;
    setOrthographicBounds(camera, aspect, Math.max(viewHeight, MIN_VIEW_HEIGHT));
  }

  camera.updateProjectionMatrix();
}

export function createViewerCamera(mode, {
  aspect = 1,
  position = new Vector3(8, 6, 8),
  target = new Vector3(),
  near = 0.1,
  far = 1000,
  fov = DEFAULT_FOV,
  viewHeight,
} = {}) {
  const camera = mode === CAMERA_MODES.ORTHOGRAPHIC
    ? createOrthographicCamera(aspect, viewHeight ?? viewHeightAtTarget(position, target, fov), near, far)
    : new PerspectiveCamera(fov, aspect, near, far);

  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return camera;
}

export function createCameraFromCurrent(mode, currentCamera, target, aspect) {
  return createViewerCamera(mode, {
    aspect,
    position: currentCamera?.position ?? new Vector3(8, 6, 8),
    target,
    near: currentCamera?.near ?? 0.1,
    far: currentCamera?.far ?? 1000,
    fov: currentCamera?.fov ?? DEFAULT_FOV,
    viewHeight: currentCamera?.isOrthographicCamera
      ? currentCamera.top - currentCamera.bottom
      : undefined,
  });
}

export function updateViewerCameraProjection(camera, { width, height, target = new Vector3() } = {}) {
  if (!camera || !width || !height) return;

  const aspect = width / height;
  if (camera.isPerspectiveCamera) {
    camera.aspect = aspect;
  } else if (camera.isOrthographicCamera) {
    const viewHeight = Math.max(
      camera.userData.viewHeight ?? viewHeightAtTarget(camera.position, target),
      MIN_VIEW_HEIGHT,
    );
    setOrthographicBounds(camera, aspect, viewHeight);
  }

  camera.updateProjectionMatrix();
}

export function viewHeightAtTarget(position, target, fov = DEFAULT_FOV) {
  const distance = position.distanceTo(target);
  const fovRad = MathUtils.degToRad(fov);
  return Math.max(distance * 2 * Math.tan(fovRad / 2), MIN_VIEW_HEIGHT);
}

function createOrthographicCamera(aspect, viewHeight, near, far) {
  const camera = new OrthographicCamera();
  setOrthographicBounds(camera, aspect, Math.max(viewHeight, MIN_VIEW_HEIGHT));
  camera.near = near;
  camera.far = far;
  return camera;
}

function setOrthographicBounds(camera, aspect, viewHeight) {
  const viewWidth = viewHeight * aspect;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.userData.viewHeight = viewHeight;
}
