const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const opponentCanvas = document.getElementById('opponentCanvas');
const oppCtx = opponentCanvas.getContext('2d');

const port = (window.location.port === '' || window.location.port === '80') ? ':3040' : `:${window.location.port}`;
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
const btnKeyConfig = document.getElementById('btn-key-config');
const keyConfigScreen = document.getElementById('key-config-screen');
const btnSaveKeys = document.getElementById('btn-save-keys');
const btnCancelKeys = document.getElementById('btn-cancel-keys');
const btnResetKeys = document.getElementById('btn-reset-keys');

// Game constants
let COLS = 4;
let COL_WIDTH = canvas.width / COLS;
const TILE_PITCH = 150;
let TILE_HEIGHT = parseInt(localStorage.getItem('pianoGameTileHeight'));
if (isNaN(TILE_HEIGHT)) TILE_HEIGHT = 150;
if (TILE_HEIGHT < 0) TILE_HEIGHT = 0;
if (TILE_HEIGHT > 150) TILE_HEIGHT = 150;

let SHOW_JUDGEMENT_LINE = localStorage.getItem('pianoGameShowLine') === 'true';
let LINE_OFFSET = parseInt(localStorage.getItem('pianoGameLineOffset'));
if (isNaN(LINE_OFFSET)) LINE_OFFSET = 60;
if (LINE_OFFSET < 0) LINE_OFFSET = 0;
if (LINE_OFFSET > 400) LINE_OFFSET = 400;

const defaultKeys = {
    normal: ['d', 'f', 'j', 'k'],
    hyper: ['s', 'd', 'f', 'j', 'k', 'l'],
    another: ['a', 's', 'd', 'f', 'j', 'k', 'l', '+']
};

const defaultColors = {
    normal: ['#000000', '#000000', '#000000', '#000000'],
    hyper: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
    another: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000']
};

let storedKeys = null;
let storedColors = null;
try {
    storedKeys = JSON.parse(localStorage.getItem('pianoGameKeys'));
    storedColors = JSON.parse(localStorage.getItem('pianoGameColors'));
} catch (e) {}

let userKeys = storedKeys ? Object.assign({}, defaultKeys, storedKeys) : JSON.parse(JSON.stringify(defaultKeys));
let userColors = storedColors ? Object.assign({}, defaultColors, storedColors) : JSON.parse(JSON.stringify(defaultColors));

// Ensure array lengths are correct if data was corrupted
if (!Array.isArray(userKeys.normal) || userKeys.normal.length !== 4) userKeys.normal = [...defaultKeys.normal];
if (!Array.isArray(userKeys.hyper) || userKeys.hyper.length !== 6) userKeys.hyper = [...defaultKeys.hyper];
if (!Array.isArray(userKeys.another) || userKeys.another.length !== 8) userKeys.another = [...defaultKeys.another];

if (!Array.isArray(userColors.normal) || userColors.normal.length !== 4) userColors.normal = [...defaultColors.normal];
if (!Array.isArray(userColors.hyper) || userColors.hyper.length !== 6) userColors.hyper = [...defaultColors.hyper];
if (!Array.isArray(userColors.another) || userColors.another.length !== 8) userColors.another = [...defaultColors.another];

let KEYS = [...userKeys.normal];
let COLORS = [...userColors.normal];
let currentMode = 'normal';

function updateModeLabels() {
    document.getElementById('label-normal').innerText = `Normal (4鍵: ${userKeys.normal.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
    document.getElementById('label-hyper').innerText = `Hyper (6鍵: ${userKeys.hyper.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
    document.getElementById('label-another').innerText = `Another (8鍵: ${userKeys.another.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
}

function setMode(mode) {
    currentMode = mode;
    let newWidth = 400;
    
    if (mode === 'normal') {
        COLS = 4;
        KEYS = [...userKeys.normal];
        COLORS = [...userColors.normal];
        newWidth = 400;
    } else if (mode === 'hyper') {
        COLS = 6;
        KEYS = [...userKeys.hyper];
        COLORS = [...userColors.hyper];
        newWidth = 500;
    } else if (mode === 'another') {
        COLS = 8;
        KEYS = [...userKeys.another];
        COLORS = [...userColors.another];
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
if (savedName && savedName !== 'Anonymous') {
    playerNameInput.value = savedName;
} else {
    playerNameInput.value = '';
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
    myName = playerNameInput.value || "名無しさん";
    localStorage.setItem('playerName', myName);
    
    const modeVal = document.querySelector('input[name="gameMode"]:checked').value;
    setMode(modeVal);
    
    isMultiplayer = false;
    startScreen.classList.add('hidden');
    startGame();
});

btnMulti.addEventListener('click', () => {
    myName = playerNameInput.value || "名無しさん";
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

// Key Config Events
function createKeyInputs(mode, count) {
    const container = document.getElementById(`config-${mode}`);
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const colDiv = document.createElement('div');
        colDiv.style.display = 'flex';
        colDiv.style.flexDirection = 'column';
        colDiv.style.alignItems = 'center';
        colDiv.style.gap = '2px';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'key-input';
        let initialKey = userKeys[mode][i];
        input.value = initialKey === ' ' ? '␣' : (initialKey === 'shift' ? 'SHIFT' : initialKey.toUpperCase());
        input.dataset.keyValue = initialKey;
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') return;
            e.preventDefault();
            let key = e.key.toLowerCase();
            if (key === ';') key = '+';
            if (key.length === 1 || key === 'shift') {
                input.value = key === ' ' ? '␣' : (key === 'shift' ? 'SHIFT' : key.toUpperCase());
                input.dataset.keyValue = key;
            }
        });
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'color-input';
        colorInput.value = userColors[mode][i];
        
        colDiv.appendChild(input);
        colDiv.appendChild(colorInput);
        container.appendChild(colDiv);
    }
}

function openKeyConfig() {
    createKeyInputs('normal', 4);
    createKeyInputs('hyper', 6);
    createKeyInputs('another', 8);
    
    document.getElementById('config-section-normal').classList.add('hidden');
    document.getElementById('config-section-hyper').classList.add('hidden');
    document.getElementById('config-section-another').classList.add('hidden');
    
    const modeVal = document.querySelector('input[name="gameMode"]:checked').value;
    document.getElementById(`config-section-${modeVal}`).classList.remove('hidden');

    const slider = document.getElementById('tile-length-slider');
    const lengthVal = document.getElementById('tile-length-val');
    slider.value = TILE_HEIGHT;
    lengthVal.innerText = TILE_HEIGHT;
    
    document.getElementById('show-judgement-line').checked = SHOW_JUDGEMENT_LINE;
    
    const lineSlider = document.getElementById('line-offset-slider');
    const lineVal = document.getElementById('line-offset-val');
    lineSlider.value = LINE_OFFSET;
    lineVal.innerText = LINE_OFFSET;
    
    const updatePreview = () => {
        TILE_HEIGHT = parseInt(slider.value);
        lengthVal.innerText = TILE_HEIGHT;
        
        SHOW_JUDGEMENT_LINE = document.getElementById('show-judgement-line').checked;
        
        LINE_OFFSET = parseInt(lineSlider.value);
        lineVal.innerText = LINE_OFFSET;
        
        ['normal', 'hyper', 'another'].forEach(mode => {
            const colorInputs = document.querySelectorAll(`#config-${mode} .color-input`);
            userColors[mode] = Array.from(colorInputs).map(inp => inp.value);
            
            const keyInputs = document.querySelectorAll(`#config-${mode} .key-input`);
            userKeys[mode] = Array.from(keyInputs).map(inp => inp.dataset.keyValue);
        });
        
        setMode(modeVal);
        
        tiles = [];
        for (let i = 0; i < 4; i++) {
            tiles.push({
                col: i % COLS,
                y: canvas.height - 150 - (i * TILE_PITCH),
                clicked: false,
                isError: false
            });
        }
        draw();
    };
    
    slider.oninput = updatePreview;
    lineSlider.oninput = updatePreview;
    document.getElementById('show-judgement-line').onchange = updatePreview;
    document.querySelectorAll('.color-input').forEach(inp => inp.oninput = updatePreview);
    document.querySelectorAll('.key-input').forEach(inp => inp.onkeyup = updatePreview);
    
    updatePreview();

    startScreen.classList.add('hidden');
    keyConfigScreen.classList.remove('hidden');
}

btnKeyConfig.addEventListener('click', openKeyConfig);

btnSaveKeys.addEventListener('click', () => {
    ['normal', 'hyper', 'another'].forEach(mode => {
        const keyInputs = document.querySelectorAll(`#config-${mode} .key-input`);
        userKeys[mode] = Array.from(keyInputs).map(inp => inp.dataset.keyValue);
        
        const colorInputs = document.querySelectorAll(`#config-${mode} .color-input`);
        userColors[mode] = Array.from(colorInputs).map(inp => inp.value);
    });
    
    const slider = document.getElementById('tile-length-slider');
    TILE_HEIGHT = parseInt(slider.value);
    localStorage.setItem('pianoGameTileHeight', TILE_HEIGHT);
    
    SHOW_JUDGEMENT_LINE = document.getElementById('show-judgement-line').checked;
    localStorage.setItem('pianoGameShowLine', SHOW_JUDGEMENT_LINE);
    
    const lineSlider = document.getElementById('line-offset-slider');
    LINE_OFFSET = parseInt(lineSlider.value);
    localStorage.setItem('pianoGameLineOffset', LINE_OFFSET);
    
    localStorage.setItem('pianoGameKeys', JSON.stringify(userKeys));
    localStorage.setItem('pianoGameColors', JSON.stringify(userColors));
    updateModeLabels();
    setMode(currentMode);
    
    tiles = [];
    draw();
    
    keyConfigScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

btnCancelKeys.addEventListener('click', () => {
    try {
        const sk = JSON.parse(localStorage.getItem('pianoGameKeys'));
        if (sk) userKeys = Object.assign({}, defaultKeys, sk);
        
        const sc = JSON.parse(localStorage.getItem('pianoGameColors'));
        if (sc) userColors = Object.assign({}, defaultColors, sc);
    } catch (e) {}
    
    TILE_HEIGHT = parseInt(localStorage.getItem('pianoGameTileHeight'));
    if (isNaN(TILE_HEIGHT)) TILE_HEIGHT = 150;
    if (TILE_HEIGHT < 0) TILE_HEIGHT = 0;
    
    SHOW_JUDGEMENT_LINE = localStorage.getItem('pianoGameShowLine') === 'true';
    
    LINE_OFFSET = parseInt(localStorage.getItem('pianoGameLineOffset'));
    if (isNaN(LINE_OFFSET)) LINE_OFFSET = 60;
    
    setMode(currentMode);
    tiles = [];
    draw();

    keyConfigScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

btnResetKeys.addEventListener('click', () => {
    userKeys = JSON.parse(JSON.stringify(defaultKeys));
    userColors = JSON.parse(JSON.stringify(defaultColors));
    openKeyConfig();
});

updateModeLabels();

document.addEventListener('keydown', (e) => {
    if (!isPlaying) {
        if (e.code === 'Space') {
            if (!gameOverScreen.classList.contains('hidden')) {
                btnRestart.click();
            } else if (!startScreen.classList.contains('hidden')) {
                if (document.activeElement !== playerNameInput) {
                    btnSingle.click();
                }
            }
        }
        return;
    }
    
    let key = e.key.toLowerCase();
    if (key === ';') key = '+';
    
    const colIndex = KEYS.indexOf(key);
    
    if (colIndex !== -1) {
        handleInput(colIndex);
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

canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
canvas.addEventListener('mousedown', handlePointerDown);

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
    for (let i = 0; i < 6; i++) {
        spawnTile(-i * TILE_PITCH);
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function spawnTile(yPos) {
    const col = Math.floor(Math.random() * COLS);
    tiles.push({
        col: col,
        y: yPos,
        clicked: false,
        isError: false
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
    
    let lowestUnclicked = null;
    
    for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        tile.y += speed;
        
        if (!tile.clicked && (lowestUnclicked === null || tile.y > lowestUnclicked.y)) {
            lowestUnclicked = tile;
        }
    }
    
    // Check if the lowest unclicked tile passed the bottom
    if (lowestUnclicked && lowestUnclicked.y > canvas.height) {
        lowestUnclicked.isError = true;
        gameOver("Missed a tile!");
    }
    
    // Remove clicked tiles that are off screen
    if (tiles[0] && tiles[0].y > canvas.height && tiles[0].clicked) {
        tiles.shift();
    }
    
    // Spawn new tiles
    const lastTile = tiles[tiles.length - 1];
    if (lastTile && lastTile.y > -TILE_PITCH) {
        spawnTile(lastTile.y - TILE_PITCH);
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
        } else if (tile.clicked) {
            ctx.fillStyle = '#ccc';
        } else {
            ctx.fillStyle = COLORS[tile.col] || 'black';
        }
        
        ctx.fillRect(tile.col * COL_WIDTH, tile.y, COL_WIDTH, TILE_HEIGHT);
        
        // Tile border
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.col * COL_WIDTH, tile.y, COL_WIDTH, TILE_HEIGHT);
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
        let keyText = KEYS[i] === ' ' ? '␣' : (KEYS[i] === 'shift' ? 'SHIFT' : KEYS[i].toUpperCase());
        ctx.fillText(keyText, i * COL_WIDTH + COL_WIDTH / 2, canvas.height - 20);
    }

    if (SHOW_JUDGEMENT_LINE) {
        ctx.strokeStyle = '#ff4081';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - LINE_OFFSET);
        ctx.lineTo(canvas.width, canvas.height - LINE_OFFSET);
        ctx.stroke();
    }
}

function handleInput(colIndex) {
    let lowestUnclickedIndex = -1;
    let lowestUnclickedY = -Infinity;
    
    for (let i = 0; i < tiles.length; i++) {
        if (!tiles[i].clicked && tiles[i].y > lowestUnclickedY) {
            lowestUnclickedY = tiles[i].y;
            lowestUnclickedIndex = i;
        }
    }
    
    if (lowestUnclickedIndex !== -1) {
        let targetTile = tiles[lowestUnclickedIndex];
        
        if (targetTile.y + TILE_HEIGHT > 0) {
            if (targetTile.col === colIndex) {
                targetTile.clicked = true;
                score++;
                scoreDisplay.innerText = score;
                
                if (isMultiplayer) {
                    socket.emit('gameState', { room: currentRoom, score: score, tiles: tiles });
                }
            } else {
                tiles.push({
                    col: colIndex,
                    y: targetTile.y,
                    clicked: false,
                    isError: true
                });
                gameOver("Wrong key!");
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
