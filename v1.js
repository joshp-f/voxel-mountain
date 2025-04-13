const canvas = document.getElementById("glcanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext("webgl");

if (!gl) {
    alert("WebGL not supported!");
    throw new Error("WebGL not supported");
}

// --- Get Instancing Extension ---
const ext = gl.getExtension('ANGLE_instanced_arrays');
if (!ext) {
    alert('Instancing not supported!');
    throw new Error('Instancing not supported');
}

// --- Modified Shaders for Instancing ---
const vertexShaderSource = `
attribute vec3 aPosition;      // Base cube vertex position
attribute vec3 aInstancePosition; // Per-instance offset (voxel position)
attribute vec3 aInstanceColor;    // Per-instance color

uniform mat4 uProjection;
uniform mat4 uView;
// No uModel needed per instance anymore

varying vec3 vColor; // Pass color to fragment shader

void main() {
  // Calculate final position: base vertex + instance offset, then apply view/projection
  gl_Position = uProjection * uView * vec4(aPosition + aInstancePosition, 1.0);
  vColor = aInstanceColor; // Pass the instance color along
}
`;

const fragmentShaderSource = `
precision mediump float;
varying vec3 vColor; // Receive color from vertex shader

void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;

// --- Camera and Controls (Mostly Unchanged) ---
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
    pitch = Math.max(-89, Math.min(89, pitch)); // Clamp pitch

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
    const speed = 5 * deltaTime;
    // Ensure cameraFront is normalized before calculating right vector
    const forward = normalize([...cameraFront]); // Use normalized front
    const worldUp = [0, 1, 0];
    const right = normalize(cross(forward, worldUp));
    const up = normalize(cross(right, forward)); // Recalculate actual 'up' based on front/right

    // Movement is relative to the camera's orientation
    if (keys["w"]) cameraPos = add(cameraPos, scale(forward, speed));
    if (keys["s"]) cameraPos = add(cameraPos, scale(forward, -speed));
    if (keys["a"]) cameraPos = add(cameraPos, scale(right, -speed));
    if (keys["d"]) cameraPos = add(cameraPos, scale(right, speed));
    // Use world up for flying controls
    if (keys[" "]) cameraPos = add(cameraPos, scale([0, 1, 0], speed)); // Fly up
    if (keys["shift"]) cameraPos = add(cameraPos, scale([0, 1, 0], -speed)); // Fly down
}

// --- Math Utilities (Unchanged, but ensure dot is defined) ---
function normalize(v) {
    const len = Math.hypot(...v);
    if (len === 0) return [0, 0, 0]; // Prevent division by zero
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

function dot(a, b) { // Make sure dot product function is defined
    return a.reduce((sum, v, i) => sum + v * b[i], 0);
}


function lookAt(eye, center, up) {
    const f = normalize([center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]]);
    const s = normalize(cross(f, up));
    const u = cross(s, f);

    // Make sure dot is defined and available
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
        0, 0, (near + far) * rangeInv, -1, // Adjusted based on standard perspective matrices
        0, 0, near * far * rangeInv * 2, 0 // Adjusted based on standard perspective matrices
    ];
}

// --- Shader Program Setup (Unchanged) ---
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
    // Detach shaders after successful linking (optional but good practice)
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

// --- Cube Geometry (Base Shape - Unchanged) ---
const cubeVertices = new Float32Array([
    // Front face
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back face
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    // Top face
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right face
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // Left face
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
]);

const cubeIndices = new Uint16Array([
    0, 1, 2, 0, 2, 3, // front
    4, 5, 6, 4, 6, 7, // back
    8, 9, 10, 8, 10, 11, // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
]);

// --- Setup Buffers for Base Cube ---
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

// Get attribute location for base vertex positions
const aPosition = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(aPosition);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Re-bind position buffer
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

// --- Create Voxel Data (Instances) ---
function randomGreen() {
    const min = [0.2, 0.5, 0.2]; // darker green
    const max = [0.4, 1.0, 0.4]; // brighter green
    return min.map((v, i) => v + Math.random() * (max[i] - v));
}

const voxels = [];
// Can render 4000000 blocks performantly
const size = 1000; // Render area size (adjust as needed, 500x500 = 250k)
for (let x = -size; x < size; x++) {
    for (let z = -size; z < size; z++) {
        voxels.push({ x, y: 0, z, color: randomGreen() });
    }
}
const numInstances = voxels.length;
console.log("Number of voxels:", numInstances);

// --- Prepare Instance Data Buffers ---
const instancePositions = new Float32Array(numInstances * 3);
const instanceColors = new Float32Array(numInstances * 3);

voxels.forEach((voxel, i) => {
    instancePositions[i * 3 + 0] = voxel.x;
    instancePositions[i * 3 + 1] = voxel.y;
    instancePositions[i * 3 + 2] = voxel.z;

    instanceColors[i * 3 + 0] = voxel.color[0];
    instanceColors[i * 3 + 1] = voxel.color[1];
    instanceColors[i * 3 + 2] = voxel.color[2];
});

// Create and fill buffer for instance positions
const instancePositionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, instancePositions, gl.STATIC_DRAW); // Use STATIC_DRAW if positions don't change often

// Create and fill buffer for instance colors
const instanceColorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, instanceColors, gl.STATIC_DRAW); // Use STATIC_DRAW if colors don't change often


// --- Setup Instance Attributes ---
// Get attribute locations for instance data
const aInstancePosition = gl.getAttribLocation(program, "aInstancePosition");
const aInstanceColor = gl.getAttribLocation(program, "aInstanceColor");

// Setup aInstancePosition
gl.enableVertexAttribArray(aInstancePosition);
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer); // Use instance position buffer
gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0); // 3 floats per instance
ext.vertexAttribDivisorANGLE(aInstancePosition, 1); // Tell WebGL this is per-instance data

// Setup aInstanceColor
gl.enableVertexAttribArray(aInstanceColor);
gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer); // Use instance color buffer
gl.vertexAttribPointer(aInstanceColor, 3, gl.FLOAT, false, 0, 0); // 3 floats per instance
ext.vertexAttribDivisorANGLE(aInstanceColor, 1); // Tell WebGL this is per-instance data


// --- Set unchanging Uniforms ---
const uProjection = gl.getUniformLocation(program, "uProjection");
const uView = gl.getUniformLocation(program, "uView");

const aspect = canvas.width / canvas.height;
// Correct FoV to radians if needed, perspective function expects radians
const projMatrix = perspective(Math.PI / 3, aspect, 0.1, 1000); // Increased far plane for large world
gl.uniformMatrix4fv(uProjection, false, projMatrix);


// --- Render Loop ---
let lastTime = 0;
function draw(now = 0) {
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    updateCamera(deltaTime);

    // Calculate view matrix once per frame
    const center = add(cameraPos, cameraFront);
    const viewMatrix = lookAt(cameraPos, center, cameraUp);
    gl.uniformMatrix4fv(uView, false, viewMatrix); // Update view matrix uniform

    // --- Clear and Prepare ---
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height); // Ensure viewport is set

    // --- Bind Buffers needed for the draw call ---
    // Base geometry attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aPosition, 0); // Ensure divisor is 0 for per-vertex attributes

    // Instance position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
    gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstancePosition, 1); // Divisor 1 for per-instance

    // Instance color attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
    gl.vertexAttribPointer(aInstanceColor, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstanceColor, 1); // Divisor 1 for per-instance

    // Bind the index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    // --- THE IMPORTANT PART: Draw all instances at once! ---
    ext.drawElementsInstancedANGLE(
        gl.TRIANGLES,           // Primitive type
        cubeIndices.length,     // Count (number of indices)
        gl.UNSIGNED_SHORT,      // Type of indices
        0,                      // Offset in index buffer
        numInstances            // Number of instances to draw
    );

    requestAnimationFrame(draw);
}

// Start the render loop
draw();