import * as THREE from 'three';

const socket = io();
let myRole = '', myRoom = '', myValue = 0;

// Configuración de la Escena 3D
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(280, 280);
document.getElementById('three-container').appendChild(renderer.domElement);

// GRUPO PRINCIPAL: Aquí metemos todo para que rote en bloque
const mainGroup = new THREE.Group();
scene.add(mainGroup);

camera.position.set(4, 4, 6);
camera.lookAt(0, 0, 0);

function initThreeGrid() {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x555555 });
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            for (let z = 0; z < 4; z++) {
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x - 1.5, y - 1.5, z - 1.5);
                mainGroup.add(m);
            }
        }
    }
}

// Unirse a sala
document.getElementById('joinBtn').onclick = () => {
    const code = document.getElementById('roomInput').value;
    if (code) {
        socket.emit('joinRoom', code);
        myRoom = code;
    }
};

socket.on('init', ({ board, role, turn, roomCode }) => {
    myRole = role;
    myValue = (role === 'P1') ? -1 : (role === 'P2' ? 1 : 0);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('role-badge').innerText = role === 'Spectator' ? 'ESPECTADOR' : `ERES: ${role}`;
    document.getElementById('room-id').innerText = `SALA: ${roomCode}`;
    render2DGrid(board);
    update3D(board);
});

function render2DGrid(board) {
    const container = document.getElementById('layers-container');
    container.innerHTML = '';
    for (let y = 3; y >= 0; y--) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer animate__animated animate__fadeInUp';
        layerDiv.innerHTML = `<h3>Nivel ${y + 1} (Altura)</h3>`;
        const grid = document.createElement('div');
        grid.className = 'grid';
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const val = board[x][y][z];
                if (val === -1) { cell.innerText = 'X'; cell.style.color = 'var(--p1)'; }
                if (val === 1) { cell.innerText = 'O'; cell.style.color = 'var(--p2)'; }
                cell.onclick = () => socket.emit('makeMove', { x, y, z, roomCode: myRoom });
                grid.appendChild(cell);
            }
        }
        layerDiv.appendChild(grid);
        container.appendChild(layerDiv);
    }
}

function update3D(board) {
    // Eliminar solo las esferas existentes en el grupo
    const spheres = mainGroup.children.filter(child => child.geometry.type === 'SphereGeometry');
    spheres.forEach(s => mainGroup.remove(s));

    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            for (let z = 0; z < 4; z++) {
                if (board[x][y][z] !== 0) {
                    const geo = new THREE.SphereGeometry(0.3, 16, 16);
                    const mat = new THREE.MeshBasicMaterial({ color: board[x][y][z] === -1 ? 0x00d4ff : 0xff4d4d });
                    const s = new THREE.Mesh(geo, mat);
                    s.position.set(x - 1.5, y - 1.5, z - 1.5);
                    mainGroup.add(s);
                }
            }
        }
    }
}

socket.on('updateBoard', ({ board, turn }) => {
    render2DGrid(board);
    update3D(board);
    const turnText = document.getElementById('turn-display');
    if (myValue === 0) {
        turnText.innerText = "OBSERVANDO...";
    } else {
        turnText.innerText = (turn === myValue) ? "¡TU TURNO!" : "ESPERANDO AL RIVAL...";
        turnText.style.color = (turn === myValue) ? "var(--p1)" : "#fff";
    }
});

socket.on('gameOver', ({ winnerId, winnerRole, board }) => {
    render2DGrid(board);
    update3D(board);
    const overlay = document.getElementById('overlay');
    const msg = document.getElementById('result-message');
    overlay.classList.remove('hidden');
    if (socket.id === winnerId) {
        msg.innerText = "¡GANASTE!";
        msg.className = "win animate__animated animate__tada";
    } else {
        msg.innerText = "PERDISTE";
        msg.className = "lose animate__animated animate__hinge";
    }
});

function animate() {
    requestAnimationFrame(animate);
    mainGroup.rotation.y += 0.01;
    renderer.render(scene, camera);
}

initThreeGrid();
animate();