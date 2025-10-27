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

const query = `ALTER TABLE products MODIFY COLUMN price BIGINT`;

db.query(query, (err) => {
    if (err) {
        console.error(`Error altering column 'price':`, err);
    } else {
        console.log(`Column 'price' in table 'products' altered to BIGINT successfully.`);
    }
    db.end();
});