import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

export interface OrbSceneApi {
  rotateBy(deltaTheta: number, deltaPhi: number): void;
  zoomBy(factor: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  setActivity(level: number): void;
  dispose(): void;
}

const HOME_POSITION = new THREE.Vector3(0, 0.3, 5.0);
const MIN_DISTANCE = 0.6;
const MAX_DISTANCE = 40;

export function createOrbScene(container: HTMLElement): OrbSceneApi {
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
  camera.position.copy(HOME_POSITION);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    2.2,
    0.45,
    0.15,
  );
  composer.addPass(bloom);

  const chromaticShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uIntensity: { value: 0.0025 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 dir = vUv - vec2(0.5);
        float d = length(dir);
        float offset = uIntensity * d;
        float flicker = 1.0 + 0.015 * sin(uTime * 24.0) * sin(uTime * 6.1);
        vec4 cr = texture2D(tDiffuse, vUv + dir * offset);
        vec4 cg = texture2D(tDiffuse, vUv);
        vec4 cb = texture2D(tDiffuse, vUv - dir * offset * 0.5);
        gl_FragColor = vec4(cr.r * 0.9, cg.g * 1.02, cb.b * 1.15, 1.0) * flicker;
      }
    `,
  };
  const chromaticPass = new ShaderPass(chromaticShader);
  composer.addPass(chromaticPass);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.zoomSpeed = 1.4;
  controls.enablePan = false;

  const C_HOT = 0xffffff;
  const C_BRIGHT = 0x8fd8ff;
  const C_MID = 0x4aa8ff;
  const C_DIM = 0x1f5fbf;

  const orbGroup = new THREE.Group();
  scene.add(orbGroup);

  function lineMat(color: number, opacity = 1) {
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const A = 1.7;
  const SEGS = 240;

  function lemniscatePoints(a: number, zAmp: number, zFreq: number, phase: number) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SEGS; i++) {
      const t = (i / SEGS) * Math.PI * 2;
      const x = a * Math.cos(t);
      const y = a * Math.sin(t) * Math.cos(t);
      const z = zAmp * Math.sin(t * zFreq + phase);
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }

  interface StrandDrift {
    baseRotZ: number;
    phase: number;
    driftSpeed: number;
  }

  const infinityGroup = new THREE.Group();
  const STRAND_COUNT = 48;
  for (let i = 0; i < STRAND_COUNT; i++) {
    const jitterA = A * (0.9 + Math.random() * 0.18);
    const zAmp = 0.04 + Math.random() * 0.18;
    const zFreq = 1 + Math.floor(Math.random() * 2);
    const phase = Math.random() * Math.PI * 2;
    const baseRotZ = (Math.random() - 0.5) * 0.22;

    const pts = lemniscatePoints(jitterA, zAmp, zFreq, phase);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);

    const roll = Math.random();
    const color = roll > 0.85 ? C_HOT : roll > 0.5 ? C_BRIGHT : roll > 0.2 ? C_MID : C_DIM;
    const opacity = roll > 0.85 ? 0.55 + Math.random() * 0.3 : 0.12 + Math.random() * 0.28;

    const line = new THREE.Line(geo, lineMat(color, opacity));
    line.rotation.z = baseRotZ;
    line.userData = {
      baseRotZ,
      phase,
      driftSpeed: 0.05 + Math.random() * 0.1,
    } satisfies StrandDrift;
    infinityGroup.add(line);
  }
  orbGroup.add(infinityGroup);

  const coreSphereMat = new THREE.MeshBasicMaterial({
    color: C_HOT,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
  });
  const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 24), coreSphereMat);
  orbGroup.add(coreSphere);

  const glowSphereMat = new THREE.MeshBasicMaterial({
    color: C_BRIGHT,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
  });
  const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 24), glowSphereMat);
  orbGroup.add(glowSphere);

  const dustCount = 900;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const rr = 0.6 + Math.pow(Math.random(), 0.6) * 4.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    dustPos[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    dustPos[i * 3 + 1] = rr * Math.cos(phi) * 0.6;
    dustPos[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dustPos, 3));

  const dotC = document.createElement("canvas");
  dotC.width = dotC.height = 64;
  const dCtx = dotC.getContext("2d")!;
  const g = dCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(200,230,255,1)");
  g.addColorStop(0.25, "rgba(120,180,255,0.55)");
  g.addColorStop(0.55, "rgba(40,100,220,0.15)");
  g.addColorStop(1, "rgba(10,40,100,0)");
  dCtx.fillStyle = g;
  dCtx.fillRect(0, 0, 64, 64);

  const dustMat = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(dotC),
    size: 0.035,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    color: C_BRIGHT,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  orbGroup.add(dustPoints);

  const haloGeo = new THREE.RingGeometry(A * 0.95, A * 1.02, 128);
  const haloMat = new THREE.MeshBasicMaterial({
    color: C_BRIGHT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  orbGroup.add(halo);

  const sphericalScratch = new THREE.Spherical();
  const offsetScratch = new THREE.Vector3();

  function rotateBy(deltaTheta: number, deltaPhi: number) {
    offsetScratch.copy(camera.position).sub(controls.target);
    sphericalScratch.setFromVector3(offsetScratch);
    sphericalScratch.theta -= deltaTheta;
    sphericalScratch.phi = THREE.MathUtils.clamp(
      sphericalScratch.phi - deltaPhi,
      0.05,
      Math.PI - 0.05,
    );
    sphericalScratch.makeSafe();
    offsetScratch.setFromSpherical(sphericalScratch);
    camera.position.copy(controls.target).add(offsetScratch);
    camera.lookAt(controls.target);
  }

  function zoomBy(factor: number) {
    offsetScratch.copy(camera.position).sub(controls.target);
    const dist = THREE.MathUtils.clamp(
      offsetScratch.length() * factor,
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
    offsetScratch.setLength(dist);
    camera.position.copy(controls.target).add(offsetScratch);
  }

  function resetView() {
    camera.position.copy(HOME_POSITION);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    controls.update();
  }

  const clock = new THREE.Clock();
  let rafId = 0;
  let disposed = false;
  let activity = 0;
  let activityTarget = 0;

  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    orbGroup.rotation.y = Math.sin(t * 0.15) * 0.35;
    orbGroup.rotation.x = Math.sin(t * 0.1) * 0.12;

    infinityGroup.children.forEach((line) => {
      const u = line.userData as StrandDrift;
      line.rotation.z = u.baseRotZ + Math.sin(t * u.driftSpeed + u.phase) * 0.06;
    });

    const breathe = 0.5 + 0.5 * Math.sin(t * 1.4);
    const surge = activity * (0.6 + 0.4 * Math.sin(t * 5));
    const coreScale = 1 + surge * 1.4 + breathe * 0.08;
    coreSphere.scale.setScalar(coreScale);
    coreSphereMat.opacity = Math.min(1, 0.35 + breathe * 0.15 + surge * 0.5);

    glowSphere.scale.setScalar(1 + surge * 1.1 + breathe * 0.1);
    glowSphereMat.opacity = Math.min(0.6, 0.1 + breathe * 0.05 + surge * 0.35);

    const haloScale = 1 + surge * 0.5;
    halo.scale.setScalar(haloScale);
    haloMat.opacity = Math.max(0, surge * 0.35 - 0.05);

    dustPoints.rotation.y += 0.0003;

    activity += (activityTarget - activity) * 0.08;
    const activityBloom = activity * 1.6;
    bloom.strength = 2.0 + Math.sin(t * 0.6) * 0.2 + activityBloom;

    chromaticPass.uniforms.uTime.value = t;

    controls.update();
    composer.render();
  }

  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    controls.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const anyMat = mat as THREE.Material & { map?: THREE.Texture };
        anyMat.map?.dispose();
        mat.dispose();
      }
    });
    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  function setActivity(level: number) {
    activityTarget = Math.max(0, Math.min(1, level));
  }

  return {
    rotateBy,
    zoomBy,
    zoomIn: () => zoomBy(0.65),
    zoomOut: () => zoomBy(1.55),
    resetView,
    setActivity,
    dispose,
  };
}