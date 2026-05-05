setPosition(0, 0, 0);
setRotationDeg(90, 0, 0);
setScale(0.01, 0.01, 0.01);

// =========================
// 只改这里
// =========================

// 滑动轴每次沿固定件方向移动多少世界距离。
const MOVE_DISTANCE_WORLD = 0.01;

// 如果方向反了，改成 -1。
const MOVE_DIRECTION = 1;

// 动画时间。写 0 就直接跳到目标位置。
const DURATION_MS = 500;

// 是否最多只移动到固定件中心，避免穿过去。
const CLAMP_TO_TARGET = true;

// 是否用 lookAt 辅助计算方向。这里只用临时对象，不会旋转真实 mesh。
const USE_LOOKAT_HELPER = true;

// =========================
// 下面不用改
// =========================

const FIXED_NAME = 'flexbeamstroke_hydraulic_fixed';
const SLIDING_NAME = 'flexbeamstroke_hydraulic_slidingshaft';
const STORE_KEY = '__flexBeamStrokeSlideStore';

function findChild(root, name) {
  if (!root) return null;

  const nodeName = root.userData && root.userData.name
    ? root.userData.name
    : root.name;

  if (nodeName === name || root.name === name) return root;

  for (let i = 0; i < root.children.length; i++) {
    const found = findChild(root.children[i], name);
    if (found) return found;
  }

  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getWorldCenter(object) {
  object.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    return box.getCenter(new THREE.Vector3());
  }

  return object.getWorldPosition(new THREE.Vector3());
}

function getDirection(from, to) {
  if (USE_LOOKAT_HELPER) {
    const helper = new THREE.Object3D();
    helper.position.copy(from);
    helper.lookAt(to);

    return new THREE.Vector3(0, 0, -1)
      .applyQuaternion(helper.quaternion)
      .normalize();
  }

  return to.clone().sub(from).normalize();
}

function setObjectWorldPosition(object, worldPosition) {
  const localPosition = worldPosition.clone();

  if (object.parent) {
    object.parent.updateWorldMatrix(true, true);
    object.parent.worldToLocal(localPosition);
  }

  object.position.copy(localPosition);
  object.updateMatrix();
  object.updateWorldMatrix(true, true);
}

function isValidVector3(vector) {
  return Number.isFinite(vector.x)
    && Number.isFinite(vector.y)
    && Number.isFinite(vector.z);
}

function stopOldMotion() {
  const oldStore = window[STORE_KEY];
  if (oldStore && oldStore.frameId) {
    cancelAnimationFrame(oldStore.frameId);
  }

  window[STORE_KEY] = { frameId: 0 };
  return window[STORE_KEY];
}

const fixedMesh = findChild(node, FIXED_NAME);
const slidingMesh = findChild(node, SLIDING_NAME);

if (typeof THREE === 'undefined') {
  console.warn('当前脚本环境没有 THREE，无法执行滑动脚本');
} else if (!fixedMesh || !slidingMesh) {
  console.warn('没有找到需要的 mesh，请检查名称是否一致', {
    fixedMesh: fixedMesh,
    slidingMesh: slidingMesh
  });
} else {
  node.updateWorldMatrix(true, true);
  fixedMesh.updateWorldMatrix(true, true);
  slidingMesh.updateWorldMatrix(true, true);

  const startCenter = getWorldCenter(slidingMesh);
  const targetCenter = getWorldCenter(fixedMesh);
  const offset = targetCenter.clone().sub(startCenter);
  const distanceToTarget = offset.length();

  if (distanceToTarget <= 1e-8) {
    console.warn('滑动轴中心和固定件中心太近，无法计算移动方向');
  } else {
    const moveDistance = CLAMP_TO_TARGET
      ? Math.min(Math.abs(MOVE_DISTANCE_WORLD), distanceToTarget)
      : Math.abs(MOVE_DISTANCE_WORLD);

    const direction = getDirection(startCenter, targetCenter)
      .multiplyScalar(MOVE_DIRECTION);

    const startOrigin = slidingMesh.getWorldPosition(new THREE.Vector3());
    const targetOrigin = startOrigin.clone().addScaledVector(direction, moveDistance);

    if (!isValidVector3(targetOrigin)) {
      console.warn('计算出的目标位置不是有效坐标', {
        startCenter: startCenter,
        targetCenter: targetCenter,
        direction: direction,
        targetOrigin: targetOrigin
      });
    } else if (DURATION_MS <= 0) {
      setObjectWorldPosition(slidingMesh, targetOrigin);
      console.log('滑动轴已移动到目标位置', {
        moveDistance: moveDistance,
        direction: direction,
        targetOrigin: targetOrigin
      });
    } else {
      const store = stopOldMotion();
      const startTime = performance.now();

      function apply(progress) {
        const t = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
        const currentOrigin = startOrigin.clone().lerp(targetOrigin, t);
        setObjectWorldPosition(slidingMesh, currentOrigin);
      }

      function step(now) {
        const progress = clamp((now - startTime) / DURATION_MS, 0, 1);
        apply(progress);

        if (progress < 1) {
          store.frameId = requestAnimationFrame(step);
        } else {
          store.frameId = 0;
          console.log('滑动轴平移动画完成', {
            moveDistance: moveDistance,
            direction: direction,
            targetOrigin: targetOrigin
          });
        }
      }

      store.frameId = requestAnimationFrame(step);
    }
  }
}
