const canvas = document.getElementById("glcanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext("webgl");

if (!gl) {
  alert("WebGL not supported!");
}

// Basic vertex & fragment shader
const vertexShaderSource = `
attribute vec4 aPosition;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
void main() {
  gl_Position = uProjection * uView * uModel * aPosition;
}
`;

const fragmentShaderSource = `
precision mediump float;
uniform vec3 uColor;

void main() {
  gl_FragColor = vec4(uColor, 1.0);
}
`;

let cameraPos = [0, 2, 5];
let cameraFront = [0, 0, -1];
let cameraUp = [0, 1, 0];

let yaw = -90;
let pitch = 0;

let keys = {};
let lastMouseX, lastMouseY;
let firstMouse = true;

canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
canvas.onclick = () => canvas.requestPointerLock();

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;

  const sensitivity = 0.1;
  const dx = e.movementX * sensitivity;
  const dy = e.movementY * sensitivity;

  yaw += dx;
  pitch -= dy;
  pitch = Math.max(-89, Math.min(89, pitch));

  const radYaw = yaw * Math.PI / 180;
  const radPitch = pitch * Math.PI / 180;

  cameraFront = [
    Math.cos(radYaw) * Math.cos(radPitch),
    Math.sin(radPitch),
    Math.sin(radYaw) * Math.cos(radPitch)
  ];

  normalize(cameraFront);
});

document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function updateCamera(deltaTime) {
  const speed = 5 * deltaTime;
  const forward = normalize([...cameraFront]);
  const right = normalize(cross(forward, cameraUp));
  const up = [0, 1, 0];

  if (keys["w"]) cameraPos = add(cameraPos, scale(forward, speed));
  if (keys["s"]) cameraPos = add(cameraPos, scale(forward, -speed));
  if (keys["a"]) cameraPos = add(cameraPos, scale(right, -speed));
  if (keys["d"]) cameraPos = add(cameraPos, scale(right, speed));
  if (keys[" "]) cameraPos = add(cameraPos, scale(up, speed));
  if (keys["shift"]) cameraPos = add(cameraPos, scale(up, -speed));
}

function normalize(v) {
    const len = Math.hypot(...v);
    return v.map(x => x / len);
  }
  
  function cross(a, b) {
    return [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
  }
  
  function add(a, b) {
    return a.map((v, i) => v + b[i]);
  }
  
  function scale(v, s) {
    return v.map(x => x * s);
  }
  
  function lookAt(eye, center, up) {
    const f = normalize([center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]]);
    const s = normalize(cross(f, up));
    const u = cross(s, f);
  
    return [
      s[0], u[0], -f[0], 0,
      s[1], u[1], -f[1], 0,
      s[2], u[2], -f[2], 0,
      -dot(s, eye), -dot(u, eye), dot(f, eye), 1
    ];
  }
  
  function dot(a, b) {
    return a.reduce((sum, v, i) => sum + v * b[i], 0);
  }
  

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
const uColor = gl.getUniformLocation(program, "uColor");
gl.useProgram(program);

// Cube (voxel) vertices
const cubeVertices = new Float32Array([
  // Front
  -0.5, -0.5,  0.5,
   0.5, -0.5,  0.5,
   0.5,  0.5,  0.5,
  -0.5,  0.5,  0.5,
  // Back
  -0.5, -0.5, -0.5,
   0.5, -0.5, -0.5,
   0.5,  0.5, -0.5,
  -0.5,  0.5, -0.5,
]);

const cubeIndices = new Uint16Array([
  // front
  0, 1, 2, 0, 2, 3,
  // top
  3, 2, 6, 3, 6, 7,
  // back
  7, 6, 5, 7, 5, 4,
  // bottom
  4, 5, 1, 4, 1, 0,
  // left
  4, 0, 3, 4, 3, 7,
  // right
  1, 5, 6, 1, 6, 2,
]);

// Setup buffers
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

const aPosition = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

// Simple matrix utilities (for MVP matrix)
function identity() {
  return [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];
}

function perspective(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov / 2);
  const rangeInv = 1 / (near - far);

  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0
  ];
}

function translation(tx, ty, tz) {
  const m = identity();
  m[12] = tx;
  m[13] = ty;
  m[14] = tz;
  return m;
}

// Set uniforms
const uProjection = gl.getUniformLocation(program, "uProjection");
const uView = gl.getUniformLocation(program, "uView");
const uModel = gl.getUniformLocation(program, "uModel");

const aspect = canvas.width / canvas.height;
const projMatrix = perspective(Math.PI / 3, aspect, 0.1, 100);
const viewMatrix = translation(0, -2, -10);

gl.uniformMatrix4fv(uProjection, false, projMatrix);
gl.uniformMatrix4fv(uView, false, viewMatrix);

// Create a grid of voxels
function randomGreen() {
  const min = [0.2, 0.5, 0.2]; // darker green
  const max = [0.4, 1.0, 0.4]; // brighter green
  return min.map((v, i) => v + Math.random() * (max[i] - v));
}

const voxels = [];
const size = 500/2;
for (let x = -size; x <= size; x++) {
  for (let z = -size; z <= size; z++) {
    voxels.push({ x, y: 0, z, color: randomGreen() });
  }
}
console.log(voxels.length);

let lastTime = 0;
function draw(now = 0) {
  const deltaTime = (now - lastTime) / 1000;
  lastTime = now;

  updateCamera(deltaTime);

  const center = add(cameraPos, cameraFront);
  const viewMatrix = lookAt(cameraPos, center, cameraUp);
  gl.uniformMatrix4fv(uView, false, viewMatrix);

  gl.clearColor(0.1, 0.1, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  for (const voxel of voxels) {
    const modelMatrix = translation(voxel.x, voxel.y, voxel.z);
    gl.uniformMatrix4fv(uModel, false, modelMatrix);
    gl.uniform3fv(uColor, voxel.color);
    gl.drawElements(gl.TRIANGLES, cubeIndices.length, gl.UNSIGNED_SHORT, 0);
  }

  requestAnimationFrame(draw);
}
draw();

