import * as THREE from 'three';

const socket = io();
let myRole = '', myRoom = '', myValue = 0;

// Audios
const snds = {
    move: document.getElementById('snd-move'),
    win: document.getElementById('snd-win'),
    lose: document.getElementById('snd-lose'),
    bgm: document.getElementById('snd-bgm')
};

// --- FONDO DINÁMICO (Sin cambios) ---
const bgScene = new THREE.Scene();
const bgCamera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const bgRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
bgRenderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('bg-canvas-container').appendChild(bgRenderer.domElement);

const starGeo = new THREE.BufferGeometry();
const starCount = 2000;
const posArray = new Float32Array(starCount * 3);
for(let i=0; i<starCount*3; i++) posArray[i] = (Math.random() - 0.5) * 10;
starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMesh = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.005, color: 0x00d4ff }));
bgScene.add(starMesh);
bgCamera.position.z = 2;

// --- MINI CUBO 3D ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(250, 250);
document.getElementById('three-canvas-target').appendChild(renderer.domElement);
const mainGroup = new THREE.Group();
scene.add(mainGroup);
camera.position.set(4, 4, 6);
camera.lookAt(0,0,0);

// Minimizar 3D
document.getElementById('toggle-3d').onclick = () => {
    document.getElementById('three-container').classList.toggle('minimized');
};

function initThreeGrid() {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    for (let x=0; x<4; x++) for (let y=0; y<4; y++) for (let z=0; z<4; z++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x-1.5, y-1.5, z-1.5);
        mainGroup.add(m);
    }
}

// Iniciar
document.getElementById('joinBtn').onclick = () => {
    const code = document.getElementById('roomInput').value;
    if (code) {
        snds.bgm.volume = 0.2;
        snds.bgm.play().catch(e => console.log("Audio bloqueado"));
        socket.emit('joinRoom', code);
        myRoom = code;
    }
};

socket.on('init', ({ board, role, turn, roomCode }) => {
    myRole = role;
    myValue = (role === 'P1') ? -1 : (role === 'P2' ? 1 : 0);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('room-id').innerText = `SALA: ${roomCode}`;
    document.getElementById('role-badge').innerText = `ERES: ${role}`;
    
    // CORRECCIÓN: Actualizar el texto del turno inmediatamente
    updateTurnText(turn);
    render2DGrid(board);
    update3D(board);
});

function updateTurnText(turn) {
    const display = document.getElementById('turn-display');
    if (myRole === 'Spectator') {
        display.innerText = "MODO ESPECTADOR";
    } else {
        if (turn === myValue) {
            display.innerText = "TU TURNO";
            display.style.color = "var(--p1)";
        } else {
            display.innerText = "ESPERANDO RIVAL...";
            display.style.color = "white";
        }
    }
}

function render2DGrid(board) {
    const container = document.getElementById('layers-container');
    container.innerHTML = '';
    for (let y = 3; y >= 0; y--) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer';
        layerDiv.innerHTML = `<h3>NIVEL ${y + 1}</h3>`;
        const grid = document.createElement('div');
        grid.className = 'grid';
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                const cell = document.createElement('div');
                cell.className = 'cell animate__animated animate__fadeIn';
                if (board[x][y][z] === -1) { cell.innerText = 'X'; cell.style.color = 'var(--p1)'; }
                if (board[x][y][z] === 1) { cell.innerText = 'O'; cell.style.color = 'var(--p2)'; }
                
                // Enviar jugada
                cell.onclick = () => {
                    socket.emit('makeMove', { x, y, z, roomCode: myRoom });
                };
                grid.appendChild(cell);
            }
        }
        layerDiv.appendChild(grid);
        container.appendChild(layerDiv);
    }
}

function update3D(board) {
    // Limpiar esferas
    const spheres = mainGroup.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry');
    spheres.forEach(s => mainGroup.remove(s));

    for (let x=0; x<4; x++) for (let y=0; y<4; y++) for (let z=0; z<4; z++) {
        if (board[x][y][z] !== 0) {
            const mat = new THREE.MeshBasicMaterial({ color: board[x][y][z] === -1 ? 0x00d4ff : 0xff4d4d });
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), mat);
            s.position.set(x-1.5, y-1.5, z-1.5);
            mainGroup.add(s);
        }
    }
}

socket.on('updateBoard', ({ board, turn }) => {
    if (myRoom) snds.move.play().catch(() => {});
    updateTurnText(turn);
    render2DGrid(board);
    update3D(board);
});

socket.on('gameOver', ({ winnerId, winnerRole, board }) => {
    render2DGrid(board);
    update3D(board);
    snds.bgm.pause();
    const overlay = document.getElementById('overlay');
    overlay.classList.remove('hidden');
    const msg = document.getElementById('result-message');
    if (socket.id === winnerId) {
        snds.win.play();
        msg.innerText = "¡GANASTE!";
        msg.className = "win animate__animated animate__bounceIn";
    } else {
        snds.lose.play();
        msg.innerText = "PERDISTE";
        msg.className = "lose animate__animated animate__shakeX";
    }
});

// Loop de animación
let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth) - 0.5;
    mouseY = (e.clientY / window.innerHeight) - 0.5;
});

function animate() {
    requestAnimationFrame(animate);
    // Estrellas
    starMesh.rotation.y += 0.001;
    starMesh.position.x += (mouseX * 0.2 - starMesh.position.x) * 0.05;
    starMesh.position.y += (-mouseY * 0.2 - starMesh.position.y) * 0.05;
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