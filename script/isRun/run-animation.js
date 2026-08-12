const node = this
class HydraulicMechanism {
  constructor(scene) {
    if (!scene) {
      throw new Error('缺少 scene')
    }

    this.scene = scene
    this.scene.updateWorldMatrix(true, true)
    this.scene.getObjectByName('SupportPivot').quaternion.set(0, 0, 0, 1)
    this.localRoot = this.getRequiredObject('SupportPivot')

    this.Right = new THREE.Vector3(1, 0, 0)
    this.Front = new THREE.Vector3(0, 0, 1)

    this.PointA = this.getLocalPoint('frontrod_fixed_pos')
    this.PointB = this.getLocalPoint('backrod_fixed_pos')
    this.PointC = this.getLocalPoint('backrod_shield')
    this.PointD = this.getLocalPoint('frontrod_shield')
    this.PointE = this.getLocalPoint('frontcolumn_hydraulic_slidingshaft2_pos')
    this.PointF = this.getLocalPoint('frontcolumn_hydraulic_fixed_pos')
    this.PointG = this.getLocalPoint('backcolumn_hydraulic_slidingshaft2_pos')
    this.PointI = this.getLocalPoint('shield_pos')
    this.PointK = this.getLocalPoint('frontcolumn_hydraulic_fixed_end')

    this.LengthAD = this.PointA.distanceTo(this.PointD)
    this.LengthDI = this.PointD.distanceTo(this.PointI)
    this.AngleCDI = this.getAngle(this.PointC, this.PointD, this.PointI)
    this.LengthBC = this.PointB.distanceTo(this.PointC)
    this.LengthCD = this.PointC.distanceTo(this.PointD)
    this.LengthIE = this.PointI.distanceTo(this.PointE)
    this.LengthIG = this.PointI.distanceTo(this.PointG)
    this.LengthFK = this.PointF.distanceTo(this.PointK)

    this.AngleAB_Horizontal = THREE.MathUtils.radToDeg(
      this.PointA.clone().sub(this.PointB).angleTo(this.Front)
    )

    this.InitAngleIE_Horizontal = THREE.MathUtils.radToDeg(
      this.PointE.clone().sub(this.PointI).angleTo(this.Front)
    )

    if (this.PointI.y > this.PointE.y) {
      this.InitAngleIE_Horizontal = -this.InitAngleIE_Horizontal
    }

    this.AngleEIG = this.getAngle(this.PointE, this.PointI, this.PointG)

    if (this.PointG.y > this.PointE.y) {
      this.AngleEIG = -this.AngleEIG
    }

    this.backcolumn_hydraulic_slidingshaft2_pos = this.getRequiredObject(
      'backcolumn_hydraulic_slidingshaft2_pos'
    )
    this.frontcolumn_hydraulic_slidingshaft2_pos = this.getRequiredObject(
      'frontcolumn_hydraulic_slidingshaft2_pos'
    )
    this.frontrod_shield = this.getRequiredObject('frontrod_shield')
    this.backrod_shield = this.getRequiredObject('backrod_shield')
  }

  getRequiredObject(name) {
    const object = this.scene.getObjectByName(name)

    if (!object) {
      throw new Error(`没有找到节点：${name}`)
    }

    return object
  }

  getLocalPoint(name) {
    const object = this.getRequiredObject(name)

    this.scene.updateWorldMatrix(true, true)
    this.localRoot.updateWorldMatrix(true, true)

    const worldPoint = object.getWorldPosition(new THREE.Vector3())
    const localPoint = this.localRoot.worldToLocal(worldPoint.clone())

    this.checkVector3(`${name} 局部坐标`, localPoint)

    return localPoint
  }

  checkVector3(label, value) {
    if (
      !value ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.z)
    ) {
      throw new Error(`${label} 不是有效坐标`)
    }
  }

  toNumber(label, value) {
    const numberValue = Number(value)

    if (!Number.isFinite(numberValue)) {
      throw new Error(`${label} 不是有效数字`)
    }

    return numberValue
  }

  rockPoint(A, B, angleDeg, length) {
    this.checkVector3('rockPoint A', A)
    this.checkVector3('rockPoint B', B)

    const angle = this.toNumber('旋转角度', angleDeg)
    const pointLength = this.toNumber('旋转长度', length)
    const dir = B.clone().sub(A).normalize()
    const q = new THREE.Quaternion().setFromAxisAngle(
      this.Right,
      THREE.MathUtils.degToRad(angle)
    )

    dir.applyQuaternion(q)

    const result = A.clone().add(dir.multiplyScalar(pointLength))
    this.checkVector3('rockPoint 结果', result)

    return result
  }

  getAngle(p1, center, p2) {
    this.checkVector3('夹角点 p1', p1)
    this.checkVector3('夹角中心点', center)
    this.checkVector3('夹角点 p2', p2)

    const v1 = p1.clone().sub(center).normalize()
    const v2 = p2.clone().sub(center).normalize()

    return THREE.MathUtils.radToDeg(v1.angleTo(v2))
  }

  getTriangleAngle(sideA, sideB, oppositeSide) {
    const a = this.toNumber('三角形边长 A', sideA)
    const b = this.toNumber('三角形边长 B', sideB)
    const c = this.toNumber('三角形对边', oppositeSide)
    const denominator = 2 * a * b

    if (Math.abs(denominator) < 0.000001) {
      throw new Error('三角形夹角计算失败：边长过小')
    }

    const cosValue = (a * a + b * b - c * c) / denominator
    const safeCosValue = THREE.MathUtils.clamp(cosValue, -1, 1)

    return THREE.MathUtils.radToDeg(Math.acos(safeCosValue))
  }

  localPointToWorld(localPoint) {
    this.checkVector3('要转换的局部坐标', localPoint)
    this.localRoot.updateWorldMatrix(true, true)

    const worldPoint = this.localRoot.localToWorld(localPoint.clone())
    this.checkVector3('转换后的世界坐标', worldPoint)

    return worldPoint
  }

  setWorldPosition(object, worldPoint) {
    if (!object) return

    if (!object.parent) {
      throw new Error(`节点没有父级，无法写入位置：${object.name || object.type}`)
    }

    this.checkVector3(`${object.name || object.type} 目标世界坐标`, worldPoint)
    object.parent.updateWorldMatrix(true, false)

    const localPoint = object.parent.worldToLocal(worldPoint.clone())
    this.checkVector3(`${object.name || object.type} 写入用局部坐标`, localPoint)

    object.position.copy(localPoint)
    object.updateWorldMatrix(false, true)
  }

  setLocalPointAsWorldPosition(object, localPoint) {
    const worldPoint = this.localPointToWorld(localPoint)
    this.setWorldPosition(object, worldPoint)
  }

  fourLink(rodAngle) {
    const angle = this.toNumber('顶梁角度', rodAngle)

    this.AngleDAB = angle + this.AngleAB_Horizontal
    this.PointD = this.rockPoint(this.PointA, this.PointB, this.AngleDAB, this.LengthAD)
    this.AngleDBA = this.getAngle(this.PointD, this.PointB, this.PointA)
    this.LengthBD = this.PointB.distanceTo(this.PointD)
    this.AngleDBC = this.getTriangleAngle(this.LengthBC, this.LengthBD, this.LengthCD)
    this.AngleABC = this.AngleDBA + this.AngleDBC
    this.PointC = this.rockPoint(this.PointB, this.PointA, -this.AngleABC, this.LengthBC)
  }

  calculatePointI(rodAngle) {
    this.fourLink(rodAngle)
    this.PointI = this.rockPoint(this.PointD, this.PointC, this.AngleCDI, this.LengthDI)

    return this.PointI
  }

  rodTopBeamAngleToHydraulicLength(rodAngle, topBeamAngle) {
    const beamAngle = topBeamAngle

    this.calculatePointI(rodAngle)

    const vectorDI = this.PointI.clone().sub(this.PointD)
    this.checkVector3('DI 方向', vectorDI)

    const AngleDIE =
      THREE.MathUtils.radToDeg(
        vectorDI.normalize().angleTo(this.Front.clone().negate().normalize())
      ) +
      this.InitAngleIE_Horizontal +
      beamAngle

    this.PointE = this.rockPoint(this.PointI, this.PointD, -AngleDIE, this.LengthIE)
    this.LengthEF = this.PointE.distanceTo(this.PointF)
    this.PointG = this.rockPoint(this.PointI, this.PointE, this.AngleEIG, this.LengthIG)
    this.updatePoint()
    this.updateLooks()

    return this.LengthEF
  }

  updatePoint() {
    this.setLocalPointAsWorldPosition(this.backcolumn_hydraulic_slidingshaft2_pos, this.PointG)
    this.setLocalPointAsWorldPosition(this.frontcolumn_hydraulic_slidingshaft2_pos, this.PointE)
    this.setLocalPointAsWorldPosition(this.frontrod_shield, this.PointD)
    this.setLocalPointAsWorldPosition(this.backrod_shield, this.PointC)
    this.scene.updateWorldMatrix(true, true)
  }

  updateLooks() {
    const frontcolumn_slidingshaft2_pos = this.scene.getObjectByName(
      'frontcolumn_hydraulic_slidingshaft2_pos'
    )
    const frontcolumn_fixed_pos = this.scene.getObjectByName('frontcolumn_hydraulic_fixed_pos')

    frontcolumn_slidingshaft2_pos.lookAt(
      frontcolumn_fixed_pos.getWorldPosition(new THREE.Vector3())
    )
    frontcolumn_fixed_pos.lookAt(
      frontcolumn_slidingshaft2_pos.getWorldPosition(new THREE.Vector3())
    )

    const backcolumn_slidingshaft2_pos = this.scene.getObjectByName(
      'backcolumn_hydraulic_slidingshaft2_pos'
    )
    const backcolumn_fixed_pos = this.scene.getObjectByName('backcolumn_hydraulic_fixed_pos')

    backcolumn_fixed_pos.lookAt(backcolumn_slidingshaft2_pos.getWorldPosition(new THREE.Vector3()))
    backcolumn_slidingshaft2_pos.lookAt(backcolumn_fixed_pos.getWorldPosition(new THREE.Vector3()))

    const backrod_fixed_pos = this.scene.getObjectByName('backrod_fixed_pos')
    const backrod_shield = this.scene.getObjectByName('backrod_shield')
    const frontrod_fixed_pos = this.scene.getObjectByName('frontrod_fixed_pos')
    const frontrod_shield = this.scene.getObjectByName('frontrod_shield')

    backrod_fixed_pos.lookAt(backrod_shield.getWorldPosition(new THREE.Vector3()))
    frontrod_fixed_pos.lookAt(frontrod_shield.getWorldPosition(new THREE.Vector3()))
    backrod_shield.lookAt(frontrod_shield.getWorldPosition(new THREE.Vector3()))

    const TopBeamDIR = this.scene.getObjectByName('TopBeamDIR')
    const targetPosition = backcolumn_slidingshaft2_pos.getWorldPosition(new THREE.Vector3())
    TopBeamDIR.lookAt(targetPosition)
  }
}
function run(){

const MIN_ROD_ANGLE = 20
const MAX_ROD_ANGLE = 50
const ANGLE_SPEED = 12
const TOP_BEAM_ANGLE = 0
const STORE_KEY = '__hydraulicMechanismRunAnimationStore'
const sceneKey = scene?.uuid || node?.uuid || 'default'

function stopOldAnimation() {
  const oldStore = window[STORE_KEY]?.[sceneKey]

  if (oldStore && oldStore.frameId) {
    cancelAnimationFrame(oldStore.frameId)
    oldStore.frameId = 0
  }
}

window.stopHydraulicMechanismRunAnimation = stopOldAnimation
window[STORE_KEY] = window[STORE_KEY] || {}
stopOldAnimation()

const oldStore = window[STORE_KEY][sceneKey] || {}
const store = {
  group: oldStore.group || new HydraulicMechanism(scene),
  frameId: 0,
  rodAngle: Number.isFinite(oldStore.rodAngle) ? oldStore.rodAngle : MIN_ROD_ANGLE,
  direction: oldStore.direction === -1 ? -1 : 1,
  lastTime: 0,
}

window[STORE_KEY][sceneKey] = store

function animate(now) {
  if (!store.lastTime) {
    store.lastTime = now
  }

  const deltaSecond = Math.min((now - store.lastTime) / 1000, 0.05)
  store.lastTime = now
  store.rodAngle += store.direction * ANGLE_SPEED * deltaSecond

  if (store.rodAngle >= MAX_ROD_ANGLE) {
    store.rodAngle = MAX_ROD_ANGLE
    store.direction = -1
  } else if (store.rodAngle <= MIN_ROD_ANGLE) {
    store.rodAngle = MIN_ROD_ANGLE
    store.direction = 1
  }

  store.group.rodTopBeamAngleToHydraulicLength(store.rodAngle, TOP_BEAM_ANGLE)
  store.frameId = requestAnimationFrame(animate)
}

store.group.rodTopBeamAngleToHydraulicLength(store.rodAngle, TOP_BEAM_ANGLE)
store.frameId = requestAnimationFrame(animate)

}
