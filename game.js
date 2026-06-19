const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const opponentCanvas = document.getElementById('opponentCanvas');
const oppCtx = opponentCanvas.getContext('2d');

const port = (window.location.port === '' || window.location.port === '80') ? ':3001' : `:${window.location.port}`;
const socketUrl = window.location.protocol + '//' + window.location.hostname + port;
const socket = io(socketUrl);

// UI Elements
const startScreen = document.getElementById('start-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const rankingScreen = document.getElementById('ranking-screen');
const scoreDisplay = document.getElementById('score-display');
const opponentScoreDisplay = document.getElementById('opponent-score-display');
const opponentContainer = document.getElementById('opponent-container');
const finalScoreSpan = document.getElementById('final-score');
const multiResult = document.getElementById('multi-result');
const playerNameInput = document.getElementById('playerName');
const rankingList = document.getElementById('ranking-list');

const btnSingle = document.getElementById('btn-single');
const btnMulti = document.getElementById('btn-multi');
const btnRanking = document.getElementById('btn-ranking');
const btnCancel = document.getElementById('btn-cancel');
const btnRestart = document.getElementById('btn-restart');
const btnCloseRanking = document.getElementById('btn-close-ranking');

// Game constants
let COLS = 4;
let COL_WIDTH = canvas.width / COLS;
const TILE_HEIGHT = 150;
let KEYS = ['d', 'f', 'j', 'k'];
let currentMode = 'normal';

function setMode(mode) {
    currentMode = mode;
    let newWidth = 400;
    
    if (mode === 'normal') {
        COLS = 4;
        KEYS = ['d', 'f', 'j', 'k'];
        newWidth = 400;
    } else if (mode === 'hyper') {
        COLS = 6;
        KEYS = ['s', 'd', 'f', 'j', 'k', 'l'];
        newWidth = 500;
    } else if (mode === 'another') {
        COLS = 8;
        KEYS = ['a', 's', 'd', 'f', 'j', 'k', 'l', '+'];
        newWidth = 600;
    }
    
    canvas.width = newWidth;
    document.getElementById('game-container').style.width = newWidth + 'px';
    opponentCanvas.width = newWidth / 2;
    
    COL_WIDTH = canvas.width / COLS;
    drawBoard();
}

// Game state
let tiles = [];
let score = 0;
let speed = 5;
let animationId;
let isPlaying = false;
let isMultiplayer = false;
let myName = "Player";
let currentRoom = null;

// Initial Draw
drawBoard();

// Load name from local storage
const savedName = localStorage.getItem('playerName');
if (savedName) {
    playerNameInput.value = savedName;
}

// Mode Selection Change Event
const modeRadios = document.querySelectorAll('input[name="gameMode"]');
modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        setMode(e.target.value);
    });
});

// Events
btnSingle.addEventListener('click', () => {
    myName = playerNameInput.value || "Anonymous";
    localStorage.setItem('playerName', myName);
    
    const modeVal = document.querySelector('input[name="gameMode"]:checked').value;
    setMode(modeVal);
    
    isMultiplayer = false;
    startScreen.classList.add('hidden');
    startGame();
});

btnMulti.addEventListener('click', () => {
    myName = playerNameInput.value || "Anonymous";
    localStorage.setItem('playerName', myName);
    
    const modeVal = document.querySelector('input[name="gameMode"]:checked').value;
    setMode(modeVal);
    
    isMultiplayer = true;
    startScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    socket.emit('findMatch', { name: myName, mode: currentMode });
});

btnCancel.addEventListener('click', () => {
    socket.emit('cancelMatch');
    waitingScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

btnRestart.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

let currentRankingMode = 'normal';

function updateRankingTitle() {
    const title = document.getElementById('ranking-title');
    if (currentRankingMode === 'normal') title.innerText = 'ランキング (Normal)';
    if (currentRankingMode === 'hyper') title.innerText = 'ランキング (Hyper)';
    if (currentRankingMode === 'another') title.innerText = 'ランキング (Another)';
}

btnRanking.addEventListener('click', () => {
    currentRankingMode = document.querySelector('input[name="gameMode"]:checked').value;
    updateRankingTitle();
    socket.emit('getRanking', currentRankingMode);
});

document.getElementById('btn-rank-normal').addEventListener('click', () => {
    currentRankingMode = 'normal';
    updateRankingTitle();
    socket.emit('getRanking', currentRankingMode);
});

document.getElementById('btn-rank-hyper').addEventListener('click', () => {
    currentRankingMode = 'hyper';
    updateRankingTitle();
    socket.emit('getRanking', currentRankingMode);
});

document.getElementById('btn-rank-another').addEventListener('click', () => {
    currentRankingMode = 'another';
    updateRankingTitle();
    socket.emit('getRanking', currentRankingMode);
});

btnCloseRanking.addEventListener('click', () => {
    rankingScreen.classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    
    let key = e.key.toLowerCase();
    if (key === ';') key = '+';
    
    const colIndex = KEYS.indexOf(key);
    
    if (colIndex !== -1) {
        handleInput(colIndex);
    }
});

document.addEventListener('keyup', (e) => {
    if (!isPlaying) return;
    let key = e.key.toLowerCase();
    if (key === ';') key = '+';
    const colIndex = KEYS.indexOf(key);
    if (colIndex !== -1) {
        handleRelease(colIndex);
    }
});

function handlePointerDown(e) {
    if (!isPlaying) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const colWidthOnScreen = rect.width / COLS;

    if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const x = touch.clientX - rect.left;
            const colIndex = Math.floor(x / colWidthOnScreen);
            if (colIndex >= 0 && colIndex < COLS) {
                handleInput(colIndex);
            }
        }
    } else {
        const x = e.clientX - rect.left;
        const colIndex = Math.floor(x / colWidthOnScreen);
        if (colIndex >= 0 && colIndex < COLS) {
            handleInput(colIndex);
        }
    }
}

function handlePointerUp(e) {
    if (!isPlaying) return;
    
    const rect = canvas.getBoundingClientRect();
    const colWidthOnScreen = rect.width / COLS;

    if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const x = touch.clientX - rect.left;
            const colIndex = Math.floor(x / colWidthOnScreen);
            if (colIndex >= 0 && colIndex < COLS) {
                handleRelease(colIndex);
            }
        }
    } else {
        const x = e.clientX - rect.left;
        const colIndex = Math.floor(x / colWidthOnScreen);
        if (colIndex >= 0 && colIndex < COLS) {
            handleRelease(colIndex);
        }
    }
}

canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('touchend', handlePointerUp);
canvas.addEventListener('mouseup', handlePointerUp);
canvas.addEventListener('mouseleave', handlePointerUp);

// Socket Events
socket.on('matchFound', (data) => {
    currentRoom = data.room;
    setMode(data.mode);
    waitingScreen.classList.add('hidden');
    startGame();
});

socket.on('opponentDied', () => {
    if (isPlaying && isMultiplayer) {
        isPlaying = false;
        cancelAnimationFrame(animationId);
        showGameOver(true, "相手がミスしました！あなたの勝ちです！");
    }
});

socket.on('opponentState', (data) => {
    if (isPlaying && isMultiplayer) {
        opponentScoreDisplay.innerText = "Opponent: " + data.score;
        drawOpponentBoard(data.tiles);
    }
});

socket.on('rankingData', (data) => {
    rankingList.innerHTML = '';
    data.forEach((entry, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}. ${entry.name}</span><span>${entry.score}</span>`;
        rankingList.appendChild(li);
    });
    rankingScreen.classList.remove('hidden');
});

// Game Functions
function startGame() {
    tiles = [];
    score = 0;
    speed = 5;
    scoreDisplay.innerText = score;
    scoreDisplay.classList.remove('hidden');
    
    if (isMultiplayer) {
        opponentScoreDisplay.innerText = "Opponent: 0";
        opponentScoreDisplay.classList.remove('hidden');
        opponentContainer.classList.remove('hidden');
        oppCtx.clearRect(0, 0, opponentCanvas.width, opponentCanvas.height);
    } else {
        opponentScoreDisplay.classList.add('hidden');
        opponentContainer.classList.add('hidden');
    }
    
    isPlaying = true;
    
    multiResult.classList.add('hidden');
    
    // Initial tiles
    let currentY = 0;
    for (let i = 0; i < 6; i++) {
        spawnTile(currentY);
        currentY -= tiles[tiles.length - 1].height;
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function spawnTile(yPos) {
    const col = Math.floor(Math.random() * COLS);
    const isLong = Math.random() < 0.2; // 20% chance for long tile
    const height = isLong ? TILE_HEIGHT * (Math.floor(Math.random() * 3) + 2) : TILE_HEIGHT;
    
    tiles.push({
        col: col,
        y: yPos,
        height: height,
        clicked: false,
        isError: false,
        isLong: isLong,
        held: false,
        completed: false
    });
}

function gameLoop() {
    if (!isPlaying) return;
    
    update();
    draw();
    
    if (isPlaying) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

function update() {
    speed = 5 + Math.floor(score / 15); // Increase speed gradually
    
    for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        tile.y += speed;
        
        if (!tile.completed && !tile.held && tile.y > canvas.height) {
            tile.isError = true;
            gameOver("Missed a tile!");
            return;
        }
        
        if (tile.held && tile.y - tile.height >= canvas.height) {
            tile.held = false;
            tile.completed = true;
            tile.clicked = true;
            score += Math.floor(tile.height / TILE_HEIGHT); // Bonus for holding!
            scoreDisplay.innerText = score;
        }
    }
    
    // Remove completed tiles that are off screen
    if (tiles[0] && tiles[0].y - tiles[0].height > canvas.height && tiles[0].completed) {
        tiles.shift();
    }
    
    // Spawn new tiles
    const lastTile = tiles[tiles.length - 1];
    if (lastTile && lastTile.y - lastTile.height > -TILE_HEIGHT) {
        spawnTile(lastTile.y - lastTile.height);
    }
    
    if (isMultiplayer) {
        socket.emit('gameState', { room: currentRoom, score: score, tiles: tiles });
    }
}

function draw() {
    drawBoard();
    
    for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        
        if (tile.isError) {
            ctx.fillStyle = 'red';
        } else if (tile.completed || tile.clicked) {
            ctx.fillStyle = '#ccc';
        } else if (tile.held) {
            ctx.fillStyle = '#add8e6';
        } else {
            ctx.fillStyle = 'black';
        }
        
        ctx.fillRect(tile.col * COL_WIDTH, tile.y - tile.height, COL_WIDTH, tile.height);
        
        // Tile border
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.col * COL_WIDTH, tile.y - tile.height, COL_WIDTH, tile.height);
    }
}

function drawBoard() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * COL_WIDTH, 0);
        ctx.lineTo(i * COL_WIDTH, canvas.height);
        ctx.stroke();
    }
    
    // Draw letters at bottom
    ctx.fillStyle = '#666';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < COLS; i++) {
        ctx.fillText(KEYS[i].toUpperCase(), i * COL_WIDTH + COL_WIDTH / 2, canvas.height - 20);
    }
}

function handleInput(colIndex) {
    let targetTile = null;
    
    for (let i = 0; i < tiles.length; i++) {
        if (!tiles[i].completed && !tiles[i].held) {
            targetTile = tiles[i];
            break;
        }
    }
    
    if (targetTile) {
        if (targetTile.y > 0) { // tile is visible
            if (targetTile.col === colIndex) {
                if (targetTile.isLong) {
                    targetTile.held = true;
                } else {
                    targetTile.completed = true;
                    targetTile.clicked = true;
                }
                score++;
                scoreDisplay.innerText = score;
                
                if (isMultiplayer) {
                    socket.emit('gameState', { room: currentRoom, score: score, tiles: tiles });
                }
            } else {
                tiles.push({
                    col: colIndex,
                    y: targetTile.y,
                    height: TILE_HEIGHT,
                    completed: false,
                    isError: true
                });
                gameOver("Wrong key!");
            }
        }
    }
}

function handleRelease(colIndex) {
    for (let i = 0; i < tiles.length; i++) {
        let t = tiles[i];
        if (t.col === colIndex && t.held && !t.completed) {
            t.held = false;
            // Check if top edge has passed the bottom margin
            if (t.y - t.height < canvas.height - 30) { 
                t.isError = true;
                gameOver("Released too early!");
            } else {
                t.completed = true;
                t.clicked = true;
            }
        }
    }
}

function gameOver(reason) {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    draw();
    
    setTimeout(() => {
        if (isMultiplayer) {
            socket.emit('playerDied', currentRoom);
            showGameOver(false, "あなたのミスです...負けました。");
        } else {
            // Save score locally/on server
            if (score > 0) {
                socket.emit('saveScore', { name: myName, score: score, mode: currentMode });
            }
            showGameOver(false, "");
        }
    }, 500);
}

function showGameOver(isWin, message) {
    scoreDisplay.classList.add('hidden');
    opponentScoreDisplay.classList.add('hidden');
    finalScoreSpan.innerText = score;
    
    if (isMultiplayer) {
        multiResult.innerText = message;
        multiResult.className = isWin ? 'win-text' : 'lose-text';
        multiResult.classList.remove('hidden');
        document.getElementById('go-title').innerText = isWin ? "You Win!" : "You Lose!";
        document.getElementById('go-title').style.color = isWin ? "#4CAF50" : "#F44336";
    } else {
        document.getElementById('go-title').innerText = "Game Over";
        document.getElementById('go-title').style.color = "#FFC107";
    }
    
    gameOverScreen.classList.remove('hidden');
}

function drawOpponentBoard(oppTiles) {
    oppCtx.clearRect(0, 0, opponentCanvas.width, opponentCanvas.height);
    const scale = 0.5;
    oppCtx.strokeStyle = '#ccc';
    oppCtx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
        oppCtx.beginPath();
        oppCtx.moveTo(i * (COL_WIDTH * scale), 0);
        oppCtx.lineTo(i * (COL_WIDTH * scale), opponentCanvas.height);
        oppCtx.stroke();
    }
    oppTiles.forEach(tile => {
        if (tile.active || !tile.clicked) {
            oppCtx.fillStyle = '#000';
        } else {
            oppCtx.fillStyle = '#ddd';
        }
        if (tile.isError) oppCtx.fillStyle = 'red';
        oppCtx.fillRect(tile.col * (COL_WIDTH * scale), tile.y * scale, COL_WIDTH * scale, TILE_HEIGHT * scale);
        oppCtx.strokeStyle = '#999';
        oppCtx.strokeRect(tile.col * (COL_WIDTH * scale), tile.y * scale, COL_WIDTH * scale, TILE_HEIGHT * scale);
    });
}
