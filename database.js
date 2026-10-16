const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'rankings.json');

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

function saveScore(name, score, mode) {
    if (!isValidScore(score)) {
        console.error('Rejected invalid score:', score);
        return;
    }
    try {
        let data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const targetMode = mode || 'normal';
        
        // Find existing entry
        const existingIndex = data.findIndex(d => d.name === name && (d.mode || 'normal') === targetMode);
        
        if (existingIndex !== -1) {
            if (score > data[existingIndex].score) {
                data[existingIndex].score = score;
                data[existingIndex].timestamp = new Date().toISOString();
            }
        } else {
            data.push({ name, score, mode: targetMode, timestamp: new Date().toISOString() });
        }
        
        writeJsonAtomic(dbPath, data);
    } catch (err) {
        console.error('Error saving score:', err.message);
    }
}

function getTopRankings(mode, limit, callback) {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const filtered = data.filter(d => (d.mode || 'normal') === mode);
        filtered.sort((a, b) => b.score - a.score);
        callback(filtered.slice(0, limit));
    } catch (err) {
        console.error('Error getting rankings:', err.message);
        callback([]);
    }
}

module.exports = {
    initDB,
    saveScore,
    getTopRankings
};
