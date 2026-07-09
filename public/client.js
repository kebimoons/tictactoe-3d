import * as THREE from 'three';

const socket = io();
let myRole = '', myRoom = '', myValue = 0;
let ghostMesh = null;
const tooltip = document.getElementById('coord-tooltip');

const snds = {
    move: document.getElementById('snd-move'),
    win: document.getElementById('snd-win'),
    bgm: document.getElementById('snd-bgm')
};

// --- FONDO DINÁMICO ---
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

// --- MINI CUBO 3D ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(250, 250);
document.getElementById('three-canvas-target').appendChild(renderer.domElement);
const mainGroup = new THREE.Group();
scene.add(mainGroup);
camera.position.set(4, 4, 6);
camera.lookAt(0, 0, 0);

function initThreeGrid() {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    for (let x=0; x<4; x++) for (let y=0; y<4; y++) for (let z=0; z<4; z++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x - 1.5, y - 1.5, z - 1.5);
        mainGroup.add(m);
    }
    // Inicializar Ghost Mesh
    const ghostGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, wireframe: true });
    ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMesh.visible = false;
    mainGroup.add(ghostMesh);
}

// --- BOTONES ---
document.getElementById('joinBtn').onclick = () => {
    const code = document.getElementById('roomInput').value;
    if (code) {
        myRoom = code;
        snds.bgm.volume = 0.2;
        snds.bgm.play().catch(() => {});
        socket.emit('joinRoom', code);
    }
};

document.getElementById('toggle-3d').onclick = () => document.getElementById('three-container').classList.toggle('minimized');
document.getElementById('btn-minimize-modal').onclick = () => document.getElementById('overlay').classList.toggle('modal-minimized');
document.getElementById('retry-btn').onclick = () => socket.emit('restartGame', myRoom);
document.getElementById('menu-btn').onclick = () => { socket.emit('leaveRoom', myRoom); location.reload(); };
document.getElementById('exit-btn').onclick = () => { if(confirm("¿Abandonar partida?")) location.reload(); };

// --- SOCKETS ---
socket.on('init', ({ board, role, turn, roomCode }) => {
    myRole = role; myValue = (role === 'P1') ? -1 : (role === 'P2' ? 1 : 0);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('room-id').innerText = `SALA: ${roomCode}`;
    document.getElementById('role-badge').innerText = `PC: ${role}`;
    updateUI(board, turn);
});

socket.on('updateBoard', ({ board, turn, reset }) => {
    if(reset) {
        document.getElementById('overlay').className = 'hidden';
        document.getElementById('overlay').classList.remove('modal-minimized');
    }
    snds.move.play().catch(() => {});
    updateUI(board, turn);
});

socket.on('gameOver', ({ winnerId, board, winningLine }) => {
    updateUI(board, 0, winningLine);
    setTimeout(() => {
        const overlay = document.getElementById('overlay');
        overlay.classList.remove('hidden');
        const msg = document.getElementById('result-message');
        if (socket.id === winnerId) { snds.win.play(); msg.innerText = "¡GANASTE!"; msg.style.color = "var(--p1)"; }
        else { msg.innerText = "DERROTA"; msg.style.color = "var(--p2)"; }
    }, 4000);
});

function updateUI(board, turn, winningLine = []) {
    const container = document.getElementById('layers-container');
    container.innerHTML = '';
    for (let y = 3; y >= 0; y--) {
        const layer = document.createElement('div');
        layer.className = 'layer';
        layer.innerHTML = `<h3>Nivel ${y + 1}</h3>`;
        const grid = document.createElement('div');
        grid.className = 'grid';
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                if (board[x][y][z] === -1) { cell.innerText = 'X'; cell.style.color = 'var(--p1)'; }
                if (board[x][y][z] === 1) { cell.innerText = 'O'; cell.style.color = 'var(--p2)'; }
                if (winningLine.some(c => c.x === x && c.y === y && c.z === z)) cell.classList.add('win-highlight');

                cell.onmouseenter = () => {
                    tooltip.innerText = `Pos: (${x}, ${y}, ${z})`;
                    tooltip.classList.remove('hidden');
                    if(ghostMesh) {
                        ghostMesh.position.set(x - 1.5, y - 1.5, z - 1.5);
                        ghostMesh.visible = true;
                        ghostMesh.material.color.set(myValue === -1 ? 0x00d4ff : 0xff4d4d);
                    }
                };
                cell.onmousemove = (e) => { tooltip.style.left = e.clientX + 'px'; tooltip.style.top = e.clientY + 'px'; };
                cell.onmouseleave = () => { tooltip.classList.add('hidden'); if(ghostMesh) ghostMesh.visible = false; };
                cell.onclick = () => socket.emit('makeMove', { x, y, z, roomCode: myRoom });
                grid.appendChild(cell);
            }
        }
        layer.appendChild(grid);
        container.appendChild(layer);
    }
    const td = document.getElementById('turn-display');
    td.innerText = (turn === myValue) ? "TU TURNO" : "ESPERANDO RIVAL";
    td.style.color = (turn === myValue) ? "var(--p1)" : "white";
    update3D(board, winningLine);
}

function update3D(board, winningLine) {
    const toRemove = mainGroup.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry');
    toRemove.forEach(s => mainGroup.remove(s));
    for(let x=0; x<4; x++) for(let y=0; y<4; y++) for(let z=0; z<4; z++) {
        if (board[x][y][z] !== 0) {
            const isWin = winningLine.some(c => c.x === x && c.y === y && c.z === z);
            const s = new THREE.Mesh(new THREE.SphereGeometry(isWin ? 0.5 : 0.3), new THREE.MeshBasicMaterial({ color: isWin ? 0xffd700 : (board[x][y][z] === -1 ? 0x00d4ff : 0xff4d4d) }));
            s.position.set(x - 1.5, y - 1.5, z - 1.5);
            mainGroup.add(s);
        }
    }
}

let mX = 0, mY = 0;
window.addEventListener('mousemove', (e) => { mX = (e.clientX / window.innerWidth) - 0.5; mY = (e.clientY / window.innerHeight) - 0.5; });

function animate() {
    requestAnimationFrame(animate);
    starMesh.rotation.y += 0.001;
    starMesh.position.x += (mX * 0.3 - starMesh.position.x) * 0.05;
    starMesh.position.y += (-mY * 0.3 - starMesh.position.y) * 0.05;
    bgRenderer.render(bgScene, bgCamera);
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