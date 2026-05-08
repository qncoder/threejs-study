const STEP = 0.01
const MOVE_DIRECTION = 1

// 你的机构运动平面法线。你前面的脚本一直绕 X 轴算，所以这里也用 X 轴。
const ROTATE_AXIS = new THREE.Vector3(1, 0, 0)

const AObject = node.getObjectByName('flap1_driving_shaft_pos')
const BObject = node.getObjectByName('flap1_hydraulic_fixed_pos')
const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
const DObject = node.getObjectByName('flap1_output_shaft_pos')
const EObject = node.getObjectByName('flap1_pos')

if (!AObject) throw new Error('找不到 flap1_driving_shaft_pos')
if (!BObject) throw new Error('找不到 flap1_hydraulic_fixed_pos')
if (!CObject) throw new Error('找不到 flap1_hydraulic_slidingshaft_pos')
if (!DObject) throw new Error('找不到 flap1_output_shaft_pos')
if (!EObject) throw new Error('找不到 flap1_pos')

function setWorldPosition(object, targetWorldPosition) {
  const localPosition = targetWorldPosition.clone()
  object.parent.updateWorldMatrix(true, true)
  object.parent.worldToLocal(localPosition)
  object.position.copy(localPosition)
}

function setWorldQuaternion(object, targetWorldQuaternion) {
  const parentWorldQuaternion = new THREE.Quaternion()
  object.parent.updateWorldMatrix(true, true)
  object.parent.getWorldQuaternion(parentWorldQuaternion)
  object.quaternion.copy(parentWorldQuaternion.invert().multiply(targetWorldQuaternion))
}

function getTriangleABC() {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const C = CObject.getWorldPosition(new THREE.Vector3())

  return {
    AB: A.distanceTo(B),
    AC: A.distanceTo(C),
    BC: B.distanceTo(C),
  }
}

function getPointC(BC) {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())

  const cosB = (InitABC.AB * InitABC.AB + BC * BC - InitABC.AC * InitABC.AC) / (2 * InitABC.AB * BC)
  const angleB = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1))

  const BAUnit = A.clone().sub(B).normalize()

  return BAUnit
    .applyAxisAngle(ROTATE_AXIS, angleB)
    .multiplyScalar(BC)
    .add(B)
}

function getPointD(C, E, CDLength, EDLength, oldD) {
  const EC = C.clone().sub(E)
  const ECLength = EC.length()

  if (ECLength <= 0.000001) {
    throw new Error('E 和 C 太近，无法计算 D 点')
  }

  if (ECLength > CDLength + EDLength || ECLength < Math.abs(EDLength - CDLength)) {
    throw new Error('C、D、E 三角形不成立，无法计算 D 点')
  }

  const ex = EC.clone().normalize()

  // 从 E 沿 EC 方向到垂足的距离
  const x = (EDLength * EDLength - CDLength * CDLength + ECLength * ECLength) / (2 * ECLength)
  const h2 = EDLength * EDLength - x * x
  const h = Math.sqrt(Math.max(0, h2))

  // 在运动平面内，和 EC 垂直的方向
  const ey = new THREE.Vector3().crossVectors(ROTATE_AXIS, ex).normalize()

  const base = E.clone().add(ex.clone().multiplyScalar(x))

  const D1 = base.clone().add(ey.clone().multiplyScalar(h))
  const D2 = base.clone().add(ey.clone().multiplyScalar(-h))

  // 选离旧 D 更近的交点，避免 D 突然翻到另一边
  return D1.distanceTo(oldD) <= D2.distanceTo(oldD) ? D1 : D2
}

function getSignedAngle(fromVector, toVector) {
  const from = fromVector.clone().normalize()
  const to = toVector.clone().normalize()
  const cross = new THREE.Vector3().crossVectors(from, to)
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1)

  return Math.atan2(ROTATE_AXIS.dot(cross), dot)
}

function isDescendantOf(child, parent) {
  let current = child
  while (current) {
    if (current === parent) return true
    current = current.parent
  }
  return false
}

const InitABC = getTriangleABC()

const oldC = CObject.getWorldPosition(new THREE.Vector3())
const oldD = DObject.getWorldPosition(new THREE.Vector3())
const oldE = EObject.getWorldPosition(new THREE.Vector3())

const oldCDLength = oldC.distanceTo(oldD)
const oldEDLength = oldE.distanceTo(oldD)

const oldEDVector = oldD.clone().sub(oldE)
const oldEWorldQuaternion = EObject.getWorldQuaternion(new THREE.Quaternion())

const nextBC = InitABC.BC - STEP * MOVE_DIRECTION
const nextC = getPointC(nextBC)

// E 不动，D 由 CD 固定长度和 ED 固定长度共同算出来
const nextD = getPointD(nextC, oldE, oldCDLength, oldEDLength, oldD)

// 先移动 C
setWorldPosition(CObject, nextC)
node.updateWorldMatrix(true, true)

// 算 E 模型需要旋转多少：让旧的 ED 方向转到新的 ED 方向
const nextEDVector = nextD.clone().sub(oldE)
let deltaAngle = getSignedAngle(oldEDVector, nextEDVector)

// 如果 flap1_pos 转反了，改成这一句：
// deltaAngle = -deltaAngle

const rotateDelta = new THREE.Quaternion().setFromAxisAngle(ROTATE_AXIS, deltaAngle)
const nextEWorldQuaternion = rotateDelta.multiply(oldEWorldQuaternion)

// E 点位置不动，只旋转
setWorldQuaternion(EObject, nextEWorldQuaternion)
setWorldPosition(EObject, oldE)

node.updateWorldMatrix(true, true)

// 如果 DObject 不是 flap1_pos 的子节点，就手动放到 nextD。
// 如果 DObject 已经在 flap1_pos 里面，旋转 flap1_pos 后它会自动跟着动，不要再单独改它的位置。
if (!isDescendantOf(DObject, EObject)) {
  setWorldPosition(DObject, nextD)
}

node.updateWorldMatrix(true, true)
node.updateMatrix()

CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))

if (!isDescendantOf(DObject, EObject)) {
  DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
}
