import * as THREE from 'three';

const socket = io();
let myRole = '', myRoom = '', myValue = 0;

// Referencias de Audio
const snds = {
    move: document.getElementById('snd-move'),
    win: document.getElementById('snd-win'),
    bgm: document.getElementById('snd-bgm')
};

// --- 1. FONDO DINÁMICO DE ESTRELLAS ---
const bgScene = new THREE.Scene();
const bgCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const bgRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
bgRenderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('bg-canvas-container').appendChild(bgRenderer.domElement);

const starGeo = new THREE.BufferGeometry();
const starCount = 2000;
const posArray = new Float32Array(starCount * 3);
for(let i=0; i < starCount * 3; i++) posArray[i] = (Math.random() - 0.5) * 15;
starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMesh = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.007, color: 0x00d4ff }));
bgScene.add(starMesh);
bgCamera.position.z = 5;

// --- 2. MINI CUBO 3D (VISUALIZADOR) ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(250, 250);
// Importante: Se adjunta al target dentro del container
document.getElementById('three-canvas-target').appendChild(renderer.domElement);

const mainGroup = new THREE.Group();
scene.add(mainGroup);
camera.position.set(4, 4, 6);
camera.lookAt(0, 0, 0);

function initThreeGrid() {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    for (let x=0; x<4; x++) {
        for (let y=0; y<4; y++) {
            for (let z=0; z<4; z++) {
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x - 1.5, y - 1.5, z - 1.5);
                mainGroup.add(m);
            }
        }
    }
}

// --- 3. LÓGICA DE INTERFAZ Y BOTONES ---

// Unirse a sala
document.getElementById('joinBtn').onclick = () => {
    const code = document.getElementById('roomInput').value;
    if (code) {
        myRoom = code;
        snds.bgm.volume = 0.2;
        snds.bgm.play().catch(() => console.log("Audio esperando interacción"));
        socket.emit('joinRoom', code);
    }
};

// Minimizar/Maximizar Cubo 3D
document.getElementById('toggle-3d').onclick = () => {
    const container = document.getElementById('three-container');
    container.classList.toggle('minimized');
    // Cambiar el icono del botón
    document.getElementById('toggle-3d').innerText = container.classList.contains('minimized') ? "+" : "_";
};

// Reiniciar Juego (desde el modal de victoria)
document.getElementById('retry-btn').onclick = () => {
    socket.emit('restartGame', myRoom);
};

// Salir al menú principal
const exitAction = () => {
    socket.emit('leaveRoom', myRoom);
    location.reload();
};
document.getElementById('menu-btn').onclick = exitAction;
document.getElementById('exit-btn').onclick = () => {
    if(confirm("¿Estás seguro de que quieres abandonar la partida?")) exitAction();
};

// --- 4. EVENTOS DE SOCKET ---

socket.on('init', ({ board, role, turn, roomCode }) => {
    myRole = role;
    myValue = (role === 'P1') ? -1 : (role === 'P2' ? 1 : 0);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('room-id').innerText = `SALA: ${roomCode}`;
    document.getElementById('role-badge').innerText = `PC: ${role}`;
    updateUI(board, turn);
});

socket.on('updateBoard', ({ board, turn, reset }) => {
    if(reset) document.getElementById('overlay').classList.add('hidden');
    snds.move.play().catch(() => {});
    updateUI(board, turn);
});

socket.on('errorMsg', (msg) => {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
});

socket.on('gameOver', ({ winnerId, board, winningLine }) => {
    updateUI(board, 0, winningLine);
    const overlay = document.getElementById('overlay');
    const msg = document.getElementById('result-message');
    overlay.classList.remove('hidden');
    
    if (socket.id === winnerId) {
        snds.win.play();
        msg.innerText = "¡VICTORIA!";
        msg.className = "win animate__animated animate__bounceIn";
    } else {
        msg.innerText = "DERROTA";
        msg.className = "lose animate__animated animate__shakeX";
    }
});

// --- 5. RENDERIZADO DE TABLEROS (2D Y 3D) ---

function updateUI(board, turn, winningLine = []) {
    // Actualizar Tableros 2D
    const container = document.getElementById('layers-container');
    container.innerHTML = '';
    
    for (let y = 3; y >= 0; y--) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer';
        layerDiv.innerHTML = `<h3>Nivel ${y + 1}</h3>`;
        const grid = document.createElement('div');
        grid.className = 'grid';

        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const val = board[x][y][z];
                
                if (val === -1) { cell.innerText = 'X'; cell.style.color = 'var(--p1)'; }
                if (val === 1) { cell.innerText = 'O'; cell.style.color = 'var(--p2)'; }

                // RESALTAR SI ES PARTE DE LA LÍNEA GANADORA
                const isWinner = winningLine.some(c => c.x === x && c.y === y && c.z === z);
                if (isWinner) {
                    cell.classList.add('win-highlight', 'animate__animated', 'animate__flash');
                }

                cell.onclick = () => socket.emit('makeMove', { x, y, z, roomCode: myRoom });
                grid.appendChild(cell);
            }
        }
        layerDiv.appendChild(grid);
        container.appendChild(layerDiv);
    }

    // Actualizar Texto de Turno
    const turnDisplay = document.getElementById('turn-display');
    if (myRole === 'Spectator') {
        turnDisplay.innerText = "ESPECTADOR";
    } else {
        turnDisplay.innerText = (turn === myValue) ? "TU TURNO" : "ESPERANDO RIVAL";
        turnDisplay.style.color = (turn === myValue) ? "var(--p1)" : "white";
    }

    // Actualizar Cubo 3D
    update3D(board, winningLine);
}

function update3D(board, winningLine) {
    // Limpiar solo las esferas
    const toRemove = mainGroup.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry');
    toRemove.forEach(s => mainGroup.remove(s));

    for(let x=0; x<4; x++) {
        for(let y=0; y<4; y++) {
            for(let z=0; z<4; z++) {
                if (board[x][y][z] !== 0) {
                    const isWin = winningLine.some(c => c.x === x && c.y === y && c.z === z);
                    const geo = new THREE.SphereGeometry(isWin ? 0.5 : 0.3, 16, 16);
                    const color = isWin ? 0xffd700 : (board[x][y][z] === -1 ? 0x00d4ff : 0xff4d4d);
                    const mat = new THREE.MeshBasicMaterial({ color });
                    const s = new THREE.Mesh(geo, mat);
                    s.position.set(x - 1.5, y - 1.5, z - 1.5);
                    mainGroup.add(s);
                }
            }
        }
    }
}

// --- 6. LOOPS DE ANIMACIÓN ---
let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) - 0.5;
    mouseY = (e.clientY / window.innerHeight) - 0.5;
});

function animate() {
    requestAnimationFrame(animate);
    
    // Fondo
    starMesh.rotation.y += 0.001;
    starMesh.position.x += (mouseX * 0.3 - starMesh.position.x) * 0.05;
    starMesh.position.y += (-mouseY * 0.3 - starMesh.position.y) * 0.05;
    bgRenderer.render(bgScene, bgCamera);

    // Mini Cubo
    mainGroup.rotation.y += 0.01;
    renderer.render(scene, camera);
}

initThreeGrid();
animate();

window.addEventListener('resize', () => {
    bgCamera.aspect = window.innerWidth / window.innerHeight;
    bgCamera.updateProjectionMatrix();
    bgRenderer.setSize(window.innerWidth, window.innerHeight);
});