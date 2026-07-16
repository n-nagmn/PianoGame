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
if (LINE_OFFSET > 800) LINE_OFFSET = 800;

const defaultKeys = {
    normal: ['d', 'f', 'j', 'k'],
    hyper: ['s', 'd', 'f', 'j', 'k', 'l'],
    another: ['a', 's', 'd', 'f', 'j', 'k', 'l', '+'],
    leggendaria: ['a', 's', 'd', 'f', ' ', 'j', 'k', 'l', '+'],
    dp: ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'y', 'u', 'i', 'o', 'h', 'j', 'k', 'l']
};

const defaultColors = {
    normal: ['#000000', '#000000', '#000000', '#000000'],
    hyper: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
    another: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
    leggendaria: ['#000000', '#000000', '#000000', '#000000', '#ff0000', '#000000', '#000000', '#000000', '#000000'],
    dp: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000']
};

let storedKeys = null;
let storedColors = null;
let storedWidths = null;
try {
    storedKeys = JSON.parse(localStorage.getItem('pianoGameKeys'));
    storedColors = JSON.parse(localStorage.getItem('pianoGameColors'));
    storedWidths = JSON.parse(localStorage.getItem('pianoGameWidths'));
} catch (e) {}

const defaultWidths = {
    normal: 400,
    hyper: 500,
    another: 600,
    leggendaria: 675,
    dp: 1200
};

let userKeys = storedKeys ? Object.assign({}, defaultKeys, storedKeys) : JSON.parse(JSON.stringify(defaultKeys));
let userColors = storedColors ? Object.assign({}, defaultColors, storedColors) : JSON.parse(JSON.stringify(defaultColors));
let userWidths = storedWidths ? Object.assign({}, defaultWidths, storedWidths) : JSON.parse(JSON.stringify(defaultWidths));

// Ensure array lengths are correct if data was corrupted
if (!Array.isArray(userKeys.normal) || userKeys.normal.length !== 4) userKeys.normal = [...defaultKeys.normal];
if (!Array.isArray(userKeys.hyper) || userKeys.hyper.length !== 6) userKeys.hyper = [...defaultKeys.hyper];
if (!Array.isArray(userKeys.another) || userKeys.another.length !== 8) userKeys.another = [...defaultKeys.another];
if (!Array.isArray(userKeys.leggendaria) || userKeys.leggendaria.length !== 9) userKeys.leggendaria = [...defaultKeys.leggendaria];
if (!Array.isArray(userKeys.dp) || userKeys.dp.length !== 16) userKeys.dp = [...defaultKeys.dp];

if (!Array.isArray(userColors.normal) || userColors.normal.length !== 4) userColors.normal = [...defaultColors.normal];
if (!Array.isArray(userColors.hyper) || userColors.hyper.length !== 6) userColors.hyper = [...defaultColors.hyper];
if (!Array.isArray(userColors.another) || userColors.another.length !== 8) userColors.another = [...defaultColors.another];
if (!Array.isArray(userColors.leggendaria) || userColors.leggendaria.length !== 9) userColors.leggendaria = [...defaultColors.leggendaria];
if (!Array.isArray(userColors.dp) || userColors.dp.length !== 16) userColors.dp = [...defaultColors.dp];

let KEYS = [...userKeys.normal];
let COLORS = [...userColors.normal];
let currentMode = 'normal';

function updateModeLabels() {
    document.getElementById('label-normal').innerText = `Normal (4鍵: ${userKeys.normal.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
    document.getElementById('label-hyper').innerText = `Hyper (6鍵: ${userKeys.hyper.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
    document.getElementById('label-another').innerText = `Another (8鍵: ${userKeys.another.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
    document.getElementById('label-leggendaria').innerText = `Leggendaria (9鍵: ${userKeys.leggendaria.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
    document.getElementById('label-dp').innerText = `DP (16鍵: ${userKeys.dp.map(k => k === ' ' ? '␣' : (k === 'shift' ? '⇧' : k)).join('').toUpperCase()})`;
}

function setMode(mode) {
    currentMode = mode;
    let newWidth = 400;
    
    if (mode === 'normal') {
        COLS = 4;
        KEYS = [...userKeys.normal];
        COLORS = [...userColors.normal];
    } else if (mode === 'hyper') {
        COLS = 6;
        KEYS = [...userKeys.hyper];
        COLORS = [...userColors.hyper];
    } else if (mode === 'another') {
        COLS = 8;
        KEYS = [...userKeys.another];
        COLORS = [...userColors.another];
    } else if (mode === 'leggendaria') {
        COLS = 9;
        KEYS = [...userKeys.leggendaria];
        COLORS = [...userColors.leggendaria];
    } else if (mode === 'dp') {
        COLS = 16;
        KEYS = [...userKeys.dp];
        COLORS = [...userColors.dp];
    }
    
    if (canvas.width !== userWidths[mode]) {
        canvas.width = userWidths[mode];
        document.getElementById('game-container').style.width = userWidths[mode] + 'px';
        opponentCanvas.width = userWidths[mode] / 2;
    }
    
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
let isPracticeMode = false;
let practiceFixedSpeed = 5;
let isChordMode = false;

const practiceToggle = document.getElementById('practice-mode-toggle');
const chordToggle = document.getElementById('chord-mode-toggle');
const optionsPanel = document.getElementById('options-panel');
const practiceMenuScreen = document.getElementById('practice-menu-screen');

let sudPercent = 0;
let hidPercent = 0;
const sliderSud = document.getElementById('slider-sud');
const sliderHid = document.getElementById('slider-hid');
const valSud = document.getElementById('val-sud');
const valHid = document.getElementById('val-hid');

sliderSud.addEventListener('input', (e) => {
    sudPercent = parseInt(e.target.value);
    valSud.innerText = sudPercent;
    drawBoard();
});

sliderHid.addEventListener('input', (e) => {
    hidPercent = parseInt(e.target.value);
    valHid.innerText = hidPercent;
    drawBoard();
});
const practiceSpeedSlider = document.getElementById('practice-speed-slider');
const practiceSpeedVal = document.getElementById('practice-speed-val');
const btnQuitPractice = document.getElementById('btn-quit-practice');

let stats = { great: 0, poor: 0 };
let totalHits = 0;
const statsScreen = document.getElementById('stats-screen');
const elAccuracy = document.getElementById('stat-accuracy');
const elGreat = document.getElementById('stat-great');
const elPoor = document.getElementById('stat-poor');

function updateStatsDisplay() {
    elGreat.innerText = stats.great;
    elPoor.innerText = stats.poor;
    
    if (totalHits > 0) {
        let acc = (stats.great / totalHits) * 100;
        elAccuracy.innerText = acc.toFixed(2);
    } else {
        elAccuracy.innerText = "0.00";
    }
}

practiceToggle.addEventListener('change', (e) => {
    isPracticeMode = e.target.checked;
});

practiceSpeedSlider.addEventListener('input', (e) => {
    practiceFixedSpeed = parseInt(e.target.value);
    practiceSpeedVal.innerText = practiceFixedSpeed;
    if (isPlaying && isPracticeMode) {
        speed = practiceFixedSpeed;
    }
});

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
    
    isPracticeMode = practiceToggle.checked;
    isChordMode = chordToggle.checked;
    isMultiplayer = false;
    startScreen.classList.add('hidden');
    startGame();
});

btnMulti.addEventListener('click', () => {
    myName = playerNameInput.value || "名無しさん";
    localStorage.setItem('playerName', myName);
    
    const modeVal = document.querySelector('input[name="gameMode"]:checked').value;
    setMode(modeVal);
    
    isPracticeMode = false; // Disable practice mode in multiplayer
    isChordMode = chordToggle.checked;
    isMultiplayer = true;
    startScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    
    let matchMode = currentMode;
    if (isChordMode) matchMode += '_chord';
    socket.emit('findMatch', { name: myName, mode: matchMode });
});

btnCancel.addEventListener('click', () => {
    socket.emit('cancelMatch');
    waitingScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

btnRestart.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    rankingScreen.classList.remove('hidden');
    socket.emit('getRanking', currentRankingMode);
});

btnQuitPractice.addEventListener('click', () => {
    if (isPlaying && isPracticeMode) {
        isPlaying = false;
        cancelAnimationFrame(animationId);
        practiceMenuScreen.classList.add('hidden');
        statsScreen.classList.add('hidden');
        optionsPanel.classList.add('hidden');
        scoreDisplay.classList.add('hidden');
        startScreen.classList.remove('hidden');
        rankingScreen.classList.remove('hidden');
        fetchRanking();
        drawBoard(); // Clear tiles
    }
});

let currentRankingMode = 'normal';
const rankingChordToggle = document.getElementById('ranking-chord-toggle');

function updateRankingTitle() {
    const title = document.getElementById('ranking-title');
    let titleText = 'ランキング';
    if (currentRankingMode === 'normal') titleText += ' (Normal)';
    if (currentRankingMode === 'hyper') titleText += ' (Hyper)';
    if (currentRankingMode === 'another') titleText += ' (Another)';
    if (currentRankingMode === 'leggendaria') titleText += ' (Leggendaria)';
    if (currentRankingMode === 'dp') titleText += ' (DP)';
    title.innerText = titleText;
}

function fetchRanking() {
    let modeToFetch = currentRankingMode;
    if (rankingChordToggle.checked) {
        modeToFetch += '_chord';
    }
    socket.emit('getRanking', modeToFetch);
}

rankingChordToggle.addEventListener('change', () => {
    updateRankingTitle();
    fetchRanking();
});

btnRanking.addEventListener('click', () => {
    currentRankingMode = document.querySelector('input[name="gameMode"]:checked').value;
    rankingChordToggle.checked = chordToggle.checked;
    updateRankingTitle();
    fetchRanking();
});

document.getElementById('btn-rank-normal').addEventListener('click', () => {
    currentRankingMode = 'normal';
    updateRankingTitle();
    fetchRanking();
});

document.getElementById('btn-rank-hyper').addEventListener('click', () => {
    currentRankingMode = 'hyper';
    updateRankingTitle();
    fetchRanking();
});

document.getElementById('btn-rank-another').addEventListener('click', () => {
    currentRankingMode = 'another';
    updateRankingTitle();
    fetchRanking();
});

document.getElementById('btn-rank-leggendaria').addEventListener('click', () => {
    currentRankingMode = 'leggendaria';
    updateRankingTitle();
    fetchRanking();
});

document.getElementById('btn-rank-dp').addEventListener('click', () => {
    currentRankingMode = 'dp';
    updateRankingTitle();
    fetchRanking();
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
        input.value = initialKey === ' ' ? '␣' : (initialKey === 'shift' ? '⇧' : initialKey.toUpperCase());
        input.dataset.keyValue = initialKey;
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') return;
            e.preventDefault();
            let key = e.key.toLowerCase();
            if (key === ';') key = '+';
            if (key.length === 1 || key === 'shift') {
                input.value = key === ' ' ? '␣' : (key === 'shift' ? '⇧' : key.toUpperCase());
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
    createKeyInputs('leggendaria', 9);
    createKeyInputs('dp', 16);
    
    document.getElementById('config-section-normal').classList.add('hidden');
    document.getElementById('config-section-hyper').classList.add('hidden');
    document.getElementById('config-section-another').classList.add('hidden');
    document.getElementById('config-section-leggendaria').classList.add('hidden');
    document.getElementById('config-section-dp').classList.add('hidden');
    
    const modeVal = document.querySelector('input[name="gameMode"]:checked').value;
    document.getElementById(`config-section-${modeVal}`).classList.remove('hidden');
    
    const configRadios = document.querySelectorAll('input[name="configMode"]');
    
    const slider = document.getElementById('tile-length-slider');
    const lengthVal = document.getElementById('tile-length-val');
    slider.value = TILE_HEIGHT;
    lengthVal.innerText = TILE_HEIGHT;
    
    const widthSlider = document.getElementById('board-width-slider');
    const widthVal = document.getElementById('board-width-val');
    widthSlider.value = userWidths[modeVal];
    widthVal.innerText = userWidths[modeVal];
    
    configRadios.forEach(r => {
        if (r.value === modeVal) r.checked = true;
        r.onchange = (e) => {
            document.getElementById('config-section-normal').classList.add('hidden');
            document.getElementById('config-section-hyper').classList.add('hidden');
            document.getElementById('config-section-another').classList.add('hidden');
            document.getElementById('config-section-leggendaria').classList.add('hidden');
            document.getElementById('config-section-dp').classList.add('hidden');
            document.getElementById(`config-section-${e.target.value}`).classList.remove('hidden');
            
            document.querySelector(`input[name="gameMode"][value="${e.target.value}"]`).checked = true;
            
            widthSlider.value = userWidths[e.target.value];
            widthVal.innerText = userWidths[e.target.value];
            
            updatePreview();
        };
    });
    
    document.getElementById('show-judgement-line').checked = SHOW_JUDGEMENT_LINE;
    
    const lineSlider = document.getElementById('line-offset-slider');
    const lineVal = document.getElementById('line-offset-val');
    lineSlider.value = LINE_OFFSET;
    lineVal.innerText = LINE_OFFSET;
    
    let previewAnimationFrame = null;
    const updatePreview = () => {
        if (previewAnimationFrame) cancelAnimationFrame(previewAnimationFrame);
        previewAnimationFrame = requestAnimationFrame(() => {
            TILE_HEIGHT = parseInt(slider.value);
            lengthVal.innerText = TILE_HEIGHT;
            
            SHOW_JUDGEMENT_LINE = document.getElementById('show-judgement-line').checked;
            
            LINE_OFFSET = parseInt(lineSlider.value);
            lineVal.innerText = LINE_OFFSET;
            
            const configModeVal = document.querySelector('input[name="configMode"]:checked').value;
            userWidths[configModeVal] = parseInt(widthSlider.value);
            widthVal.innerText = userWidths[configModeVal];
            
            ['normal', 'hyper', 'another', 'leggendaria', 'dp'].forEach(mode => {
                const colorInputs = document.querySelectorAll(`#config-${mode} .color-input`);
                userColors[mode] = Array.from(colorInputs).map(inp => inp.value);
                
                const keyInputs = document.querySelectorAll(`#config-${mode} .key-input`);
                userKeys[mode] = Array.from(keyInputs).map(inp => inp.dataset.keyValue);
            });
            
            setMode(configModeVal);
            
            tiles = [];
            for (let i = 0; i < COLS; i++) {
                // Show exactly one note per column. Wrap vertically so they all stay within the visible screen.
                let visualRow = i % 5;
                tiles.push({
                    col: i,
                    y: canvas.height - 150 - (visualRow * TILE_PITCH),
                    clicked: false,
                    isError: false
                });
            }
            draw();
        });
    };
    
    slider.oninput = updatePreview;
    widthSlider.oninput = (e) => {
        // Update label only during drag to prevent layout shift feedback loop
        widthVal.innerText = e.target.value;
    };
    widthSlider.onchange = updatePreview; // Apply resize only on mouse release
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
    ['normal', 'hyper', 'another', 'leggendaria', 'dp'].forEach(mode => {
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
    localStorage.setItem('pianoGameWidths', JSON.stringify(userWidths));
    updateModeLabels();
    const configModeVal = document.querySelector('input[name="configMode"]:checked').value;
    setMode(configModeVal);
    currentMode = configModeVal;
    
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
        
        const sw = JSON.parse(localStorage.getItem('pianoGameWidths'));
        if (sw) userWidths = Object.assign({}, defaultWidths, sw);
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
    userWidths = JSON.parse(JSON.stringify(defaultWidths));
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
    speed = isPracticeMode ? practiceFixedSpeed : 5;
    scoreDisplay.innerText = score;
    scoreDisplay.classList.remove('hidden');
    
    stats = { great: 0, poor: 0 };
    totalHits = 0;
    updateStatsDisplay();
    
    optionsPanel.classList.remove('hidden');
    
    if (isPracticeMode) {
        practiceMenuScreen.classList.remove('hidden');
        statsScreen.classList.remove('hidden');
    } else {
        practiceMenuScreen.classList.add('hidden');
        statsScreen.classList.add('hidden');
    }
    
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
    let numTiles = 1;
    if (isChordMode) {
        let r = Math.random();
        // Total 20% chance of simultaneous presses
        if (COLS >= 6 && r < 0.05) {
            numTiles = 3; // 5% chance of 3-note chord
        } else if (r < 0.20) {
            numTiles = 2; // 15% chance of 2-note chord (0.05 to 0.20)
        }
    }
    
    let chosenCols = [];
    for (let i = 0; i < numTiles; i++) {
        let col;
        let attempts = 0;
        let isMuriOshi = false;
        
        do {
            col = Math.floor(Math.random() * COLS);
            
            // 無理押し対策: 片手(左右半分)に3つ以上集中させない
            isMuriOshi = false;
            if (numTiles >= 3) {
                let leftCount = 0;
                let rightCount = 0;
                let half = Math.floor(COLS / 2);
                
                for (let c of chosenCols) {
                    if (c < half) leftCount++;
                    else rightCount++;
                }
                
                if (col < half) leftCount++;
                else rightCount++;
                
                if (leftCount >= 3 || rightCount >= 3) {
                    isMuriOshi = true;
                }
            }
            
            attempts++;
        } while ((chosenCols.includes(col) || isMuriOshi) && attempts < 20);
        
        if (!chosenCols.includes(col)) {
            chosenCols.push(col);
            tiles.push({
                col: col,
                y: yPos,
                clicked: false,
                isError: false
            });
        }
    }
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
    if (isPracticeMode) {
        speed = practiceFixedSpeed;
    } else {
        speed = 5 + Math.floor(score / 15); // Increase speed gradually
    }
    
    let lowestUnclicked = null;
    
    for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        tile.y += speed;
        
        if (!tile.clicked && !tile.passed && !tile.isWrongKey && (lowestUnclicked === null || tile.y > lowestUnclicked.y)) {
            lowestUnclicked = tile;
        }
    }
    
    // Check if the lowest unclicked tile passed the bottom
    if (lowestUnclicked && lowestUnclicked.y + (TILE_PITCH - TILE_HEIGHT) > canvas.height) {
        stats.poor++;
        totalHits++;
        updateStatsDisplay();
        
        if (isPracticeMode) {
            lowestUnclicked.passed = true;
            lowestUnclicked.isError = true;
        } else {
            lowestUnclicked.isError = true;
            gameOver("Missed a tile!");
            return;
        }
    }
    
    // Remove tiles that are far off screen
    while (tiles.length > 0 && tiles[0].y > canvas.height + TILE_PITCH) {
        tiles.shift();
    }
    
    // Spawn new tiles
    let lastValidTile = null;
    for (let i = tiles.length - 1; i >= 0; i--) {
        if (!tiles[i].isWrongKey) {
            lastValidTile = tiles[i];
            break;
        }
    }
    
    if (lastValidTile && lastValidTile.y > -TILE_PITCH) {
        spawnTile(lastValidTile.y - TILE_PITCH);
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
        
        let drawY = tile.y + (TILE_PITCH - TILE_HEIGHT);
        ctx.fillRect(tile.col * COL_WIDTH, drawY, COL_WIDTH, TILE_HEIGHT);
        
        // Tile border
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.col * COL_WIDTH, drawY, COL_WIDTH, TILE_HEIGHT);
    }
    
    // SUDDEN+
    if (sudPercent > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        let sudHeight = canvas.height * (sudPercent / 100);
        ctx.fillRect(0, 0, canvas.width, sudHeight);
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, sudHeight);
        ctx.lineTo(canvas.width, sudHeight);
        ctx.stroke();
    }
    
    // HIDDEN+
    if (hidPercent > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        let hidHeight = canvas.height * (hidPercent / 100);
        ctx.fillRect(0, canvas.height - hidHeight, canvas.width, hidHeight);
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - hidHeight);
        ctx.lineTo(canvas.width, canvas.height - hidHeight);
        ctx.stroke();
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
    let lowestUnclickedY = -Infinity;
    
    for (let i = 0; i < tiles.length; i++) {
        if (!tiles[i].clicked && !tiles[i].passed && !tiles[i].isWrongKey && tiles[i].y > lowestUnclickedY) {
            lowestUnclickedY = tiles[i].y;
        }
    }
    
    if (lowestUnclickedY > -Infinity) {
        let targetTiles = tiles.filter(t => !t.clicked && !t.passed && !t.isWrongKey && t.y === lowestUnclickedY);
        let matchingTile = targetTiles.find(t => t.col === colIndex);
        
        if (lowestUnclickedY + TILE_PITCH > 0) {
            if (matchingTile) {
                matchingTile.clicked = true;
                
                totalHits++;
                stats.great++;
                
                updateStatsDisplay();
                
                score++;
                scoreDisplay.innerText = score;
                
                if (isMultiplayer) {
                    socket.emit('gameState', { room: currentRoom, score: score, tiles: tiles });
                }
            } else {
                stats.poor++;
                totalHits++;
                updateStatsDisplay();
                
                tiles.push({
                    col: colIndex,
                    y: lowestUnclickedY,
                    clicked: false,
                    isError: true,
                    isWrongKey: true
                });
                if (!isPracticeMode) {
                    gameOver("Wrong key!");
                }
            }
        }
    }
}

function gameOver(reason) {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    practiceMenuScreen.classList.add('hidden');
    statsScreen.classList.add('hidden');
    optionsPanel.classList.add('hidden');
    draw();
    
    setTimeout(() => {
        if (isMultiplayer) {
            socket.emit('playerDied', currentRoom);
            showGameOver(false, "あなたのミスです...負けました。");
        } else {
            // Save score locally/on server (skip if practice mode)
            if (score > 0 && !isPracticeMode) {
                let saveMode = currentMode;
                if (isChordMode) saveMode += '_chord';
                socket.emit('saveScore', { name: myName, score: score, mode: saveMode });
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
        let drawY = (tile.y + (TILE_PITCH - TILE_HEIGHT)) * scale;
        oppCtx.fillRect(tile.col * (COL_WIDTH * scale), drawY, COL_WIDTH * scale, TILE_HEIGHT * scale);
        oppCtx.strokeStyle = '#999';
        oppCtx.strokeRect(tile.col * (COL_WIDTH * scale), drawY, COL_WIDTH * scale, TILE_HEIGHT * scale);
    });
}
