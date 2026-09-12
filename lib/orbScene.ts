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

const HOME_POSITION = new THREE.Vector3(0, 1.6, 5.4);
const MIN_DISTANCE = 0.8;
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
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 2.0, 0.5, 0.12);
  composer.addPass(bloom);

  const chromaticShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uIntensity: { value: 0.002 },
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
        float flicker = 1.0 + 0.012 * sin(uTime * 20.0) * sin(uTime * 5.3);
        vec4 cr = texture2D(tDiffuse, vUv + dir * offset);
        vec4 cg = texture2D(tDiffuse, vUv);
        vec4 cb = texture2D(tDiffuse, vUv - dir * offset * 0.5);
        gl_FragColor = vec4(cr.r * 1.05, cg.g * 1.0, cb.b * 0.85, 1.0) * flicker;
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

  const orbGroup = new THREE.Group();
  scene.add(orbGroup);

  const HORIZON_R = 0.85;
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const horizon = new THREE.Mesh(new THREE.SphereGeometry(HORIZON_R, 48, 48), horizonMat);
  orbGroup.add(horizon);

  const ringCanvas = document.createElement("canvas");
  ringCanvas.width = ringCanvas.height = 256;
  const ringCtx = ringCanvas.getContext("2d")!;
  const ringGrad = ringCtx.createRadialGradient(128, 128, 60, 128, 128, 128);
  ringGrad.addColorStop(0, "rgba(255,255,255,0)");
  ringGrad.addColorStop(0.62, "rgba(255,255,255,0)");
  ringGrad.addColorStop(0.72, "rgba(255,240,220,0.9)");
  ringGrad.addColorStop(0.82, "rgba(255,180,110,0.5)");
  ringGrad.addColorStop(1, "rgba(255,140,60,0)");
  ringCtx.fillStyle = ringGrad;
  ringCtx.fillRect(0, 0, 256, 256);
  const ringTex = new THREE.CanvasTexture(ringCanvas);

  const ringSpriteMat = new THREE.SpriteMaterial({
    map: ringTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringSprite = new THREE.Sprite(ringSpriteMat);
  ringSprite.scale.set(HORIZON_R * 3.4, HORIZON_R * 3.4, 1);
  orbGroup.add(ringSprite);

  const DISK_INNER = HORIZON_R * 1.15;
  const DISK_OUTER = HORIZON_R * 3.8;
  const PARTICLE_COUNT = 3200;

  const diskRadius = new Float32Array(PARTICLE_COUNT);
  const diskAngle = new Float32Array(PARTICLE_COUNT);
  const diskY = new Float32Array(PARTICLE_COUNT);
  const diskSpeed = new Float32Array(PARTICLE_COUNT);
  const diskPositions = new Float32Array(PARTICLE_COUNT * 3);
  const diskColors = new Float32Array(PARTICLE_COUNT * 3);

  const HOT = new THREE.Color(0xffffff);
  const MID = new THREE.Color(0xffcc77);
  const COOL = new THREE.Color(0xaa3a10);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const rNorm = Math.pow(Math.random(), 1.8);
    const r = DISK_INNER + rNorm * (DISK_OUTER - DISK_INNER);
    diskRadius[i] = r;
    diskAngle[i] = Math.random() * Math.PI * 2;
    const thickness = 0.06 * (1 - rNorm * 0.7);
    diskY[i] = (Math.random() - 0.5) * thickness;
    diskSpeed[i] = 1.1 / Math.sqrt(r / DISK_INNER);

    const t = rNorm;
    const col = t < 0.5 ? HOT.clone().lerp(MID, t * 2) : MID.clone().lerp(COOL, (t - 0.5) * 2);
    diskColors[i * 3] = col.r;
    diskColors[i * 3 + 1] = col.g;
    diskColors[i * 3 + 2] = col.b;
  }

  const diskGeo = new THREE.BufferGeometry();
  diskGeo.setAttribute("position", new THREE.BufferAttribute(diskPositions, 3));
  diskGeo.setAttribute("color", new THREE.BufferAttribute(diskColors, 3));

  const dotC = document.createElement("canvas");
  dotC.width = dotC.height = 64;
  const dCtx = dotC.getContext("2d")!;
  const g = dCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,220,180,0.8)");
  g.addColorStop(0.6, "rgba(255,150,80,0.25)");
  g.addColorStop(1, "rgba(255,100,40,0)");
  dCtx.fillStyle = g;
  dCtx.fillRect(0, 0, 64, 64);
  const dotTex = new THREE.CanvasTexture(dotC);

  const diskMat = new THREE.PointsMaterial({
    map: dotTex,
    size: 0.045,
    transparent: true,
    opacity: 0.85,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const diskPoints = new THREE.Points(diskGeo, diskMat);
  orbGroup.add(diskPoints);

  interface ArcStrand {
    baseAngle: number;
    radius: number;
    length: number;
    speed: number;
  }
  const arcGroup = new THREE.Group();
  const ARC_COUNT = 14;
  for (let i = 0; i < ARC_COUNT; i++) {
    const radius = DISK_INNER + Math.random() * (DISK_OUTER - DISK_INNER);
    const length = 0.6 + Math.random() * 1.8;
    const segs = 60;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * length;
      pts.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: Math.random() > 0.5 ? 0xffe6c2 : 0xffa64d,
      transparent: true,
      opacity: 0.15 + Math.random() * 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.userData = {
      baseAngle: Math.random() * Math.PI * 2,
      radius,
      length,
      speed: 1.1 / Math.sqrt(radius / DISK_INNER),
    } satisfies ArcStrand;
    line.rotation.y = line.userData.baseAngle as number;
    arcGroup.add(line);
  }
  orbGroup.add(arcGroup);

  orbGroup.rotation.x = 0.28;

  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const rr = 6 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = rr * Math.cos(phi);
    starPos[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.02,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  scene.add(starPoints);

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

    activity += (activityTarget - activity) * 0.08;
    const speedMul = 1 + activity * 1.8;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = diskRadius[i];
      const a = diskAngle[i] + t * diskSpeed[i] * speedMul;
      diskPositions[i * 3] = r * Math.cos(a);
      diskPositions[i * 3 + 1] = diskY[i];
      diskPositions[i * 3 + 2] = r * Math.sin(a);
    }
    diskGeo.attributes.position.needsUpdate = true;
    diskMat.opacity = 0.75 + activity * 0.2;

    arcGroup.children.forEach((line) => {
      const u = line.userData as ArcStrand;
      line.rotation.y = u.baseAngle + t * u.speed * speedMul;
    });

    const breathe = 0.5 + 0.5 * Math.sin(t * 1.2);
    const ringScale = HORIZON_R * (3.2 + breathe * 0.15 + activity * 0.6);
    ringSprite.scale.set(ringScale, ringScale, 1);
    ringSpriteMat.opacity = 0.7 + breathe * 0.1 + activity * 0.3;

    starPoints.rotation.y += 0.00015;

    bloom.strength = 1.9 + Math.sin(t * 0.5) * 0.15 + activity * 1.3;

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