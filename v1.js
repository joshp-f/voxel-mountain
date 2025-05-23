const canvas = document.getElementById("glcanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
// Get WebGL2 context
const gl = canvas.getContext("webgl2");

// WebGL2 Shaders
const vertexShaderSource = `#version 300 es
in vec3 aPosition;
in float aFaceIndex; // Index (0-5) to select the correct face color
in vec3 aInstancePosition;
in vec3 aInstanceColor0; // Color for face 0 (Front)
in vec3 aInstanceColor1; // Color for face 1 (Back)
in vec3 aInstanceColor2; // Color for face 2 (Top)
in vec3 aInstanceColor3; // Color for face 3 (Bottom)
in vec3 aInstanceColor4; // Color for face 4 (Right)
in vec3 aInstanceColor5; // Color for face 5 (Left)
in float aInstanceScale;

uniform mat4 uProjection;
uniform mat4 uView;

out vec3 vColor; // Use 'out' instead of 'varying'

void main() {
vec3 scaledPosition = aPosition * aInstanceScale;
  gl_Position = uProjection * uView * vec4(scaledPosition + aInstancePosition, 1.0);

// Select the face color based on the face index
if (aFaceIndex < 0.5) {vColor = aInstanceColor0; }
else if (aFaceIndex < 1.5) {vColor = aInstanceColor1; }
else if (aFaceIndex < 2.5) {vColor = aInstanceColor2; }
else if (aFaceIndex < 3.5) {vColor = aInstanceColor3; }
    else if (aFaceIndex < 4.5) {vColor = aInstanceColor4; }
    else {vColor = aInstanceColor5; }
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;
in vec3 vColor; // Use 'in' instead of 'varying'

out vec4 fragColor; // Define output color variable

void main() {
    fragColor = vec4(vColor, 1.0); // Assign to output variable
}
`;

// --- Marker Data ---
const markers = [
    { x: 70, z: 70, found: false },
    { x: 1000, z: 1000, found: false },
    { x: -1500, z: 500, found: false },
    { x: 2000, z: -2000, found: false },
    { x: -500, z: -2500, found: false },
    { x: 3000, z: 0, found: false },
    { x: 0, z: 3000, found: false },
    { x: -3500, z: -3500, found: false },
    { x: 4000, z: 2000, found: false },
    { x: -2000, z: 4500, found: false },
    { x: 2500, z: -4000, found: false },
];
const proximityThreshold = 30; // World units to trigger 'found' status
let mapNeedsUpdate = false; // Flag to trigger map redraw

// --- Camera and Controls ---

function GetStartPos() {
    let lowest = 10000;
    let bestX = 0;
    let bestZ = 0;
    const spawnRange = 1000;
    const testGap = spawnRange / 20
    for (let x = -spawnRange; x < spawnRange; x += testGap) {
        for (let z = -spawnRange; z < spawnRange; z += testGap) {
            const elevation = Elevation(x, z);
            if (elevation < lowest) {
                lowest = elevation;
                bestX = x;
                bestZ = z;
            }
        }
    }
    return [bestX, lowest + 20, bestZ];
}
let cameraPos = [0, Elevation(0, 5) + 10, 5];
// let cameraPos = GetStartPos();
console.log(cameraPos);
let currentChunkX = 0;
let currentChunkZ = 0;
let firstLoadDone = false;
let yVel = 0;
let cameraFront = [0, 0, -1];
let cameraUp = [0, 1, 0];
let yaw = -90;
let pitch = 0;
let keys = {};
canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
canvas.onclick = () => canvas.requestPointerLock();
function UpdateCompass() {
    const rotationDegrees = yaw + 90;
    // Apply the rotation to the needle div
    if (compassNeedle) { // Ensure the element exists
        compassNeedle.style.transform = `rotate(${rotationDegrees}deg)`;
    }
}
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
    UpdateCompass();

});
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

let isSprinting = false;
function updateCamera(deltaTime) {
    isSprinting = keys["shift"];
    const speed = 10 * (isSprinting ? 3 : 1) * deltaTime;
    const forward = normalize([...cameraFront]);
    const worldUp = [0, 1, 0];
    const right = normalize(cross(forward, worldUp));
    // const up = normalize(cross(right, forward)); // Local up, not used for movement here
    if (keys["w"]) cameraPos = add(cameraPos, scale(forward, speed));
    if (keys["s"]) cameraPos = add(cameraPos, scale(forward, -speed));
    if (keys["a"]) cameraPos = add(cameraPos, scale(right, -speed));
    if (keys["d"]) cameraPos = add(cameraPos, scale(right, speed));
    if (keys[" "]) {
        // Broken, tbh dont care
        const elevation = GetGroundElevation();
        console.log(cameraPos[1], elevation)
        if (cameraPos[1] < elevation) yVel = 10;
    }
    // if (keys["shift"]) cameraPos = add(cameraPos, scale([0, 1, 0], -speed)); // Move along world Y
}
// --- End Camera ---

// --- Math Utilities ---
function normalize(v) { const len = Math.hypot(...v); if (len === 0) return [0, 0, 0]; return v.map(x => x / len); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function add(a, b) { return a.map((v, i) => v + b[i]); }
function scale(v, s) { return v.map(x => x * s); }
function dot(a, b) { return a.reduce((sum, v, i) => sum + v * b[i], 0); }
function Elevation(x, z) {
    let height = 0;
    const base = 16;
    for (let i = 0; i < 8; i++) {
        const amp = base * (2 ** i);
        const scale = 1 / (amp * 8);
        let levelHeight = noise.simplex2(x * scale + amp, z * scale + amp);
        levelHeight = Math.max(0, levelHeight);
        levelHeight = (levelHeight + levelHeight ** 2);
        height += levelHeight * amp;
    }
    height = Math.max(height, 0);
    const distToOrigin = cubeDist(x, z);
    const falloffRadius = 5000;

    // if (distToOrigin < falloffRadius) {
    //  const fallOffAmount = distToOrigin / falloffRadius;
    //  // Lerp towards 500 metres around spawn
    //  height = height * fallOffAmount + 500 * (1 - fallOffAmount);
    // }
    return height;
}

function Steepness(realX, realZ) {
    const elevation = Elevation(realX, realZ);
    const xElevation = Elevation(realX + 1, realZ);
    const zElevation = Elevation(realX, realZ + 1);
    const steepness = EuclideanDist(elevation - xElevation, elevation - zElevation);
    return steepness;
}
// --- End Noise ---

// --- Matrix Functions ---
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

// --- Shader Compilation ---
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
// Adjusted Y values to center the cube vertically around Y=0 (Height is 4)
const cubeVertices = new Float32Array([
    // Front face (+Z) (Index 0)
    -0.5, -2, 0.5, 0.5, -2, 0.5, 0.5, 2, 0.5,
    -0.5, -2, 0.5, 0.5, 2, 0.5, -0.5, 2, 0.5,
    // Back face (-Z) (Index 1)
    -0.5, -2, -0.5, -0.5, 2, -0.5, 0.5, 2, -0.5,
    -0.5, -2, -0.5, 0.5, 2, -0.5, 0.5, -2, -0.5,
    // Top face (+Y) (Index 2)
    -0.5, 2, -0.5, -0.5, 2, 0.5, 0.5, 2, 0.5,
    -0.5, 2, -0.5, 0.5, 2, 0.5, 0.5, 2, -0.5,
    // Bottom face (-Y) (Index 3)
    -0.5, -2, -0.5, 0.5, -2, -0.5, 0.5, -2, 0.5,
    -0.5, -2, -0.5, 0.5, -2, 0.5, -0.5, -2, 0.5,
    // Right face (+X) (Index 4)
    0.5, -2, -0.5, 0.5, 2, -0.5, 0.5, 2, 0.5,
    0.5, -2, -0.5, 0.5, 2, 0.5, 0.5, -2, 0.5,
    // Left face (-X) (Index 5)
    -0.5, -2, -0.5, -0.5, -2, 0.5, -0.5, 2, 0.5,
    -0.5, -2, -0.5, -0.5, 2, 0.5, -0.5, 2, -0.5,
]);
const CUBE_VERTEX_COUNT = 36;

// --- Create Vertex Array Object (VAO) ---
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

// --- Create Vertex Position Buffer ---
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
const aPosition = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
// gl.vertexAttribDivisor(aPosition, 0); // Divisor 0 is default

// --- Create Face Index Buffer ---
const cubeFaceIndices = new Float32Array(CUBE_VERTEX_COUNT);
for (let face = 0; face < 6; ++face) {
    for (let vert = 0; vert < 6; ++vert) {
        cubeFaceIndices[face * 6 + vert] = face;
    }
}
const faceIndexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, faceIndexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeFaceIndices, gl.STATIC_DRAW);
const aFaceIndex = gl.getAttribLocation(program, "aFaceIndex");
gl.enableVertexAttribArray(aFaceIndex);
gl.vertexAttribPointer(aFaceIndex, 1, gl.FLOAT, false, 0, 0);
// gl.vertexAttribDivisor(aFaceIndex, 0); // Divisor 0 is default

// --- Color Generation ---
const skyColor = [0.4, 0.75, 0.98];
const MakeShadedColorFaces = (baseColor, gap) => {
    return [
        [baseColor[0] - gap, baseColor[1] + gap, baseColor[2]],
        [baseColor[0] + gap, baseColor[1] - gap, baseColor[2]],
        [baseColor[0], baseColor[1] + gap, baseColor[2] - gap],
        [baseColor[0], baseColor[1] - gap, baseColor[2] + gap],
        [baseColor[0] + gap, baseColor[1], baseColor[2] - gap],
        [baseColor[0] - gap, baseColor[1], baseColor[2] + gap],
    ];
}
const baseGreen = [0.3, 0.6, 0.44];
const greenFaceGap = 0.1;
const greenFaces = MakeShadedColorFaces(baseGreen, greenFaceGap);

const baseMountainGrass = [0.376, 0.376, 0.376];
const rockFaceGap = 0.04;
const mountainGrassFaces = MakeShadedColorFaces(baseMountainGrass, rockFaceGap);
const baseSnow = [0.8, 0.8, 0.8];
const snowFaceGap = 0.07;
const snowFaces = MakeShadedColorFaces(baseSnow, snowFaceGap);

const baseWood = [0.35, 0.22, 0.12];
const woodGap = 0.04;
const woodFaces = MakeShadedColorFaces(baseWood, woodGap);

const basPineLeaf = [0.165, 0.361, 0.227];
const pineGap = 0.04;
const pineFaces = MakeShadedColorFaces(basPineLeaf, pineGap);

const basePath = [0.545, 0.353, 0.169];
const pathGap = 0.04;
const pathFaces = MakeShadedColorFaces(basePath, pathGap);

const pillarColor = [0.5, 0.0, 0.5]; // Purple
const pillarFaces = MakeShadedColorFaces(pillarColor, 0.05);

const faceMap = {
    green: greenFaces,
    mountain: mountainGrassFaces,
    snow: snowFaces,
    wood: woodFaces,
    pine: pineFaces,
    path: pathFaces
}
function pickFaces(elevation, steepness) {
    let face = 'green';
    // if (steepness + (elevation / 4000) < 1) face = 'pine';
    // Dont use harsh cut offs, use gradients, looks nicer
    if (steepness + (elevation / 8000) > 1) {
        face = 'mountain';
    }
    if ((steepness - elevation / 1000) < -1) {
        face = 'snow';
    }
    // if (elevation > 400 && elevation < 405) face = 'path';
    return face;
}

function getColor(x, z, face, faceIndex, chunkLevel) {
    if (chunkLevel <= HIGH_FIDELITY_LEVEL) {
        if (face === "pine") {
            face = "green";
        }
    }
    const dist = cubeDist(x, z);
    const faces = faceMap[face];
    const baseColor = faces[faceIndex];
    const baseColorVariance = 0.5;
    const varianceDropedOff = baseColorVariance * (1 / (dist / 1500 + 1));

    const color = baseColor.map((v, i) => {
        const modifier = (1 + (Math.random() - 0.5) * varianceDropedOff);
        return Math.max(0, Math.min(1, v * modifier)); // Clamp color
    });
    const nonFog = 1 / (dist / 25000 + 1);
    let foggedColor = color.map((c, i) => skyColor[i] * (1 - nonFog) + c * nonFog);
    return foggedColor;
}

function getFaceColors(x, z, face, chunkLevel) {
    let faceColors = [];
    for (let faceId = 0; faceId < 6; faceId++) {
        faceColors.push(getColor(x, z, face, faceId, chunkLevel));
    }
    return faceColors
}

function cubeDist(x, z) { return Math.max(Math.abs(x), Math.abs(z)); }
const EuclideanDist = (x, y, z) => {
    // Optimized 2D distance if z is undefined or 0
    if (z === undefined || z === 0) {
        return Math.sqrt(x * x + y * y);
    }
    return Math.sqrt(x * x + y * y + z * z);
}


// --- Voxel Generation ---
class ChunkManager {
    constructor() {
        this.voxelCounter = 0;
        this.chunkMap = {};
        this.voxelMap = {};
        this.chunkLevels = {};
    }
    CreateChunk(chunkX, chunkZ) {
        const chunkId = `${chunkX}-${chunkZ}`
        let dist = cubeDist(chunkX - currentChunkX, chunkZ - currentChunkZ);
        dist = Math.max(dist, 1);
        let chunkLevel = Math.pow(2, Math.floor(Math.log2(dist - 1)));
        if (chunkId in this.chunkLevels && this.chunkLevels[chunkId] == chunkLevel) return;
        this.DeleteChunk(chunkX, chunkZ);
        this.chunkLevels[chunkId] = chunkLevel;
        _CreateChunk(chunkX, chunkZ, chunkLevel);
    }
    PushVoxel(voxel) {
        const chunkX = Math.floor(voxel.x / chunkSize);
        const chunkZ = Math.floor(voxel.z / chunkSize);
        const chunkId = `${chunkX}-${chunkZ}`

        this.voxelMap[this.voxelCounter] = voxel;
        if (!(chunkId in this.chunkMap)) this.chunkMap[chunkId] = [];
        this.chunkMap[chunkId].push(this.voxelCounter);
        this.voxelCounter++;
    }
    DeleteChunk(chunkX, chunkZ) {
        const chunkId = `${chunkX}-${chunkZ}`
        if (chunkId in this.chunkMap) {
            for (const id of this.chunkMap[chunkId]) {
                delete this.voxelMap[id];
            }
            delete this.chunkMap[chunkId];
            delete this.chunkLevels[chunkId];
        }
    }
}
const chunkManager = new ChunkManager();
const nChunks = 256;
const chunkSize = 64;
const maxDist = chunkSize * nChunks;
console.log('MaxDist', maxDist);
// Creates artifacts :( Need to create double density probably
const treeRadius = 3;
const treeHeight = 32;

let numInstances = 0; // Will be updated in regenerateWorldAndUploadData
function CrapRandom(x, z) {
    return (noise.simplex2(x, z) + 1) / 2;

}
const HIGH_FIDELITY_LEVEL = 16;
const treeDist = HIGH_FIDELITY_LEVEL;
function EntityVoxels(face, x, y, z, chunkLevel) {
    if (chunkLevel > HIGH_FIDELITY_LEVEL) return;
    if (face === 'pine') {
        let treeX = Math.floor(x / treeDist) * treeDist;
        let treeZ = Math.floor(z / treeDist) * treeDist;
        const distToTree = EuclideanDist(treeX - x, treeZ - z);
        const treeBase = y + chunkLevel / 2;
        if (distToTree < chunkLevel && treeX) {
            for (let i = 0; i < 4; i++) {
                const treeSize = CrapRandom(x + i, z + i);
                treeX += (CrapRandom(x + i, z + i) - 0.5) * treeDist;
                treeZ += (CrapRandom(x + i, z + i) - 0.5) * treeDist;
                for (let i = 0; i < 3; i++) {

                    chunkManager.PushVoxel({
                        x: treeX,
                        y: treeBase + i * 4 * treeSize,
                        z: treeZ,
                        faceColors: woodFaces,
                        scale: 1 * treeSize
                    })

                }
                const leafSize = 7
                chunkManager.PushVoxel({
                    x: treeX,
                    y: treeBase + (3 * 4 + leafSize * 2) * treeSize,
                    z: treeZ,
                    faceColors: getFaceColors(treeX, treeZ, 'pine'),
                    scale: leafSize * treeSize
                })
                chunkManager.PushVoxel({
                    x: treeX,
                    y: treeBase + (3 * 4 + leafSize * 3.5) * treeSize,
                    z: treeZ,
                    faceColors: getFaceColors(treeX, treeZ, 'pine'),
                    scale: (leafSize * 0.5) * treeSize
                })
            }

        }
    }
}

function _CreateChunk(chunkX, chunkZ, chunkLevel) {
    const chunkPosX = chunkSize * chunkX;
    const chunkPosZ = chunkSize * chunkZ;
    chunkLevel = Math.min(Math.max(chunkLevel, 1), chunkSize);
    const nBlocks = chunkSize / chunkLevel;
    for (let i = 0; i < nBlocks; i++) {
        for (let j = 0; j < nBlocks; j++) {
            const realX = chunkPosX + i * chunkLevel;
            const realZ = chunkPosZ + j * chunkLevel;
            const yPos = Elevation(realX, realZ);
            const steepness = Steepness(realX, realZ);
            const face = pickFaces(yPos, steepness);
            const faceColors = getFaceColors(realX, realZ, face, chunkLevel);

            chunkManager.PushVoxel({
                x: realX,
                y: yPos, // Center the terrain block
                z: realZ,
                faceColors,
                scale: chunkLevel
            });
            // EntityVoxels(face, realX, yPos, realZ, chunkLevel);
        }
    }
}

// --- Instance Buffers (Declare handles here) ---
const instancePositionBuffer = gl.createBuffer();
const instanceScaleBuffer = gl.createBuffer();
const instanceColorBuffer0 = gl.createBuffer();
const instanceColorBuffer1 = gl.createBuffer();
const instanceColorBuffer2 = gl.createBuffer();
const instanceColorBuffer3 = gl.createBuffer();
const instanceColorBuffer4 = gl.createBuffer();
const instanceColorBuffer5 = gl.createBuffer();

const instanceColorBuffers = [
    instanceColorBuffer0, instanceColorBuffer1, instanceColorBuffer2,
    instanceColorBuffer3, instanceColorBuffer4, instanceColorBuffer5
];


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
for (let chunkX = -nChunks; chunkX < nChunks; chunkX++) {
    for (let chunkZ = -nChunks; chunkZ < nChunks; chunkZ++) {
        chunkManager.CreateChunk(chunkX, chunkZ);
    }
}

// ->

const regenerateChunkSize = 64;

function regenerateWorldAndUploadData() {
    const camChunkX = Math.round(cameraPos[0] / chunkSize);
    const camChunkZ = Math.round(cameraPos[2] / chunkSize);
    if (camChunkX == currentChunkX && camChunkZ == currentChunkZ && firstLoadDone === true) {
        return;
    }
    firstLoadDone = true;
    console.time("All Generation");
    console.time("Rebuild Chunks");
    for (let chunkX = -regenerateChunkSize; chunkX < regenerateChunkSize; chunkX++) {
        for (let chunkZ = -regenerateChunkSize; chunkZ < regenerateChunkSize; chunkZ++) {
            const regenX = chunkX + camChunkX;
            const regenZ = chunkZ + camChunkZ;
            chunkManager.CreateChunk(regenX, regenZ);
        }
    }
    console.timeEnd("Rebuild Chunks");

    currentChunkX = camChunkX;
    currentChunkZ = camChunkZ;
    console.time("Voxel List");
    let voxels = Object.values(chunkManager.voxelMap);
    console.timeEnd("Voxel List");

    // --- Add Pillar Voxels ---
    const pillarSegmentScale = 5; // Scale of each segment cube
    const segmentHeight = 4 * pillarSegmentScale; // Actual height of a scaled segment (base cube height is 4)
    const pillarTotalHeight = 100;
    const numPillarSegments = Math.ceil(pillarTotalHeight / segmentHeight);

    markers.forEach(marker => {
        const baseElevation = Elevation(marker.x, marker.z);
        for (let i = 0; i < numPillarSegments; i++) {
            const segmentCenterY = baseElevation + 1 + (i * segmentHeight) + (segmentHeight / 2);
            voxels.push({
                x: marker.x,
                y: segmentCenterY, // Instance position is the center
                z: marker.z,
                faceColors: marker.found ? greenFaces : pillarFaces, // Use the defined purple faces
                scale: pillarSegmentScale
            });
        }
    });
    // --- End Pillar Voxels ---


    numInstances = voxels.length;
    console.log("Regenerated Voxels:", numInstances);
    if (numInstances === 0) return; // Avoid errors if no voxels generated
    console.time("Array Creation");
    const instancePositions = new Float32Array(numInstances * 3);
    const instanceScales = new Float32Array(numInstances);
    const instanceColors0 = new Float32Array(numInstances * 3);
    const instanceColors1 = new Float32Array(numInstances * 3);
    const instanceColors2 = new Float32Array(numInstances * 3);
    const instanceColors3 = new Float32Array(numInstances * 3);
    const instanceColors4 = new Float32Array(numInstances * 3);
    const instanceColors5 = new Float32Array(numInstances * 3);
    const instanceColorArrays = [instanceColors0, instanceColors1, instanceColors2, instanceColors3, instanceColors4, instanceColors5];
    console.timeEnd("Array Creation");
    console.time("Matrix Filling");
    voxels.forEach((voxel, i) => {
        instancePositions[i * 3 + 0] = voxel.x;
        instancePositions[i * 3 + 1] = voxel.y;
        instancePositions[i * 3 + 2] = voxel.z;
        instanceScales[i] = voxel.scale;
        for (let face = 0; face < 6; face++) {
            const colorArr = instanceColorArrays[face];
            const color = voxel.faceColors[face];
            colorArr[i * 3 + 0] = color[0];
            colorArr[i * 3 + 1] = color[1];
            colorArr[i * 3 + 2] = color[2];
        }
    });
    console.timeEnd("Matrix Filling");
    console.time("Buffer Upload");
    gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instancePositions, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceScales, gl.DYNAMIC_DRAW);

    for (let i = 0; i < 6; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffers[i]);
        gl.bufferData(gl.ARRAY_BUFFER, instanceColorArrays[i], gl.DYNAMIC_DRAW);
    }
    console.timeEnd("Buffer Upload");

    gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind
    console.timeEnd("All Generation");
}


// --- Set Instance Attribute Pointers (within the VAO setup) ---
gl.bindVertexArray(vao); // Bind VAO once here

gl.enableVertexAttribArray(aInstancePosition);
gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
gl.vertexAttribPointer(aInstancePosition, 3, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(aInstancePosition, 1);

gl.enableVertexAttribArray(aInstanceScale);
gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
gl.vertexAttribPointer(aInstanceScale, 1, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(aInstanceScale, 1);

for (let i = 0; i < 6; i++) {
    const loc = aInstanceColorLocations[i];
    const buffer = instanceColorBuffers[i];
    if (loc !== -1) {
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer); // Bind correct buffer
        gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(loc, 1);
    } else {
        console.warn(`Attribute aInstanceColor${i} not found in shader.`);
    }
}

// Unbind the VAO and ARRAY_BUFFER after setup
gl.bindVertexArray(null);
gl.bindBuffer(gl.ARRAY_BUFFER, null);


// --- Uniform Locations and Projection Matrix ---
const uProjection = gl.getUniformLocation(program, "uProjection");
const uView = gl.getUniformLocation(program, "uView");

const aspect = canvas.width / canvas.height;
const projMatrix = perspective(Math.PI / 3, aspect, 1, maxDist * 1.5);
gl.uniformMatrix4fv(uProjection, false, projMatrix);

// --- Topographic Map Generation ---
const mapCanvas = document.getElementById("mapCanvas");
const mapCtx = mapCanvas.getContext("2d");
const mapWidth = 300;
const mapHeight = 300;
mapCanvas.width = mapWidth;
mapCanvas.height = mapHeight;
const mapWorldSize = 10000; // How much world space the map covers

function updateMap() { // Renamed from generateTopographicMap
    console.time("Map Generation");
    const imageData = mapCtx.createImageData(mapWidth, mapHeight);
    const data = imageData.data;

    // Draw Terrain Background
    for (let py = 0; py < mapHeight; py++) {
        for (let px = 0; px < mapWidth; px++) {
            const worldX = (px / (mapWidth - 1) - 0.5) * mapWorldSize;
            const worldZ = (py / (mapHeight - 1) - 0.5) * mapWorldSize; // Map increasing py to increasing Z
            const elevation = Elevation(worldX, worldZ);
            const steepness = Steepness(worldX, worldZ);
            const faceName = pickFaces(elevation, steepness);
            const face = faceMap[faceName];
            let color = face[0]; // Use one of the face colors for the map
            color = color.map(c => Math.max(0, Math.min(255, c * 255))); // Clamp and scale
            const index = (py * mapWidth + px) * 4;
            data[index] = color[0];     // R
            data[index + 1] = color[1]; // G
            data[index + 2] = color[2]; // B
            data[index + 3] = 255;      // A (fully opaque)
        }
    }
    mapCtx.putImageData(imageData, 0, 0);

    // Draw Markers on top
    const markerSize = 8; // Size of marker rect on map
    markers.forEach(marker => {
        // Convert marker world coordinates to map coordinates
        const mapX = ((marker.x / mapWorldSize) + 0.5) * mapWidth;
        const mapZ = ((marker.z / mapWorldSize) + 0.5) * mapHeight; // World Z maps to Map Y

        // Set color based on 'found' status
        mapCtx.fillStyle = marker.found ? 'lime' : 'purple'; // Bright green if found, red if not

        // Draw marker (adjust coords to center the rect)
        mapCtx.fillRect(mapX - markerSize / 2, mapZ - markerSize / 2, markerSize, markerSize);
    });

    console.timeEnd("Map Generation");
}
function UpdateMarkers() {
    // Check marker proximity
    mapNeedsUpdate = false; // Reset flag each frame
    markers.forEach(marker => {
        if (!marker.found) {
            const distToMarker = EuclideanDist(cameraPos[0] - marker.x, cameraPos[2] - marker.z);
            if (distToMarker < proximityThreshold) {
                marker.found = true;
                mapNeedsUpdate = true; // Set flag to redraw map
                console.log("Found marker at:", marker.x, marker.z); // Optional feedback
            }
        }
    });

    // Update map if needed
    if (mapNeedsUpdate) {
        updateMap();
    }
}

// --- End Topographic Map Generation ---

const compassNeedle = document.getElementById('compassNeedle');


// --- Initial World and Map Generation ---
regenerateWorldAndUploadData();
updateMap(); // Initial map draw including markers

function GetGroundElevation() {
    return Elevation(cameraPos[0], cameraPos[2]) + 3.5; // Adjusted player height offset
}
// --- Draw Loop ---
let lastTime = 0;
function draw(now = 0) {
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    updateCamera(deltaTime);
    UpdateMarkers();


    regenerateWorldAndUploadData(); // Regenerate world chunks if camera moved


    const groundElevation = GetGroundElevation();
    if (cameraPos[1] < groundElevation) {
        cameraPos[1] = groundElevation;
        yVel = Math.min(yVel, 0);
    } else {
        yVel += deltaTime * 9.81; // Apply gravity
        cameraPos[1] -= yVel * deltaTime; // Apply velocity
    }
    const center = add(cameraPos, cameraFront);
    const viewMatrix = lookAt(cameraPos, center, cameraUp);
    gl.uniformMatrix4fv(uView, false, viewMatrix);

    gl.clearColor(...skyColor, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.bindVertexArray(vao);

    if (numInstances > 0) { // Only draw if there are instances
        gl.drawArraysInstanced(
            gl.TRIANGLES,     // primitive type
            0,                // offset
            CUBE_VERTEX_COUNT, // number of vertices per instance
            numInstances      // number of instances
        );
    }

    gl.bindVertexArray(null);

    requestAnimationFrame(draw);
}

draw(); // Start the rendering loop
