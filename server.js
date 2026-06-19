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

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('saveScore', (data) => {
        if (data.name && data.score !== undefined) {
            db.saveScore(data.name, data.score);
        }
    });

    socket.on('getRanking', () => {
        db.getTopRankings(10, (rows) => {
            socket.emit('rankingData', rows);
        });
    });

    socket.on('findMatch', (name) => {
        socket.playerName = name;
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Match found
            const room = 'room_' + waitingPlayer.id + '_' + socket.id;
            socket.join(room);
            waitingPlayer.join(room);
            
            io.to(room).emit('matchFound', room);
            
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
        }
    });

    socket.on('cancelMatch', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
    });

    socket.on('updateScore', (data) => {
        // Could implement live score sync here if wanted
    });

    socket.on('playerDied', (room) => {
        socket.to(room).emit('opponentDied');
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
    });
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
