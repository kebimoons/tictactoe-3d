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
                turn: -1,
                active: true
            };
        }
        const room = rooms[roomCode];
        if (room.players.length < 2) {
            const role = room.players.length === 0 ? 'P1' : 'P2';
            room.players.push({ id: socket.id, role, value: (role === 'P1' ? -1 : 1) });
            socket.join(roomCode);
            socket.emit('init', { board: room.board, role, turn: room.turn, roomCode });
            if (room.players.length === 2) io.to(roomCode).emit('updateBoard', { board: room.board, turn: room.turn });
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
        if (room.board[x][y][z] !== 0) {
            socket.emit('errorMsg', "Casilla ya ocupada");
            return;
        }

        room.board[x][y][z] = player.value;
        const winResult = checkWin(room.board, x, y, z, player.value);

        if (winResult) {
            room.active = false;
            io.to(roomCode).emit('gameOver', { 
                winnerId: socket.id, 
                board: room.board, 
                winningLine: winResult 
            });
        } else {
            room.turn *= -1;
            io.to(roomCode).emit('updateBoard', { board: room.board, turn: room.turn });
        }
    });

    socket.on('restartGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].board = Array(4).fill().map(() => Array(4).fill().map(() => Array(4).fill(0)));
            rooms[roomCode].turn = -1;
            rooms[roomCode].active = true;
            io.to(roomCode).emit('updateBoard', { board: rooms[roomCode].board, turn: rooms[roomCode].turn, reset: true });
        }
    });

    socket.on('leaveRoom', (roomCode) => {
        socket.leave(roomCode);
        // Si la sala se queda vacía, la borramos
        const clients = io.sockets.adapter.rooms.get(roomCode);
        if (!clients || clients.size === 0) delete rooms[roomCode];
    });
});

/**
 * ALGORITMO MATEMÁTICO DE LAS 13 VARIACIONES
 * Verifica los 13 casos descritos por el profesor.
 */
function checkWin(board, x, y, z, val) {
    const directions = [
        [1,0,0], [0,1,0], [0,0,1],                // 1-3: Frontales (H, V, Prof)
        [1,1,0], [1,-1,0],                         // 4-5: Diagonales Frontales
        [0,1,1], [0,1,-1],                         // 6-7: Diagonales Verticales
        [1,0,1], [1,0,-1],                         // 8-9: Diagonales Horizontales
        [1,1,1], [1,1,-1], [1,-1,1], [1,-1,-1]     // 10-13: Diagonales Cruzadas
    ];

    for (let [dx, dy, dz] of directions) {
        let line = [{x, y, z}];
        // Buscar hacia adelante
        line = line.concat(getDirCoords(board, x, y, z, dx, dy, dz, val));
        // Buscar hacia atrás
        line = line.concat(getDirCoords(board, x, y, z, -dx, -dy, -dz, val));

        if (line.length >= 4) return line;
    }
    return null;
}

function getDirCoords(board, x, y, z, dx, dy, dz, val) {
    let coords = [];
    let cx = x + dx, cy = y + dy, cz = z + dz;
    while (cx >= 0 && cx < 4 && cy >= 0 && cy < 4 && cz >= 0 && cz < 4 && board[cx][cy][cz] === val) {
        coords.push({x: cx, y: cy, z: cz});
        cx += dx; cy += dy; cz += dz;
    }
    return coords;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));