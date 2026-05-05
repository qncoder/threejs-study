const STEP = 0.01
const MOVE_DIRECTION = 1

const findNode = name => node.children.find(n => n.name === name)

const fixed = findNode('flap1_hydraulic_fixed')
const sliding = findNode('flap1_hydraulic_slidingshaft')
const pivot = findNode('flap1_pivot')
const driving = findNode('flap1_driving_shaft')

if (!fixed || !sliding || !pivot || !driving) {
  console.warn('缺少节点', { fixed, sliding, pivot, driving })
  return
}

function centerOf(object) {
  return new THREE.Box3()
    .setFromObject(object)
    .getCenter(new THREE.Vector3())
}

function moveWorld(object, deltaWorld) {
  const p = object.getWorldPosition(new THREE.Vector3()).add(deltaWorld)

  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(p)
  object.position.copy(p)

  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

function rotateByWorldQuaternion(object, q) {
  const parentQ = object.parent.getWorldQuaternion(new THREE.Quaternion())
  const parentInv = parentQ.clone().invert()

  const localQ = parentInv.clone().multiply(q).multiply(parentQ)

  object.quaternion.premultiply(localQ)
  object.updateMatrix()
  object.updateWorldMatrix(true, true)
}

node.updateWorldMatrix(true, true)

// 1. 记录 driving 原点和 pivot 旧位置
const drivingOrigin = driving.getWorldPosition(new THREE.Vector3())
const oldPivotWorld = pivot.getWorldPosition(new THREE.Vector3())

// 2. sliding 沿 fixed 方向平移
const dir = centerOf(fixed)
  .sub(centerOf(sliding))
  .normalize()

const delta = dir.multiplyScalar(STEP * MOVE_DIRECTION)

moveWorld(sliding, delta)

// 3. pivot 跟着 sliding 平移
moveWorld(pivot, delta)

node.updateWorldMatrix(true, true)

// 4. driving_shaft 不平移，只旋转，让它的端点方向跟上新的 pivot
const newPivotWorld = pivot.getWorldPosition(new THREE.Vector3())

const oldDir = oldPivotWorld
  .clone()
  .sub(drivingOrigin)
  .normalize()

const newDir = newPivotWorld
  .clone()
  .sub(drivingOrigin)
  .normalize()

if (oldDir.lengthSq() < 0.000001 || newDir.lengthSq() < 0.000001) {
  console.warn('driving 原点和 pivot 太近，无法计算旋转')
  return
}

const q = new THREE.Quaternion().setFromUnitVectors(oldDir, newDir)

rotateByWorldQuaternion(driving, q)

node.updateWorldMatrix(true, true)

console.log('driving_shaft 已跟随 pivot 旋转', {
  delta,
  oldDir,
  newDir,
})
