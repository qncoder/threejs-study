setPosition(0, 0, 0);
setRotationDeg(0, 0, 0);
setScale(1, 1, 1);

function createHydraulicMechanism(scene) {
  const state = {
    // =========================
    // 点位
    // =========================

    PointA: scene.getObjectByName('frontrod_fixed_pos').getWorldPosition(new THREE.Vector3()),
    PointB: scene.getObjectByName('backrod_fixed_pos').getWorldPosition(new THREE.Vector3()),
    PointC: scene.getObjectByName('backrod_shield').getWorldPosition(new THREE.Vector3()),
    PointD: scene.getObjectByName('frontrod_shield').getWorldPosition(new THREE.Vector3()),
    PointE: scene
      .getObjectByName('frontcolumn_hydraulic_slidingshaft2_pos')
      .getWorldPosition(new THREE.Vector3()),
    PointF: scene
      .getObjectByName('frontcolumn_hydraulic_fixed_pos')
      .getWorldPosition(new THREE.Vector3()),
    PointG: scene
      .getObjectByName('backcolumn_hydraulic_slidingshaft2_pos')
      .getWorldPosition(new THREE.Vector3()),
    PointI: scene.getObjectByName('shield_pos').getWorldPosition(new THREE.Vector3()),

    // =========================
    // 长度参数
    // =========================

    LengthAD: 0,
    LengthBC: 0,
    LengthCD: 0,

    LengthIE: 0,
    LengthIG: 0,
    LengthFK: 0,
    LengthDI: 0,

    // =========================
    // 角度参数
    // =========================

    AngleAB_Horizontal: 0,
    InitAngleIE_Horizontal: 0,
    AngleEIG: 0,
    AngleCDI: 0,

    // =========================
    // 方向
    // =========================

    Right: new THREE.Vector3(1, 0, 0),
    Front: new THREE.Vector3(0, 0, 1),

    // =========================
    // 模型节点
    // =========================

    eularTempTRS: null,

    BackColumHydraulicJack: null,
    FrontColumHydraulicJack: null,

    crankMiddelSliding: null,
    crankAfterSliding: null,

    updateLooks: null
  }

  // ====================================================
  // 求旋转后的点
  // ====================================================

  function rockPoint(A, B, angleDeg, length) {
    const dir = B.clone().sub(A).normalize()

    const q = new THREE.Quaternion().setFromAxisAngle(
      state.Right,
      THREE.MathUtils.degToRad(angleDeg)
    )

    dir.applyQuaternion(q)

    return A.clone().add(dir.multiplyScalar(length))
  }

  // ====================================================
  // 求夹角
  // ====================================================

  function getAngle(p1, center, p2) {
    const v1 = p1.clone().sub(center).normalize()
    const v2 = p2.clone().sub(center).normalize()

    return THREE.MathUtils.radToDeg(v1.angleTo(v2))
  }

  // ====================================================
  // 世界坐标转局部坐标
  // ====================================================

  function inverseTransformPoint(object3D, worldPoint) {
    return object3D.worldToLocal(worldPoint.clone())
  }

  // ====================================================
  // 四连杆计算
  // ====================================================

  function fourLink(rodAngle) {
    state.AngleDAB =
      rodAngle +
      state.AngleAB_Horizontal

    state.PointD = rockPoint(
      state.PointA,
      state.PointB,
      state.AngleDAB,
      state.LengthAD
    )

    state.AngleDBA = getAngle(
      state.PointD,
      state.PointB,
      state.PointA
    )

    state.LengthBD =
      state.PointB.distanceTo(state.PointD)

    const cosDBC =
      (
        state.LengthBC * state.LengthBC +
        state.LengthBD * state.LengthBD -
        state.LengthCD * state.LengthCD
      ) /
      (
        2 *
        state.LengthBC *
        state.LengthBD
      )

    state.AngleDBC =
      THREE.MathUtils.radToDeg(
        Math.acos(
          THREE.MathUtils.clamp(
            cosDBC,
            -1,
            1
          )
        )
      )

    state.AngleABC =
      state.AngleDBA +
      state.AngleDBC

    state.PointC = rockPoint(
      state.PointB,
      state.PointA,
      -state.AngleABC,
      state.LengthBC
    )
  }

  // ====================================================
  // 计算I点
  // ====================================================

  function calculatePointI(rodAngle) {
    fourLink(rodAngle)

    state.PointI = rockPoint(
      state.PointD,
      state.PointC,
      state.AngleCDI,
      state.LengthDI
    )

    return state.PointI
  }

  // ====================================================
  // 更新活动轴
  // ====================================================

  function updateSlider(
    rodAngle,
    frontColumn
  ) {
    console.log(state,'updateSlider---------')
    // frontColumn += state.LengthFK
    state.LengthFK+=1
    frontColumn +=state.LengthFK
    console.log(frontColumn,state.LengthFK)
    calculatePointI(rodAngle)

    const lengthIF =
      state.PointF.distanceTo(state.PointI)
    console.log(lengthIF,'lengthIF')
    const cosFIE =
      (
        lengthIF * lengthIF +
        state.LengthIE * state.LengthIE -
        frontColumn * frontColumn
      ) /
      (
        2 *
        lengthIF *
        state.LengthIE
      )

    const angleFIE =
      THREE.MathUtils.radToDeg(
        Math.acos(
          THREE.MathUtils.clamp(
            cosFIE,
            -1,
            1
          )
        )
      )

    state.PointE = rockPoint(
      state.PointI,
      state.PointF,
      -angleFIE,
      state.LengthIE
    )

    state.PointG = rockPoint(
      state.PointI,
      state.PointE,
      state.AngleEIG,
      state.LengthIG
    )

    updatePoint()
  }

  // ====================================================
  // 顶梁角度 -> 液压缸长度
  // ====================================================

  function rodTopBeamAngleToHydraulicLength(
    rodAngle,
    topBeamAngle
  ) {
    calculatePointI(rodAngle)

    const vectorDI =
      state.PointI.clone().sub(state.PointD)

    const frontReverse =
      state.Front.clone()
        .negate()
        .normalize()

    const angleDIE =
      THREE.MathUtils.radToDeg(
        vectorDI.normalize().angleTo(frontReverse)
      ) +
      state.InitAngleIE_Horizontal +
      topBeamAngle

    state.PointE = rockPoint(
      state.PointI,
      state.PointD,
      -angleDIE,
      state.LengthIE
    )

    const lengthEF =
      state.PointE.distanceTo(state.PointF)

    state.PointG = rockPoint(
      state.PointI,
      state.PointE,
      state.AngleEIG,
      state.LengthIG
    )
    console.log(state,'state******')
    updatePoint()

    if (state.updateLooks) {
      state.updateLooks()
    }

    return lengthEF
  }

  // ====================================================
  // 更新模型位置
  // ====================================================

  function updatePoint() {
    if (!state.eularTempTRS) {
      return
    }

    if (
      state.BackColumHydraulicJack?.slidingShaft
    ) {
      state.BackColumHydraulicJack.slidingShaft.position.copy(
        inverseTransformPoint(
          state.eularTempTRS,
          state.PointG
        )
      )
    }

    if (
      state.FrontColumHydraulicJack?.slidingShaft
    ) {
      state.FrontColumHydraulicJack.slidingShaft.position.copy(
        inverseTransformPoint(
          state.eularTempTRS,
          state.PointE
        )
      )
    }

    if (state.crankMiddelSliding) {
      state.crankMiddelSliding.position.copy(
        inverseTransformPoint(
          state.eularTempTRS,
          state.PointD
        )
      )
    }

    if (state.crankAfterSliding) {
      state.crankAfterSliding.position.copy(
        inverseTransformPoint(
          state.eularTempTRS,
          state.PointC
        )
      )
    }
  }

  return {
    state,

    rockPoint,
    getAngle,

    fourLink,
    calculatePointI,

    updateSlider,
    updatePoint,

    rodTopBeamAngleToHydraulicLength
  }
}
const hydraulic =
  createHydraulicMechanism(scene)

// 初始化参数
hydraulic.state.LengthAD = hydraulic.state.PointA.distanceTo(hydraulic.state.PointD)
hydraulic.state.LengthBC = hydraulic.state.PointB.distanceTo(hydraulic.state.PointC)
hydraulic.state.LengthCD = hydraulic.state.PointC.distanceTo(hydraulic.state.PointD)

hydraulic.state.LengthIE = hydraulic.state.PointI.distanceTo(hydraulic.state.PointE)
hydraulic.state.LengthIG = hydraulic.state.PointI.distanceTo(hydraulic.state.PointG)
hydraulic.state.LengthDI = hydraulic.state.PointD.distanceTo(hydraulic.state.PointI)

// 计算
const pointI =
  hydraulic.calculatePointI(30)

console.log(pointI)

// 更新液压缸
hydraulic.updateSlider(
  35,
  0.6
)
console.log('PointB', hydraulic.state.PointB)

console.log('LengthAD', hydraulic.state.LengthAD)
console.log('LengthBC', hydraulic.state.LengthBC)
console.log('LengthCD', hydraulic.state.LengthCD)

console.log(
  hydraulic.calculatePointI(0)
)

console.log(
  hydraulic.calculatePointI(30)
)

console.log(
  hydraulic.calculatePointI(60)
)
