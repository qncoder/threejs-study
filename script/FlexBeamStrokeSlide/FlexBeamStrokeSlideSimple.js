setPosition(0, 0, 0);
setRotationDeg(90, 0, 0);
setScale(0.01, 0.01, 0.01);

const step = 0.01;
// 如果方向反了，改成 -1。
const MOVE_DIRECTION = -1;
const fixed = node.children.find(n => n.userData.name === 'flexbeamstroke_hydraulic_fixed');
const sliding = node.children.find(n => n.userData.name === 'flexbeamstroke_hydraulic_slidingshaft');

if (fixed && sliding) {
  node.updateWorldMatrix(true, true);

  const fixedCenter = new THREE.Box3().setFromObject(fixed).getCenter(new THREE.Vector3());
  const slidingCenter = new THREE.Box3().setFromObject(sliding).getCenter(new THREE.Vector3());
  const dir = fixedCenter.sub(slidingCenter).normalize();

  const target = sliding.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, step*MOVE_DIRECTION);

  sliding.parent.worldToLocal(target);
  sliding.position.copy(target);
  sliding.updateMatrixWorld(true);
} else {
  console.warn('没有找到 fixed 或 sliding', { fixed, sliding });
}
