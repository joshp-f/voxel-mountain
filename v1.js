const canvas = document.getElementById("glcanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext("webgl");

const ext = gl.getExtension('ANGLE_instanced_arrays');

const vertexShaderSource = `
attribute vec3 aPosition;
attribute vec3 aInstancePosition;
attribute vec3 aInstanceColor;
attribute float aInstanceScale; 

uniform mat4 uProjection;
uniform mat4 uView;

varying vec3 vColor;

void main() {

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

let cameraPos = [0, 200, 5];
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
gl.useProgram(program);

const cubeVertices = new Float32Array([

    -0.5, -0.5, 0.5,  0.5, -0.5, 0.5,  0.5,  0.5, 0.5,
    -0.5, -0.5, 0.5,  0.5,  0.5, 0.5, -0.5,  0.5, 0.5,

    -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,
    -0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5,

    -0.5,  0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,
    -0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -0.5,

    -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5,  0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5,  0.5,

     0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,
     0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,

    -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5,
    -0.5, -0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5,
]);
const CUBE_VERTEX_COUNT = 36; 
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

const aPosition = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(aPosition);

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

ext.vertexAttribDivisorANGLE(aPosition, 0); 

const skyColor = [0.53, 0.81, 0.98];

const baseGreen = [0.3, 0.75, 0.3];
const greenFaces = [
    [baseGreen[0]-0.2,baseGreen[1]+0.2,baseGreen[2]],
    [baseGreen[0]+0.2,baseGreen[1]-0.2,baseGreen[2]],
    [baseGreen[0],baseGreen[1]+0.2,baseGreen[2]-0.2],
    [baseGreen[0],baseGreen[1]-0.2,baseGreen[2]+0.2],
    [baseGreen[0]+0.2,baseGreen[1],baseGreen[2]-0.2],
    [baseGreen[0]-0.2,baseGreen[1],baseGreen[2]+0.2],
]
function getColor(x, z,faceIndex) {
    const dist = cubeDist(x, z);
    const green = greenFaces[faceIndex];
    const greenVariance = 0.77;
    const varianceDropedOff = greenVariance * (1 / (dist / 100000 + 1));

    const color = green.map((v, i) => {
        const modifier = (1 + (Math.random() - 0.5) * varianceDropedOff);
        if (x == 0 && z == 0) {
            console.log('modifier',modifier);
        }
        return v*modifier;
    });
    // if (x == 0 && z == 0) {
    //     console.log(varianceDropedOff,x,z,green,color);
    //     throw new Error("A");
    // }
    return color;
    const nonFog = 1 / (dist / 40000 + 1);
    let foggedColor = color.map((c, i) => skyColor[i] * (1 - nonFog) + c * nonFog);
    return foggedColor;
}

function cubeDist(x, z) {
    return Math.max(Math.abs(x), Math.abs(z));
}

const voxels = [];
const size = 700;
const maxDist = 2**(size/100)*size; 
console.log('MaxDist', maxDist); 
let nlogged = 0;
for (let x = -size; x < size; x++) {
    for (let z = -size; z < size; z++) {
        const dist = cubeDist(x, z);
        const distMult = 2**(dist / 100);
        const realX = x * distMult;
        const realZ = z * distMult; 
        const yPos = Elevation(realX, realZ);
        let faceColors = [];
        for (let i = 0; i < 6; i++) faceColors.push(getColor(realX,realZ,i))
        if (nlogged < 10) {
            console.log(faceColors);
            nlogged++;
        }
        voxels.push({ x: realX, y: yPos, z: realZ, face_colors: faceColors, scale: distMult });
    }
}
const numInstances = voxels.length;
console.log("Number of voxels:", numInstances);

COLORS_FLOATS_PER_INSTANCE = 3 * 36;

const instancePositions = new Float32Array(numInstances * 3);
const instanceColors = new Float32Array(numInstances * COLORS_FLOATS_PER_INSTANCE );
const instanceScales = new Float32Array(numInstances); 

voxels.forEach((voxel, i) => {
    instancePositions[i * 3 + 0] = voxel.x;
    instancePositions[i * 3 + 1] = voxel.y;
    instancePositions[i * 3 + 2] = voxel.z;
    voxel.face_colors.forEach((color, faceIndex) => {
        // Each face has 6 vertices
        for (let vertex = 0; vertex < 6; vertex++) {
            const vertexIndex = faceIndex * 6 + vertex; // Index of the vertex in the 36-vertex array
            const colorIndex = i * COLORS_FLOATS_PER_INSTANCE + vertexIndex * 3;
            instanceColors[colorIndex + 0] = color[0];
            instanceColors[colorIndex + 1] = color[1];
            instanceColors[colorIndex + 2] = color[2];
        }
    });
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
ext.vertexAttribDivisorANGLE(aInstanceColor, 0); // per vertex

gl.enableVertexAttribArray(aInstanceScale);
gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
ext.vertexAttribDivisorANGLE(aInstanceScale, 1);

const uProjection = gl.getUniformLocation(program, "uProjection");
const uView = gl.getUniformLocation(program, "uView");

const aspect = canvas.width / canvas.height;
const projMatrix = perspective(Math.PI / 3, aspect, 0.1, maxDist * 2); 
gl.uniformMatrix4fv(uProjection, false, projMatrix);

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

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aPosition, 0); 

    gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
    gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstancePosition, 1); 

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
    gl.vertexAttribPointer(aInstanceColor, 3, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstanceColor, 0); 

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
    gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aInstanceScale, 1); 

    ext.drawArraysInstancedANGLE(
        gl.TRIANGLES,       
        0,                  
        CUBE_VERTEX_COUNT,  
        numInstances        
    );

    requestAnimationFrame(draw);
}

draw();