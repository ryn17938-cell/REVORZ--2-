// Load environment variables from the database/.env file
require('dotenv').config({ path: './database/.env' });
const mysql = require('mysql2');

// MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'revoz',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const migrationQueries = [
    `ALTER TABLE carts ADD COLUMN payment_method VARCHAR(255) DEFAULT NULL`
];

db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        process.exit(1);
    }

    console.log('Connected to MySQL database:', process.env.DB_NAME);

    migrationQueries.forEach(query => {
        connection.query(query, (err, results) => {
            if (err) {
                console.error('Error executing migration query:', err);
            } else {
                console.log('Migration query executed successfully:', query);
            }
        });
    });

    connection.release();
});
