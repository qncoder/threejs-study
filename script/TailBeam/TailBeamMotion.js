setPosition(0, 0, 0);
setRotationDeg(90, 0, 0);
setScale(0.01, 0.01, 0.01);

// =========================
// 只改这里
// =========================

// 当前控制方式：直接控制尾梁绕 C 点旋转多少度。
// A = tailbeam_hydraulic_fixed.position
// B = tailbeam_hydraulic_slidingshaft.position
// C = tailbeam.position
// 如果方向反了，只改 TAILBEAM_MOVE_DIRECTION。
const ANGLE_STEP_DEG = 8;
const TAILBEAM_MOVE_DIRECTION = 1;

// 单次最大旋转角度，防止动作太大穿模。
const MAX_STEP_DEG = 12;

// 动画时间。写 0 就直接跳到目标位置。
const DURATION_MS = 700;

// 是否画模型外辅助线。
const SHOW_DEBUG = true;

// 如果活动杆绕 B 点旋转方向相反，把这里改成 -1。
const SLIDING_ROTATE_DIRECTION = 1;

// 如果固定缸体绕 A 点旋转方向相反，把这里改成 -1。
const FIXED_ROTATE_DIRECTION = 1;

// =========================
// 下面不用改
// =========================

const DEBUG_HELPER_NAME = 'TailBeam_Motion_Debug';
const POINT_SIZE = 0.035;
const LINE_WIDTH = 0.018;

function findChild(root, name) {
  if (!root) return null;
  if (root.name === name) return root;

  for (let i = 0; i < root.children.length; i++) {
    const found = findChild(root.children[i], name);
    if (found) return found;
  }

  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRadians(value) {
  let result = value;

  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;

  return result;
}

function removeSceneChildByName(name) {
  if (!scene) return;

  const child = findChild(scene, name);
  if (child && child.parent) {
    child.parent.remove(child);
  }
}

function getNodeLocalPoint(object) {
  const world = object.getWorldPosition(new THREE.Vector3());
  const local = world.clone();
  node.updateWorldMatrix(true, true);
  node.worldToLocal(local);
  return local;
}

function setObjectFromNodeLocalPoint(object, nodeLocalPoint) {
  const world = nodeLocalPoint.clone();
  node.updateWorldMatrix(true, true);
  node.localToWorld(world);

  if (object.parent) {
    object.parent.updateWorldMatrix(true, true);
    object.parent.worldToLocal(world);
  }

  object.position.copy(world);
  object.updateMatrix();
  object.updateWorldMatrix(true, true);
}

function getAngleAtC(A, C, B) {
  const CA = A.clone().sub(C).normalize();
  const CB = B.clone().sub(C).normalize();

  let cos = CA.dot(CB);
  cos = Math.max(-1, Math.min(1, cos));

  return Math.acos(cos) * 180 / Math.PI;
}

function angleInYZ(point, center) {
  const v = point.clone().sub(center);
  return Math.atan2(v.z, v.y);
}

function rotatePointAroundCInYZ(point, C, radians) {
  const v = point.clone().sub(C);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return new THREE.Vector3(
    point.x,
    C.y + v.y * cos - v.z * sin,
    C.z + v.y * sin + v.z * cos
  );
}

function makeDebugMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color: color,
    depthTest: false,
    depthWrite: false
  });
}

function makeDebugPoint(parent, name, color, position, size) {
  const geo = new THREE.SphereGeometry(size, 16, 16);
  const mesh = new THREE.Mesh(geo, makeDebugMaterial(color));
  mesh.name = name;
  mesh.position.copy(position);
  mesh.renderOrder = 1000;
  parent.add(mesh);
  return mesh;
}

function makeDebugLine(parent, name, color, start, end, width) {
  const direction = end.clone().sub(start);
  const length = direction.length();

  if (length <= 0) return null;

  const geo = new THREE.CylinderGeometry(width, width, length, 12);
  const mesh = new THREE.Mesh(geo, makeDebugMaterial(color));
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  mesh.renderOrder = 999;
  parent.add(mesh);
  return mesh;
}
function stopOldMotion() {
  const store = window.__tailBeamMotionStore;
  if (store && store.frameId) {
    cancelAnimationFrame(store.frameId);
  }
  window.__tailBeamMotionStore = { frameId: 0 };
  return window.__tailBeamMotionStore;
}

const plateMesh = findChild(node, 'tailbeam');
const fixedMesh = findChild(node, 'tailbeam_hydraulic_fixed');
const slidingMesh = findChild(node, 'tailbeam_hydraulic_slidingshaft');

if (!plateMesh || !fixedMesh || !slidingMesh) {
  console.warn('没有找到三个 mesh，请检查名称是否一致', {
    plateMesh: plateMesh,
    fixedMesh: fixedMesh,
    slidingMesh: slidingMesh
  });
} else if (typeof THREE === 'undefined') {
  console.warn('当前脚本环境没有 THREE，无法执行尾梁运动脚本');
} else {
  node.updateWorldMatrix(true, true);

  const C = getNodeLocalPoint(plateMesh);
  const A0 = getNodeLocalPoint(fixedMesh);
  const B = getNodeLocalPoint(slidingMesh);

  const safeStepDeg = clamp(Math.abs(ANGLE_STEP_DEG), 0, MAX_STEP_DEG);
  const deltaRotation = deg(safeStepDeg * TAILBEAM_MOVE_DIRECTION);
  const A1 = rotatePointAroundCInYZ(A0, C, deltaRotation);

  const startPlateRotationX = plateMesh.rotation.x;
  const startFixedRotationX = fixedMesh.rotation.x;
  const startSlidingRotationX = slidingMesh.rotation.x;
  const startFixedAngle = angleInYZ(B, A0);
  const startSlidingAngle = angleInYZ(A0, B);
  const store = stopOldMotion();
  const startTime = performance.now();

  function apply(progress) {
    const t = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
    const currentDelta = deltaRotation * t;
    const currentA = rotatePointAroundCInYZ(A0, C, currentDelta);
    const currentFixedAngle = angleInYZ(B, currentA);
    const fixedDelta = normalizeRadians(currentFixedAngle - startFixedAngle)
      * FIXED_ROTATE_DIRECTION;
    const currentSlidingAngle = angleInYZ(currentA, B);
    const slidingDelta = normalizeRadians(currentSlidingAngle - startSlidingAngle)
      * SLIDING_ROTATE_DIRECTION;

    plateMesh.rotation.x = startPlateRotationX + currentDelta;
    fixedMesh.rotation.x = startFixedRotationX + fixedDelta;
    slidingMesh.rotation.x = startSlidingRotationX + slidingDelta;
    setObjectFromNodeLocalPoint(fixedMesh, currentA);

    plateMesh.updateMatrix();
    plateMesh.updateWorldMatrix(true, true);
    fixedMesh.updateMatrix();
    fixedMesh.updateWorldMatrix(true, true);
    slidingMesh.updateMatrix();
    slidingMesh.updateWorldMatrix(true, true);
  }

  if (DURATION_MS <= 0) {
    apply(1);
  } else {
    function step(now) {
      const progress = clamp((now - startTime) / DURATION_MS, 0, 1);
      apply(progress);

      if (progress < 1) {
        store.frameId = requestAnimationFrame(step);
      }
    }

    store.frameId = requestAnimationFrame(step);
  }
}
