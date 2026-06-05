setPosition(0, 0, 0)
setRotationDeg(0, 0, 0)
setScale(1, 1, 1)

class HydraulicMechanism {
  constructor(scene) {
    if (!scene) {
      throw new Error('缺少 scene')
    }

    this.scene = scene
    this.scene.updateWorldMatrix(true, true)
    this.scene.getObjectByName('SupportPivot').quaternion.set(0, 0, 0, 1)
    // 所有点位统一以 SupportPivot 为局部坐标基准
    this.localRoot = this.getRequiredObject('SupportPivot')

    // =========================
    // 方向
    // 这里是 SupportPivot 局部坐标里的方向
    // =========================

    this.Right = new THREE.Vector3(1, 0, 0)
    this.Front = new THREE.Vector3(0, 0, 1)

    // =========================
    // 点位
    // 这里全部拿 SupportPivot 下的局部坐标
    // =========================

    this.PointA = this.getLocalPoint('frontrod_fixed_pos')
    this.PointB = this.getLocalPoint('backrod_fixed_pos')
    this.PointC = this.getLocalPoint('backrod_shield')
    this.PointD = this.getLocalPoint('frontrod_shield')
    this.PointE = this.getLocalPoint('frontcolumn_hydraulic_slidingshaft2_pos')
    this.PointF = this.getLocalPoint('frontcolumn_hydraulic_fixed_pos')
    this.PointG = this.getLocalPoint('backcolumn_hydraulic_slidingshaft2_pos')
    this.PointI = this.getLocalPoint('shield_pos')
    this.PointK = this.getLocalPoint('frontcolumn_hydraulic_fixed_end')

    // =========================
    // 长度参数
    // =========================

    this.LengthAD = this.PointA.distanceTo(this.PointD)
    this.LengthDI = this.PointD.distanceTo(this.PointI)
    this.AngleCDI = this.getAngle(this.PointC, this.PointD, this.PointI)

    this.LengthBC = this.PointB.distanceTo(this.PointC)
    this.LengthCD = this.PointC.distanceTo(this.PointD)

    this.LengthIE = this.PointI.distanceTo(this.PointE)
    this.LengthIG = this.PointI.distanceTo(this.PointG)
    this.LengthFK = this.PointF.distanceTo(this.PointK)

    // =========================
    // 角度参数
    // 注意：必须 clone()，不能直接 sub()
    // =========================

    this.AngleAB_Horizontal = THREE.MathUtils.radToDeg(
      this.PointA.clone().sub(this.PointB).angleTo(this.Front)
    )

    this.InitAngleIE_Horizontal = THREE.MathUtils.radToDeg(
      this.PointE.clone().sub(this.PointI).angleTo(this.Front)
    )
    this.PointI.y > this.PointE.y ? this.InitAngleIE_Horizontal = -this.InitAngleIE_Horizontal : null
    this.AngleEIG = this.getAngle(this.PointE, this.PointI, this.PointG)
    console.log(this.PointG)
    console.log(this.PointE)
    this.PointG.y > this.PointE.y ? (this.AngleEIG = -this.AngleEIG) : null

    console.log('AngleAB_Horizontal:', this.AngleAB_Horizontal)
    console.log('InitAngleIE_Horizontal:', this.InitAngleIE_Horizontal)
    console.log('AngleEIG:', this.AngleEIG)

    // =========================
    // 模型节点
    // =========================

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

  // ====================================================
  // 获取 SupportPivot 下的局部坐标
  // ====================================================

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

  // ====================================================
  // 求旋转后的点
  // A、B 都是 SupportPivot 下的局部坐标
  // 返回值也是 SupportPivot 下的局部坐标
  // ====================================================

  rockPoint(A, B, angleDeg, length) {
    this.checkVector3('rockPoint A', A)
    this.checkVector3('rockPoint B', B)

    const angle = this.toNumber('旋转角度', angleDeg)
    const pointLength = this.toNumber('旋转长度', length)

    const dir = B.clone().sub(A).normalize()

    const q = new THREE.Quaternion().setFromAxisAngle(this.Right, THREE.MathUtils.degToRad(angle))

    dir.applyQuaternion(q)

    const result = A.clone().add(dir.multiplyScalar(pointLength))
    this.checkVector3('rockPoint 结果', result)

    return result
  }

  // ====================================================
  // 求夹角
  // p1、center、p2 都是 SupportPivot 下的局部坐标
  // ====================================================

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

  // ====================================================
  // 把 SupportPivot 下的局部坐标转成世界坐标
  // ====================================================

  localPointToWorld(localPoint) {
    this.checkVector3('要转换的局部坐标', localPoint)

    this.localRoot.updateWorldMatrix(true, true)

    const worldPoint = this.localRoot.localToWorld(localPoint.clone())
    this.checkVector3('转换后的世界坐标', worldPoint)

    return worldPoint
  }

  // ====================================================
  // 把世界坐标写入目标节点
  // object.position 仍然需要转换成它父级下的局部坐标
  // ====================================================

  setWorldPosition(object, worldPoint) {
    if (!object) {
      return
    }

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

  // ====================================================
  // 输入 SupportPivot 局部坐标，按世界坐标方式写回节点
  // ====================================================

  setLocalPointAsWorldPosition(object, localPoint) {
    const worldPoint = this.localPointToWorld(localPoint)
    this.setWorldPosition(object, worldPoint)
  }

  // ====================================================
  // 四连杆计算
  // ====================================================

  fourLink(rodAngle) {
    const angle = this.toNumber('顶梁角度', rodAngle)

    this.AngleDAB = angle + this.AngleAB_Horizontal
    console.log(this.AngleDAB, 'AngleDAB')

    this.PointD = this.rockPoint(this.PointA, this.PointB, this.AngleDAB, this.LengthAD)

    this.AngleDBA = this.getAngle(this.PointD, this.PointB, this.PointA)
    console.log(this.AngleDBA, 'AngleDBA')

    this.LengthBD = this.PointB.distanceTo(this.PointD)

    this.AngleDBC = this.getTriangleAngle(this.LengthBC, this.LengthBD, this.LengthCD)

    this.AngleABC = this.AngleDBA + this.AngleDBC

    this.PointC = this.rockPoint(this.PointB, this.PointA, -this.AngleABC, this.LengthBC)
  }

  // ====================================================
  // 计算 I 点
  // ====================================================

  calculatePointI(rodAngle) {
    this.fourLink(rodAngle)

    this.PointI = this.rockPoint(this.PointD, this.PointC, this.AngleCDI, this.LengthDI)

    console.log('calculatePointI', this.PointI)
    return this.PointI
  }

  // ====================================================
  // 活动轴更新
  // ====================================================

  updateSlider(rodAngle, frontColumn) {
    const frontColumnLength = this.toNumber('前立柱长度', frontColumn) + this.LengthFK

    this.calculatePointI(rodAngle)

    const LengthIF = this.PointF.distanceTo(this.PointI)

    const AngleFIE = this.getTriangleAngle(LengthIF, this.LengthIE, frontColumnLength)

    this.PointE = this.rockPoint(this.PointI, this.PointF, -AngleFIE, this.LengthIE)

    this.PointG = this.rockPoint(this.PointI, this.PointE, this.AngleEIG, this.LengthIG)

    this.updatePoint()
  }

  // ====================================================
  // 顶梁角度 => 液压缸长度
  // ====================================================

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

    console.log('AngleDIE', AngleDIE)
    this.PointE = this.rockPoint(this.PointI, this.PointD, -AngleDIE, this.LengthIE)

    this.LengthEF = this.PointE.distanceTo(this.PointF)

    this.PointG = this.rockPoint(this.PointI, this.PointE, this.AngleEIG, this.LengthIG)

    console.log(this.PointD, 'this.PointD')
    console.log(this.PointE, 'this.PointE')
    console.log(this.PointG, 'this.PointG')
    console.log(this.LengthIE, 'LengthIE')

    console.log(this.AngleEIG, 'AngleEIG')
    this.updatePoint()

    if (this.updateLooks) {
      this.updateLooks()
    }

    return this.LengthEF
  }

  // ====================================================
  // 更新模型位置
  // PointC / PointD / PointE / PointG 是 SupportPivot 下的局部坐标
  // 写回时先转世界坐标，再写入目标节点
  // ====================================================

  updatePoint() {
    this.setLocalPointAsWorldPosition(this.backcolumn_hydraulic_slidingshaft2_pos, this.PointG)
    this.setLocalPointAsWorldPosition(this.frontcolumn_hydraulic_slidingshaft2_pos, this.PointE)
    this.setLocalPointAsWorldPosition(this.frontrod_shield, this.PointD)
    this.setLocalPointAsWorldPosition(this.backrod_shield, this.PointC)

    this.scene.updateWorldMatrix(true, true)
  }

  updateLooks() {
    // 这里可以放一些额外的更新外观的逻辑，比如根据液压缸长度调整柱塞伸出部分的缩放等
    // 目前先留空
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
    const backcolumn_hydraulic_slidingshaft2_pos = this.scene.getObjectByName(
      'backcolumn_hydraulic_slidingshaft2_pos'
    )
    const targetPosition = backcolumn_hydraulic_slidingshaft2_pos.getWorldPosition(
      new THREE.Vector3()
    )
    TopBeamDIR.lookAt(targetPosition)
  }
}
const STORE_KEY = '__hydraulicMechanismInstance222133'
const FORCE_INIT = false

if (FORCE_INIT || !window[STORE_KEY]) {
  window[STORE_KEY] = new HydraulicMechanism(scene)
  console.log('已初始化 HydraulicMechanism 实例')
} else {
  console.log('复用已有 HydraulicMechanism 实例')
}

const group = window[STORE_KEY]
if (!window.step) {
  window.step = 40
  console.log('重置 step 为 40')
} else {
  window.step += 1
  console.log('当前 step:', window.step)
}
group.rodTopBeamAngleToHydraulicLength(window.step, 0)
