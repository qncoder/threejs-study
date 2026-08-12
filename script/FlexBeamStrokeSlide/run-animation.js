const node = this

function run() {
  const STEP = 0.01
  const MOVE_DIRECTION = -1
  const TOTAL_STEPS = 40
  const STORE_KEY = '__flexBeamStrokeSlideRunAnimationStore'

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
      caf(oldStore.frameId)
    }

    window[STORE_KEY] = { frameId: 0, count: 0 }
    return window[STORE_KEY]
  }

  window.stopFlexBeamStrokeSlideRunAnimation = stopOldAnimation

  const AObject = node.getObjectByName('flexbeamstroke_hydraulic_fixed_pos')
  const BObject = node.getObjectByName('flexbeamstroke_hydraulic_fixed_end')
  const CObject = node.getObjectByName('flexbeamstroke_hydraulic_slidingshaft_pos')
  const DObject = node.getObjectByName('frontdisstart1')
  const EObject = node.getObjectByName('flexbeamstroke_pos')

  if (!AObject || !BObject || !CObject || !DObject || !EObject) {
    console.warn('伸缩梁动画缺少节点，请检查 flexbeamstroke 相关点位')
    return
  }

  function moveWorld(object, delta) {
    if (!object || !object.parent) return

    const p = object.getWorldPosition(new THREE.Vector3()).add(delta)
    object.parent.updateWorldMatrix(true, true)
    object.parent.worldToLocal(p)
    object.position.copy(p)
    object.updateMatrixWorld(true)
  }

  function runOneStep() {
    const start = CObject.getWorldPosition(new THREE.Vector3())
    const dir = AObject.getWorldPosition(new THREE.Vector3())
      .sub(BObject.getWorldPosition(new THREE.Vector3()))
      .normalize()

    const target = start.clone().addScaledVector(dir, STEP * MOVE_DIRECTION)
    const delta = target.clone().sub(start)

    moveWorld(CObject, delta)
    moveWorld(DObject, delta)
    moveWorld(EObject, delta)

    AObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
    BObject.lookAt(AObject.getWorldPosition(new THREE.Vector3()))
    CObject.lookAt(BObject.getWorldPosition(new THREE.Vector3()))
    DObject.lookAt(EObject.getWorldPosition(new THREE.Vector3()))
    EObject.lookAt(CObject.getWorldPosition(new THREE.Vector3()))
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
