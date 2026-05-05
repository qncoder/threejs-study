// 脚本只对 flap1_driving_shaft flap1_hydraulic_slidingshaft flap1_hydraulic_fixed 做
const STEP = 0.01
const MOVE_DIRECTION = 1

const findNode = name => node.children.find(n => n.name === name)
const pos = obj => obj.getWorldPosition(new THREE.Vector3())

const fixed = findNode('flap1_hydraulic_fixed')
const sliding = findNode('flap1_hydraulic_slidingshaft')
const driving = findNode('flap1_driving_shaft')

if (!fixed || !sliding || !driving) {
  console.warn('缺少节点', { fixed, sliding, driving })
  return
}

function moveWorld(obj, delta) {
  const p = pos(obj).add(delta)

  obj.parent.updateWorldMatrix(true, true)
  obj.parent.worldToLocal(p)
  obj.position.copy(p)

  obj.updateMatrix()
  obj.updateWorldMatrix(true, true)
}

function angleYZ(from, to) {
  return Math.atan2(to.z - from.z, to.y - from.y)
}

node.updateWorldMatrix(true, true)

const A = pos(fixed)
const B0 = pos(sliding)
const C = pos(driving)

const oldAngle = angleYZ(C, B0)

const dir = A.clone().sub(B0)
if (dir.lengthSq() < 1e-12) {
  console.warn('fixed 和 sliding 太近，无法计算方向')
  return
}

const delta = dir.normalize().multiplyScalar(STEP * MOVE_DIRECTION)

moveWorld(sliding, delta)

node.updateWorldMatrix(true, true)

const B1 = pos(sliding)
const newAngle = angleYZ(C, B1)

driving.rotation.x += newAngle - oldAngle
driving.updateMatrix()
driving.updateWorldMatrix(true, true)

node.updateWorldMatrix(true, true)
