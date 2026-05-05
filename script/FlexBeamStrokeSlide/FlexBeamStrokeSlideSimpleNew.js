setPosition(0, 0, 0);
setRotationDeg(90, 0, 0);
setScale(0.01, 0.01, 0.01);
// 测试
 console.log(node.parent)
 const sceneChildren = node.parent.children
 const Flap1 = sceneChildren.find(children=>children.name === 'Flap1')
 const flap1 = Flap1

// 测试

const step = 0.01;
const MOVE_DIRECTION = -1;

const fixed = node.children.find(n => n.userData.name === 'flexbeamstroke_hydraulic_fixed');
const sliding = node.children.find(n => n.userData.name === 'flexbeamstroke_hydraulic_slidingshaft');

const followers = [
  node.children.find(n => n.userData.name === 'flexbeamstroke'),
  Flap1
].filter(Boolean);

function moveWorld(object, delta) {
  const p = object.getWorldPosition(new THREE.Vector3()).add(delta);
  object.parent.worldToLocal(p);
  object.position.copy(p);
  object.updateMatrixWorld(true);
}

if (fixed && sliding) {
  node.updateWorldMatrix(true, true);

  const fixedCenter = new THREE.Box3().setFromObject(fixed).getCenter(new THREE.Vector3());
  const slidingCenter = new THREE.Box3().setFromObject(sliding).getCenter(new THREE.Vector3());
  const dir = fixedCenter.sub(slidingCenter).normalize();

  const start = sliding.getWorldPosition(new THREE.Vector3());
  const target = start.clone().addScaledVector(dir, step * MOVE_DIRECTION);
  const delta = target.clone().sub(start);

  moveWorld(sliding, delta);

  followers.forEach(n => moveWorld(n, delta));
} else {
  console.warn('没有找到 fixed 或 sliding', { fixed, sliding });
}
