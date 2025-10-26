require('dotenv').config({ path: '../database/.env' });
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'revoz',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function run() {
  // ensure tables exist (server also creates them)
  await new Promise((resolve, reject) => {
    db.query(`CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => err ? reject(err) : resolve());
  });

  await new Promise((resolve, reject) => {
    db.query(`CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255),
        description TEXT,
        price INT,
        image VARCHAR(255),
        category VARCHAR(255),
        brand VARCHAR(255)
    )`, (err) => err ? reject(err) : resolve());
  });

  // Insert/Update sample products
  const products = [
    { name: 'Smartwatch X1', description: 'Smartwatch canggih dengan fitur lengkap.', price: 1500000, image: 'image/Jam.png', category: 'Elektronik', brand: 'Brand A' },
    { name: 'Headphone Pro', description: 'Audio jernih, desain ergonomis.', price: 850000, image: 'image/katalog.png', category: 'Audio', brand: 'Brand B' },
    { name: 'Kamera Digital', description: 'Abadikan momen terbaik Anda.', price: 4200000, image: 'image/Jam.png', category: 'Fotografi', brand: 'Brand C' },
    { name: 'Laptop Ultra', description: 'Performa tinggi untuk produktivitas.', price: 12000000, image: 'image/katalog.png', category: 'Komputer', brand: 'Brand A' }
  ];

  for (const p of products) {
    await new Promise((resolve) => {
        db.query('SELECT id FROM products WHERE name = ?', [p.name], (err, results) => {
            if (err) {
                console.error(err);
                return resolve();
            }
            if (results.length > 0) {
                // Update existing product
                db.query('UPDATE products SET category = ?, brand = ? WHERE name = ?', [p.category, p.brand, p.name], (err) => {
                    if (err) console.error(`Error updating product ${p.name}`, err);
                    else console.log(`Updated product: ${p.name}`);
                    resolve();
                });
            } else {
                // Insert new product
                db.query('INSERT INTO products (name, description, price, image, category, brand) VALUES (?, ?, ?, ?, ?, ?)', 
                    [p.name, p.description, p.price, p.image, p.category, p.brand], 
                    (err) => {
                        if (err) console.error(`Error inserting product ${p.name}`, err);
                        else console.log(`Inserted product: ${p.name}`);
                        resolve();
                    }
                );
            }
        });
    });
  }

  // Insert test user
  const username = 'testuser';
  const password = 'password';
  const hashed = await bcrypt.hash(password, 10);
  await new Promise((resolve) => {
    db.query('INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashed, 'user'], (err) => {
      if (err) console.error('Error inserting test user', err);
      else console.log('Inserted test user: testuser / password');
      resolve();
    });
  });

  // Insert admin user
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  const adminHashed = await bcrypt.hash(adminPassword, 10);
  await new Promise((resolve) => {
    db.query('INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', [adminUsername, adminHashed, 'admin'], (err) => {
      if (err) console.error('Error inserting admin user', err);
      else console.log('Inserted admin user: admin / admin123');
      resolve();
    });
  });

  // Insert super admin user
  const superAdminUsername = 'superadmin';
  const superAdminPassword = 'super123';
  const superAdminHashed = await bcrypt.hash(superAdminPassword, 10);
  await new Promise((resolve) => {
    db.query('INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', [superAdminUsername, superAdminHashed, 'superadmin'], (err) => {
      if (err) console.error('Error inserting super admin user', err);
      else console.log('Inserted super admin user: superadmin / super123');
      resolve();
    });
  });

  console.log('Seeding complete.');
  db.end();
}

run().catch(e => {
    console.error(e);
    db.end();
});