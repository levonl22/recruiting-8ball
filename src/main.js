import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  Clock,
  DirectionalLight,
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { createStudioEnvironment } from "./environment.js";
import { createEightBall } from "./eightBall.js";
import { Spring3 } from "./physics.js";
import {
  createFortuneTexture,
  createGlowTexture,
  createMarkTexture,
  createTriangleTexture,
  setTextureQuality,
} from "./textures.js";

const FORTUNES = [
  "You will get a good interviewer who guides you and brings out your best.",
  "Your next technical round will go smooth.",
  "A recruiter will reply this week.",
  "Your resume will land in the right hands.",
  "You will ace the behavioral questions.",
  "The system design interview will click.",
  "Someone will speak up for you after the interview.",
  "Your prep will pay off.",
  "A surprising opportunity is closer than it looks.",
  "You will stay calm under the hard follow-up.",
  "Your story will stick with the hiring manager.",
  "The coding problem will play to your strengths.",
  "You will get the clarifying question you need.",
  "A good-fit team is looking for someone like you.",
  "Your LinkedIn outreach will open a door.",
  "You will walk out proud of how you showed up.",
  "An offer is in your near future.",
  "Today's rejection makes room for a better yes.",
];

const SHAKE_MS = 1000;
const ZOOM_MS = 900;
const RESET_MS = 700;
const MOTION_THRESHOLD = 20;
const MOTION_COOLDOWN_MS = 1400;
const DIE_DAMPING = 4.6;
const DRAG_LIMIT = 0.5;

const CAM_IDLE = new Vector3(0, -0.42, 9.3);
const CAM_ZOOM = new Vector3(0, 0, 2.62);

const stage = document.getElementById("stage");
const canvas = document.getElementById("scene");
const liveEl = document.getElementById("live");
const fallbackEl = document.getElementById("fallback");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lastFortuneIndex = -1;

function pickFortune() {
  let index = Math.floor(Math.random() * FORTUNES.length);
  if (index === lastFortuneIndex) index = (index + 1) % FORTUNES.length;
  lastFortuneIndex = index;
  return FORTUNES[index];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function startFallback() {
  stage.hidden = true;
  fallbackEl.hidden = false;

  const output = fallbackEl.querySelector(".fallback-fortune");
  fallbackEl.addEventListener("click", () => {
    output.textContent = pickFortune();
  });
}

async function init() {
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
  } catch {
    startFallback();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  setTextureQuality(renderer);

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // System font fallback is fine.
    }
  }

  const scene = new Scene();
  scene.environment = createStudioEnvironment(renderer);

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.copy(CAM_IDLE);

  const glowTexture = createGlowTexture();
  const ball = createEightBall({
    triangleTexture: createTriangleTexture(),
    markTexture: createMarkTexture("?"),
    glowTexture,
  });
  scene.add(ball.group);

  // Backdrop: the blue pool of light the ball sits in.
  const backdrop = new Mesh(
    new PlaneGeometry(18, 22),
    new ShaderMaterial({
      // Radius is in UV space on an 18x22 plane, so these numbers keep the
      // glow roughly the width of the ball's silhouette instead of the frame.
      uniforms: {
        uCore: { value: new Vector3(0.03, 0.17, 0.62) },
        uMid: { value: new Vector3(0.005, 0.032, 0.14) },
        uEdge: { value: new Vector3(0.0006, 0.0018, 0.0055) },
        uCenter: { value: new Vector2(0.5, 0.5) },
        uRadius: { value: new Vector2(0.115, 0.09) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform vec3 uCore;
        uniform vec3 uMid;
        uniform vec3 uEdge;
        uniform vec2 uCenter;
        uniform vec2 uRadius;
        void main() {
          float r = length((vUv - uCenter) / uRadius);
          vec3 color = mix(uCore, uMid, smoothstep(0.0, 0.95, r));
          color = mix(color, uEdge, smoothstep(0.7, 1.9, r));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false,
    })
  );
  backdrop.position.z = -9;
  scene.add(backdrop);

  // Tight halo hugging the shell, so the silhouette separates from the backdrop.
  const rimGlow = new Mesh(
    new PlaneGeometry(4.4, 4.4),
    new MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  rimGlow.material.color.setRGB(0.06, 0.2, 0.58, LinearSRGBColorSpace);
  rimGlow.position.z = -1.7;
  scene.add(rimGlow);

  const floor = new Mesh(
    new PlaneGeometry(60, 60),
    new MeshStandardMaterial({ color: 0x01030a, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1;
  floor.receiveShadow = true;
  scene.add(floor);

  const floorGlow = new Mesh(
    new PlaneGeometry(6, 6),
    new MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  floorGlow.material.color.setRGB(0.015, 0.07, 0.26, LinearSRGBColorSpace);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, -0.995, -0.4);
  floorGlow.scale.set(1, 0.55, 1);
  scene.add(floorGlow);

  const key = new DirectionalLight(0xe4edff, 1.5);
  key.position.set(-3.4, 5.4, 4.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -2.8;
  key.shadow.camera.right = 2.8;
  key.shadow.camera.top = 2.8;
  key.shadow.camera.bottom = -2.8;
  key.shadow.radius = 4;
  key.shadow.bias = -0.0009;
  scene.add(key);

  // Blue rim comes from the environment map. Point lights here just left two
  // hot specular dots on the silhouette.
  scene.add(new AmbientLight(0x08182f, 0.32));

  const composerTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    samples: window.devicePixelRatio > 1.5 ? 2 : 4,
  });
  const composer = new EffectComposer(renderer, composerTarget);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.3, 0.6, 0.85));
  composer.addPass(new OutputPass());

  // Layout viewport only — visualViewport shrinks while pinch-zooming, which
  // made the stage (and prompt text) get smaller as you zoomed out on Firefox.
  function layoutSize() {
    return {
      width: Math.max(1, document.documentElement.clientWidth || window.innerWidth),
      height: Math.max(1, document.documentElement.clientHeight || window.innerHeight),
    };
  }

  function fitStage(availW, availH) {
    const maxW = Math.min(availW, 430);
    let width = maxW;
    let height = Math.round((width * 16) / 9);
    if (height > availH) {
      height = availH;
      width = Math.max(1, Math.round((height * 9) / 16));
    }
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    return { width, height };
  }

  function resize() {
    const { width: availW, height: availH } = layoutSize();
    const { width, height } = fitStage(availW, availH);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener(
    "gesturestart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  // ---- state ------------------------------------------------------------

  /** @type {"idle" | "busy" | "revealed"} */
  let state = "idle";
  let zoom = 0;
  let lastMotionTrigger = 0;

  const shellPos = new Spring3({ stiffness: 300, damping: 13 });
  const shellRot = new Spring3({ stiffness: 250, damping: 11 });
  const dieRot = new Spring3({ stiffness: 52, damping: DIE_DAMPING });

  const tweens = new Set();

  function tween({ duration, delay = 0, onUpdate, onComplete }) {
    const item = { elapsed: -delay, duration, onUpdate, onComplete };
    tweens.add(item);
    return item;
  }

  function updateTweens(dt) {
    for (const item of tweens) {
      item.elapsed += dt;
      if (item.elapsed < 0) continue;
      const progress = Math.min(1, item.elapsed / item.duration);
      item.onUpdate(easeInOutCubic(progress));
      if (progress >= 1) {
        tweens.delete(item);
        item.onComplete?.();
      }
    }
  }

  function fadeMesh(mesh, to, duration, delay = 0) {
    const from = mesh.material.opacity;
    if (to > 0) mesh.visible = true;
    tween({
      duration: duration / 1000,
      delay: delay / 1000,
      onUpdate: (t) => {
        mesh.material.opacity = from + (to - from) * t;
      },
      onComplete: () => {
        if (to === 0) mesh.visible = false;
      },
    });
  }

  function tweenZoom(to, duration) {
    const from = zoom;
    tween({
      duration: duration / 1000,
      onUpdate: (t) => {
        zoom = from + (to - from) * t;
      },
    });
  }

  function announce(text) {
    liveEl.textContent = text;
    stage.setAttribute(
      "aria-label",
      text ? `Fortune: ${text}. Tap for another.` : "Shake the Magic 8 Ball"
    );
  }

  function shakeSequence() {
    const beats = [
      [-3.6, 1.7],
      [4.0, -1.3],
      [-3.4, -1.6],
      [3.2, 1.5],
      [-2.3, 0.9],
      [1.5, -0.7],
    ];

    beats.forEach(([x, y], index) => {
      setTimeout(() => {
        shellPos.impulse(x * 0.055, y * 0.05, 0);
        shellRot.impulse(y * 0.55, x * 0.62, -x * 0.22);
        dieRot.impulse(y * 2.4, x * 2.6, x * 1.6);
      }, index * 140);
    });
  }

  function applyFortune(text) {
    const previous = ball.words.material.map;
    ball.words.material.map = createFortuneTexture(text);
    ball.words.material.needsUpdate = true;
    previous?.dispose();
    ball.words.material.opacity = 0;
  }

  async function reveal() {
    if (state !== "idle") return;
    state = "busy";
    stage.classList.add("is-active");
    stage.setAttribute("aria-busy", "true");

    const text = pickFortune();
    applyFortune(text);

    if (reduceMotion) {
      tweenZoom(1, 260);
      fadeMesh(ball.mark, 0, 160);
      fadeMesh(ball.words, 1, 220, 120);
      await wait(300);
      state = "revealed";
      stage.setAttribute("aria-busy", "false");
      announce(text);
      return;
    }

    shakeSequence();
    await wait(SHAKE_MS);

    dieRot.damping = 13;
    tweenZoom(1, ZOOM_MS);
    fadeMesh(ball.mark, 0, 380);
    fadeMesh(ball.words, 1, 520, 260);

    await wait(ZOOM_MS);
    state = "revealed";
    stage.setAttribute("aria-busy", "false");
    announce(text);
  }

  async function reset() {
    if (state !== "revealed") return;
    state = "busy";
    stage.setAttribute("aria-busy", "true");

    fadeMesh(ball.words, 0, reduceMotion ? 120 : 280);
    fadeMesh(ball.mark, 1, reduceMotion ? 120 : 420, reduceMotion ? 0 : 220);
    tweenZoom(0, reduceMotion ? 200 : RESET_MS);

    if (!reduceMotion) {
      shellRot.impulse(0.25, -0.4, 0.1);
      dieRot.impulse(0.8, -1.2, 0.4);
    }

    await wait(reduceMotion ? 220 : RESET_MS);

    dieRot.damping = DIE_DAMPING;
    state = "idle";
    stage.classList.remove("is-active");
    stage.setAttribute("aria-busy", "false");
    announce("");
  }

  function activate() {
    if (state === "idle") reveal();
    else if (state === "revealed") reset();
  }

  // ---- input ------------------------------------------------------------

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let travelled = 0;
  let velocityX = 0;
  let velocityY = 0;

  stage.addEventListener("pointerdown", (event) => {
    if (state === "busy") return;
    dragging = true;
    travelled = 0;
    velocityX = 0;
    velocityY = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    travelled += Math.hypot(dx, dy);
    velocityX = dx;
    velocityY = dy;

    if (state !== "idle") return;
    shellRot.value.y = clamp(shellRot.value.y + dx * 0.0045, -DRAG_LIMIT, DRAG_LIMIT);
    shellRot.value.x = clamp(shellRot.value.x + dy * 0.0045, -DRAG_LIMIT, DRAG_LIMIT);
    shellPos.value.x = clamp(shellPos.value.x + dx * 0.0011, -0.18, 0.18);
    shellPos.value.y = clamp(shellPos.value.y - dy * 0.0011, -0.18, 0.18);
    dieRot.impulse(dy * 0.02, dx * 0.02, 0);
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer already released.
    }

    if (state === "idle" && travelled > 12) {
      shellRot.impulse(velocityY * 0.05, velocityX * 0.05, 0);
      dieRot.impulse(velocityY * 0.2, velocityX * 0.2, 0);
    }
    activate();
  }

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", () => {
    dragging = false;
  });

  stage.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });

  function onDeviceMotion(event) {
    const accel = event.accelerationIncludingGravity;
    if (!accel) return;

    const magnitude = Math.hypot(accel.x || 0, accel.y || 0, accel.z || 0);
    if (state === "idle" && magnitude > 12) {
      shellPos.impulse((accel.x || 0) * 0.002, (accel.y || 0) * 0.002, 0);
      dieRot.impulse((accel.y || 0) * 0.05, (accel.x || 0) * 0.05, 0);
    }

    const now = Date.now();
    if (
      state === "idle" &&
      magnitude > MOTION_THRESHOLD &&
      now - lastMotionTrigger > MOTION_COOLDOWN_MS
    ) {
      lastMotionTrigger = now;
      reveal();
    }
  }

  function enableMotion() {
    window.addEventListener("devicemotion", onDeviceMotion, { passive: true });
  }

  const DeviceMotionEventRef = window.DeviceMotionEvent;
  if (typeof DeviceMotionEventRef?.requestPermission === "function") {
    stage.addEventListener(
      "pointerdown",
      async () => {
        try {
          const permission = await DeviceMotionEventRef.requestPermission();
          if (permission === "granted") enableMotion();
        } catch {
          // Tap still works.
        }
      },
      { once: true }
    );
  } else if (DeviceMotionEventRef) {
    enableMotion();
  }

  // ---- loop -------------------------------------------------------------

  const clock = new Clock();
  let elapsed = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    elapsed += dt;

    updateTweens(dt);
    shellPos.update(dt);
    shellRot.update(dt);
    dieRot.update(dt);

    const bob = Math.sin(elapsed * 0.9) * 0.008;
    ball.group.position.set(
      shellPos.value.x,
      shellPos.value.y + bob,
      shellPos.value.z
    );
    ball.group.rotation.set(
      shellRot.value.x,
      shellRot.value.y,
      shellRot.value.z
    );

    const drift = state === "revealed" ? 0 : Math.sin(elapsed * 0.7) * 0.035;
    ball.dieGroup.rotation.set(
      dieRot.value.x,
      dieRot.value.y,
      dieRot.value.z + drift
    );

    camera.position.lerpVectors(CAM_IDLE, CAM_ZOOM, zoom);
    ball.halo.material.opacity = 1 - zoom * 0.35;

    composer.render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function supportsWebGL() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

if (supportsWebGL()) {
  init().catch(() => startFallback());
} else {
  startFallback();
}
