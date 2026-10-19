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

// 対戦モード (基本モード + _chord 対応)
const ALL_MODES = ['normal', 'hyper', 'another', 'leggendaria', 'dp']
    .flatMap(m => [m, m + '_chord']);

let waitingPlayers = {};
ALL_MODES.forEach(m => { waitingPlayers[m] = null; });

// スコアの上限(異常な値の登録を防止)
const MAX_SCORE = 100000;
// 名牌の上限
const MAX_NAME_LEN = 32;
// saveScore のレート制限(秒・回)
const SAVE_RATE_LIMIT_MS = 1000;
const SAVE_RATE_LIMIT_COUNT = 5;

// 名牌の正規化: trim + 32文字制限。空白のみの場合は null
function normalizeName(raw) {
    if (typeof raw !== 'string') return null;
    const name = raw.trim().slice(0, MAX_NAME_LEN);
    if (name.length === 0) return null;
    return name;
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // saveScore のレート制限用記録
    let saveScoreTimestamps = [];

    socket.on('saveScore', (data) => {
        // データ型の検証
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;

        // 名牌の検証: trim + 32文字制限、空白のみ拒否
        const name = normalizeName(data.name);
        if (!name) return;

        // スコアは 0〜MAX_SCORE の整数のみ許可
        if (!Number.isInteger(data.score) || data.score < 0 || data.score > MAX_SCORE) return;

        // モードの検証
        const mode = (typeof data.mode === 'string' && ALL_MODES.includes(data.mode)) ? data.mode : 'normal';

        // レート制限: 1秒以内に N 回以上は拒否
        const now = Date.now();
        saveScoreTimestamps = saveScoreTimestamps.filter(t => now - t < SAVE_RATE_LIMIT_MS);
        if (saveScoreTimestamps.length >= SAVE_RATE_LIMIT_COUNT) {
            console.warn('saveScore rate limit hit for socket:', socket.id);
            return;
        }
        saveScoreTimestamps.push(now);

        db.saveScore(name, data.score, mode);
    });

    socket.on('getRanking', (mode) => {
        db.getTopRankings(mode || 'normal', 10, (rows) => {
            socket.emit('rankingData', rows);
        });
    });

    socket.on('findMatch', (data) => {
        // データ型の検証
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;

        // モードの検証: 不正なモードはデフォルトにフォールバック
        const mode = (typeof data.mode === 'string' && ALL_MODES.includes(data.mode)) ? data.mode : 'normal';

        // 名牌の検証: trim + 32文字制限
        const playerName = normalizeName(data.name) || '名無しさん';

        // H1: このsocketの既存のキュー登録をクリア(重複登録を防止)
        for (const m in waitingPlayers) {
            if (waitingPlayers[m] === socket) waitingPlayers[m] = null;
        }

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
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        if (typeof data.room !== 'string') return;
        // H6: 送信元がルームに実際に参加していること
        if (!socket.rooms.has(data.room)) return;
        // H6: スコアは有限な数字のみ
        if (typeof data.score !== 'number' || !Number.isFinite(data.score)) return;
        // H6: tilesは配列の上限のみを強制し、各要素は受信側が個別に検証する
        if (data.tiles !== undefined) {
            if (Array.isArray(data.tiles)) {
                if (data.tiles.length > 512) data.tiles = data.tiles.slice(0, 512);
            } else {
                data.tiles = [];
            }
        }
        socket.to(data.room).emit('opponentState', data);
        // H5: server 側のスコア追跡(死亡時の突合に使用)
        const scoreMap = (socket.lastGameStates = socket.lastGameStates || new Map());
        scoreMap.set(data.room, { score: data.score });
    });

    // H5: playerDiedは権威を持たない。
    // 死んだクライアントが最終スコアを selfReport に送り、
    // 直前の server 側の gameState のスコアと突合して矛盾する場合は無視する。
    const finalScoreReports = new Map(); // socket.id -> { score, room, at }

    function handleDeath(socket, selfReport) {
        if (!selfReport || typeof selfReport !== 'object' || Array.isArray(selfReport)) return;
        const room = selfReport.room;
        if (typeof room !== 'string') return;
        // 送信元がルームに実際に参加していること
        if (!socket.rooms.has(room)) return;

        const lastStates = (socket.lastGameStates = socket.lastGameStates || new Map());
        const last = lastStates.get(room);

        const finalScore = selfReport.score;
        if (typeof finalScore === 'number' && Number.isFinite(finalScore)
            && Number.isInteger(finalScore) && finalScore >= 0 && finalScore <= MAX_SCORE
            && last && Number.isInteger(last.score)
            && Math.abs(finalScore - last.score) <= 2) {
            // 最終スコアが直前のレポートと一致 → 相手を死亡通知
            socket.to(room).emit('opponentDied');
        }
    }

    socket.on('playerDied', (data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        if (typeof data.room !== 'string') return;
        if (!socket.rooms.has(data.room)) return;
        handleDeath(socket, data);
    });

    socket.on('gameEnded', (data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        if (typeof data.room !== 'string') return;
        if (!socket.rooms.has(data.room)) return;
        // レースの保険のため死亡もここで突合
        handleDeath(socket, data);
        // ルームから離脱
        socket.leave(data.room);
    });

    socket.on('disconnect', () => {
        if (waitingPlayers[socket.gameMode] === socket) {
            waitingPlayers[socket.gameMode] = null;
        }
        // 対戦中に相手が切断した場合に通知する
        if (socket.gameMode) {
            const rooms = socket.rooms;
            if (rooms && rooms.size) {
                const opponents = new Set();
                rooms.forEach((room) => {
                    if (room !== socket.id) {
                        io.in(room).sockets.forEach((otherId) => {
                            if (otherId !== socket.id) opponents.add(otherId);
                        });
                    }
                });
                if (opponents.size) {
                    io.to([...opponents]).emit('opponentDisconnected');
                }
            }
        }
    });
});

const PORT = 3040;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
