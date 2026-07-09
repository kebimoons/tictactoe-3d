const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomCode) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                board: Array(4).fill().map(() => Array(4).fill().map(() => Array(4).fill(0))),
                players: [],
                turn: -1, // Empieza P1 (-1)
                active: true
            };
        }

        const room = rooms[roomCode];
        if (room.players.length < 2) {
            const role = room.players.length === 0 ? 'P1' : 'P2';
            const value = role === 'P1' ? -1 : 1;
            room.players.push({ id: socket.id, role, value });
            socket.join(roomCode);
            socket.emit('init', { board: room.board, role, turn: room.turn, roomCode });
        } else {
            socket.join(roomCode);
            socket.emit('init', { board: room.board, role: 'Spectator', turn: room.turn, roomCode });
        }
    });

    socket.on('makeMove', ({ x, y, z, roomCode }) => {
        const room = rooms[roomCode];
        if (!room || !room.active) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.value !== room.turn) return;
        if (room.board[x][y][z] !== 0) return;

        room.board[x][y][z] = player.value;

        if (checkWin(room.board, x, y, z, player.value)) {
            room.active = false;
            io.to(roomCode).emit('gameOver', { winnerId: socket.id, winnerRole: player.role, board: room.board });
        } else {
            room.turn *= -1;
            io.to(roomCode).emit('updateBoard', { board: room.board, turn: room.turn });
        }
    });

    socket.on('disconnect', () => {
        // Limpieza opcional de salas vacías
    });
});

function checkWin(board, x, y, z, val) {
    const directions = [
        [1,0,0], [0,1,0], [0,0,1],                // Ortogonales
        [1,1,0], [1,-1,0], [1,0,1], [1,0,-1], [0,1,1], [0,1,-1], // Diagonales planas
        [1,1,1], [1,1,-1], [1,-1,1], [1,-1,-1]    // Diagonales cruzadas
    ];
    for (let [dx, dy, dz] of directions) {
        let count = 1 + countInDir(board, x, y, z, dx, dy, dz, val) + countInDir(board, x, y, z, -dx, -dy, -dz, val);
        if (count >= 4) return true;
    }
    return false;
}

function countInDir(board, x, y, z, dx, dy, dz, val) {
    let c = 0, cx = x+dx, cy = y+dy, cz = z+dz;
    while (cx>=0 && cx<4 && cy>=0 && cy<4 && cz>=0 && cz<4 && board[cx][cy][cz] === val) {
        c++; cx+=dx; cy+=dy; cz+=dz;
    }
    return c;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));