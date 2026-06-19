const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'rankings.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
    db.run(`CREATE TABLE IF NOT EXISTS rankings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        score INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

function saveScore(name, score) {
    db.run(`INSERT INTO rankings (name, score) VALUES (?, ?)`, [name, score], function(err) {
        if (err) {
            console.error('Error saving score:', err.message);
        }
    });
}

function getTopRankings(limit, callback) {
    db.all(`SELECT name, score FROM rankings ORDER BY score DESC LIMIT ?`, [limit], (err, rows) => {
        if (err) {
            console.error('Error getting rankings:', err.message);
            callback([]);
        } else {
            callback(rows);
        }
    });
}

module.exports = {
    initDB,
    saveScore,
    getTopRankings
};
