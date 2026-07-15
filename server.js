const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const db = require('./database.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

db.initDB();

let waitingPlayers = {
    normal: null,
    hyper: null,
    another: null,
    leggendaria: null,
    dp: null
};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('saveScore', (data) => {
        if (data.name && data.score !== undefined) {
            db.saveScore(data.name, data.score, data.mode || 'normal');
        }
    });

    socket.on('getRanking', (mode) => {
        db.getTopRankings(mode || 'normal', 10, (rows) => {
            socket.emit('rankingData', rows);
        });
    });

    socket.on('findMatch', (data) => {
        const playerName = data.name || '名無しさん';
        const mode = data.mode || 'normal';
        
        socket.playerName = playerName;
        socket.gameMode = mode;

        if (waitingPlayers[mode] && waitingPlayers[mode] !== socket) {
            const opponent = waitingPlayers[mode];
            waitingPlayers[mode] = null;
            
            // Match found
            const room = 'room_' + opponent.id + '_' + socket.id;
            socket.join(room);
            opponent.join(room);
            
            io.to(room).emit('matchFound', { room: room, mode: mode });
        } else {
            waitingPlayers[mode] = socket;
        }
    });

    socket.on('cancelMatch', () => {
        if (waitingPlayers[socket.gameMode] === socket) {
            waitingPlayers[socket.gameMode] = null;
        }
    });

    socket.on('gameState', (data) => {
        socket.to(data.room).emit('opponentState', data);
    });

    socket.on('playerDied', (room) => {
        socket.to(room).emit('opponentDied');
    });

    socket.on('disconnect', () => {
        if (waitingPlayers[socket.gameMode] === socket) {
            waitingPlayers[socket.gameMode] = null;
        }
    });
});

const PORT = 3040;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
