require('dotenv').config({ path: './database/.env' });
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'revoz',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const queries = [
    `ALTER TABLE products ADD COLUMN warna TEXT DEFAULT NULL`,
    `ALTER TABLE products ADD COLUMN ukuran TEXT DEFAULT NULL`
];

let completed = 0;
queries.forEach(query => {
    db.query(query, (err) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log(`Column already exists: ${query}`);
            } else {
                console.error(`Error executing query: ${query}`, err);
            }
        } else {
            console.log(`Successfully executed query: ${query}`);
        }
        completed++;
        if (completed === queries.length) {
            db.end();
        }
    });
});