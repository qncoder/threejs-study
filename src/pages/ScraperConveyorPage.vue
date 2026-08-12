<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const SEGMENT_COUNT = 120
const SEGMENT_LENGTH = 1.2
const SPRING_STIFFNESS = 120
const DAMPING_COEFFICIENT = 18
const VELOCITY_DAMPING = 0.88
const MAX_LINK_FORCE = 12
const FORCE_SCALE = 0.015

const canvasHost = ref(null)

let scene
let camera
let renderer
let controls
let resizeObserver
let frameId = 0
let positions
let velocities
let segments
let scrapers
let coalParticles
let tensionLine
let segmentMaterial
let simulationTime = 0

onMounted(() => {
  initSimulation()
  frameId = requestAnimationFrame(animate)

  resizeObserver = new ResizeObserver(resizeSimulation)
  resizeObserver.observe(canvasHost.value)
  resizeSimulation()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  controls?.dispose()

  scene?.traverse((object) => {
    if (object.geometry) object.geometry.dispose()
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    }
  })
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  scene?.clear()
})

function initSimulation() {
  positions = new Float32Array(SEGMENT_COUNT * 3)
  velocities = new Float32Array(SEGMENT_COUNT * 3)
  segments = []
  scrapers = []
  coalParticles = []
  simulationTime = 0

  scene = new Scene()
  scene.background = new Color(0x1a1a1a)
  scene.fog = new Fog(0x1a1a1a, 60, 180)

  camera = new PerspectiveCamera(55, 1, 0.1, 300)
  camera.position.set(35, 28, 65)

  renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.target.set((SEGMENT_COUNT * SEGMENT_LENGTH) / 2, 2, 0)

  scene.add(new AmbientLight(0x666666))
  const directionalLight = new DirectionalLight(0xffeecc, 1.3)
  directionalLight.position.set(25, 45, 35)
  scene.add(directionalLight)

  createSupports()
  createChain()
  createScrapers()
  createTensionLine()
  createCoalParticles()

  canvasHost.value.appendChild(renderer.domElement)
}

function createSupports() {
  const supportGeometry = new BoxGeometry(2.5, 18, 3)
  const supportMaterial = new MeshPhongMaterial({ color: 0x555577 })

  for (let index = 0; index < 8; index += 1) {
    const support = new Mesh(supportGeometry, supportMaterial)
    support.position.set(index * 18, 8, -7)
    scene.add(support)
  }
}

function createChain() {
  const segmentGeometry = new BoxGeometry(0.8, 0.45, 0.65)
  segmentMaterial = new MeshPhongMaterial({ color: 0x777777 })

  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    const segment = new Mesh(segmentGeometry, segmentMaterial)
    segments.push(segment)
    scene.add(segment)
    positions[index * 3] = index * SEGMENT_LENGTH
  }
}

function createScrapers() {
  const scraperMaterial = new MeshPhongMaterial({ color: 0xaaaaaa })

  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    const scraper = new Mesh(new BoxGeometry(1.6, 2.3, 0.12), scraperMaterial)
    scraper.rotation.x = Math.PI / 2
    scrapers.push(scraper)
    scene.add(scraper)
  }
}

function createTensionLine() {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array((SEGMENT_COUNT - 1) * 6), 3)
  )
  geometry.setAttribute(
    'color',
    new BufferAttribute(new Float32Array((SEGMENT_COUNT - 1) * 6), 3)
  )

  tensionLine = new LineSegments(
    geometry,
    new LineBasicMaterial({ vertexColors: true, linewidth: 4 })
  )
  scene.add(tensionLine)
}

function createCoalParticles() {
  const coalGeometry = new SphereGeometry(0.35, 8, 8)
  const coalMaterial = new MeshPhongMaterial({ color: 0x3d2b1f })

  for (let index = 0; index < 40; index += 1) {
    const coal = new Mesh(coalGeometry, coalMaterial)
    coal.position.set(
      Math.random() * SEGMENT_COUNT * SEGMENT_LENGTH * 0.6 + 10,
      1.8,
      (Math.random() - 0.5) * 2.5
    )
    coalParticles.push(coal)
    scene.add(coal)
  }
}

function animate() {
  frameId = requestAnimationFrame(animate)
  controls.update()
  simulationTime += 0.018

  const pushIndex = Math.floor(SEGMENT_COUNT * 0.45)
  positions[pushIndex * 3 + 1] = Math.sin(simulationTime * 4.5) * 0.13

  positions[0] = 0
  positions[1] = 0
  positions[2] = 0
  positions[(SEGMENT_COUNT - 1) * 3] = (SEGMENT_COUNT - 1) * SEGMENT_LENGTH

  for (let iteration = 0; iteration < 16; iteration += 1) {
    for (let index = 0; index < SEGMENT_COUNT - 1; index += 1) {
      const current = index * 3
      const next = (index + 1) * 3
      const dx = positions[next] - positions[current]
      const dy = positions[next + 1] - positions[current + 1]
      const dz = positions[next + 2] - positions[current + 2]
      const distance = Math.hypot(dx, dy, dz) || 0.001
      const directionX = dx / distance
      const directionY = dy / distance
      const directionZ = dz / distance
      const springForce = (distance - SEGMENT_LENGTH) * SPRING_STIFFNESS
      const relativeVelocity =
        (velocities[next] - velocities[current]) * directionX +
        (velocities[next + 1] - velocities[current + 1]) * directionY +
        (velocities[next + 2] - velocities[current + 2]) * directionZ
      const unclampedForce = (springForce + relativeVelocity * DAMPING_COEFFICIENT) * FORCE_SCALE
      const totalForce = Math.max(-MAX_LINK_FORCE, Math.min(MAX_LINK_FORCE, unclampedForce))

      velocities[current] += totalForce * directionX * 0.5
      velocities[current + 1] += totalForce * directionY * 0.5
      velocities[current + 2] += totalForce * directionZ * 0.5
      velocities[next] -= totalForce * directionX * 0.5
      velocities[next + 1] -= totalForce * directionY * 0.5
      velocities[next + 2] -= totalForce * directionZ * 0.5
    }
  }

  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    const offset = index * 3
    positions[offset] += velocities[offset] * 0.016
    positions[offset + 1] += velocities[offset + 1] * 0.016
    positions[offset + 2] += velocities[offset + 2] * 0.016
    velocities[offset] *= VELOCITY_DAMPING
    velocities[offset + 1] *= VELOCITY_DAMPING
    velocities[offset + 2] *= VELOCITY_DAMPING
    velocities[offset] = Math.max(-2.5, Math.min(2.5, velocities[offset]))
    velocities[offset + 1] = Math.max(-2.5, Math.min(2.5, velocities[offset + 1]))
    velocities[offset + 2] = Math.max(-2.5, Math.min(2.5, velocities[offset + 2]))

    segments[index].position.set(positions[offset], positions[offset + 1], positions[offset + 2])
    scrapers[index].position.set(
      positions[offset],
      positions[offset + 1] + 1.15,
      positions[offset + 2]
    )
    if (index > 0) {
      scrapers[index].rotation.z = (positions[offset + 1] - positions[offset - 2]) * 1.2
    }
  }

  positions[0] = 0
  positions[1] = 0
  positions[2] = 0
  positions[(SEGMENT_COUNT - 1) * 3] = (SEGMENT_COUNT - 1) * SEGMENT_LENGTH

  updateTensionLine()
  coalParticles.forEach((coal) => {
    coal.position.x += 0.085
    if (coal.position.x > SEGMENT_COUNT * SEGMENT_LENGTH * 0.98) coal.position.x = 8
  })

  renderer.render(scene, camera)
}

function updateTensionLine() {
  const positionAttribute = tensionLine.geometry.attributes.position
  const colorAttribute = tensionLine.geometry.attributes.color

  for (let index = 0; index < SEGMENT_COUNT - 1; index += 1) {
    const offset = index * 3
    const lineOffset = index * 6
    positionAttribute.array[lineOffset] = positions[offset]
    positionAttribute.array[lineOffset + 1] = positions[offset + 1]
    positionAttribute.array[lineOffset + 2] = positions[offset + 2]
    positionAttribute.array[lineOffset + 3] = positions[offset + 3]
    positionAttribute.array[lineOffset + 4] = positions[offset + 4]
    positionAttribute.array[lineOffset + 5] = positions[offset + 5]

    const dx = positions[offset + 3] - positions[offset]
    const dy = positions[offset + 4] - positions[offset + 1]
    const dz = positions[offset + 5] - positions[offset + 2]
    const distance = Math.hypot(dx, dy, dz)
    const intensity = Math.min(Math.abs((distance - SEGMENT_LENGTH) * SPRING_STIFFNESS) / 800, 1)
    const red = intensity
    const green = 1 - intensity * 0.6
    const blue = 1 - intensity

    for (let colorOffset = 0; colorOffset < 6; colorOffset += 3) {
      colorAttribute.array[lineOffset + colorOffset] = red
      colorAttribute.array[lineOffset + colorOffset + 1] = green
      colorAttribute.array[lineOffset + colorOffset + 2] = blue
    }
  }

  positionAttribute.needsUpdate = true
  colorAttribute.needsUpdate = true
}

function resizeSimulation() {
  if (!canvasHost.value || !renderer || !camera) return

  const width = Math.max(canvasHost.value.clientWidth, 1)
  const height = Math.max(canvasHost.value.clientHeight, 1)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}
</script>

<template>
  <main class="scraper-page">
    <header class="scraper-header">
      <div>
        <p class="scraper-eyebrow">机构仿真</p>
        <h1>综采工作面刮板机</h1>
        <p class="scraper-subtitle">Kelvin-Voigt 模型与张力可视化</p>
      </div>
      <RouterLink class="scraper-back-link" to="/">返回编辑器</RouterLink>
    </header>

    <section ref="canvasHost" class="scraper-canvas" aria-label="刮板输送机仿真画布">
      <div class="scraper-info">
        <strong>刮板输送机仿真</strong>
        <span>颜色表示张力：蓝 → 绿 → 黄 → 红</span>
        <span>拖拽观察，中部受煤冲击</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.scraper-page {
  width: 100%;
  height: 100vh;
  min-height: 520px;
  overflow: hidden;
  background: #1a1a1a;
  color: #f8fafc;
}

.scraper-header {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  background: linear-gradient(rgb(13 13 13 / 86%), rgb(13 13 13 / 0%));
  pointer-events: none;
}

.scraper-header > div,
.scraper-back-link {
  pointer-events: auto;
}

.scraper-eyebrow {
  margin: 0 0 5px;
  color: #facc15;
  font-size: 12px;
  font-weight: 700;
}

.scraper-header h1 {
  margin: 0;
  color: #f8fafc;
  font-size: 24px;
  line-height: 1.2;
}

.scraper-subtitle {
  margin: 6px 0 0;
  color: #cbd5e1;
  font-size: 13px;
}

.scraper-back-link {
  margin-top: 2px;
  padding: 8px 12px;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 6px;
  color: #f8fafc;
  background: rgb(15 23 42 / 58%);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.scraper-back-link:hover {
  border-color: #facc15;
  color: #fef08a;
}

.scraper-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
}

.scraper-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.scraper-info {
  position: absolute;
  z-index: 1;
  top: 92px;
  left: 24px;
  display: grid;
  gap: 3px;
  max-width: min(320px, calc(100% - 48px));
  padding: 11px 13px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 6px;
  color: #e2e8f0;
  background: rgb(0 0 0 / 68%);
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
}

.scraper-info strong {
  color: #ffffff;
  font-size: 13px;
}

@media (max-width: 640px) {
  .scraper-header {
    padding: 16px;
  }

  .scraper-header h1 {
    font-size: 20px;
  }

  .scraper-info {
    top: 86px;
    left: 16px;
    max-width: calc(100% - 32px);
  }

  .scraper-back-link {
    padding: 7px 9px;
    font-size: 12px;
  }
}
</style>
