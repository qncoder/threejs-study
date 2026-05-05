setPosition(0, 0, 0);
setRotationDeg(90, 0, 0);
setScale(0.01, 0.01, 0.01);

const DEBUG_HELPER_NAME = 'TailBeam_ABC_Debug';
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

function removeChildByName(root, name) {
  const child = findChild(root, name);
  if (child && child.parent) {
    child.parent.remove(child);
  }
}

function removeSceneChildByName(name) {
  if (!scene) return;

  const child = findChild(scene, name);
  if (child && child.parent) {
    child.parent.remove(child);
  }
}

const plateMesh = findChild(node, 'tailbeam');
const fixedMesh = findChild(node, 'tailbeam_hydraulic_fixed');
const slidingMesh = findChild(node, 'tailbeam_hydraulic_slidingshaft');

// 清掉之前调试脚本挂到模型里的辅助对象，避免撑大模型范围。
removeChildByName(node, 'ABC_Helper');
removeSceneChildByName(DEBUG_HELPER_NAME);

if (!plateMesh || !fixedMesh || !slidingMesh) {
  console.warn('没有找到三个 mesh，请检查名称是否一致', {
    plateMesh: plateMesh,
    fixedMesh: fixedMesh,
    slidingMesh: slidingMesh
  });
} else {
  const Vec3 = node.position.constructor;

  function getWorldPosition(object) {
    object.updateWorldMatrix(true, false);
    return object.getWorldPosition(new Vec3());
  }

  function worldToNodeLocal(worldPoint) {
    const p = worldPoint.clone();
    node.updateWorldMatrix(true, false);
    node.worldToLocal(p);
    return p;
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

  function getAngleAtC(A, C, B) {
    const CA = A.clone().sub(C).normalize();
    const CB = B.clone().sub(C).normalize();

    let cos = CA.dot(CB);
    cos = Math.max(-1, Math.min(1, cos));

    return Math.acos(cos) * 180 / Math.PI;
  }

  // 直接使用三个 mesh 的节点位置。这里不再从 geometry 顶点里猜点。
  const C = getWorldPosition(plateMesh);
  const A = getWorldPosition(fixedMesh);
  const B = getWorldPosition(slidingMesh);

  const cNodeLocal = worldToNodeLocal(C);
  const aNodeLocal = worldToNodeLocal(A);
  const bNodeLocal = worldToNodeLocal(B);

  const AB = A.distanceTo(B);
  const AC = A.distanceTo(C);
  const BC = B.distanceTo(C);
  const angleC = getAngleAtC(A, C, B);

  if (scene && typeof THREE !== 'undefined') {
    const debug = new THREE.Group();
    debug.name = DEBUG_HELPER_NAME;
    scene.add(debug);

    makeDebugPoint(debug, 'A_green_fixed_position', 0x33cc66, A, POINT_SIZE);
    makeDebugPoint(debug, 'B_red_sliding_position', 0xff3333, B, POINT_SIZE);
    makeDebugPoint(debug, 'C_blue_tailbeam_position', 0x3399ff, C, POINT_SIZE);

    makeDebugLine(debug, 'AB_yellow', 0xffcc00, A, B, LINE_WIDTH);
    makeDebugLine(debug, 'AC_red', 0xff3333, A, C, LINE_WIDTH);
    makeDebugLine(debug, 'BC_red', 0xff3333, B, C, LINE_WIDTH);
  } else {
    console.warn('没有 scene 或 THREE，无法绘制模型外辅助线');
  }

  console.log('C 点 tailbeam.position 世界坐标:', C);
  console.log('A 点 tailbeam_hydraulic_fixed.position 世界坐标:', A);
  console.log('B 点 tailbeam_hydraulic_slidingshaft.position 世界坐标:', B);
  console.log('C 点，父级局部坐标:', cNodeLocal);
  console.log('A 点，父级局部坐标:', aNodeLocal);
  console.log('B 点，父级局部坐标:', bNodeLocal);
  console.log('plateMesh.position:', plateMesh.position);
  console.log('fixedMesh.position:', fixedMesh.position);
  console.log('slidingMesh.position:', slidingMesh.position);
  console.log('液压杆当前长度 AB:', AB);
  console.log('AC:', AC);
  console.log('BC:', BC);
  console.log('夹角 ∠ACB:', angleC);
}
