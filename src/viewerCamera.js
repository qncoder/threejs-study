import { MathUtils, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';

export const CAMERA_MODES = {
  PERSPECTIVE: 'perspective',
  ORTHOGRAPHIC: 'orthographic',
};

const DEFAULT_FOV = 45;
const MIN_VIEW_HEIGHT = 0.1;

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
