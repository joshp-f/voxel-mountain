
const canvas = document.getElementById("glcanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext("webgl");

if (!gl) {
    alert("WebGL not supported!");
    throw new Error("WebGL not supported");
}

const ext = gl.getExtension('ANGLE_instanced_arrays');
if (!ext) {
    alert('Instancing not supported!');
    throw new Error('Instancing not supported');
}

const vertexShaderSource = `
attribute vec3 aPosition;
attribute vec3 aInstancePosition;
attribute vec3 aInstanceColor;
attribute float aInstanceScale; // New attribute for per-instance scale

uniform mat4 uProjection;
uniform mat4 uView;

varying vec3 vColor;

void main() {
  // Apply scale to base vertex position, then add instance offset
  vec3 scaledPosition = aPosition * aInstanceScale;
  gl_Position = uProjection * uView * vec4(scaledPosition + aInstancePosition, 1.0);
  vColor = aInstanceColor;
}
`;

const fragmentShaderSource = `
precision mediump float;
varying vec3 vColor;

void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;

let cameraPos = [0, 2, 5];
let cameraFront = [0, 0, -1];
let cameraUp = [0, 1, 0];

let yaw = -90;
let pitch = 0;

let keys = {};
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

    const front = [
        Math.cos(radYaw) * Math.cos(radPitch),
        Math.sin(radPitch),
        Math.sin(radYaw) * Math.cos(radPitch)
    ];
    cameraFront = normalize(front);
});

document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function updateCamera(deltaTime) {
    const speed = 50 * deltaTime;
    const forward = normalize([...cameraFront]);
    const worldUp = [0, 1, 0];
    const right = normalize(cross(forward, worldUp));
    const up = normalize(cross(right, forward));

    if (keys["w"]) cameraPos = add(cameraPos, scale(forward, speed));
    if (keys["s"]) cameraPos = add(cameraPos, scale(forward, -speed));
    if (keys["a"]) cameraPos = add(cameraPos, scale(right, -speed));
    if (keys["d"]) cameraPos = add(cameraPos, scale(right, speed));
    if (keys[" "]) cameraPos = add(cameraPos, scale([0, 1, 0], speed));
    if (keys["shift"]) cameraPos = add(cameraPos, scale([0, 1, 0], -speed));
}

function normalize(v) {
    const len = Math.hypot(...v);
    if (len === 0) return [0, 0, 0];
    return v.map(x => x / len);
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function add(a, b) {
    return a.map((v, i) => v + b[i]);
}

function scale(v, s) {
    return v.map(x => x * s);
}

function dot(a, b) {
    return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function Elevation(x, z) {
  const bigMtn2048Magnitude = (Math.max(0.5, noise.simplex2(x / 32768, z / 32768)) - 0.5) * 2;
  const Mtn1024Magnitude = (Math.max(0.5, noise.simplex2(x / 16384, z / 16384)) - 0.5) * 2;
  const smallMtn512Magnitude = (Math.max(0.5, noise.simplex2(x / 8192, z / 8192)) - 0.5) * 2;
  const bigHill256Magnitude = (Math.max(0.5, noise.simplex2(x / 4096, z / 4096)) - 0.5) * 2;
  const footHill128Magnitude = (Math.max(0.5, noise.simplex2(x / 2048, z / 2048)) - 0.5) * 2;
  const hills64Presense = Math.max(0, noise.simplex2(x / 1024, z / 1024));
  let hills64Magnitude = ((noise.simplex2(x / 256, z / 256) + 1) / 2) * hills64Presense * 2;
  let height = hills64Magnitude * 64 + footHill128Magnitude * 256 + bigHill256Magnitude * 512 +
               smallMtn512Magnitude * 1024 + Mtn1024Magnitude * 2048 + bigMtn2048Magnitude * 4096;
  height *= 2;
  if (height > 1000) height *= 1.5;
  return height;
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

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
if (!program) {
    throw new Error("Failed to create shader program");
}
gl.useProgram(program);

const cubeVertices = new Float32Array([
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
]);

const cubeIndices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
]);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

const aPosition = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(aPosition);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

function randomGreen() {
    const min = [0.2, 0.5, 0.2];
    const max = [0.4, 1.0, 0.4];
    return min.map((v, i) => v + Math.random() * (max[i] - v));
}

function cubeDist(x,z) {
    return Math.max(Math.abs(x),Math.abs(z));
}

const voxels = [];
const size = 500;
for (let x = -size; x < size; x++) {
    for (let z = -size; z < size; z++) {
        const dist = cubeDist(x,z);
        const distMult = 2**(Math.floor(dist/100));
        const realX = x*distMult;
        const realZ = z*distMult;
        voxels.push({ x:realX, y: Elevation(realX,realZ), z:realZ, color: randomGreen(), scale: distMult });
    }
}
const numInstances = voxels.length;
console.log("Number of voxels:", numInstances);

const instancePositions = new Float32Array(numInstances * 3);
const instanceColors = new Float32Array(numInstances * 3);
const instanceScales = new Float32Array(numInstances); // New buffer for scales

voxels.forEach((voxel, i) => {
    instancePositions[i * 3 + 0] = voxel.x;
    instancePositions[i * 3 + 1] = voxel.y;
    instancePositions[i * 3 + 2] = voxel.z;

    instanceColors[i * 3 + 0] = voxel.color[0];
    instanceColors[i * 3 + 1] = voxel.color[1];
    instanceColors[i * 3 + 2] = voxel.color[2];

    instanceScales[i] = voxel.scale;
});

const instancePositionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, instancePositions, gl.STATIC_DRAW);

const instanceColorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, instanceColors, gl.STATIC_DRAW);

const instanceScaleBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
gl.bufferData(gl.ARRAY_BUFFER, instanceScales, gl.STATIC_DRAW);

const aInstancePosition = gl.getAttribLocation(program, "aInstancePosition");
const aInstanceColor = gl.getAttribLocation(program, "aInstanceColor");
const aInstanceScale = gl.getAttribLocation(program, "aInstanceScale");

gl.enableVertexAttribArray(aInstancePosition);
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aInstancePosition, 1);

gl.enableVertexAttribArray(aInstanceColor);
gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
gl.vertexAttribPointer(aInstanceColor, 3, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aInstanceColor, 1);

gl.enableVertexAttribArray(aInstanceScale);
gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aInstanceScale, 1);

const uProjection = gl.getUniformLocation(program, "uProjection");
const uView = gl.getUniformLocation(program, "uView");

const aspect = canvas.width / canvas.height;
// Far needs to be 50KM
const projMatrix = perspective(Math.PI / 3, aspect, 0.1, 50000);
gl.uniformMatrix4fv(uProjection, false, projMatrix);

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
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aPosition, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
    gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstancePosition, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
    gl.vertexAttribPointer(aInstanceColor, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstanceColor, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
    gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstanceScale, 1);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    ext.drawElementsInstancedANGLE(
        gl.TRIANGLES,
        cubeIndices.length,
        gl.UNSIGNED_SHORT,
        0,
        numInstances
    );

    requestAnimationFrame(draw);
}

draw();