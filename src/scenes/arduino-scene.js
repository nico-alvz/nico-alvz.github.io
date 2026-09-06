import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { parseProgram } from "./arduino-parser.js";

const BUTTONS = [
  { name: "Amarelo-material", color: 0xf4c542, pin: 2 },
  { name: "Azul_Servo_005-material", color: 0x3d7fe0, pin: 3 },
  { name: "verde_002-material", color: 0x3fae6a, pin: 4 },
  { name: "vermelho-material_1", color: 0xe34b4b, pin: 5 },
];

const LED_NAME_RE = /^vidro_00[2-5]-material$/;

const CALIBRATE = new URLSearchParams(location.search).has("calibrate");
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initArduinoScene(canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  camera.position.set(0.5, 0.4, 0.58);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-2, 1, 1.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x2a3aff, 0.25);
  rim.position.set(-2, -1, -2);
  scene.add(rim);

  const rig = new THREE.Group();
  scene.add(rig);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const buttonMeshes = [];
  const pinToButton = {};
  const pinToLed = {};
  const boardMeshes = [];
  let pressedButton = null;
  let activeProgram = null;

  function render() {
    renderer.render(scene, camera);
  }

  function setPointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickButton(event) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(buttonMeshes, false);
    return hits.length ? hits[0].object : null;
  }

  function setLedOn(led, on) {
    led.userData.isOn = on;
    const mat = led.material;
    mat.emissive.set(led.userData.color);
    mat.emissiveIntensity = on ? 3.8 : 0.05;
    if (led.userData.light) {
      led.userData.light.intensity = on ? 0.7 : 0;
    }
  }

  function runOps(ops) {
    ops.forEach((op) => {
      const led = pinToLed[op.pin];
      if (!led) return;
      if (op.type === "write") setLedOn(led, op.value);
      else if (op.type === "toggle") setLedOn(led, !led.userData.isOn);
    });
    render();
  }

  function runInterrupt(pin, pressPhase) {
    if (!activeProgram) return false;
    const binding = activeProgram.interrupts[pin];
    if (!binding) return false;
    const fires =
      (pressPhase && (binding.edge === "FALLING" || binding.edge === "CHANGE")) ||
      (!pressPhase && (binding.edge === "RISING" || binding.edge === "CHANGE"));
    if (!fires) return true;
    const ops = activeProgram.handlers[binding.handler];
    if (ops) runOps(ops);
    return true;
  }

  function applyProgram(program) {
    stopIdleDemo();
    activeProgram = program;
    Object.keys(pinToLed).forEach((pin) => setLedOn(pinToLed[pin], false));
    runOps(program.setupWrites);
  }

  // Mimics the TX/RX LEDs blinking on a real board while a sketch flashes in.
  function flashUpload() {
    const steps = [1, 0, 1, 0, 1, 0];
    steps.forEach((on, i) => {
      setTimeout(() => {
        boardMeshes.forEach((mesh) => {
          mesh.material.emissive.setHex(0xff1a1a);
          mesh.material.emissiveIntensity = on ? 2.6 : 0;
        });
        render();
      }, i * 120);
    });
  }

  function verify(source) {
    return parseProgram(source);
  }

  function upload(source) {
    const result = parseProgram(source);
    if (result.ok) {
      applyProgram(result);
      flashUpload();
    }
    return result;
  }

  // Idle demo: cycles through the buttons on its own, lighting each LED in
  // turn as if toggled by software, so the board reads as alive even before
  // anyone touches it. Runs forever alongside real clicks.
  let idleTimer = null;

  function simulatedPress(button) {
    const led = button.userData.led;
    if (led) setLedOn(led, true);
    render();
    idleTimer = setTimeout(() => {
      if (led) setLedOn(led, false);
      render();
    }, 380);
  }

  function startIdleDemo() {
    let index = 0;
    function cycle() {
      simulatedPress(buttonMeshes[index % buttonMeshes.length]);
      index++;
      idleTimer = setTimeout(cycle, 900);
    }
    idleTimer = setTimeout(cycle, 700);
  }

  function stopIdleDemo() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  // Drag-to-orient state. In calibrate mode this rotates the rig live and
  // logs the final values so we can bake them in as defaults, then drop
  // ?calibrate=1 to go back to the static, non-draggable view.
  let dragging = false;
  let dragMoved = false;
  let dragStart = { x: 0, y: 0 };
  let rigStartRotation = { x: 0, y: 0 };

  function logCalibration() {
    console.warn(
      "ARDUINO_CALIBRATE:" +
        JSON.stringify({
          rigRotationX: +rig.rotation.x.toFixed(3),
          rigRotationY: +rig.rotation.y.toFixed(3),
          cameraPosition: camera.position.toArray().map((n) => +n.toFixed(3)),
        })
    );
  }

  function onPointerDown(event) {
    if (CALIBRATE) {
      event.preventDefault();
      dragging = true;
      dragMoved = false;
      dragStart = { x: event.clientX, y: event.clientY };
      rigStartRotation = { x: rig.rotation.x, y: rig.rotation.y };
      return;
    }
    const button = pickButton(event);
    if (!button) return;
    pressedButton = button;
    if (activeProgram) runInterrupt(button.userData.pin, true);
  }

  function onPointerMove(event) {
    if (!CALIBRATE || !dragging) return;
    event.preventDefault();
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    rig.rotation.y = rigStartRotation.y + dx * 0.012;
    rig.rotation.x = rigStartRotation.x + dy * 0.025;
    render();
  }

  function onPointerUp(event) {
    if (CALIBRATE) {
      if (dragging && dragMoved) logCalibration();
      dragging = false;
      return;
    }
    if (!pressedButton) return;
    const button = pressedButton;
    pressedButton = null;
    if (activeProgram) {
      runInterrupt(button.userData.pin, false);
      return;
    }
    const led = button.userData.led;
    if (led) setLedOn(led, !led.userData.isOn);
    render();
  }

  function onWheel(event) {
    if (!CALIBRATE) return;
    event.preventDefault();
    const dir = camera.position.clone().normalize();
    const dist = THREE.MathUtils.clamp(camera.position.length() * (1 + event.deltaY * 0.001), 0.15, 3);
    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0, 0, 0);
    render();
    logCalibration();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  if (CALIBRATE) {
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.style.touchAction = "none";
    console.warn("ARDUINO_CALIBRATE_MODE_ON: arrastra para rotar, scroll para zoom");
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    "/models/arduino.glb",
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.roughness = 0.6;
          child.material.metalness = 0.05;
        }
      });

      if (window.__DEBUG_ARDUINO__) {
        const rows = [];
        model.traverse((child) => {
          if (child.isMesh) {
            const box = new THREE.Box3().setFromObject(child);
            const s = new THREE.Vector3();
            box.getSize(s);
            const p = new THREE.Vector3();
            child.getWorldPosition(p);
            rows.push({
              name: child.name,
              type: child.type,
              material: child.material?.name,
              x: p.x.toFixed(3),
              y: p.y.toFixed(3),
              z: p.z.toFixed(3),
              sx: s.x.toFixed(3),
              sy: s.y.toFixed(3),
              sz: s.z.toFixed(3),
            });
          }
        });
        console.warn("ARDUINO_DEBUG_DUMP:" + JSON.stringify(rows));
      }

      // Fix orientation first so the bounding box we measure next matches
      // what's actually rendered — centering before rotating throws it off.
      model.rotation.x = -Math.PI / 2.6;
      model.rotation.z = Math.PI / 8;

      // Frame on the board + breadboard, not the full model: long trailing
      // wires skew a whole-model bbox far from where the eye actually looks.
      const ANCHOR_NAMES = ["PCB_topo_001-material", "PCB_BASE_001-material", "Protoboard_003-material"];
      const anchors = ANCHOR_NAMES.map((n) => model.getObjectByName(n)).filter(Boolean);
      const box = new THREE.Box3();
      if (anchors.length) {
        anchors.forEach((mesh) => box.expandByObject(mesh));
        box.expandByScalar(0.02);
      } else {
        box.setFromObject(model);
      }
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 0.44 / maxDim;

      model.scale.setScalar(scale);
      model.position.set(0, 0, 0);
      model.position.sub(center.clone().multiplyScalar(scale));
      rig.add(model);

      if (!CALIBRATE) {
        rig.rotation.x = -0.783;
        rig.rotation.y = 3.282;
        camera.position.set(0.807, 0.646, 0.936);
        camera.lookAt(0, 0, 0);
        // nudge the subject toward camera-right so it fills more of its frame
        const forward = new THREE.Vector3().sub(camera.position).normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        rig.position.add(right.multiplyScalar(0.022));
      }

      const leds = [];
      model.traverse((child) => {
        if (child.isMesh && LED_NAME_RE.test(child.name)) {
          child.material = child.material.clone();
          leds.push(child);
        }
      });

      // The board's own TX/RX indicator LEDs — a single small lens mesh —
      // are what actually blink on real hardware while a sketch uploads.
      const onboardLed = model.getObjectByName("LED_002-material");
      if (onboardLed) {
        onboardLed.material = onboardLed.material.clone();
        onboardLed.material.emissiveIntensity = 0;
        boardMeshes.push(onboardLed);
      }

      BUTTONS.forEach(({ name, color, pin }) => {
        const button = model.getObjectByName(name);
        if (!button || !leds.length) return;

        button.material = button.material.clone();

        const buttonWorldPos = new THREE.Vector3();
        button.getWorldPosition(buttonWorldPos);
        let nearestLed = leds[0];
        let nearestDist = Infinity;
        leds.forEach((led) => {
          const ledWorldPos = new THREE.Vector3();
          led.getWorldPosition(ledWorldPos);
          const dist = buttonWorldPos.distanceTo(ledWorldPos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestLed = led;
          }
        });

        nearestLed.userData.color = color;
        nearestLed.userData.isOn = false;
        const pointLight = new THREE.PointLight(color, 0, 0.06, 2);
        const ledWorldPos = new THREE.Vector3();
        nearestLed.getWorldPosition(ledWorldPos);
        pointLight.position.copy(rig.worldToLocal(ledWorldPos));
        rig.add(pointLight);
        nearestLed.userData.light = pointLight;
        setLedOn(nearestLed, false);

        button.userData.led = nearestLed;
        button.userData.pin = pin;
        pinToButton[pin] = button;
        pinToLed[pin] = nearestLed;
        buttonMeshes.push(button);
      });

      if (!CALIBRATE && !REDUCE_MOTION && !activeProgram && buttonMeshes.length) startIdleDemo();
      else if (activeProgram) runOps(activeProgram.setupWrites);

      render();
    },
    undefined,
    (error) => {
      console.error("No se pudo cargar el modelo del Arduino:", error);
    }
  );

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }

  const resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => { resize(); render(); }));
  resizeObserver.observe(canvas);

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          resize();
          render();
        }
      });
    },
    { threshold: 0.1 }
  );
  visibilityObserver.observe(canvas);

  return { scene, camera, renderer, verify, upload };
}
