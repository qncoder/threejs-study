function run() {
  const node = this
  const STEP = 0.01
  const MOVE_DIRECTION = 1 // 1 收缩，-1 伸展
  const TOTAL_STEPS = 80
  const STORE_KEY = '__frontBeamRunAnimationStore'

  function stopOldAnimation() {
    const oldStore = window[STORE_KEY]

    if (oldStore && oldStore.frameId) {
      cancelAnimationFrame(oldStore.frameId)
    }

    window[STORE_KEY] = { frameId: 0, count: 0 }
    return window[STORE_KEY]
  }

  window.stopFrontBeamRunAnimation = stopOldAnimation

  const AObject = node.getObjectByName('frontbeam_pos')
  const BObject = node.getObjectByName('frontbeam_hydraulic_fixed_pos')
  const CObject = node.getObjectByName('frontbeam_hydraulic_slidingshaft_pos')

  if (!AObject || !BObject || !CObject) {
    console.warn(
      '前梁动画缺少节点，请检查 frontbeam_pos、frontbeam_hydraulic_fixed_pos、frontbeam_hydraulic_slidingshaft_pos'
    )
    return
  }

  function customQuaternionLookAt(object, target) {
    const current = object.getWorldDirection(new THREE.Vector3())
    const next = target.clone().sub(object.getWorldPosition(new THREE.Vector3()))

    if (next.lengthSq() === 0) return

    const q = new THREE.Quaternion().setFromUnitVectors(current, next.normalize())
    object.quaternion.premultiply(q)
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

  function getTriangle() {
    const A = AObject.getWorldPosition(new THREE.Vector3())
    const B = BObject.getWorldPosition(new THREE.Vector3())
    const C = CObject.getWorldPosition(new THREE.Vector3())

    return {
      AB: A.distanceTo(B),
      AC: A.distanceTo(C),
      BC: B.distanceTo(C),
    }
  }

  function getPointC(init, initC, nextBC) {
    const A = AObject.getWorldPosition(new THREE.Vector3())
    const B = BObject.getWorldPosition(new THREE.Vector3())
    const minBC = Math.abs(init.AB - init.AC) + 0.000001
    const maxBC = init.AB + init.AC - 0.000001
    const safeBC = THREE.MathUtils.clamp(nextBC, minBC, maxBC)
    const cosValue =
      (init.AB * init.AB + safeBC * safeBC - init.AC * init.AC) / (2 * init.AB * safeBC)
    const angleB = Math.acos(THREE.MathUtils.clamp(cosValue, -1, 1))
    const BAUnit = A.clone().sub(B).normalize()
    const BCInitUnit = initC.clone().sub(B).normalize()
    const axis = new THREE.Vector3().crossVectors(BAUnit, BCInitUnit).normalize()

    if (axis.lengthSq() === 0) return initC

    return BAUnit.applyAxisAngle(axis, angleB).multiplyScalar(safeBC).add(B)
  }

  function runOneStep() {
    const init = getTriangle()
    const initC = CObject.getWorldPosition(new THREE.Vector3())
    const nextBC = init.BC - STEP * MOVE_DIRECTION
    const C = getPointC(init, initC, nextBC)

    setWorldPosition(CObject, C)
    node.updateWorldMatrix(true, true)
    node.updateMatrix()
    customQuaternionLookAt(BObject, CObject.getWorldPosition(new THREE.Vector3()))
    customQuaternionLookAt(CObject, BObject.getWorldPosition(new THREE.Vector3()))
    customQuaternionLookAt(AObject, CObject.getWorldPosition(new THREE.Vector3()))
  }

  const store = stopOldAnimation()

  function animate() {
    runOneStep()
    store.count += 1

    if (store.count < TOTAL_STEPS) {
      store.frameId = requestAnimationFrame(animate)
    }
  }

  store.frameId = requestAnimationFrame(animate)
}
