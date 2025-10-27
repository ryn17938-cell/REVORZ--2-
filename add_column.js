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

const columns = [
    { table: 'products', name: 'category', type: 'VARCHAR(255) DEFAULT NULL' },
    { table: 'products', name: 'brand', type: 'VARCHAR(255) DEFAULT NULL' }
];

let completed = 0;

columns.forEach(column => {
    const query = `ALTER TABLE ${column.table} ADD COLUMN ${column.name} ${column.type}`;
    db.query(query, (err) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log(`Column ${column.name} in table ${column.table} already exists.`);
            } else {
                console.error(`Error adding column ${column.name}:`, err);
            }
        } else {
            console.log(`Column ${column.name} in table ${column.table} added successfully.`);
        }
        
        completed++;
        if (completed === columns.length) {
            db.end();
        }
    });
});
