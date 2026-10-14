<template>
  <div ref="containerRef" class="three-hero" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Three.js 首屏 3D 场景：
 * 漂浮的字母立方体粒子 + 星点背景 + 鼠标视差，为首页提供科技感视觉锚点。
 */
const containerRef = ref<HTMLElement | null>(null);

let renderer: any;
let scene: any;
let camera: any;
let raf = 0;
let disposeFns: Array<() => void> = [];
let THREE_MODULE: any;

onMounted(async () => {
  const container = containerRef.value;
  if (!container) return;

  // 按需加载，避免影响首屏体积
  const THREE = await import('three');
  THREE_MODULE = THREE;

  const width = container.clientWidth;
  const height = container.clientHeight;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0f1b2d, 8, 26);

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.set(0, 0, 9);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  /* ---------------- 字母立方体群 ---------------- */
  const group = new THREE.Group();
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const cubeGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);

  const letterTextures = glyphs.map((g) => makeLetterTexture(THREE, g));

  const cubes: any[] = [];
  for (let i = 0; i < 42; i++) {
    const tex = letterTextures[i % letterTextures.length];
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color(0x2f74ff),
      emissiveIntensity: 0.16,
    });
    const cube = new THREE.Mesh(cubeGeo, mat);
    cube.position.set(
      (Math.random() - 0.5) * 13,
      (Math.random() - 0.5) * 7.5,
      (Math.random() - 0.5) * 9,
    );
    cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    cube.userData = {
      speed: 0.0035 + Math.random() * 0.006,
      floatAmp: 0.25 + Math.random() * 0.4,
      floatSpeed: 0.4 + Math.random() * 0.8,
      baseY: cube.position.y,
      phase: Math.random() * Math.PI * 2,
    };
    group.add(cube);
    cubes.push(cube);
  }
  scene.add(group);

  /* ---------------- 星点背景 ---------------- */
  const starCount = 900;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = -Math.random() * 35 - 4;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0x9ec3ff,
    size: 0.055,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------------- 灯光 ---------------- */
  const ambient = new THREE.AmbientLight(0xffffff, 1.15);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0x8ebdff, 1.6);
  dir.position.set(4, 6, 8);
  scene.add(dir);
  const point = new THREE.PointLight(0x2f74ff, 22, 30);
  point.position.set(-6, -3, 5);
  scene.add(point);

  /* ---------------- 交互 & 动画 ---------------- */
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  };
  window.addEventListener('pointermove', onPointerMove);
  disposeFns.push(() => window.removeEventListener('pointermove', onPointerMove));

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  disposeFns.push(() => window.removeEventListener('resize', onResize));

  const clock = new THREE.Clock();
  const animate = () => {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    pointer.x += (target.x - pointer.x) * 0.05;
    pointer.y += (target.y - pointer.y) * 0.05;

    camera.position.x = pointer.x * 1.5;
    camera.position.y = -pointer.y * 1.0;
    camera.lookAt(0, 0, 0);

    for (const cube of cubes) {
      const d = cube.userData;
      cube.rotation.x += d.speed;
      cube.rotation.y += d.speed * 1.35;
      cube.position.y = d.baseY + Math.sin(t * d.floatSpeed + d.phase) * d.floatAmp;
    }
    group.rotation.y = Math.sin(t * 0.12) * 0.22;
    stars.rotation.y = t * 0.012;

    renderer.render(scene, camera);
  };
  animate();

  disposeFns.push(() => {
    renderer?.dispose?.();
    cubeGeo?.dispose?.();
    starGeo?.dispose?.();
    starMat?.dispose?.();
    letterTextures.forEach((tx: any) => tx.dispose?.());
    cubes.forEach((c: any) => c.material?.dispose?.());
    if (renderer?.domElement?.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  });
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
  disposeFns.forEach((fn) => fn());
  disposeFns = [];
});

/** 用 Canvas 画一个字母贴图 */
function makeLetterTexture(THREE: any, letter: string) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#1a2c4a');
  grad.addColorStop(1, '#0f1b2d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(142,189,255,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  ctx.fillStyle = '#cfe3ff';
  ctx.font = 'bold 74px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, size / 2, size / 2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
</script>

<style scoped>
.three-hero {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
</style>
