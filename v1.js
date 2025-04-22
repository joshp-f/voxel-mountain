const canvas = document.getElementById("glcanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext("webgl");

const ext = gl.getExtension('ANGLE_instanced_arrays');


const vertexShaderSource = `
attribute vec3 aPosition;
attribute float aFaceIndex; // Index (0-5) to select the correct face color
attribute vec3 aInstancePosition;
attribute vec3 aInstanceColor0; // Color for face 0 (Front)
attribute vec3 aInstanceColor1; // Color for face 1 (Back)
attribute vec3 aInstanceColor2; // Color for face 2 (Top)
attribute vec3 aInstanceColor3; // Color for face 3 (Bottom)
attribute vec3 aInstanceColor4; // Color for face 4 (Right)
attribute vec3 aInstanceColor5; // Color for face 5 (Left)
attribute float aInstanceScale;

uniform mat4 uProjection;
uniform mat4 uView;

varying vec3 vColor;

void main() {
    vec3 scaledPosition = aPosition * aInstanceScale;
    gl_Position = uProjection * uView * vec4(scaledPosition + aInstancePosition, 1.0);

    // Select the face color based on the face index
    if (aFaceIndex < 0.5) { vColor = aInstanceColor0; }
    else if (aFaceIndex < 1.5) { vColor = aInstanceColor1; }
    else if (aFaceIndex < 2.5) { vColor = aInstanceColor2; }
    else if (aFaceIndex < 3.5) { vColor = aInstanceColor3; }
    else if (aFaceIndex < 4.5) { vColor = aInstanceColor4; }
    else { vColor = aInstanceColor5; }
}
`;

const fragmentShaderSource = `
precision mediump float;
varying vec3 vColor;

void main() {
    gl_FragColor = vec4(vColor, 1.0);
}
`;

// --- Camera and Controls (mostly unchanged) ---
let cameraPos = [0, 200, 5];
let cameraFront = [0, 0, -1];
let cameraUp = [0, 1, 0];
let yaw = -90;
let pitch = 0;
let keys = {};
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
    const speed = 500 * deltaTime;
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
// --- End Camera ---

// --- Math Utilities (unchanged) ---
function normalize(v) { const len = Math.hypot(...v); if (len === 0) return [0, 0, 0]; return v.map(x => x / len); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function add(a, b) { return a.map((v, i) => v + b[i]); }
function scale(v, s) { return v.map(x => x * s); }
function dot(a, b) { return a.reduce((sum, v, i) => sum + v * b[i], 0); }

function Elevation(x, z) {
    // Simplified elevation for example, adjust noise parameters as needed
    const scale1 = 1 / 4096, scale2 = 1 / 1024, scale3 = 1 / 256;
    const amp1 = 2000, amp2 = 500, amp3 = 50;

    let height = noise.simplex2(x * scale1, z * scale1) * amp1;
    height += noise.simplex2(x * scale2, z * scale2) * amp2;
    height += noise.simplex2(x * scale3, z * scale3) * amp3;
    return height * Math.max(0, noise.simplex2(x / 8192, z / 8192)); // Add large scale modulation
}
// --- End Noise ---

// --- Matrix Functions (unchanged) ---
function lookAt(eye, center, up) {
    const f = normalize([center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]]);
    const s = normalize(cross(f, up));
    const u = cross(s, f);
    return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, eye), -dot(u, eye), dot(f, eye), 1];
}
function perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2); const rangeInv = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * rangeInv, -1, 0, 0, near * far * rangeInv * 2, 0];
}
// --- End Matrix Functions ---

// --- Shader Compilation (unchanged) ---
function createShader(gl, type, source) {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    return shader;
}
function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource); const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource); if (!vs || !fs) return null;
    const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Program link error:', gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; }
    gl.detachShader(program, vs); gl.detachShader(program, fs); gl.deleteShader(vs); gl.deleteShader(fs); return program;
}
// --- End Shader Compilation ---

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
if (!program) { throw new Error("Failed to create shader program"); }
gl.useProgram(program);

// --- Cube Vertex Data ---
const cubeVertices = new Float32Array([
    // Front face (+Z) (Index 0)
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back face (-Z) (Index 1)
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    // Top face (+Y) (Index 2)
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // Bottom face (-Y) (Index 3)
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right face (+X) (Index 4)
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
    0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // Left face (-X) (Index 5)
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
]);
const CUBE_VERTEX_COUNT = 36;

// --- Create Vertex Position Buffer ---
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
const aPosition = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aPosition, 0); // Position is per-vertex

// --- Create Face Index Buffer ---
const cubeFaceIndices = new Float32Array(CUBE_VERTEX_COUNT);
for (let face = 0; face < 6; ++face) {
    for (let vert = 0; vert < 6; ++vert) {
        cubeFaceIndices[face * 6 + vert] = face; // Assign index 0-5 to vertices of each face
    }
}
const faceIndexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, faceIndexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeFaceIndices, gl.STATIC_DRAW);
const aFaceIndex = gl.getAttribLocation(program, "aFaceIndex");
gl.enableVertexAttribArray(aFaceIndex);
// Bind the buffer before setting the pointer
gl.bindBuffer(gl.ARRAY_BUFFER, faceIndexBuffer);
gl.vertexAttribPointer(aFaceIndex, 1, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aFaceIndex, 0); // Face index is per-vertex

// --- Color Generation ---
const skyColor = [0.53, 0.81, 0.98];

const baseGreen = [0.3, 0.75, 0.3];
const greenFaces = [
    [baseGreen[0] - 0.2, baseGreen[1] + 0.2, baseGreen[2]],
    [baseGreen[0] + 0.2, baseGreen[1] - 0.2, baseGreen[2]],
    [baseGreen[0], baseGreen[1] + 0.2, baseGreen[2] - 0.2],
    [baseGreen[0], baseGreen[1] - 0.2, baseGreen[2] + 0.2],
    [baseGreen[0] + 0.2, baseGreen[1], baseGreen[2] - 0.2],
    [baseGreen[0] - 0.2, baseGreen[1], baseGreen[2] + 0.2],
]
function getColor(x, z, faceIndex) {
    const dist = cubeDist(x, z);
    const green = greenFaces[faceIndex];
    const greenVariance = 0.77;
    const varianceDropedOff = greenVariance * (1 / (dist / 100000 + 1));

    const color = green.map((v, i) => {
        const modifier = (1 + (Math.random() - 0.5) * varianceDropedOff);
        if (x == 0 && z == 0) {
            console.log('modifier', modifier);
        }
        return v * modifier;
    });
    const nonFog = 1 / (dist / 40000 + 1);
    let foggedColor = color.map((c, i) => skyColor[i] * (1 - nonFog) + c * nonFog);
    return foggedColor;
}
function getFaceColors(x, z) {
    const faceColors = [];
    for (let i = 0; i < 6; i++) {
        faceColors.push(getColor(x, z, i));
    }
    return faceColors; // Return array of 6 color vectors [ [r,g,b], [r,g,b], ... ]
}

function cubeDist(x, z) { return Math.max(Math.abs(x), Math.abs(z)); }

// --- Voxel Generation ---
const voxels = [];
const size = 700;
const maxDist = 2 ** (size / 100) * size;
console.log('MaxDist', maxDist);
for (let x = -size; x < size; x++) {
    for (let z = -size; z < size; z++) {
        const dist = cubeDist(x, z);
        const distMult = 2 ** (dist / 100);
        // const distMult = 1;
        const realX = x * distMult;
        const realZ = z * distMult;

        const yPos = Elevation(realX, realZ);
        voxels.push({
            x: realX,
            y: yPos,
            z: realZ,
            faceColors: getFaceColors(realX, realZ), // Store array of 6 colors
            scale: distMult
        });

    }
}
const numInstances = voxels.length;
console.log("Number of voxels:", numInstances);

// --- Instance Data Buffers ---
const instancePositions = new Float32Array(numInstances * 3);
const instanceScales = new Float32Array(numInstances);
// Create arrays for each face color component
const instanceColors0 = new Float32Array(numInstances * 3);
const instanceColors1 = new Float32Array(numInstances * 3);
const instanceColors2 = new Float32Array(numInstances * 3);
const instanceColors3 = new Float32Array(numInstances * 3);
const instanceColors4 = new Float32Array(numInstances * 3);
const instanceColors5 = new Float32Array(numInstances * 3);

voxels.forEach((voxel, i) => {
    instancePositions[i * 3 + 0] = voxel.x;
    instancePositions[i * 3 + 1] = voxel.y;
    instancePositions[i * 3 + 2] = voxel.z;

    instanceScales[i] = voxel.scale;

    // Populate face color arrays
    for (let face = 0; face < 6; face++) {
        const colorArr = [instanceColors0, instanceColors1, instanceColors2, instanceColors3, instanceColors4, instanceColors5][face];
        const color = voxel.faceColors[face];
        colorArr[i * 3 + 0] = color[0];
        colorArr[i * 3 + 1] = color[1];
        colorArr[i * 3 + 2] = color[2];
    }
});

// --- Create Instance Buffers ---
const instancePositionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, instancePositions, gl.STATIC_DRAW);

const instanceScaleBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
gl.bufferData(gl.ARRAY_BUFFER, instanceScales, gl.STATIC_DRAW);

// Function to create and bind an instance color buffer
function createInstanceColorBuffer(gl, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

const instanceColorBuffer0 = createInstanceColorBuffer(gl, instanceColors0);
const instanceColorBuffer1 = createInstanceColorBuffer(gl, instanceColors1);
const instanceColorBuffer2 = createInstanceColorBuffer(gl, instanceColors2);
const instanceColorBuffer3 = createInstanceColorBuffer(gl, instanceColors3);
const instanceColorBuffer4 = createInstanceColorBuffer(gl, instanceColors4);
const instanceColorBuffer5 = createInstanceColorBuffer(gl, instanceColors5);


// --- Get Attribute Locations ---
const aInstancePosition = gl.getAttribLocation(program, "aInstancePosition");
const aInstanceScale = gl.getAttribLocation(program, "aInstanceScale");
const aInstanceColorLocations = [
    gl.getAttribLocation(program, "aInstanceColor0"),
    gl.getAttribLocation(program, "aInstanceColor1"),
    gl.getAttribLocation(program, "aInstanceColor2"),
    gl.getAttribLocation(program, "aInstanceColor3"),
    gl.getAttribLocation(program, "aInstanceColor4"),
    gl.getAttribLocation(program, "aInstanceColor5"),
];
const instanceColorBuffers = [
    instanceColorBuffer0, instanceColorBuffer1, instanceColorBuffer2,
    instanceColorBuffer3, instanceColorBuffer4, instanceColorBuffer5
];

// --- Set Instance Attribute Pointers ---
gl.enableVertexAttribArray(aInstancePosition);
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aInstancePosition, 1); // Position is per-instance

gl.enableVertexAttribArray(aInstanceScale);
gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aInstanceScale, 1); // Scale is per-instance

// Set up attribute pointers for each instance color buffer
for (let i = 0; i < 6; i++) {
    const loc = aInstanceColorLocations[i];
    const buffer = instanceColorBuffers[i];
    if (loc !== -1) { // Check if attribute exists in shader
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        ext.vertexAttribDivisorANGLE(loc, 1); // Colors are per-instance
    } else {
        console.warn(`Attribute aInstanceColor${i} not found in shader.`);
    }
}


// --- Uniform Locations and Projection Matrix ---
const uProjection = gl.getUniformLocation(program, "uProjection");
const uView = gl.getUniformLocation(program, "uView");

const aspect = canvas.width / canvas.height;
const projMatrix = perspective(Math.PI / 3, aspect, 0.1, maxDist * 2);
gl.uniformMatrix4fv(uProjection, false, projMatrix);

// --- Draw Loop ---
let lastTime = 0;
function draw(now = 0) {
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    updateCamera(deltaTime);

    const center = add(cameraPos, cameraFront);
    const viewMatrix = lookAt(cameraPos, center, cameraUp);
    gl.uniformMatrix4fv(uView, false, viewMatrix);

    gl.clearColor(...skyColor, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // NOTE: Binding buffers and setting vertexAttribPointers is generally done
    // *once* after creating the buffers and before the first draw call,
    // unless the data or buffer bindings change frequently.
    // Re-binding vertex attributes here is not strictly necessary if they
    // were set up correctly outside the loop as done above.

    // However, we DO need to ensure the correct VAO (or individual buffers in WebGL1)
    // are active if switching between different objects/shaders.
    // For this single-object case, the setup outside the loop is sufficient.

    // Bind vertex buffers (divisor 0) - needed if switching objects/VAOs
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, faceIndexBuffer);
    gl.vertexAttribPointer(aFaceIndex, 1, gl.FLOAT, false, 0, 0);

    // Bind instance buffers (divisor 1) - also usually set up once
    // Re-binding is redundant here but shown for clarity if needed elsewhere.
    gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
    gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
    gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < 6; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffers[i]);
        gl.vertexAttribPointer(aInstanceColorLocations[i], 3, gl.FLOAT, false, 0, 0);
    }


    // Perform the instanced draw call
    ext.drawArraysInstancedANGLE(
        gl.TRIANGLES,          // primitive type
        0,                     // offset
        CUBE_VERTEX_COUNT,     // number of vertices per instance (36 for a cube made of triangles)
        numInstances           // number of instances
    );

    requestAnimationFrame(draw);
}

// Initial setup of vertex attribute pointers before the first draw
// (This is redundant with the setup above but demonstrates where it should happen)
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, faceIndexBuffer);
gl.vertexAttribPointer(aFaceIndex, 1, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
for (let i = 0; i < 6; i++) {
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffers[i]);
    gl.vertexAttribPointer(aInstanceColorLocations[i], 3, gl.FLOAT, false, 0, 0);
}


draw(); // Start the rendering loop