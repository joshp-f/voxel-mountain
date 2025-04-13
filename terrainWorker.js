// terrainWorker.js

// Import necessary scripts (make sure perlin.js is accessible)
try {
    importScripts('perlin.js'); // Load the Perlin noise library
} catch (e) {
    console.error("Worker failed to load perlin.js. Make sure it's accessible.", e);
    // Optionally, post an error back to the main thread
    // self.postMessage({ type: 'error', message: 'Failed to load perlin.js' });
}


// --- Constants (should match main thread if needed) ---
const CHUNK_SIZE = 64; // Make sure this matches the main thread's CHUNK_SIZE

// --- Copy necessary functions from main script ---
// (Elevation, Lvl1Color, Lvl4Color, Lvl16Color, Lvl256Color, LeveledBlockColors, GetBlockColor, GenerateCubeColor, AddVectors, MultiplyVector)

function Elevation(x, z) {
    // Ensure noise object is available (assuming perlin.js defines it globally or via 'noise')
    if (typeof noise === 'undefined' || typeof noise.simplex2 !== 'function') {
         console.error("Worker: 'noise' or 'noise.simplex2' is not available.");
         return 0; // Return a default value
    }
    // Paste the exact Elevation function logic here...
    const bigMtn2048Magnitude = (Math.max(0.5,noise.simplex2(x/32768,z/32768))-0.5)*2;
    const Mtn1024Magnitude = (Math.max(0.5,noise.simplex2(x/16384,z/16384))-0.5)*2;
    const smallMtn512Magnitude = (Math.max(0.5,noise.simplex2(x/8192,z/8192))-0.5)*2;
    const bigHill256Magnitude = (Math.max(0.5,noise.simplex2(x/4096,z/4096))-0.5)*2;
    const footHill128Magnitude = (Math.max(0.5,noise.simplex2(x/2048,z/2048))-0.5)*2;
    const hills64Presense = Math.max(0,noise.simplex2(x/1024,z/1024));
    let hills64Magnitude = ((noise.simplex2(x/256,z/256)+1)/2)*hills64Presense*2;
    return hills64Magnitude*64 +footHill128Magnitude*256 + bigHill256Magnitude*512+smallMtn512Magnitude*1024 + Mtn1024Magnitude*2048+bigMtn2048Magnitude*4096;
}

function Lvl1Color(x, z) { return [0.2, 0.5 + Math.random() * 0.5, 0.2]; }
function Lvl4Color(x, z) { const pathX = Math.sin(z / 20) * 20; const distToPath = Math.abs(pathX - x); if (distToPath <= 2) return [0.8, 0.5 + Math.random() * 0.5, 0.4]; }
function Lvl16Color(x, z) { const riverZ = Math.sin(x / 20) * 20; const distToRiver = Math.abs(riverZ - z); if (distToRiver <= 8) return [0.7, 0.7, 0.8 + Math.random() * 0.2]; }
function Lvl256Color(x, z) { const elevation = noise.simplex2(x / (256 * 16), z / (256 * 16)); if (elevation > 0.75) { return [0, elevation, elevation]; } }
const LeveledBlockColors = [Lvl256Color, Lvl16Color, Lvl4Color];
function GetBlockColor(x, z) { for (const fn of LeveledBlockColors) { const res = fn(x, z); if (res) return res; } return Lvl1Color(x, z); }
function MultiplyVector(v1, n) { return v1.map((item) => item * n); }

function GenerateCubeColor(cube) { /* ... Paste exact GenerateCubeColor logic ... */
    let finalColor = [0, 0, 0];
    let count = 0;
    const step = Math.max(1, Math.floor(cube.size / 4));
    for (let i = cube.x - cube.size / 2 + step / 2; i < cube.x + cube.size / 2; i += step) {
        for (let j = cube.z - cube.size / 2 + step / 2; j < cube.z + cube.size / 2; j += step) {
            const color = GetBlockColor(i, j);
            finalColor[0] += color[0];
            finalColor[1] += color[1];
            finalColor[2] += color[2];
            count++;
        }
    }
    if (count === 0) return Lvl1Color(cube.x, cube.z);
    return MultiplyVector(finalColor, 1 / count);
}


// --- Box Geometry Data Function ---
// Generates vertex data for a single box centered at origin
function createBoxVertexData(size) {
    const hs = size / 2;
    const positions = [
        // Front face
        -hs, -hs, -hs,  hs, -hs, -hs,  hs,  hs, -hs, -hs,  hs, -hs,
        // Back face
        -hs, -hs,  hs, -hs,  hs,  hs,  hs,  hs,  hs,  hs, -hs,  hs,
        // Top face
        -hs,  hs, -hs,  hs,  hs, -hs,  hs,  hs,  hs, -hs,  hs,  hs,
        // Bottom face
        -hs, -hs, -hs, -hs, -hs,  hs,  hs, -hs,  hs,  hs, -hs, -hs,
        // Right face
         hs, -hs, -hs,  hs, -hs,  hs,  hs,  hs,  hs,  hs,  hs, -hs,
        // Left face
        -hs, -hs, -hs, -hs,  hs, -hs, -hs,  hs,  hs, -hs, -hs,  hs
    ];
    const indices = [
        0, 1, 2, 0, 2, 3, // front
        4, 5, 6, 4, 6, 7, // back
        8, 9, 10, 8, 10, 11, // top
        12, 13, 14, 12, 14, 15, // bottom
        16, 17, 18, 16, 18, 19, // right
        20, 21, 22, 20, 22, 23 // left
    ];
    const normals = [
        // Front
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // Back
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        // Top
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        // Bottom
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        // Right
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // Left
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0
    ];
     // UVs can be added here if needed for texturing
    return { positions, indices, normals };
}


// --- Worker Message Handler ---
self.onmessage = function(e) {
    const { id, x, z, level } = e.data;
    // console.log(`Worker received request for chunk: ${id} L${level}`);

    // Arrays to hold the combined geometry for the entire chunk
    const chunkPositions = [];
    const chunkIndices = [];
    const chunkNormals = [];
    const chunkColors = [];
    let currentIndex = 0; // Keep track of the index offset for merging

    const blocks_in_chunk = CHUNK_SIZE / level;

    for (let i = 0; i < blocks_in_chunk; i++) {
        for (let j = 0; j < blocks_in_chunk; j++) {
            const blockX = x * CHUNK_SIZE + (i - blocks_in_chunk / 2 + 0.5) * level;
            const blockZ = z * CHUNK_SIZE + (j - blocks_in_chunk / 2 + 0.5) * level;

            const cubeData = {
                x: blockX,
                z: blockZ,
                y: Elevation(blockX, blockZ),
                size: level
            };

            if (cubeData.y < -100) continue; // Culling low blocks

            cubeData.color = GenerateCubeColor(cubeData);
            const baseColor = { r: cubeData.color[0], g: cubeData.color[1], b: cubeData.color[2], a: 1 };

            // Get geometry for a single box
            const boxGeo = createBoxVertexData(level);

            // Add box vertices, adjusting for position offset
            for (let v = 0; v < boxGeo.positions.length; v += 3) {
                chunkPositions.push(boxGeo.positions[v + 0] + cubeData.x);
                chunkPositions.push(boxGeo.positions[v + 1] + cubeData.y);
                chunkPositions.push(boxGeo.positions[v + 2] + cubeData.z);
                // Copy normals directly
                chunkNormals.push(boxGeo.normals[v + 0]);
                chunkNormals.push(boxGeo.normals[v + 1]);
                chunkNormals.push(boxGeo.normals[v + 2]);
                // Add vertex colors
                chunkColors.push(baseColor.r, baseColor.g, baseColor.b, baseColor.a);
            }

            // Add box indices, adjusting for the current vertex offset
            for (let idx = 0; idx < boxGeo.indices.length; idx++) {
                chunkIndices.push(boxGeo.indices[idx] + currentIndex);
            }

            // Update the index offset for the next box
            // Each box adds boxGeo.positions.length / 3 vertices
            currentIndex += boxGeo.positions.length / 3;
        }
    }

    // --- Post results back to main thread ---
    if (chunkPositions.length > 0) {
        const positions = new Float32Array(chunkPositions);
        const indices = new Uint32Array(chunkIndices);
        const normals = new Float32Array(chunkNormals);
        const colors = new Float32Array(chunkColors);

        // Use Transferable Objects for efficiency (zero-copy)
        self.postMessage({
            type: 'geometry',
            id: id,
            level: level, // Pass level back for potential checks
            positions: positions.buffer,
            indices: indices.buffer,
            normals: normals.buffer,
            colors: colors.buffer
        }, [positions.buffer, indices.buffer, normals.buffer, colors.buffer]); // Transfer ownership
         // console.log(`Worker finished chunk: ${id} L${level}, vertices: ${positions.length / 3}`);

    } else {
        // Send an empty message or specific type if chunk is empty
        self.postMessage({ type: 'empty', id: id, level: level });
         // console.log(`Worker finished empty chunk: ${id} L${level}`);
    }
};

// Handle potential errors during worker initialization or execution
self.onerror = function(error) {
    console.error("Error in terrainWorker:", error);
    // Optionally inform the main thread
    // self.postMessage({ type: 'error', message: error.message });
};

console.log("Terrain worker initialized.");