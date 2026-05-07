/*
  fixed 和 sliding 互相看向对方

  注意：
  - 这个脚本只改旋转，不改位置。
  - Three.js 的 lookAt 默认会让模型的“正 Z 方向”朝向目标。
  - 如果运行后模型朝向差 90 度或 180 度，只改下面的修正角度即可。
*/

const findNode = name => node.children.find(child => child.name === name)
const degToRad = value => (value * Math.PI) / 180

const fixed = findNode('flap1_hydraulic_fixed')
const sliding = findNode('flap1_hydraulic_slidingshaft')

if (!fixed || !sliding) {
  console.warn('缺少 fixed 或 sliding 节点', { fixed, sliding })
  return
}

// 如果 fixed 朝向不对，在这里调角度，单位是度。
const FIXED_FIX_ROTATION_DEG = {
  x: 0,
  y: 0,
  z: 0,
}

// 如果 sliding 朝向不对，在这里调角度，单位是度。
const SLIDING_FIX_ROTATION_DEG = {
  x: 0,
  y: 0,
  z: 0,
}

// 取模型包围盒中心点，比只用模型原点更直观。
function centerOf(object) {
  return new THREE.Box3()
    .setFromObject(object)
    .getCenter(new THREE.Vector3())
}

function applyRotationFix(object, fixDeg) {
  object.rotateX(degToRad(fixDeg.x))
  object.rotateY(degToRad(fixDeg.y))
  object.rotateZ(degToRad(fixDeg.z))
}

function lookAtWorldPoint(object, targetWorldPoint, fixDeg) {
  object.lookAt(targetWorldPoint)
  applyRotationFix(object, fixDeg)
  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

node.updateWorldMatrix(true, true)

const fixedCenter = centerOf(fixed)
const slidingCenter = centerOf(sliding)

if (fixedCenter.distanceToSquared(slidingCenter) < 1e-12) {
  console.warn('fixed 和 sliding 几乎在同一个位置，无法互相看向')
  return
}

lookAtWorldPoint(fixed, slidingCenter, FIXED_FIX_ROTATION_DEG)
lookAtWorldPoint(sliding, fixedCenter, SLIDING_FIX_ROTATION_DEG)

node.updateWorldMatrix(true, true)

console.log('fixed 和 sliding 已互相看向', {
  fixedTarget: slidingCenter,
  slidingTarget: fixedCenter,
})
