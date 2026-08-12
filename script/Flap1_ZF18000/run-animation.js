const node = this
function run() {
  const STEP = 0.01
  const MOVE_DIRECTION = 1 // 1 收缩，-1 伸展
  const TOTAL_STEPS = 80
  const MIN_BC = 0.976
  const MAX_BC = 1.446
  const STORE_KEY = '__flap1Zf18000RunAnimationStore'
  const raf =
    typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : typeof globalThis !== 'undefined' && typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : function (callback) {
            return setTimeout(function () {
              callback(Date.now())
            }, 16)
          }

  const caf =
    typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : typeof globalThis !== 'undefined' && typeof globalThis.cancelAnimationFrame === 'function'
        ? globalThis.cancelAnimationFrame.bind(globalThis)
        : clearTimeout
  function stopOldAnimation() {
    const oldStore = window[STORE_KEY]

    if (oldStore && oldStore.frameId) {
      cancelAnimationFrame(oldStore.frameId)
    }

    window[STORE_KEY] = { frameId: 0, count: 0 }
    return window[STORE_KEY]
  }

  window.stopFlap1Zf18000RunAnimation = stopOldAnimation

  const AObject = node.getObjectByName('flap1_driving_shaft_pos')
  const BObject = node.getObjectByName('flap1_hydraulic_fixed_pos')
  const CObject = node.getObjectByName('flap1_hydraulic_slidingshaft_pos')
  const DObject = node.getObjectByName('flap1_output_shaft_pos')
  const EObject = node.getObjectByName('flap1_pos')

  if (!AObject || !BObject || !CObject || !DObject || !EObject) {
    console.warn('一级护帮动画缺少节点，请检查 flap1 相关点位')
    return
  }

  function setWorldPosition(object, targetWorldPosition) {
    const localPosition = targetWorldPosition.clone()

    if (
      !object ||
      !object.parent ||
      !Number.isFinite(localPosition.x) ||
      !Number.isFinite(localPosition.y) ||
      !Number.isFinite(localPosition.z)
    ) {
      return
    }

    object.parent.updateWorldMatrix(true, true)
    object.parent.worldToLocal(localPosition)
    object.position.copy(localPosition)
  }

  function customQuaternionLookAt(object, target) {
    const current = object.getWorldDirection(new THREE.Vector3())
    const next = target.clone().sub(object.getWorldPosition(new THREE.Vector3()))

    if (next.lengthSq() === 0) return

    const q = new THREE.Quaternion().setFromUnitVectors(current, next.normalize())
    object.quaternion.premultiply(q)
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

  function getPointC(init, nextBC) {
    const A = AObject.getWorldPosition(new THREE.Vector3())
    const B = BObject.getWorldPosition(new THREE.Vector3())
    const safeBC = THREE.MathUtils.clamp(nextBC, MIN_BC, MAX_BC)
    const cosValue =
      (init.AB * init.AB + safeBC * safeBC - init.AC * init.AC) / (2 * init.AB * safeBC)
    const angleB = Math.acos(THREE.MathUtils.clamp(cosValue, -1, 1))
    const BAUnit = A.clone().sub(B).normalize()

    return BAUnit.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleB)
      .multiplyScalar(safeBC)
      .add(B)
  }

  function getPointD(init, C) {
    const E = EObject.getWorldPosition(new THREE.Vector3())
    const CE = C.distanceTo(E)
    const cosValue = (init.DE * init.DE + CE * CE - init.DC * init.DC) / (2 * init.DE * CE)
    const angleE = Math.acos(THREE.MathUtils.clamp(cosValue, -1, 1))
    const ECUnit = C.clone().sub(E).normalize()

    return ECUnit.applyAxisAngle(new THREE.Vector3(1, 0, 0), -angleE)
      .multiplyScalar(init.DE)
      .add(E)
  }

  function runOneStep() {
    const init = getTriangle()
    const nextBC = init.BC - STEP * MOVE_DIRECTION

    if (nextBC < MIN_BC || nextBC > MAX_BC) {
      console.log('一级护帮动画已到边界')
      return false
    }

    const C = getPointC(init, nextBC)
    const D = getPointD(init, C)

    setWorldPosition(CObject, C)
    setWorldPosition(DObject, D)
    node.updateWorldMatrix(true, true)
    node.updateMatrix()
    customQuaternionLookAt(CObject, BObject.getWorldPosition(new THREE.Vector3()))
    customQuaternionLookAt(BObject, CObject.getWorldPosition(new THREE.Vector3()))
    customQuaternionLookAt(AObject, CObject.getWorldPosition(new THREE.Vector3()))
    customQuaternionLookAt(DObject, CObject.getWorldPosition(new THREE.Vector3()))
    customQuaternionLookAt(EObject, DObject.getWorldPosition(new THREE.Vector3()))

    return true
  }

  const store = stopOldAnimation()

  function animate() {
    runOneStep()
    store.count += 1

    if (store.count < TOTAL_STEPS) {
      store.frameId = raf(animate)
    }
  }

  store.frameId = raf(animate)
}
