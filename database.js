const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'rankings.json');

function initDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify([]));
    }
}

function saveScore(name, score, mode) {
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
        
        fs.writeFileSync(dbPath, JSON.stringify(data));
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
