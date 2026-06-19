const fs = require('fs');
const path = require('path');

const dbPath = '/tmp/rankings.json';

function initDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify([]));
    }
}

function saveScore(name, score, mode) {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        data.push({ name, score, mode: mode || 'normal', timestamp: new Date().toISOString() });
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
