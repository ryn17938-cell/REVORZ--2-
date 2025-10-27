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

const query = `ALTER TABLE products ADD COLUMN jenis TEXT DEFAULT NULL`;

db.query(query, (err) => {
    if (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log(`Column 'jenis' in table 'products' already exists.`);
        } else {
            console.error(`Error adding column 'jenis':`, err);
        }
    } else {
        console.log(`Column 'jenis' in table 'products' added successfully.`);
    }
    db.end();
});
