const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'rankings.json');
const corruptBackupPath = dbPath + '.corrupt.bak';

// 各モードに保持する最大エントリ数
const MAX_ENTRIES_PER_MODE = 100;

// 書き込みのシリアライズ(キュー/ミューティックス)
let writeQueue = Promise.resolve();
function enqueueWrite(task) {
    const result = writeQueue.then(task);
    // 失敗してもキューを止めない
    writeQueue = result.catch(() => {});
    return result;
}

// 壊れたファイルは退避して初期化し、[] を返す
function readDbOrRecover() {
    let raw;
    try {
        raw = fs.readFileSync(dbPath, 'utf8');
    } catch (err) {
        // 読み取り不能(欠損/権限) → 空DBで初期化
        initDB();
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('DB is not an array');
        return parsed;
    } catch (err) {
        console.error('Corrupt rankings DB, backing up and reinitializing:', err.message);
        try {
            fs.writeFileSync(corruptBackupPath, raw);
        } catch (bakErr) {
            console.error('Failed to back up corrupt DB:', bakErr.message);
        }
        initDB();
        return [];
    }
}

function initDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify([]));
    }
}

function isValidScore(score) {
    return typeof score === 'number' && Number.isFinite(score) && Number.isInteger(score) && score >= 0;
}

// 別ファイルへの書き込み + rename でファイル破損を防ぐ(原子的な書き込み)
function writeJsonAtomic(filePath, data) {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data));
    fs.renameSync(tmpPath, filePath);
}

// 各モードの上位 N 件のみを保持(ファイル肥大化を防止)
function capEntries(data) {
    const byMode = {};
    for (const entry of data) {
        const mode = (entry && typeof entry.mode === 'string') ? entry.mode : 'normal';
        if (!byMode[mode]) byMode[mode] = [];
        byMode[mode].push(entry);
    }
    const capped = [];
    for (const mode in byMode) {
        byMode[mode]
            .filter(d => d && isValidScore(d.score))
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_ENTRIES_PER_MODE)
            .forEach(d => capped.push(d));
    }
    return capped;
}

function saveScore(name, score, mode) {
    if (!isValidScore(score)) {
        console.error('Rejected invalid score:', score);
        return;
    }
    enqueueWrite(() => new Promise((resolve) => {
        try {
            const data = readDbOrRecover();
            const targetMode = mode || 'normal';

            // Find existing entry
            const existingIndex = data.findIndex(d => d && d.name === name && (d.mode || 'normal') === targetMode);

            if (existingIndex !== -1) {
                if (score > data[existingIndex].score) {
                    data[existingIndex].score = score;
                    data[existingIndex].timestamp = new Date().toISOString();
                }
            } else {
                data.push({ name, score, mode: targetMode, timestamp: new Date().toISOString() });
            }

            writeJsonAtomic(dbPath, capEntries(data));
        } catch (err) {
            console.error('Error saving score:', err.message);
        }
        resolve();
    }));
}

function getTopRankings(mode, limit, callback) {
    enqueueWrite(() => new Promise((resolve) => {
        try {
            const data = readDbOrRecover();
            const filtered = data.filter(d => d && (d.mode || 'normal') === mode);
            filtered.sort((a, b) => b.score - a.score);
            callback(filtered.slice(0, limit));
        } catch (err) {
            console.error('Error getting rankings:', err.message);
            callback([]);
        }
        resolve();
    }));
}

module.exports = {
    initDB,
    saveScore,
    getTopRankings
};
