const STEP = 0.01
const MOVE_DIRECTION = -1
const ROTATE_AXIS = new THREE.Vector3(1, 0, 0)

let AObject = null
let BObject = null
let CObject = null
let DObject = null
let EObject = null

let Init = null
let InitE = null
let InitEDVector = null
let InitEWorldQuaternion = null
let currentBC = 0

let inited = false
let manualFrameId = 0

function run() {
  if (manualFrameId) {
    stop()
    return
  }

  init.call(this)

  if (manualFrameId) {
    cancelAnimationFrame(manualFrameId)
    manualFrameId = 0
  }

  const owner = this

  function animate() {
    step(owner)

    if (typeof render === 'function') {
      render()
    }

    manualFrameId = requestAnimationFrame(animate)
  }

  manualFrameId = requestAnimationFrame(animate)
}

function loaded() {
  init.call(this)
}

function afterAnimation(delta, toBeRender) {
  step(this)
  toBeRender(true)
}

function beforeDestroy() {
  if (manualFrameId) {
    cancelAnimationFrame(manualFrameId)
    manualFrameId = 0
  }
}

function init() {
  if (inited) return

  AObject = this.getObjectByName('flap1_driving_shaft_pos')
  BObject = this.getObjectByName('flap1_hydraulic_fixed_pos')
  CObject = this.getObjectByName('flap1_hydraulic_slidingshaft_pos')
  DObject = this.getObjectByName('flap1_output_shaft_pos')
  EObject = this.getObjectByName('flap1_pos')

  if (!AObject) throw new Error('找不到节点：flap1_driving_shaft_pos')
  if (!BObject) throw new Error('找不到节点：flap1_hydraulic_fixed_pos')
  if (!CObject) throw new Error('找不到节点：flap1_hydraulic_slidingshaft_pos')
  if (!DObject) throw new Error('找不到节点：flap1_output_shaft_pos')
  if (!EObject) throw new Error('找不到节点：flap1_pos')

  this.updateWorldMatrix(true, true)

  Init = getTriangle()

  const InitD = DObject.getWorldPosition(new THREE.Vector3())
  InitE = EObject.getWorldPosition(new THREE.Vector3())
  InitEDVector = InitD.clone().sub(InitE)
  InitEWorldQuaternion = EObject.getWorldQuaternion(new THREE.Quaternion())

  currentBC = Init.BC
  inited = true
}

function step(owner) {
  init.call(owner)

  currentBC -= STEP * MOVE_DIRECTION

  const C = getPointC(currentBC)
  setWorldPosition(CObject, C)

  const D = getPointD(C)
  setWorldPosition(DObject, D)

  const nextEDVector = D.clone().sub(InitE)
  const deltaAngle = getSignedAngle(InitEDVector, nextEDVector)
  const rotateDelta = new THREE.Quaternion().setFromAxisAngle(ROTATE_AXIS, deltaAngle)
  const nextEWorldQuaternion = rotateDelta.multiply(InitEWorldQuaternion)

  setWorldQuaternion(EObject, nextEWorldQuaternion)
  setWorldPosition(EObject, InitE)

  owner.updateWorldMatrix(true, true)
  owner.updateMatrix()

  CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
  BObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
  AObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
  DObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
}

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

function getTriangle() {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())
  const C = CObject.getWorldPosition(new THREE.Vector3())
  const D = DObject.getWorldPosition(new THREE.Vector3())
  const E = EObject.getWorldPosition(new THREE.Vector3())

  return {
    AB: A.distanceTo(B),
    AC: A.distanceTo(C),
    BC: B.distanceTo(C),
    DC: D.distanceTo(C),
    DE: D.distanceTo(E),
  }
}

function getPointC(BC) {
  const A = AObject.getWorldPosition(new THREE.Vector3())
  const B = BObject.getWorldPosition(new THREE.Vector3())

  const cosB = (Init.AB * Init.AB + BC * BC - Init.AC * Init.AC) / (2 * Init.AB * BC)
  const angleB = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1))

  const BAUnit = A.clone().sub(B).normalize()

  return BAUnit.applyAxisAngle(ROTATE_AXIS, angleB).multiplyScalar(BC).add(B)
}

function getPointD(C) {
  const E = EObject.getWorldPosition(new THREE.Vector3())
  const CE = C.distanceTo(E)

  const cosE = (Init.DE * Init.DE + CE * CE - Init.DC * Init.DC) / (2 * Init.DE * CE)
  const angleE = Math.acos(THREE.MathUtils.clamp(cosE, -1, 1))

  const ECUnit = C.clone().sub(E).normalize()

  return ECUnit.applyAxisAngle(ROTATE_AXIS, -angleE).multiplyScalar(Init.DE).add(E)
}

function getSignedAngle(fromVector, toVector) {
  const from = fromVector.clone().normalize()
  const to = toVector.clone().normalize()
  const cross = new THREE.Vector3().crossVectors(from, to)
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1)

  return Math.atan2(ROTATE_AXIS.dot(cross), dot)
}
