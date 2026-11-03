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
  color: '#bfcdcd',
  roughness: 0.8,
  metalness: 0.02,
});

const wallMaterial = new THREE.MeshStandardMaterial({
  color: '#76b7b3',
  roughness: 0.82,
  metalness: 0.0,
});

const arenaHalfSize = 5;
const wallHeight = 2;
const wallThickness = 0.2;
const exitHalfWidth = 0.55;
const wallGeometries = [];

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

function addWall(width, depth, x, z) {
  const geometry = new THREE.BoxGeometry(width, wallHeight, depth);
  const mesh = new THREE.Mesh(geometry, wallMaterial);
  mesh.position.set(x, 0, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  wallGeometries.push(geometry);
}

// 四面围墙，+Z 侧中央留出唯一出口。
addWall(2 * arenaHalfSize + wallThickness, wallThickness, 0, -arenaHalfSize);
addWall(wallThickness, 2 * arenaHalfSize + wallThickness, -arenaHalfSize, 0);
addWall(wallThickness, 2 * arenaHalfSize + wallThickness, arenaHalfSize, 0);
const wallOuterEdge = arenaHalfSize + wallThickness / 2;
const exitWallSegmentWidth = wallOuterEdge - exitHalfWidth;
const exitWallSegmentX = (wallOuterEdge + exitHalfWidth) / 2;
addWall(exitWallSegmentWidth, wallThickness, -exitWallSegmentX, arenaHalfSize);
addWall(exitWallSegmentWidth, wallThickness, exitWallSegmentX, arenaHalfSize);

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
const movement = new THREE.Vector2();
const velocity = new THREE.Vector2();
const cameraForward = new THREE.Vector3();
const transitionOverlay = document.querySelector('#transition-overlay');
const victoryMenu = document.querySelector('#victory-menu');
const resetButton = document.querySelector('#reset-button');
const nextLevelButton = document.querySelector('#next-level-button');
const movementAcceleration = 18;
const maximumSpeed = 5;
const wallBounce = 0.35;
const impactCooldownDuration = 0.25;
const transitionDuration = 0.65;
let impactCooldown = 0;
let impactCount = 0;
let gameState = 'playing';
let transitionPhase = null;
let transitionElapsed = 0;

// 游戏重置：恢复球体、摄像机和移动状态。
function resetGame() {
  gameState = 'playing';
  impactCount = 0;
  impactCooldown = 0;
  velocity.set(0, 0);
  pressedKeys.clear();
  ball.visible = true;
  ball.scale.setScalar(1);
  ball.position.set(0, 0, 0);
  controls.target.set(0, 0, 0);
  camera.position.copy(initialCameraPosition);
  camera.lookAt(0, 0, 0);
  controls.update();
}

// 输入控制：WASD / 方向键控制球体。
function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (gameState === 'playing'
    && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
}

function onKeyUp(event) {
  pressedKeys.delete(event.key.toLowerCase());
}

function clearPressedKeys() {
  pressedKeys.clear();
}

// 胜利菜单：重置按钮重新开始，下一关暂时保留为空操作。
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
}

resetButton.addEventListener('click', resetFromVictory);
nextLevelButton.addEventListener('click', onNextLevelClick);

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', clearPressedKeys);

// 碰撞与失败判定：受击缩小，达到次数上限后开始黑屏重置转场。
function shrinkAfterImpact() {
  if (impactCooldown > 0 || gameState !== 'playing') return;

  impactCooldown = impactCooldownDuration;
  impactCount += 1;
  ball.scale.multiplyScalar(0.82);
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

  const radius = ballGeometry.parameters.radius * ball.scale.x;
  const nextX = ball.position.x + velocity.x * delta;
  const nextZ = ball.position.z + velocity.y * delta;
  const wallInnerEdge = arenaHalfSize - wallThickness / 2;
  const centerLimit = wallInnerEdge - radius;
  let hitWall = false;

  if (nextX < -centerLimit) {
    ball.position.x = -centerLimit;
    velocity.x = Math.abs(velocity.x) * wallBounce;
    hitWall = true;
  } else if (nextX > centerLimit) {
    ball.position.x = centerLimit;
    velocity.x = -Math.abs(velocity.x) * wallBounce;
    hitWall = true;
  } else {
    ball.position.x = nextX;
  }

  const fitsExit = radius * 2 < exitHalfWidth * 2
    && Math.abs(ball.position.x) + radius < exitHalfWidth;
  if (nextZ > centerLimit && fitsExit) {
    ball.position.z = nextZ;
    if (ball.position.z - radius > wallOuterEdge) {
      gameState = 'won';
      velocity.set(0, 0);
      pressedKeys.clear();
      beginTransition('won');
    }
  } else if (nextZ < -centerLimit) {
    ball.position.z = -centerLimit;
    velocity.y = Math.abs(velocity.y) * wallBounce;
    hitWall = true;
  } else if (nextZ > centerLimit) {
    ball.position.z = centerLimit;
    velocity.y = -Math.abs(velocity.y) * wallBounce;
    hitWall = true;
  } else {
    ball.position.z = nextZ;
  }

  if (hitWall) shrinkAfterImpact();
}

// 胜负转场：成功在白屏下重置，失败在黑屏下重置。
function beginTransition(result) {
  gameState = result;
  transitionPhase = result === 'won' ? 'white-in' : 'black-in';
  transitionElapsed = 0;
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
function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
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
