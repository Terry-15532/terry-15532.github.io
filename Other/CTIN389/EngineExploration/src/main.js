import { buildLevel, sizeFactor } from './levels.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// 1. 场景：所有三维物体和灯光的容器。
const scene = new THREE.Scene();
scene.background = new THREE.Color('#eaf8fa');

// 2. 透视相机：参数分别是视野角度、宽高比、近裁剪面、远裁剪面。
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
const initialCameraPosition = new THREE.Vector3(0, 14, -22);
camera.position.copy(initialCameraPosition);
camera.lookAt(0, 0, 0);

// 3. 渲染器：把相机看到的场景绘制到 canvas。
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 环境补光：预计算室内环境贴图，给球体、墙和地面提供柔和的间接光。
const roomEnvironment = new RoomEnvironment();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const environmentTarget = pmremGenerator.fromScene(roomEnvironment);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = 0.4;
roomEnvironment.dispose();
pmremGenerator.dispose();

// 场景物体：球体、地面和带窄出口的围墙。
const ballGeometry = new THREE.SphereGeometry(1, 32, 16);

const ballMaterial = new THREE.MeshStandardMaterial({
  color: '#e1e5e8',
  roughness: 0.38,
  metalness: 1,
  envMap: environmentTarget.texture,
  envMapIntensity: 0.72,
});

const wallMaterial = new THREE.MeshStandardMaterial({
  color: '#76b7b3',
  roughness: 0.82,
  metalness: 0.0,
});

let levelNumber = 1;
const levelCount = 4;
let level = buildLevel(levelNumber, scene, wallMaterial);

const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
const floorMaterial = new THREE.MeshStandardMaterial({
  color: '#c2e7e1',
  roughness: 0.92,
  metalness: 0.0,
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1;
floor.receiveShadow = true;
scene.add(floor);

// 柔和反射：覆盖整片地板并根据观察角度增强菲涅尔反射。
const reflectionTextureSize = 1024;
const reflectionBlurRadius = 2;
const floorMirrorGeometry = new THREE.PlaneGeometry(1000, 1000);
const roughReflectionShader = {
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    texelSize: { value: new THREE.Vector2(1 / reflectionTextureSize, 1 / reflectionTextureSize) },
    blurRadius: { value: reflectionBlurRadius },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorldPosition;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform vec2 texelSize;
    uniform float blurRadius;
    varying vec4 vUv;
    varying vec3 vWorldPosition;

    #include <logdepthbuf_pars_fragment>

    void main() {
      #include <logdepthbuf_fragment>

      vec2 uv = vUv.xy / vUv.w;
      vec3 reflection = vec3(0.0);
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          float weightX = (x == 0 ? 6.0 : (abs(x) == 1 ? 4.0 : 1.0));
          float weightY = (y == 0 ? 6.0 : (abs(y) == 1 ? 4.0 : 1.0));
          vec2 offset = vec2(float(x), float(y)) * texelSize * blurRadius;
          reflection += texture2D(tDiffuse, uv + offset).rgb * weightX * weightY;
        }
      }
      reflection /= 256.0;

      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float normalViewDot = abs(dot(viewDirection, vec3(0.0, 1.0, 0.0)));
      float fresnel = 0.04 + 0.96 * pow(1.0 - normalViewDot, 5.0);
      float reflectionStrength = mix(0.1, 0.6, fresnel);
      gl_FragColor = vec4(mix(reflection, color, 0.08), reflectionStrength);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};
const floorMirror = new Reflector(floorMirrorGeometry, {
  clipBias: 0.003,
  textureWidth: reflectionTextureSize,
  textureHeight: reflectionTextureSize,
  color: '#b7ddd8',
  multisample: 4,
  shader: roughReflectionShader,
});
floorMirror.material.transparent = true;
floorMirror.material.depthWrite = false;
floorMirror.rotation.x = -Math.PI / 2;
floorMirror.position.y = -0.995;
scene.add(floorMirror);

const ball = new THREE.Mesh(ballGeometry, ballMaterial);
ball.castShadow = true;
scene.add(ball);

// 灯光与阴影：冷色天空光配合略带暖色的平行光。
scene.add(new THREE.HemisphereLight('#e9fbff', '#a8d1ca', 0.9));
const light = new THREE.DirectionalLight('#fff8eb', 1.8);
light.position.set(4, 6, 5);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
light.shadow.camera.left = -10;
light.shadow.camera.right = 10;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 30;
light.shadow.bias = -0.0002;
light.shadow.normalBias = 0.02;
scene.add(light);

// 摄像机控制：鼠标拖动旋转视角。
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 10;
controls.maxDistance = 50;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI / 2;
controls.update();

const pressedKeys = new Set();
const heldSkipKeys = new Set();
const movement = new THREE.Vector2();
const velocity = new THREE.Vector2();
const cameraForward = new THREE.Vector3();
const transitionOverlay = document.querySelector('#transition-overlay');
const victoryMenu = document.querySelector('#victory-menu');
const resetButton = document.querySelector('#reset-button');
const nextLevelButton = document.querySelector('#next-level-button');
const movementAcceleration = 18;
const maximumSpeed = 5;

const hud = document.querySelector('#level-status');
const impactCooldownDuration = 0.25;
const transitionDuration = 0.65;
let impactCooldown = 0;
let impactCount = 0;
let gameState = 'playing';
let transitionPhase = null;
let transitionElapsed = 0;

// 游戏重置：恢复球体、摄像机和移动状态。
function resetGame() {
  level.dispose();
  level = buildLevel(levelNumber, scene, wallMaterial);
  gameState = 'playing';
  impactCount = 0;
  impactCooldown = 0;
  velocity.set(0, 0);
  pressedKeys.clear();
  ball.visible = true;
  ball.scale.setScalar(1);
  ball.position.set(-level.spawn[0], 0, -level.spawn[1]);
  controls.maxDistance = Math.max(50,initialCameraPosition.length()*cameraScale()*1.2);
  controls.target.set(0, 0, 0);
  camera.position.copy(initialCameraPosition).multiplyScalar(cameraScale());
  camera.lookAt(0, 0, 0);
  controls.update();
}

// 输入控制：WASD / 方向键控制球体。
function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (key === '6' || key === '7') {
    heldSkipKeys.add(key);
    if (heldSkipKeys.has('6') && heldSkipKeys.has('7')) {
      event.preventDefault();
      if (!event.repeat) skipLevel();
    }
  }
  if (key === 'r' && !event.repeat && gameState === 'playing' && !transitionPhase) resetGame();
  if (gameState === 'playing'
    && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  pressedKeys.delete(key);
  heldSkipKeys.delete(key);
}

function clearPressedKeys() {
  pressedKeys.clear();
  heldSkipKeys.clear();
}

function skipLevel() {
  if (gameState !== 'playing' || transitionPhase !== null) return;
  beginTransition('won');
}

// 胜利菜单：进入下一关；全部通关后从第一关重来。
function resetFromVictory() {
  resetGame();
  victoryMenu.hidden = true;
  transitionOverlay.setAttribute('aria-hidden', 'true');
  transitionOverlay.style.backgroundColor = '#fff';
  transitionOverlay.style.opacity = '1';
  transitionPhase = 'white-out';
  transitionElapsed = 0;
}

function onNextLevelClick(event) {
  event.preventDefault();
  levelNumber++;
  resetFromVictory();
}

function onResetClick(event) {
  event.preventDefault();
  levelNumber = 1;
  resetFromVictory();
}

resetButton.addEventListener('click', onResetClick);
nextLevelButton.addEventListener('click', onNextLevelClick);

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', clearPressedKeys);

// 碰撞与失败判定：受击缩小，达到次数上限后开始黑屏重置转场。
// Brian MacIntosh, Metal Impact Sounds (CC0): https://opengameart.org/content/metal-impact-sounds
const impactSound = new Audio(new URL('../assets/audio/bing1.wav', import.meta.url));
impactSound.preload = 'auto';
impactSound.volume = 0.18;

// 胜利音效：来自 https://www.bilibili.com/video/BV1ECaN6cEuo 的前 1 秒。
const victorySound = new Audio(new URL('../assets/audio/victory.mp3', import.meta.url));
victorySound.preload = 'auto';

function shrinkAfterImpact() {
  if (impactCooldown > 0 || gameState !== 'playing') return;

  impactCooldown = impactCooldownDuration;
  impactCount += 1;
  impactSound.currentTime = 0;
  impactSound.play().catch(() => {});
  ball.scale.multiplyScalar(sizeFactor);
  ball.position.y = -1 + ballGeometry.parameters.radius * ball.scale.y;

  if (impactCount >= 5) {
    gameState = 'lost';
    ball.visible = false;
    velocity.set(0, 0);
    pressedKeys.clear();
    beginTransition('lost');
  }
}

// 移动与碰撞检测：按摄像机水平朝向移动，并判断墙体和出口碰撞。
function updatePlayer(delta) {
  if (gameState !== 'playing') return;

  const inputX = Number(pressedKeys.has('d') || pressedKeys.has('arrowright'))
    - Number(pressedKeys.has('a') || pressedKeys.has('arrowleft'));
  const inputForward = Number(pressedKeys.has('w') || pressedKeys.has('arrowup'))
    - Number(pressedKeys.has('s') || pressedKeys.has('arrowdown'));

  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  cameraForward.normalize();
  movement.set(
    -cameraForward.z * inputX + cameraForward.x * inputForward,
    cameraForward.x * inputX + cameraForward.z * inputForward,
  );
  if (movement.lengthSq() > 0) movement.normalize();

  velocity.addScaledVector(movement, movementAcceleration * delta);
  velocity.multiplyScalar(Math.exp(-2.2 * delta));
  if (velocity.length() > maximumSpeed) velocity.setLength(maximumSpeed);

  const steps = Math.max(1, Math.ceil(delta * 120));
  const dt = delta / steps;
  for (let i = 0; i < steps && gameState === 'playing'; i++) {
    level.advance(dt);
    ball.position.x += velocity.x * dt;
    ball.position.z += velocity.y * dt;
    if (level.collide(ball,velocity)) shrinkAfterImpact();
    const message = level.press(ball,impactCount);
    const status = message || ('Level ' + levelNumber + ' / ' + levelCount);
    if (hud.textContent !== status) hud.textContent = status;
    if (gameState === 'playing' && level.escaped(ball)) beginTransition('won');
  }
}

// 胜负转场：成功停留在白屏菜单，失败在黑屏下重置。
function beginTransition(result) {
  gameState = result;
  transitionPhase = result === 'won' ? 'white-in' : 'black-in';
  transitionElapsed = 0;
  if (result === 'won') {
    victorySound.currentTime = 0;
    victorySound.play().catch(() => {});
  }
}

function resetUnderBlack() {
  transitionOverlay.style.backgroundColor = '#000';
  transitionOverlay.style.opacity = '1';
  resetGame();
  transitionPhase = 'black-out';
  transitionElapsed = 0;
}

function resetUnderWhite() {
  transitionOverlay.style.backgroundColor = '#fff';
  transitionOverlay.style.opacity = '1';
  transitionOverlay.setAttribute('aria-hidden', 'false');
  const isLastLevel = levelNumber === levelCount;
  resetButton.style.display = isLastLevel ? '' : 'none';
  nextLevelButton.style.display = isLastLevel ? 'none' : '';
  victoryMenu.hidden = false;
  transitionPhase = null;
}

function updateTransition(delta) {
  if (transitionPhase === null) return;

  transitionElapsed += delta;
  const progress = Math.min(transitionElapsed / transitionDuration, 1);

  if (transitionPhase === 'white-in') {
    transitionOverlay.style.backgroundColor = '#fff';
    transitionOverlay.style.opacity = String(progress);
    if (progress >= 1) {
      resetUnderWhite();
    }
  } else if (transitionPhase === 'white-out') {
    transitionOverlay.style.backgroundColor = '#fff';
    transitionOverlay.style.opacity = String(1 - progress);
    if (progress >= 1) {
      transitionOverlay.style.opacity = '0';
      transitionPhase = null;
      transitionOverlay.setAttribute('aria-hidden', 'true');
    }
  } else if (transitionPhase === 'black-in') {
    transitionOverlay.style.backgroundColor = '#000';
    transitionOverlay.style.opacity = String(progress);
    if (progress >= 1) resetUnderBlack();
  } else if (transitionPhase === 'black-out') {
    transitionOverlay.style.backgroundColor = '#000';
    transitionOverlay.style.opacity = String(1 - progress);
    if (progress >= 1) {
      transitionOverlay.style.opacity = '0';
      transitionPhase = null;
    }
  }
}

// 画布适配：窗口尺寸变化时更新相机比例和渲染尺寸。
function cameraScale() {
  return Math.max(1,level.extent[1]/7,level.extent[0]/(8*camera.aspect));
}
function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  controls.maxDistance = Math.max(50,initialCameraPosition.length()*cameraScale()*1.2);
  camera.position.copy(initialCameraPosition).multiplyScalar(cameraScale());
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize);
resize();

// 主循环：更新镜头阻尼、玩家移动、转场和场景渲染。
let previousFrameTime;
renderer.setAnimationLoop((time) => {
  const delta = previousFrameTime === undefined
    ? 0
    : Math.min((time - previousFrameTime) / 1000, 0.05);
  previousFrameTime = time;
  impactCooldown = Math.max(0, impactCooldown - delta);
  if (transitionPhase === null && gameState === 'playing') controls.update();
  updatePlayer(delta);
  updateTransition(delta);
  renderer.render(scene, camera);
});
