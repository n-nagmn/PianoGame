const fs = require('fs');
const path = require('path');

const dbPath = '/tmp/rankings.json';

function initDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify([]));
    }
}

function saveScore(name, score) {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        data.push({ name, score, timestamp: new Date().toISOString() });
        fs.writeFileSync(dbPath, JSON.stringify(data));
    } catch (err) {
        console.error('Error saving score:', err.message);
    }
}

function getTopRankings(limit, callback) {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        data.sort((a, b) => b.score - a.score);
        callback(data.slice(0, limit));
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
