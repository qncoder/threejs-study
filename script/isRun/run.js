import * as THREE from 'three'

export class HydraulicMechanism {
  constructor(scene) {
    // =========================
    // 点位
    // =========================

    this.PointA = scene.getObjectByName('frontrod_fixed_pos').getWorldPosition(new THREE.Vector3())
    this.PointB = scene.getObjectByName('backrod_fixed_pos').getWorldPosition(new THREE.Vector3())
    this.PointC = scene.getObjectByName('backrod_shield').getWorldPosition(new THREE.Vector3())
    this.PointD = scene.getObjectByName('frontrod_shield').getWorldPosition(new THREE.Vector3())
    this.PointE = scene
      .getObjectByName('frontcolumn_hydraulic_slidingshaft2_pos')
      .getWorldPosition(new THREE.Vector3())
    this.PointF = scene
      .getObjectByName('frontcolumn_hydraulic_fixed_pos')
      .getWorldPosition(new THREE.Vector3())
    this.PointG = scene
      .getObjectByName('backcolumn_hydraulic_slidingshaft2_pos')
      .getWorldPosition(new THREE.Vector3())
    this.PointI = scene.getObjectByName('shield_pos').getWorldPosition(new THREE.Vector3())
    this.PointK = scene.getObjectByName('frontcolumn_hydraulic_fixed_end').getWorldPosition(new THREE.Vector3())
    // A = frontrod_fixed_pos
    // B = backrod_fixed_pos
    // C = backrod_shield
    // D = frontrod_shield
    // E = frontcolumn_hydraulic_slidingshaft2_pos
    // F = frontcolumn_hydraulic_fixed_pos
    // G = backcolumn_hydraulic_slidingshaft2_pos
    // I = shield_pos
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
    // =========================

    this.AngleAB_Horizontal = this.PointA.sub(this.PointB).angleTo(new THREE.Vector3(0, 0, 1))
    this.InitAngleIE_Horizontal = 0
    this.AngleEIG = this.getAngle(this.PointE, this.PointI, this.PointG)

    // =========================
    // 方向
    // =========================

    this.Right = new THREE.Vector3(1, 0, 0)
    this.Front = new THREE.Vector3(0, 0, 1)

    // =========================
    // 模型节点
    // =========================

    this.eularTempTRS = scene.getObjectByName('SupportPivot')

    this.backcolumn_hydraulic_slidingshaft2_pos = scene.getObjectByName('backcolumn_hydraulic_slidingshaft2_pos')
    this.frontcolumn_hydraulic_slidingshaft2_pos = scene.getObjectByName('frontcolumn_hydraulic_slidingshaft2_pos')

    this.frontrod_shield = scene.getObjectByName('frontrod_shield')
    this.backrod_shield = scene.getObjectByName('backrod_shield')
  }

  // ====================================================
  // 求旋转后的点
  // ====================================================

  rockPoint(A, B, angleDeg, length) {
    const dir = B.clone().sub(A).normalize()

    const q = new THREE.Quaternion().setFromAxisAngle(
      this.Right,
      THREE.MathUtils.degToRad(angleDeg)
    )

    dir.applyQuaternion(q)

    return A.clone().add(dir.multiplyScalar(length))
  }

  // ====================================================
  // 求夹角
  // ====================================================

  getAngle(p1, center, p2) {
    const v1 = p1.clone().sub(center).normalize()

    const v2 = p2.clone().sub(center).normalize()

    return THREE.MathUtils.radToDeg(v1.angleTo(v2))
  }

  // ====================================================
  // 世界坐标转局部坐标
  // ====================================================

  inverseTransformPoint(object3D, worldPoint) {
    return object3D.worldToLocal(worldPoint.clone())
  }

  // ====================================================
  // 四连杆计算
  // ====================================================

  fourLink(rodAngle) {
    this.AngleDAB = rodAngle + this.AngleAB_Horizontal

    this.PointD = this.rockPoint(this.PointA, this.PointB, this.AngleDAB, this.LengthAD)

    this.AngleDBA = this.getAngle(this.PointD, this.PointB, this.PointA)

    this.LengthBD = this.PointB.distanceTo(this.PointD)

    const cosDBC =
      (this.LengthBC * this.LengthBC +
        this.LengthBD * this.LengthBD -
        this.LengthCD * this.LengthCD) /
      (2 * this.LengthBC * this.LengthBD)

    this.AngleDBC = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cosDBC, -1, 1)))

    this.AngleABC = this.AngleDBA + this.AngleDBC

    this.PointC = this.rockPoint(this.PointB, this.PointA, -this.AngleABC, this.LengthBC)
  }

  // ====================================================
  // 计算I点
  // 这里替换成你的原逻辑
  // ====================================================

  calculatePointI(rodAngle) {
    // TODO:
    // 把Unity里的 CalculatePointI()
    // 搬过来
    this.fourLink(rodAngle)

    this.PointI = this.rockPoint(this.PointD, this.PointC, this.AngleCDI, this.LengthDI)

    return this.PointI
  }

  // ====================================================
  // 活动轴更新
  // ====================================================

  updateSlider(rodAngle, frontColumn) {
    frontColumn += this.LengthFK

    this.calculatePointI(rodAngle)

    const LengthIF = this.PointF.distanceTo(this.PointI)

    const cosFIE =
      (LengthIF * LengthIF + this.LengthIE * this.LengthIE - frontColumn * frontColumn) /
      (2 * LengthIF * this.LengthIE)

    const AngleFIE = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cosFIE, -1, 1)))

    this.PointE = this.rockPoint(this.PointI, this.PointF, -AngleFIE, this.LengthIE)

    this.PointG = this.rockPoint(this.PointI, this.PointE, this.AngleEIG, this.LengthIG)

    this.updatePoint()
  }

  // ====================================================
  // 顶梁角度 => 液压缸长度
  // ====================================================

  rodTopBeamAngleToHydraulicLength(rodAngle, topBeamAngle) {
    this.calculatePointI(rodAngle)

    const vectorDI = this.PointI.clone().sub(this.PointD)

    const frontReverse = this.Front.clone().negate().normalize()

    const AngleDIE =
      THREE.MathUtils.radToDeg(vectorDI.normalize().angleTo(frontReverse)) +
      this.InitAngleIE_Horizontal +
      topBeamAngle

    this.PointE = this.rockPoint(this.PointI, this.PointD, -AngleDIE, this.LengthIE)

    this.LengthEF = this.PointE.distanceTo(this.PointF)

    this.PointG = this.rockPoint(this.PointI, this.PointE, this.AngleEIG, this.LengthIG)

    this.updatePoint()

    if (this.updateLooks) {
      this.updateLooks()
    }

    return this.LengthEF
  }

  // ====================================================
  // 更新模型位置
  // ====================================================

  updatePoint() {
    if (!this.eularTempTRS) {
      return
    }

    if (this.backcolumn_hydraulic_slidingshaft2_pos) {
      this.backcolumn_hydraulic_slidingshaft2_pos.position.copy(
        this.inverseTransformPoint(this.eularTempTRS, this.PointG)
      )
    }

    if (this.frontcolumn_hydraulic_slidingshaft2_pos) {
      this.frontcolumn_hydraulic_slidingshaft2_pos.position.copy(
        this.inverseTransformPoint(this.eularTempTRS, this.PointE)
      )
    }

    if (this.frontrod_shield) {
      this.frontrod_shield.position.copy(
        this.inverseTransformPoint(this.eularTempTRS, this.PointD)
      )
    }

    if (this.backrod_shield) {
      this.backrod_shield.position.copy(
        this.inverseTransformPoint(this.eularTempTRS, this.PointC)
      )
    }
  }
}
