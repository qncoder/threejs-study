function createHydraulicMechanism(scene) {
  // =========================
  // 点位
  // =========================

  const frontRodFixedPos = getNode('frontrod_fixed_pos')
  const backRodFixedPos = getNode('backrod_fixed_pos')
  const backRodShield = getControlNode('backrod_shield')
  const frontRodShield = getControlNode('frontrod_shield')
  const frontColumnSlidingShaft = getControlNode('frontcolumn_hydraulic_slidingshaft2')
  const frontColumnFixedPos = getNode('frontcolumn_hydraulic_fixed_pos')
  const backColumnSlidingShaft = getControlNode('backcolumn_hydraulic_slidingshaft2')
  const shieldPos = getNode('shield_pos')
  const frontColumnFixedEnd = getNode('frontcolumn_hydraulic_fixed_end')

  const PointA = frontRodFixedPos.getWorldPosition(new THREE.Vector3())
  const PointB = backRodFixedPos.getWorldPosition(new THREE.Vector3())
  const PointC = backRodShield.getWorldPosition(new THREE.Vector3())
  const PointD = frontRodShield.getWorldPosition(new THREE.Vector3())
  const PointE = frontColumnSlidingShaft.getWorldPosition(new THREE.Vector3())
  const PointF = frontColumnFixedPos.getWorldPosition(new THREE.Vector3())
  const PointG = backColumnSlidingShaft.getWorldPosition(new THREE.Vector3())
  const PointI = shieldPos.getWorldPosition(new THREE.Vector3())
  const PointK = frontColumnFixedEnd.getWorldPosition(new THREE.Vector3())

  const mechanism = {
    PointA,
    PointB,
    PointC,
    PointD,
    PointE,
    PointF,
    PointG,
    PointI,
    PointK,

    // =========================
    // 长度参数
    // =========================

    LengthAD: PointA.distanceTo(PointD),
    LengthDI: PointD.distanceTo(PointI),
    AngleCDI: getAngle(PointC, PointD, PointI),
    LengthBC: PointB.distanceTo(PointC),
    LengthCD: PointC.distanceTo(PointD),

    LengthIE: PointI.distanceTo(PointE),
    LengthIG: PointI.distanceTo(PointG),
    LengthFK: PointF.distanceTo(PointK),

    // =========================
    // 角度参数
    // =========================

    AngleAB_Horizontal: 0,
    InitAngleIE_Horizontal: 0,
    AngleEIG: 0,

    // =========================
    // 方向
    // =========================

    Right: new THREE.Vector3(1, 0, 0),
    Front: new THREE.Vector3(0, 0, 1),

    // =========================
    // 模型节点
    // =========================

    backColumnSlidingShaft,
    frontColumnSlidingShaft,
    crankMiddelSliding: frontRodShield,
    crankAfterSliding: backRodShield,
    debugMove: false,

    rockPoint,
    getAngle,
    inverseTransformPoint,
    fourLink,
    calculatePointI,
    updateSlider,
    rodTopBeamAngleToHydraulicLength,
    printRodTopBeamLengthRange,
    updatePoint,
  }

  // ====================================================
  // 求旋转后的点
  // ====================================================

  function getNode(name) {
    const object = scene.getObjectByName(name)
    if (!object) {
      throw new Error(`找不到节点：${name}`)
    }
    return object
  }

  function getControlNode(meshName) {
    const pos = scene.getObjectByName(`${meshName}_pos`)
    const mesh = scene.getObjectByName(meshName)

    if (!pos && !mesh) {
      throw new Error(`找不到节点：${meshName} 或 ${meshName}_pos`)
    }

    if (pos && mesh && mesh.parent !== pos && !isDescendantOf(pos, mesh)) {
      scene.updateWorldMatrix(true, true)
      pos.attach(mesh)
      scene.updateWorldMatrix(true, true)
    }

    return pos || mesh
  }

  function isDescendantOf(object3D, parent) {
    let current = object3D?.parent
    while (current) {
      if (current === parent) {
        return true
      }
      current = current.parent
    }
    return false
  }

  function rockPoint(A, B, angleDeg, length) {
    const dir = B.clone().sub(A).normalize()

    const q = new THREE.Quaternion().setFromAxisAngle(
      mechanism.Right,
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

  function setWorldPosition(object3D, worldPoint) {
    if (!object3D?.parent) {
      if (mechanism.debugMove) {
        console.warn('节点没有父级，不能写入本地坐标：', object3D?.name || object3D)
      }
      return
    }

    const beforeWorld = object3D.getWorldPosition(new THREE.Vector3())

    object3D.parent.updateWorldMatrix(true, true)
    object3D.position.copy(mechanism.inverseTransformPoint(object3D.parent, worldPoint))
    object3D.updateMatrix()
    object3D.updateWorldMatrix(true, true)

    if (mechanism.debugMove) {
      const afterWorld = object3D.getWorldPosition(new THREE.Vector3())
      console.log('节点移动：', {
        name: object3D.name || '(未命名)',
        before: formatVector(beforeWorld),
        target: formatVector(worldPoint),
        after: formatVector(afterWorld),
        distance: Number(beforeWorld.distanceTo(afterWorld).toFixed(6)),
        meshCount: countMeshes(object3D),
      })
    }
  }

  function countMeshes(object3D) {
    let count = 0
    object3D.traverse?.((child) => {
      if (child.isMesh) {
        count += 1
      }
    })
    return count
  }

  function formatVector(vector) {
    return {
      x: Number(vector.x.toFixed(6)),
      y: Number(vector.y.toFixed(6)),
      z: Number(vector.z.toFixed(6)),
    }
  }

  // ====================================================
  // 四连杆计算
  // ====================================================

  function fourLink(rodAngle) {
    mechanism.AngleDAB = rodAngle + mechanism.AngleAB_Horizontal

    mechanism.PointD = mechanism.rockPoint(
      mechanism.PointA,
      mechanism.PointB,
      mechanism.AngleDAB,
      mechanism.LengthAD
    )

    mechanism.AngleDBA = mechanism.getAngle(mechanism.PointD, mechanism.PointB, mechanism.PointA)

    mechanism.LengthBD = mechanism.PointB.distanceTo(mechanism.PointD)

    const cosDBC =
      (mechanism.LengthBC * mechanism.LengthBC +
        mechanism.LengthBD * mechanism.LengthBD -
        mechanism.LengthCD * mechanism.LengthCD) /
      (2 * mechanism.LengthBC * mechanism.LengthBD)

    mechanism.AngleDBC = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cosDBC, -1, 1)))

    mechanism.AngleABC = mechanism.AngleDBA + mechanism.AngleDBC

    mechanism.PointC = mechanism.rockPoint(
      mechanism.PointB,
      mechanism.PointA,
      -mechanism.AngleABC,
      mechanism.LengthBC
    )
  }

  // ====================================================
  // 计算I点
  // 这里替换成你的原逻辑
  // ====================================================

  function calculatePointI(rodAngle) {
    // TODO:
    // 把Unity里的 CalculatePointI()
    // 搬过来
    mechanism.fourLink(rodAngle)

    mechanism.PointI = mechanism.rockPoint(
      mechanism.PointD,
      mechanism.PointC,
      mechanism.AngleCDI,
      mechanism.LengthDI
    )

    return mechanism.PointI
  }

  // ====================================================
  // 活动轴更新
  // ====================================================

  function updateSlider(rodAngle, frontColumn) {
    frontColumn += mechanism.LengthFK

    mechanism.calculatePointI(rodAngle)

    const LengthIF = mechanism.PointF.distanceTo(mechanism.PointI)

    const cosFIE =
      (LengthIF * LengthIF + mechanism.LengthIE * mechanism.LengthIE - frontColumn * frontColumn) /
      (2 * LengthIF * mechanism.LengthIE)

    const AngleFIE = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cosFIE, -1, 1)))

    mechanism.PointE = mechanism.rockPoint(
      mechanism.PointI,
      mechanism.PointF,
      -AngleFIE,
      mechanism.LengthIE
    )

    mechanism.PointG = mechanism.rockPoint(
      mechanism.PointI,
      mechanism.PointE,
      mechanism.AngleEIG,
      mechanism.LengthIG
    )

    mechanism.updatePoint()
  }

  // ====================================================
  // 顶梁角度 => 液压缸长度
  // ====================================================

  function rodTopBeamAngleToHydraulicLength(rodAngle, topBeamAngle) {
    mechanism.calculatePointI(rodAngle)

    const vectorDI = mechanism.PointI.clone().sub(mechanism.PointD)

    const frontReverse = mechanism.Front.clone().negate().normalize()

    const AngleDIE =
      THREE.MathUtils.radToDeg(vectorDI.normalize().angleTo(frontReverse)) +
      mechanism.InitAngleIE_Horizontal +
      topBeamAngle

    mechanism.PointE = mechanism.rockPoint(
      mechanism.PointI,
      mechanism.PointD,
      -AngleDIE,
      mechanism.LengthIE
    )

    mechanism.LengthEF = mechanism.PointE.distanceTo(mechanism.PointF)

    mechanism.PointG = mechanism.rockPoint(
      mechanism.PointI,
      mechanism.PointE,
      mechanism.AngleEIG,
      mechanism.LengthIG
    )

    mechanism.updatePoint()

    if (mechanism.debugMove) {
      console.log('rodTopBeamAngleToHydraulicLength：', {
        rodAngle,
        topBeamAngle,
        LengthEF: Number(mechanism.LengthEF.toFixed(6)),
      })
    }

    if (mechanism.updateLooks) {
      mechanism.updateLooks()
    }

    return mechanism.LengthEF
  }

  // ====================================================
  // 打印顶梁角度和油缸长度范围
  // ====================================================

  function printRodTopBeamLengthRange(options = {}) {
    const rodAngleStart = options.rodAngleStart ?? -20
    const rodAngleEnd = options.rodAngleEnd ?? 20
    const rodAngleStep = options.rodAngleStep ?? 5
    const topBeamAngleStart = options.topBeamAngleStart ?? -20
    const topBeamAngleEnd = options.topBeamAngleEnd ?? 20
    const topBeamAngleStep = options.topBeamAngleStep ?? 5
    const shouldRestore = options.restore ?? true

    if (rodAngleStep <= 0 || topBeamAngleStep <= 0) {
      console.warn('角度步长必须大于 0。', { rodAngleStep, topBeamAngleStep })
      return {
        rows: [],
        min: null,
        max: null,
      }
    }

    const savedState = saveCurrentState()
    const rows = []
    let minRow = null
    let maxRow = null

    for (let rodAngle = rodAngleStart; rodAngle <= rodAngleEnd; rodAngle += rodAngleStep) {
      for (
        let topBeamAngle = topBeamAngleStart;
        topBeamAngle <= topBeamAngleEnd;
        topBeamAngle += topBeamAngleStep
      ) {
        const length = mechanism.rodTopBeamAngleToHydraulicLength(rodAngle, topBeamAngle)
        const row = {
          rodAngle,
          topBeamAngle,
          length: Number(length.toFixed(4)),
        }

        rows.push(row)

        if (!minRow || row.length < minRow.length) {
          minRow = row
        }

        if (!maxRow || row.length > maxRow.length) {
          maxRow = row
        }
      }
    }

    if (shouldRestore) {
      restoreCurrentState(savedState)
    }

    console.table(rows)
    console.log('rodTopBeamAngleToHydraulicLength 长度范围：', {
      min: minRow,
      max: maxRow,
      count: rows.length,
    })

    return {
      rows,
      min: minRow,
      max: maxRow,
    }
  }

  function saveCurrentState() {
    return {
      points: {
        PointC: mechanism.PointC.clone(),
        PointD: mechanism.PointD.clone(),
        PointE: mechanism.PointE.clone(),
        PointG: mechanism.PointG.clone(),
        PointI: mechanism.PointI.clone(),
      },
      values: {
        AngleDAB: mechanism.AngleDAB,
        AngleDBA: mechanism.AngleDBA,
        LengthBD: mechanism.LengthBD,
        AngleDBC: mechanism.AngleDBC,
        AngleABC: mechanism.AngleABC,
        LengthEF: mechanism.LengthEF,
      },
      objects: [
        mechanism.backColumnSlidingShaft,
        mechanism.frontColumnSlidingShaft,
        mechanism.crankMiddelSliding,
        mechanism.crankAfterSliding,
      ]
        .filter(Boolean)
        .map((object3D) => ({
          object3D,
          position: object3D.position.clone(),
        })),
    }
  }

  function restoreCurrentState(savedState) {
    Object.assign(mechanism, savedState.points, savedState.values)

    savedState.objects.forEach(({ object3D, position }) => {
      object3D.position.copy(position)
      object3D.updateMatrix()
      object3D.updateWorldMatrix(true, true)
    })
  }

  // ====================================================
  // 更新模型位置
  // ====================================================

  function updatePoint() {
    setWorldPosition(mechanism.backColumnSlidingShaft, mechanism.PointG)
    setWorldPosition(mechanism.frontColumnSlidingShaft, mechanism.PointE)
    setWorldPosition(mechanism.crankMiddelSliding, mechanism.PointD)
    setWorldPosition(mechanism.crankAfterSliding, mechanism.PointC)
  }

  return mechanism
}
