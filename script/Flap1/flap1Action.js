// 默认位置 没实际用途
const step = 0.01
// 如果方向反了，改成 -1。
const MOVE_DIRECTION = 1
const ROTATE_STEP_DEG = 2
const findNode = (name) => node.children.find((n) => n.name === name)
const flap1_hydraulic_fixed = findNode('flap1_hydraulic_fixed')
const flap1_hydraulic_slidingshaft = findNode('flap1_hydraulic_slidingshaft')

if (!flap1_hydraulic_fixed || !flap1_hydraulic_slidingshaft) {
  console.warn('没有找到 fixed', fixed, '或 sliding', sliding)
  return
}
node.updateWorldMatrix(true, true)
const fixedCenter = new THREE.Box3()
  .setFromObject(flap1_hydraulic_fixed)
  .getCenter(new THREE.Vector3())
const slidingCenter = new THREE.Box3()
  .setFromObject(flap1_hydraulic_slidingshaft)
  .getCenter(new THREE.Vector3())
const dir = fixedCenter.sub(slidingCenter).normalize()

const target = flap1_hydraulic_slidingshaft
  .getWorldPosition(new THREE.Vector3())
  .addScaledVector(dir, step * MOVE_DIRECTION)

flap1_hydraulic_slidingshaft.parent.worldToLocal(target)
flap1_hydraulic_slidingshaft.position.copy(target)
flap1_hydraulic_slidingshaft.updateMatrixWorld(true)




const pivotNode = findNode('flap1_pivot')
const flap1 = findNode('flap1')
const outputShaft = findNode('flap1_output_shaft')

// flap1_driving_shaft 不放进来，它不动
const rotateList = [
  outputShaft
].filter(Boolean)

if (!pivotNode) {
  console.warn('没有找到 flap1_pivot')
  return
}

node.updateWorldMatrix(true, true)

const pivot = pivotNode.getWorldPosition(new THREE.Vector3())
const angle = 10 * MOVE_DIRECTION * Math.PI / 180

// 先试 X 轴，不对就改成 Y 或 Z
const axis = new THREE.Vector3(1, 0, 0).normalize()
const q = new THREE.Quaternion().setFromAxisAngle(axis, angle)

function rotateAroundPivot(object) {
  const worldPos = object.getWorldPosition(new THREE.Vector3())

  worldPos.sub(pivot).applyQuaternion(q).add(pivot)

  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(worldPos)
  object.position.copy(worldPos)

  object.quaternion.premultiply(q)

  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

rotateList.forEach(rotateAroundPivot)
flap1.rotation.x += deg(ROTATE_STEP_DEG * MOVE_DIRECTION)
node.updateWorldMatrix(true, true)
