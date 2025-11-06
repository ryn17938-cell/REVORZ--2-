const path = require('path');
// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, 'database', '.env') });
}
const express = require('express');
const mysql = require('mysql2');



const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const methodOverride = require('method-override'); // Require method-override

const app = express();
const port = process.env.PORT || 8888;

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method')); // Use method-override middleware
// Add Content Security Policy middleware
app.use((req, res, next) => {
    // Allow Google Fonts (fonts.googleapis.com for styles and fonts.gstatic.com for font resources)
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; connect-src 'self' http://localhost:8888 ws://localhost:8888 wss://localhost:8888 'unsafe-inline' 'unsafe-eval'; img-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
    );
    next();
});
// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'image'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// Configure EJS view engine (views directory)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// POST /api/products/add - Add new product (admin only)
app.post('/api/products/add', requireAuth, requireAdmin, upload.fields([{ name: 'image', maxCount: 2 }, { name: 'jenis_images', maxCount: 7 }]), (req, res) => {
    const { name, description, price, spesifikasi, warna, ukuran } = req.body;
    const mainImage = req.files && req.files.image ? req.files.image.map(file => '/image/' + file.filename).join(',') : '';
    const jenisImages = req.files && req.files.jenis_images ? req.files.jenis_images.map(file => '/image/' + file.filename).join(',') : null;

    if (!name || !description || !price) return res.status(400).send('Missing required fields');
    const prodPrice = parseInt(price, 10);
    if (isNaN(prodPrice)) return res.status(400).send('Invalid price');

    db.query('INSERT INTO products (name, description, price, image, spesifikasi, jenis, warna, ukuran) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [name, description, prodPrice, mainImage, spesifikasi || null, jenisImages, warna || null, ukuran || null], function(err, result) {
        if (err) {
            console.error('Add product error:', err);
            return res.status(500).send('Error adding product');
        }
        res.redirect('/catalog');
    });
});

// DELETE /api/products/:id - Delete product (admin only)
app.delete('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
    const productId = req.params.id;
    if (!productId) return res.status(400).send('Missing product ID');

    db.query('DELETE FROM products WHERE id = ?', [productId], function(err, result) {
        if (err) {
            console.error('Delete product error:', err);
            return res.status(500).send('Error deleting product');
        }
        if (result.affectedRows === 0) {
            return res.status(404).send('Product not found');
        }
        res.json({ ok: true, message: 'Product deleted successfully' });
    });
});

// POST /api/products/:id - Edit product (admin only)
app.post('/api/products/:id', requireAuth, requireAdmin, upload.fields([{ name: 'image', maxCount: 2 }, { name: 'jenis_images', maxCount: 7 }]), (req, res) => {
    const productId = req.params.id;
    const { name, description, price, spesifikasi, warna, ukuran, deleted_jenis_images } = req.body; // Get deleted_jenis_images
    const mainImage = req.files && req.files.image && req.files.image.length > 0 ? req.files.image.map(file => '/image/' + file.filename).join(',') : null;
    const newJenisImages = req.files && req.files.jenis_images && req.files.jenis_images.length > 0 ? req.files.jenis_images.map(file => '/image/' + file.filename).join(',') : null;

    if (!productId) return res.status(400).json({ ok: false, message: 'Missing product ID' });
    if (!name || !description || !price) return res.status(400).json({ ok: false, message: 'Missing required fields' });

    const prodPrice = parseInt(price, 10);
    if (isNaN(prodPrice)) return res.status(400).json({ ok: false, message: 'Invalid price' });

    // Fetch existing product data to merge jenis images
    db.query('SELECT image, jenis FROM products WHERE id = ?', [productId], (err, results) => {
        if (err) {
            console.error('Error fetching existing product for update:', err);
            return res.status(500).json({ ok: false, message: 'Error fetching existing product' });
        }
        const existingProduct = results.length > 0 ? results[0] : {};
        let currentJenisImagesArray = existingProduct.jenis ? existingProduct.jenis.split(',') : [];
        let finalMainImage = existingProduct.image;

        // If new main image is uploaded, use it
        if (mainImage) {
            finalMainImage = mainImage;
        }

        // Process deleted jenis images
        if (deleted_jenis_images) {
            const deletedImagesArray = deleted_jenis_images.split(',');
            currentJenisImagesArray = currentJenisImagesArray.filter(img => !deletedImagesArray.includes(img));
        }

        // If new jenis images are uploaded, append them to existing ones
        if (newJenisImages) {
            const newImagesArray = newJenisImages.split(',');
            currentJenisImagesArray = currentJenisImagesArray.concat(newImagesArray);
        }
        
        let finalJenisImages = currentJenisImagesArray.length > 0 ? currentJenisImagesArray.join(',') : null;

        let updateQuery = 'UPDATE products SET name = ?, description = ?, price = ?, spesifikasi = ?, warna = ?, ukuran = ?, image = ?, jenis = ? WHERE id = ?';
        let updateValues = [name, description, prodPrice, spesifikasi || null, warna || null, ukuran || null, finalMainImage, finalJenisImages, productId];

        function runUpdate(tryAlterOnce = true) {
            db.query(updateQuery, updateValues, function(err, result) {
                if (err) {
                    console.error('Edit product error:', err);
                    // If failure due to missing columns, try to add common missing columns and retry once
                    if (tryAlterOnce && err.code === 'ER_BAD_FIELD_ERROR') {
                        console.warn('Attempting to add missing product columns and retry update...');
                        // Attempt to add columns that newer templates expect. Ignore errors.
                        Promise.all([
                            db.promise().query("ALTER TABLE products ADD COLUMN IF NOT EXISTS spesifikasi TEXT"),
                            db.promise().query("ALTER TABLE products ADD COLUMN IF NOT EXISTS jenis TEXT"),
                            db.promise().query("ALTER TABLE products ADD COLUMN IF NOT EXISTS warna VARCHAR(255)"),
                            db.promise().query("ALTER TABLE products ADD COLUMN IF NOT EXISTS ukuran VARCHAR(255)")
                        ]).then(() => {
                            // Retry update once
                            runUpdate(false);
                        }).catch((alterErr) => {
                            console.warn('Failed adding product columns (non-fatal):', alterErr && alterErr.message ? alterErr.message : alterErr);
                            return res.status(500).json({ ok: false, message: 'Error updating product (schema issue)' });
                        });
                        return;
                    }
                    return res.status(500).json({ ok: false, message: 'Error updating product' });
                }
                if (result.affectedRows === 0) {
                    return res.status(404).json({ ok: false, message: 'Product not found' });
                }
                res.redirect('/catalog');
            });
        }

        runUpdate(true);
    });
});

// Helper function to get profile picture
function getProfilePicture(userId, callback) {
    if (!userId) return callback(null);
    db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error fetching profile picture:', err);
            return callback(null);
        }
        callback(results.length > 0 ? results[0].profile_picture : null);
    });
}

// Helper function to get cart item count
function getCartItemCount(req, callback) {
    const sessionId = getSessionId(req);
    if (!sessionId) return callback(0);

    ensureCartForSession(sessionId, req.session.userId)
        .then(cart => {
            db.query('SELECT SUM(quantity) as count FROM cart_items WHERE cart_id = ?', [cart.id], (err, results) => {
                if (err) {
                    console.error('Error fetching cart item count:', err);
                    return callback(0);
                }
                callback(results[0].count || 0);
            });
        })
        .catch(err => {
            console.error('Error ensuring cart for session:', err);
            callback(0);
        });
}

// Render pages using EJS templates
app.get('/', async (req, res) => {
    try {
        const productsPromise = new Promise((resolve, reject) => {
            db.query('SELECT * FROM products ORDER BY id DESC LIMIT 4', (err, results) => {
                if (err) {
                    console.error('Error fetching featured products:', err);
                    return resolve([]);
                }
                resolve(results);
            });
        });

        const reviewsPromise = new Promise((resolve, reject) => {
            const query = `
                SELECT pr.review, pr.rating, u.username, u.profile_picture
                FROM product_ratings pr
                JOIN users u ON pr.user_id = u.id
                WHERE pr.rating = 5 AND pr.review IS NOT NULL AND pr.review != ''
                ORDER BY pr.created_at DESC
                LIMIT 3
            `;
            db.query(query, (err, results) => {
                if (err) {
                    console.error('Error fetching testimonials:', err);
                    return resolve([]);
                }
                resolve(results);
            });
        });

        const cartItemCountPromise = new Promise(resolve => getCartItemCount(req, resolve));

        const profilePicturePromise = new Promise(resolve => {
            if (req.session.userId) {
                getProfilePicture(req.session.userId, resolve);
            } else {
                resolve(null);
            }
        });

        const [products, reviews, cartItemCount, profilePicture] = await Promise.all([
            productsPromise,
            reviewsPromise,
            cartItemCountPromise,
            profilePicturePromise
        ]);

        res.render('index', {
            isLoggedIn: !!req.session.userId,
            username: req.session.username || null,
            role: req.session.role || null,
            profilePicture,
            products,
            reviews,
            cartItemCount
        });

    } catch (err) {
        console.error('Error rendering homepage:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/admin/dashboard', requireAuth, requireAdmin, async (req, res) => {
    try {
        const totalSalesQuery = "SELECT SUM(price * quantity) as totalSales FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE status = 'completed')";
        const newOrdersQuery = "SELECT COUNT(*) as newOrders FROM carts WHERE status = 'completed' AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
        const newUsersQuery = "SELECT COUNT(*) as newUsers FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
        const recentOrdersQuery = `
            SELECT c.id, c.updated_at, u.username, SUM(ci.price * ci.quantity) as total
            FROM carts c
            JOIN users u ON c.user_id = u.id
            JOIN cart_items ci ON c.id = ci.cart_id
            WHERE c.status = 'completed'
            GROUP BY c.id, c.updated_at, u.username
            ORDER BY c.updated_at DESC
            LIMIT 5
        `;

        const [totalSalesRows] = await db.promise().query(totalSalesQuery);
        const [newOrdersRows] = await db.promise().query(newOrdersQuery);
        const [newUsersRows] = await db.promise().query(newUsersQuery);
        const [recentOrders] = await db.promise().query(recentOrdersQuery);

        const totalSales = totalSalesRows[0].totalSales || 0;
        const newOrders = newOrdersRows[0].newOrders || 0;
        const newUsers = newUsersRows[0].newUsers || 0;

        getCartItemCount(req, (cartItemCount) => {
            getProfilePicture(req.session.userId, (profilePicture) => {
                res.render('admin-dashboard', {
                    isLoggedIn: !!req.session.userId,
                    username: req.session.username || null,
                    role: req.session.role || null,
                    profilePicture: profilePicture,
                    cartItemCount: cartItemCount,
                    totalSales,
                    newOrders,
                    newUsers,
                    recentOrders
                });
            });
        });
    } catch (err) {
        console.error('Error fetching admin dashboard data:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/admin/orders', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status, q } = req.query;

        let ordersQuery = `
            SELECT c.id, c.updated_at, c.tipe as status, u.username, SUM(ci.price * ci.quantity) as total
            FROM carts c
            JOIN users u ON c.user_id = u.id
            JOIN cart_items ci ON c.id = ci.cart_id
            WHERE c.status = 'completed'
        `;

        const queryParams = [];

        if (status && ['waiting', 'approved', 'rejected'].includes(status)) {
            ordersQuery += ' AND c.tipe = ?';
            queryParams.push(status);
        }

        if (q) {
            ordersQuery += ' AND (u.username LIKE ? OR c.id = ?)';
            queryParams.push(`%${q}%`, q);
        }

        ordersQuery += `
            GROUP BY c.id, c.updated_at, c.tipe, u.username
            ORDER BY c.updated_at DESC
        `;

        const [orders] = await db.promise().query(ordersQuery, queryParams);

        getCartItemCount(req, (cartItemCount) => {
            getProfilePicture(req.session.userId, (profilePicture) => {
                res.render('admin-orders', {
                    isLoggedIn: !!req.session.userId,
                    username: req.session.username || null,
                    role: req.session.role || null,
                    profilePicture: profilePicture,
                    cartItemCount: cartItemCount,
                    orders: orders,
                    filters: req.query
                });
            });
        });
    } catch (err) {
        console.error('Error fetching admin orders data:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/admin/orders/:id/details', requireAuth, requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;

        const orderQuery = `
            SELECT c.id, c.updated_at, c.tipe as status, u.username, SUM(ci.price * ci.quantity) as total
            FROM carts c
            JOIN users u ON c.user_id = u.id
            JOIN cart_items ci ON c.id = ci.cart_id
            WHERE c.id = ? AND c.status = 'completed'
            GROUP BY c.id, c.updated_at, c.tipe, u.username
        `;
        const [orderRows] = await db.promise().query(orderQuery, [orderId]);

        if (orderRows.length === 0) {
            return res.status(404).json({ ok: false, message: 'Order not found' });
        }

        const order = orderRows[0];

        const itemsQuery = `
            SELECT ci.quantity, ci.price, ci.warna, ci.ukuran, p.name, p.image
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = ?
        `;
        const [items] = await db.promise().query(itemsQuery, [orderId]);

        res.json({ ok: true, order, items });

    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ ok: false, message: 'Internal Server Error' });
    }
});

app.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const usersQuery = "SELECT id, username, role, created_at FROM users ORDER BY created_at DESC";
        const [users] = await db.promise().query(usersQuery);

        getCartItemCount(req, (cartItemCount) => {
            getProfilePicture(req.session.userId, (profilePicture) => {
                res.render('admin-users', {
                    isLoggedIn: !!req.session.userId,
                    username: req.session.username || null,
                    role: req.session.role || null,
                    profilePicture: profilePicture,
                    cartItemCount: cartItemCount,
                    users: users
                });
            });
        });
    } catch (err) {
        console.error('Error fetching admin users data:', err);
        res.status(500).send('Internal Server Error');
    }
});

// POST /api/admin/users/:id/update-role - Update user role (admin only)
app.post('/api/admin/users/:id/update-role', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ ok: false, message: 'Invalid role provided.' });
        }

        await db.promise().query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        res.json({ ok: true, message: 'User role updated successfully.' });
    } catch (err) {
        console.error('Error updating user role:', err);
        res.status(500).json({ ok: false, message: 'Internal Server Error' });
    }
});

// POST /api/admin/users/:id/delete - Delete user (admin only)
app.post('/api/admin/users/:id/delete', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (req.session.userId == userId) {
            return res.status(400).json({ ok: false, message: 'Admin cannot delete their own account from here.' });
        }

        // Delete user's carts (cart_items will cascade due to FK on cart_id)
        await db.promise().query('DELETE FROM carts WHERE user_id = ?', [userId]);
        // Delete the user (product_ratings will cascade due to FK on user_id)
        await db.promise().query('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ ok: true, message: 'User deleted successfully.' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ ok: false, message: 'Internal Server Error' });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

// --- Forgot password verification APIs ---
// Step 1: init - check username exists and if a phone number (nomor) is registered
app.post('/api/user/forgot-init', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ ok: false, message: 'Username diperlukan.' });

    db.query('SELECT nomor FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error looking up username for forgot-init:', err);
            return res.status(500).json({ ok: false, message: 'Terjadi kesalahan server.' });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ ok: false, message: 'Username tidak ditemukan.' });
        }

        const user = results[0];
        if (!user.nomor) {
            // No phone on file - suggest contacting support
            return res.json({ ok: true, hasNomor: false, message: 'Akun ini tidak memiliki nomor terdaftar. Silakan hubungi admin.' });
        }

        // Mask the phone number for display: show last 3 digits only
        const raw = String(user.nomor).replace(/[^0-9]/g, '');
        const showDigits = 3;
        const last = raw.slice(-showDigits);
        const masked = '•••' + last;

        return res.json({ ok: true, hasNomor: true, maskedNomor: masked });
    });
});

// Step 2: verify - user provides the last digits of the registered phone (or the full number)
app.post('/api/user/forgot-verify', (req, res) => {
    const { username, verifyDigits } = req.body;
    if (!username || !verifyDigits) return res.status(400).json({ ok: false, message: 'Username dan digit verifikasi diperlukan.' });

    db.query('SELECT nomor FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error looking up username for forgot-verify:', err);
            return res.status(500).json({ ok: false, message: 'Terjadi kesalahan server.' });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ ok: false, message: 'Username tidak ditemukan.' });
        }

        const user = results[0];
        if (!user.nomor) return res.status(400).json({ ok: false, message: 'Akun tidak memiliki nomor terdaftar.' });

        const raw = String(user.nomor).replace(/[^0-9]/g, '');
        const provided = String(verifyDigits).replace(/[^0-9]/g, '');

        // Accept match if provided equals last N digits or the full number
        const lastN = raw.slice(-provided.length);
        if (provided === raw || provided === lastN) {
            // Mark session as allowed to reset password for this username for a short time
            req.session.resetUser = username;
            req.session.resetExpires = Date.now() + (15 * 60 * 1000); // 15 minutes
            return res.json({ ok: true, message: 'Verifikasi berhasil. Silakan atur ulang password.' });
        }

        return res.status(401).json({ ok: false, message: 'Digit verifikasi tidak cocok.' });
    });
});

app.get('/catalog', (req, res) => {
    // Fetch products from DB and render catalog dynamically
    const { categories: categoriesQuery, min: minQuery, max: maxQuery } = req.query;
    const requestedCategories = categoriesQuery ? categoriesQuery.split(',').map(c => c.trim()).filter(Boolean) : [];
    const requestedMin = minQuery ? Number(minQuery) : null;
    const requestedMax = maxQuery ? Number(maxQuery) : null;

    // Build a base query and params for filtering
    let baseSql = 'SELECT * FROM products WHERE 1=1';
    const baseParams = [];
    if (requestedMin !== null && !isNaN(requestedMin)) {
        baseSql += ' AND price >= ?';
        baseParams.push(requestedMin);
    }
    if (requestedMax !== null && !isNaN(requestedMax)) {
        baseSql += ' AND price <= ?';
        baseParams.push(requestedMax);
    }
    if (requestedCategories.length) {
        // Use IN(?) style by adding placeholders
        const placeholders = requestedCategories.map(() => '?').join(',');
        baseSql += ` AND category IN (${placeholders})`;
        requestedCategories.forEach(c => baseParams.push(c));
    }

    // Fetch filtered products for rendering
    db.query(baseSql, baseParams, (err, results) => {
        if (err) {
            console.error('Error fetching products for catalog', err);
            return res.render('catalog', {
                products: [],
                categories: [],
                priceMin: 0,
                priceMax: 1000000,
                isLoggedIn: !!req.session.userId,
                username: req.session.username || null,
                role: req.session.role || null,
                profilePicture: null,
                cartItemCount: 0 // Default to 0 on error
            });
        }
        // Compute categories and price bounds from ALL products for UI (so sliders/categories reflect dataset)
        db.query('SELECT category, price FROM products', (allErr, allRows) => {
            const categories = Array.from(new Set((allRows || [])
                .map(p => (p.category || '').toString().trim())
                .filter(Boolean)
            ));

            const prices = (allRows || []).map(p => Number(p.price || 0)).filter(n => !isNaN(n));
            const priceMin = prices.length ? Math.min(...prices) : 0;
            const priceMax = prices.length ? Math.max(...prices) : 1000000;

            getCartItemCount(req, (cartItemCount) => { // Get cart item count
                if (req.session.userId) {
                    getProfilePicture(req.session.userId, (profilePicture) => {
                        return res.render('catalog', {
                            products: results,
                            categories,
                            priceMin,
                            priceMax,
                            isLoggedIn: !!req.session.userId,
                            username: req.session.username || null,
                            role: req.session.role || null,
                            profilePicture: profilePicture,
                            cartItemCount: cartItemCount // Pass cart item count
                        });
                    });
                } else {
                    return res.render('catalog', {
                        products: results,
                        categories,
                        priceMin,
                        priceMax,
                        isLoggedIn: !!req.session.userId,
                        username: req.session.username || null,
                        role: req.session.role || null,
                        profilePicture: null,
                        cartItemCount: cartItemCount // Pass cart item count
                    });
                }
            });
        });
    });
});
app.get('/category', async (req, res) => {
    try {
        const { sort, page = 1, q, brand, min_rating } = req.query; // Added brand and min_rating
        const limit = 12;
        const offset = (page - 1) * limit;

        let query = 'SELECT p.*, AVG(pr.rating) as average_rating FROM products p LEFT JOIN product_ratings pr ON p.id = pr.product_id WHERE 1=1'; // Modified query to include average_rating
        let countQuery = 'SELECT COUNT(DISTINCT p.id) as count FROM products p LEFT JOIN product_ratings pr ON p.id = pr.product_id WHERE 1=1'; // Modified countQuery
        const params = [];
        const countParams = [];

        if (q) {
            const searchTerm = `%${q}%`;
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            countQuery += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            params.push(searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm);
        }

        if (brand) { // Added brand filter
            query += ' AND p.brand = ?';
            countQuery += ' AND p.brand = ?';
            params.push(brand);
            countParams.push(brand);
        }

        query += ' GROUP BY p.id'; // Group by product id for average rating

        if (min_rating) { // Added min_rating filter
            query += ' HAVING AVG(pr.rating) >= ?';
            // countQuery doesn't need HAVING as it counts distinct products before rating filter
            params.push(min_rating);
        }

        const [totalResult] = await new Promise((resolve, reject) => {
            db.query(countQuery, countParams, (err, results) => err ? reject(err) : resolve(results));
        });
        const totalProducts = totalResult.count;
        const totalPages = Math.ceil(totalProducts / limit);

        // Sorting
        switch (sort) {
            case 'price_asc':
                query += ' ORDER BY p.price ASC';
                break;
            case 'price_desc':
                query += ' ORDER BY p.price DESC';
                break;
            case 'name_asc':
                query += ' ORDER BY p.name ASC';
                break;
            case 'name_desc':
                query += ' ORDER BY p.name DESC';
                break;
            case 'rating_desc': // Added sorting by rating
                query += ' ORDER BY average_rating DESC';
                break;
            default:
                query += ' ORDER BY p.id DESC';
        }

        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [products] = await db.promise().query(query, params);

        // Fetch all unique brands for filter options
        const [brands] = await db.promise().query('SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL');
        const uniqueBrands = brands.map(row => row.brand);

        getCartItemCount(req, (cartItemCount) => { // Get cart item count
            getProfilePicture(req.session.userId, (profilePicture) => {
                res.render('category', {
                    products,
                    pagination: {
                        page: parseInt(page),
                        totalPages,
                        totalProducts,
                        limit
                    },
                    filters: req.query,
                    isLoggedIn: !!req.session.userId,
                    username: req.session.username || null,
                    role: req.session.role || null,
                    profilePicture,
                    cartItemCount: cartItemCount, // Pass cart item count
                    highlightSearchTerm: highlightSearchTerm, // Pass the helper function
                    uniqueBrands: uniqueBrands // Pass unique brands
                });
            });
        });

    } catch (err) {
        console.error('Error in /category route:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/about', (req, res) => {
    getCartItemCount(req, (cartItemCount) => { // Get cart item count
        if (req.session.userId) {
            getProfilePicture(req.session.userId, (profilePicture) => {
                res.render('about', {
                    isLoggedIn: !!req.session.userId,
                    username: req.session.username || null,
                    role: req.session.role || null,
                    profilePicture: profilePicture,
                    cartItemCount: cartItemCount // Pass cart item count
                });
            });
        } else {
            res.render('about', {
                isLoggedIn: !!req.session.userId,
                username: req.session.username || null,
                role: req.session.role || null,
                profilePicture: null,
                cartItemCount: cartItemCount // Pass cart item count
            });
        }
    });
});
// Contact page
app.get('/contact', (req, res) => {
    getCartItemCount(req, (cartItemCount) => {
        getProfilePicture(req.session.userId, (profilePicture) => {
            res.render('contact', {
                isLoggedIn: !!req.session.userId,
                username: req.session.username || null,
                role: req.session.role || null,
                profilePicture: profilePicture,
                cartItemCount: cartItemCount
            });
        });
    });
});

// Contact form submit
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ ok: false, message: 'Semua field harus diisi.' });
    db.query('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', [name, email, message], (err) => {
        if (err) {
            console.error('Error saving contact message:', err);
            return res.status(500).json({ ok: false, message: 'Gagal menyimpan pesan.' });
        }
        // Notify admin via email if mailer is configured
        const adminEmail = process.env.ADMIN_EMAIL;
        if (mailerTransport && adminEmail) {
            const subject = `Pesan Kontak Baru dari ${name}`;
            const html = `<p>Anda menerima pesan kontak baru:</p>
                <ul>
                    <li><strong>Nama:</strong> ${escapeHtml(name)}</li>
                    <li><strong>Email:</strong> ${escapeHtml(email)}</li>
                    <li><strong>Pesan:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</li>
                </ul>
                <p>Masuk ke panel admin untuk melihat lebih lanjut.</p>`;

            mailerTransport.sendMail({
                from: process.env.SMTP_FROM || smtpFromOrDefault(),
                to: adminEmail,
                subject: subject,
                html: html
            }).then(info => {
                console.log('Contact notification sent:', info.messageId || info.response || info);
            }).catch(mailErr => {
                console.error('Failed to send contact notification email:', mailErr && mailErr.message ? mailErr.message : mailErr);
            });
        } else {
            if (!adminEmail) console.warn('ADMIN_EMAIL not set; skipping contact notification email.');
        }

        res.json({ ok: true });
    });
});

// Simple helper to escape HTML to reduce injection risk in emails
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Helper function to highlight search terms
function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !text) return text;
    const escapedSearchTerm = escapeHtml(searchTerm);
    const escapedText = escapeHtml(String(text));
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    return escapedText.replace(regex, '<span class="bg-yellow-200 font-semibold">$1</span>');
}

function smtpFromOrDefault(){
    if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
    if (process.env.SMTP_USER) return process.env.SMTP_USER;
    return 'no-reply@localhost';
}
app.get('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Fetch the full user object
        const userPromise = new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results.length > 0 ? results[0] : null);
            });
        });

        const cartItemCountPromise = new Promise((resolve) => {
            getCartItemCount(req, (count) => resolve(count));
        });

        const [user, cartItemCount] = await Promise.all([userPromise, cartItemCountPromise]);

        if (!user) {
            return res.redirect('/login');
        }

        const ratingsPromise = new Promise((resolve, reject) => {
            db.query('SELECT product_id FROM product_ratings WHERE user_id = ?', [userId], (err, ratings) => {
                if (err) return reject(err);
                resolve(ratings.map(r => r.product_id));
            });
        });

        let activitiesPromise;
        if (user.role === 'admin') {
            activitiesPromise = new Promise((resolve, reject) => {
                const query = `
                    SELECT c.*, u.username, u.nomor
                    FROM carts c 
                    JOIN users u ON c.user_id = u.id 
                    WHERE c.status = 'completed' 
                    ORDER BY c.updated_at DESC
                `;
                db.query(query, async (err, carts) => {
                    if (err) return reject(err);
                    if (!carts.length) return resolve([]);

                    const activityCarts = await Promise.all(carts.map(cart => {
                        return new Promise((resolveCart, rejectCart) => {
                            db.query("SELECT ci.*, p.name, p.image FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.cart_id = ?", [cart.id], (itemErr, items) => {
                                if (itemErr) return rejectCart(itemErr);
                                cart.items = items;
                                cart.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                resolveCart(cart);
                            });
                        });
                    }));
                    resolve(activityCarts);
                });
            });
        } else {
            activitiesPromise = new Promise((resolve, reject) => {
                db.query("SELECT * FROM carts WHERE user_id = ? AND status = 'completed' ORDER BY updated_at DESC", [userId], async (err, carts) => {
                    if (err) return reject(err);
                    if (!carts.length) return resolve([]);

                    const activityCarts = await Promise.all(carts.map(cart => {
                        return new Promise((resolveCart, rejectCart) => {
                            db.query("SELECT ci.*, p.name, p.image FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.cart_id = ?", [cart.id], (itemErr, items) => {
                                if (itemErr) return rejectCart(itemErr);
                                cart.items = items;
                                cart.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                resolveCart(cart);
                            });
                        });
                    }));
                    resolve(activityCarts);
                });
            });
        }

        const [activities, ratedProductIds] = await Promise.all([
            activitiesPromise, 
            ratingsPromise
        ]);

        // Parse the 'like' field from JSON string to array, if it exists
        if (user && typeof user.like === 'string' && user.like.trim() !== '') {
            try {
                user.like = JSON.parse(user.like);
            } catch (e) {
                console.error('Error parsing user likes:', e);
                user.like = []; // Default to empty array on parsing error
            }
        } else if (!user.like) {
            user.like = []; // Default to empty array if null, undefined, or empty
        }

        res.render('profile', {
            isLoggedIn: !!userId,
            user: user,
            username: user.username,
            role: user.role,
            profilePicture: user.profile_picture,
            nomor: user.nomor, // Pass the number to the template
            cartItemCount: cartItemCount,
            activities: activities,
            ratedProductIds: ratedProductIds || []
        });

    } catch (err) {
        console.error('Error fetching profile data:', err);
        res.status(500).send('Internal Server Error');
    }
});

// POST /api/user/update-whatsapp
app.post('/api/user/update-whatsapp', requireAuth, (req, res) => {
    const { nomor } = req.body;
    const userId = req.session.userId;

    if (!nomor) {
        return res.status(400).json({ ok: false, message: 'Nomor tidak boleh kosong' });
    }

    if (!/^[0-9]+$/.test(nomor) || nomor.length < 10 || nomor.length > 15) {
        return res.status(400).json({ ok: false, message: 'Format nomor tidak valid' });
    }

    db.query('UPDATE users SET nomor = ? WHERE id = ?', [nomor, userId], (err, result) => {
        if (err) {
            console.error('Error updating WhatsApp number:', err);
            return res.status(500).json({ ok: false, message: 'Gagal menyimpan nomor' });
        }
        res.json({ ok: true, message: 'Nomor WhatsApp berhasil disimpan' });
    });
});

app.post('/api/user/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.userId;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ ok: false, message: 'Semua field harus diisi.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ ok: false, message: 'Password baru tidak cocok.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ ok: false, message: 'Password baru minimal harus 6 karakter.' });
    }

    try {
        // 1. Get current user's hashed password
        const user = await new Promise((resolve, reject) => {
            db.query('SELECT password FROM users WHERE id = ?', [userId], (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) return reject(new Error('User not found'));
                resolve(results[0]);
            });
        });

        // 2. Compare provided current password with the stored hash
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(401).json({ ok: false, message: 'Password saat ini salah.' });
        }

        // 3. Hash the new password
        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        // 4. Update the database
        await new Promise((resolve, reject) => {
            db.query('UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, userId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        res.json({ ok: true, message: 'Password berhasil diubah.' });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
    }
});

// --- Forgot/Reset Password Routes ---
app.get('/reset-password', (req, res) => {
    const { username } = req.query;
    // Allow access only if session has been marked by forgot-verify and not expired
    if (!username || !req.session.resetUser || req.session.resetUser !== username) {
        return res.status(401).send('Akses tidak diizinkan. Silakan lakukan verifikasi lupa password terlebih dahulu.');
    }
    if (!req.session.resetExpires || Date.now() > req.session.resetExpires) {
        // Expired
        delete req.session.resetUser;
        delete req.session.resetExpires;
        return res.status(401).send('Sesi verifikasi telah kedaluwarsa. Silakan coba lagi.');
    }

    res.render('reset-password', { username });
});

app.post('/api/user/reset-password', async (req, res) => {
    const { username, newPassword, confirmPassword } = req.body;

    if (!username || !newPassword || !confirmPassword) {
        return res.status(400).json({ ok: false, message: 'Semua field harus diisi.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ ok: false, message: 'Password tidak cocok.' });
    }

    try {
        // Ensure session verification exists and matches
        if (!req.session.resetUser || req.session.resetUser !== username) {
            return res.status(401).json({ ok: false, message: 'Aksi tidak diizinkan. Lakukan verifikasi terlebih dahulu.' });
        }
        if (!req.session.resetExpires || Date.now() > req.session.resetExpires) {
            delete req.session.resetUser;
            delete req.session.resetExpires;
            return res.status(401).json({ ok: false, message: 'Sesi verifikasi telah kedaluwarsa.' });
        }

        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        db.query('UPDATE users SET password = ? WHERE username = ?', [newHashedPassword, username], (err, result) => {
            if (err) {
                console.error('Error resetting password:', err);
                return res.status(500).json({ ok: false, message: 'Gagal mereset password.' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ ok: false, message: 'Username tidak ditemukan.' });
            }

            // Clear reset markers
            delete req.session.resetUser;
            delete req.session.resetExpires;

            res.json({ ok: true, message: 'Password berhasil direset.' });
        });
    } catch (error) {
        console.error('Error hashing password during reset:', error);
        res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
    }
});

// POST /api/admin/orders/update-status - Update order status (admin only)
app.post('/api/admin/orders/update-status', requireAuth, requireAdmin, (req, res) => {
    const { cart_id, new_status } = req.body;

    if (!cart_id || !new_status) {
        return res.status(400).json({ ok: false, message: 'Missing cart_id or new_status' });
    }

    const allowedStatus = ['waiting', 'approved', 'rejected'];
    if (!allowedStatus.includes(new_status)) {
        return res.status(400).json({ ok: false, message: 'Invalid status' });
    }

    db.query('UPDATE carts SET tipe = ? WHERE id = ?', [new_status, cart_id], (err, result) => {
        if (err) {
            console.error('Error updating order status:', err);
            return res.status(500).json({ ok: false, message: 'Database error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ ok: false, message: 'Order not found' });
        }
        res.json({ ok: true, message: 'Status updated successfully' });
    });
});

// POST /api/product/toggle-like - Add/remove a product from user's favorites
app.post('/api/user/delete-account', requireAuth, async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ ok: false, message: 'User not authenticated.' });
    }

    try {
        // Start a transaction
        await new Promise((resolve, reject) => {
            db.getConnection((err, connection) => {
                if (err) return reject(err);
                connection.beginTransaction(async (err) => {
                    if (err) {
                        connection.release();
                        return reject(err);
                    }

                    try {
                        // 1. Delete user's carts (cart_items will cascade due to FK on cart_id)
                        await new Promise((resolveDeleteCarts, rejectDeleteCarts) => {
                            connection.query('DELETE FROM carts WHERE user_id = ?', [userId], (err, result) => {
                                if (err) return rejectDeleteCarts(err);
                                resolveDeleteCarts(result);
                            });
                        });

                        // 2. Delete the user (product_ratings will cascade due to FK on user_id)
                        await new Promise((resolveDeleteUser, rejectDeleteUser) => {
                            connection.query('DELETE FROM users WHERE id = ?', [userId], (err, result) => {
                                if (err) return rejectDeleteUser(err);
                                if (result.affectedRows === 0) {
                                    return rejectDeleteUser(new Error('User not found for deletion.'));
                                }
                                resolveDeleteUser(result);
                            });
                        });

                        // Commit transaction
                        connection.commit((err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    reject(err);
                                });
                            }
                            connection.release();
                            resolve();
                        });
                    } catch (transactionError) {
                        connection.rollback(() => {
                            connection.release();
                            reject(transactionError);
                        });
                    }
                });
            });
        });

        // Destroy session after successful deletion
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session after account deletion:', err);
                // Even if session destruction fails, account is deleted, so still send success
            }
            res.json({ ok: true, message: 'Akun berhasil dihapus.' });
        });

    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ ok: false, message: error.message || 'Terjadi kesalahan pada server saat menghapus akun.' });
    }
});

// POST /api/product/toggle-like - Add/remove a product from user's favorites
app.post('/api/product/toggle-like', requireAuth, async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.userId;

    if (!productId) {
        return res.status(400).json({ ok: false, message: 'Product ID is required.' });
    }

    try {
        // 1. Fetch the user's current likes
        const users = await new Promise((resolve, reject) => {
            db.query('SELECT `like` FROM users WHERE id = ?', [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (users.length === 0) {
            return res.status(404).json({ ok: false, message: 'User not found.' });
        }
        const user = users[0];

        // 2. Parse likes and toggle the productId
        let likedIds = [];
        if (user.like && typeof user.like === 'string' && user.like.trim() !== '') {
            try {
                likedIds = JSON.parse(user.like);
                if (!Array.isArray(likedIds)) likedIds = []; // Ensure it's an array
            } catch {
                likedIds = []; // On parsing error, start with an empty array
            }
        }
        
        const productIdNum = parseInt(productId, 10);
        const index = likedIds.indexOf(productIdNum);
        let message = '';

        if (index > -1) {
            // Product is liked, so unlike it
            likedIds.splice(index, 1);
            message = 'Produk dihapus dari favorit.';
        } else {
            // Product is not liked, so like it
            likedIds.push(productIdNum);
            message = 'Produk ditambahkan ke favorit.';
        }

        // 3. Update the database
        const newLikesJson = JSON.stringify(likedIds);
        await new Promise((resolve, reject) => {
            db.query('UPDATE users SET `like` = ? WHERE id = ?', [newLikesJson, userId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // 4. Send success response
        res.json({
            ok: true,
            message: message,
            likeCount: likedIds.length
        });

    } catch (error) {
        console.error('Error toggling product like status:', error);
        res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/products/rate', requireAuth, (req, res) => {
    const { productId, rating, review } = req.body;
    const userId = req.session.userId;

    if (!productId || !rating) {
        return res.status(400).json({ ok: false, message: 'Product ID and rating are required.' });
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ ok: false, message: 'Rating must be a number between 1 and 5.' });
    }

    const query = 'INSERT INTO product_ratings (product_id, user_id, rating, review) VALUES (?, ?, ?, ?)';
    db.query(query, [productId, userId, ratingNum, review || null], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ ok: false, message: 'You have already rated this product.' });
            }
            console.error('Error submitting rating:', err);
            return res.status(500).json({ ok: false, message: 'Failed to submit rating.' });
        }
        res.json({ ok: true, message: 'Rating submitted successfully!' });
    });
});

// POST /profile/upload-picture - Upload profile picture
app.post('/profile/upload-picture', requireAuth, upload.single('profilePicture'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    const imagePath = '/image/' + req.file.filename;
    db.query('UPDATE users SET profile_picture = ? WHERE id = ?', [imagePath, req.session.userId], (err) => {
        if (err) {
            console.error('Error updating profile picture:', err);
            return res.status(500).send('Error updating profile picture');
        }
        // Update session with new profile picture
        req.session.profilePicture = imagePath;
        res.redirect('/profile');
    });
});

app.get('/admin/add-product', requireAuth, requireAdmin, (req, res) => {
    getCartItemCount(req, (cartItemCount) => { // Get cart item count
        getProfilePicture(req.session.userId, (profilePicture) => {
            res.render('admin-add-product', {
                isLoggedIn: !!req.session.userId,
                username: req.session.username || null,
                role: req.session.role || null,
                profilePicture: profilePicture,
                cartItemCount: cartItemCount // Pass cart item count
            });
        });
    });
});
app.get('/product-detail', (req, res) => {
    // keep compatibility: render template without a product (will show placeholders)
    if (req.session.userId) {
        getProfilePicture(req.session.userId, (profilePicture) => {
            res.render('product-detail', { 
                product: null, 
                isLoggedIn: !!req.session.userId, 
                username: req.session.username || null, 
                role: req.session.role || null,
                profilePicture: profilePicture
            });
        });
    } else {
        res.render('product-detail', { 
            product: null, 
            isLoggedIn: !!req.session.userId, 
            username: req.session.username || null, 
            role: req.session.role || null,
            profilePicture: null
        });
    }
});

// Render product detail by id (dynamic)
app.get('/product/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const productPromise = new Promise((resolve, reject) => {
            db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) return reject('Product not found');
                resolve(results[0]);
            });
        });

        const relatedProductsPromise = new Promise((resolve, reject) => {
            db.query('SELECT * FROM products WHERE id != ? ORDER BY RAND() LIMIT 4', [id], (err, results) => {
                if (err) {
                    console.error('Error fetching related products:', err);
                    return resolve([]); // Resolve with empty array on error
                }
                resolve(results);
            });
        });

        const ratingsPromise = new Promise((resolve, reject) => {
            const query = `
                SELECT pr.rating, pr.review, pr.created_at, u.username 
                FROM product_ratings pr 
                JOIN users u ON pr.user_id = u.id 
                WHERE pr.product_id = ? 
                ORDER BY pr.created_at DESC
            `;
            db.query(query, [id], (err, results) => {
                if (err) {
                    console.error('Error fetching ratings:', err);
                    return resolve([]); // Resolve with empty array on error
                }
                resolve(results);
            });
        });

        const cartItemCountPromise = new Promise(resolve => getCartItemCount(req, resolve));

        const profilePicturePromise = new Promise(resolve => {
            if (req.session.userId) {
                getProfilePicture(req.session.userId, resolve);
            } else {
                resolve(null);
            }
        });

        const [product, relatedProducts, ratings, cartItemCount, profilePicture] = await Promise.all([
            productPromise,
            relatedProductsPromise,
            ratingsPromise,
            cartItemCountPromise,
            profilePicturePromise
        ]);

        // Create color to image mapping
        let colorImageMap = {};
        if (product.warna && product.jenis) {
            const colors = product.warna.split(',').map(c => c.trim());
            const images = product.jenis.split(',').map(i => i.trim());
            colors.forEach((color, index) => {
                if (images[index]) {
                    colorImageMap[color] = images[index];
                }
            });
        }

        res.render('product-detail', {
            product,
            relatedProducts,
            ratings: ratings || [],
            isLoggedIn: !!req.session.userId,
            username: req.session.username || null,
            role: req.session.role || null,
            profilePicture,
            cartItemCount,
            colorImageMap
        });

    } catch (err) {
        console.error('Error fetching product page:', err);
        if (err === 'Product not found') {
            return res.status(404).send('Product not found');
        }
        return res.status(500).send('Error fetching product');
    }
});

// Render edit product page
app.get('/edit/:id', requireAuth, requireAdmin, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error fetching product for edit:', err);
            return res.status(500).send('Error fetching product for edit');
        }
        if (results.length === 0) return res.status(404).send('Product not found');

        const product = results[0];

        getCartItemCount(req, (cartItemCount) => { // Get cart item count
            getProfilePicture(req.session.userId, (profilePicture) => {
                res.render('edit', {
                    product: product,
                    isLoggedIn: !!req.session.userId,
                    username: req.session.username || null,
                    role: req.session.role || null,
                    profilePicture: profilePicture,
                    cartItemCount: cartItemCount // Pass cart item count
                });
            });
        });
    });
});

// Render product ratings page (admin only)
app.get('/product-ratings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const ratingsPromise = new Promise((resolve, reject) => {
            const query = `
                SELECT pr.rating, pr.review, pr.created_at, u.username, p.name as productName, p.id as productId
                FROM product_ratings pr
                JOIN users u ON pr.user_id = u.id
                JOIN products p ON pr.product_id = p.id
                ORDER BY pr.created_at DESC
            `;
            db.query(query, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        const cartItemCountPromise = new Promise(resolve => getCartItemCount(req, resolve));
        const profilePicturePromise = new Promise(resolve => getProfilePicture(req.session.userId, resolve));

        const [ratings, cartItemCount, profilePicture] = await Promise.all([
            ratingsPromise,
            cartItemCountPromise,
            profilePicturePromise
        ]);

        res.render('product-ratings', {
            ratings,
            isLoggedIn: true,
            username: req.session.username,
            role: req.session.role,
            profilePicture,
            cartItemCount
        });

    } catch (err) {
        console.error('Error fetching product ratings page:', err);
        res.status(500).send('Internal Server Error');
    }
});

// MySQL connection pool
let db;
// Prioritize Railway-provided variables
const railwayDbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT,
};


// Check if Railway variables are present
if (railwayDbConfig.host && railwayDbConfig.user && railwayDbConfig.database) {
    db = mysql.createPool({
        host: railwayDbConfig.host,
        user: railwayDbConfig.user,
        password: railwayDbConfig.password,
        database: railwayDbConfig.database,
        port: railwayDbConfig.port ? parseInt(railwayDbConfig.port, 10) : 3306, // Default MySQL port
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('Connected to Railway MySQL database.');
} else if (process.env.DATABASE_URL) { // Fallback for Heroku-style DATABASE_URL (if user changes mind or has it)
    db = mysql.createPool(process.env.DATABASE_URL);
    console.log('Connected to DATABASE_URL MySQL database.');
} else {
    // Local environment or other custom env vars
    db = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'revoz',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('Connected to local/custom MySQL database.');
}

// Test connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        process.exit(1);
    } else {
        console.log('Connected to MySQL database:', process.env.DB_NAME);
        connection.release();
    }
});

// Initialize tables if they don't exist
db.query(`CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    profile_picture VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) console.error('Error creating users table:', err);
});

db.query(`CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255),
    description TEXT,
    price INT,
    image VARCHAR(255)
)`, (err) => {
    if (err) console.error('Error creating products table:', err);
});

// Cart tables
db.query(`CREATE TABLE IF NOT EXISTS carts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(255),
    user_id INT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) console.error('Error creating carts table:', err);
});

db.query(`CREATE TABLE IF NOT EXISTS cart_items (\n    id INT PRIMARY KEY AUTO_INCREMENT,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
)`, (err) => {
    if (err) console.error('Error creating cart_items table:', err);
});

db.query(`CREATE TABLE IF NOT EXISTS product_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL,
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rating (product_id, user_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`, (err) => {
    if (err) console.error('Error creating product_ratings table:', err);
});

// Contact messages table
db.query(`CREATE TABLE IF NOT EXISTS contact_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) console.error('Error creating contact_messages table:', err);
});

// Register route
app.post('/register', async (req, res) => {
    const { username, password, 'confirm-password': confirmPassword } = req.body;
    if (!username || !password || !confirmPassword) return res.status(400).send('Missing username, password, or confirm password');
    if (password !== confirmPassword) return res.status(400).send('Passwords do not match');
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'user'], function(err, result) {
            if (err) {
                console.error('Register error:', err);
                // Unique constraint violation (username exists)
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).send('Username already exists');
                return res.status(500).send('Error registering user');
            }
            // Log the user in by setting session and redirect to home
            req.session.userId = result.insertId;
            req.session.username = username;
            req.session.role = 'user'; // Default role for new users
            return res.redirect('/');
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Internal server error');
    }
});

// POST /api/user/check-username - check whether a username is already registered
app.post('/api/user/check-username', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ ok: false, message: 'Username diperlukan.' });

    db.query('SELECT id FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error checking username existence:', err);
            return res.status(500).json({ ok: false, message: 'Terjadi kesalahan server.' });
        }
        const exists = results && results.length > 0;
        res.json({ ok: true, exists });
    });
});

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ ok: false, message: 'Username dan password harus diisi.' });
    }

    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err) {
            console.error('DB error:', err);
            return res.status(500).json({ ok: false, message: 'Error selama login.' });
        }
        if (results.length === 0) {
            return res.status(401).json({ ok: false, message: 'Invalid username or password' });
        }
        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            
            const redirectUrl = user.nomor ? '/' : '/profile';
            return res.json({ ok: true, redirectUrl: redirectUrl });
        }
        return res.status(401).json({ ok: false, message: 'Invalid username or password' });
    });
});

app.get('/home', (req, res) => {
    if (req.session && req.session.userId) {
        return res.render('home', { username: req.session.username });
    }
    return res.redirect('/login');
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/login');
    });
});

// API to list products
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        if (err) {
            console.error('Products query error:', err);
            return res.status(500).send('Error retrieving products');
        }
        res.json(results);
    });
});

// Middleware to check admin role
function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    } else {
        return res.status(403).send('Access denied. Admin only.');
    }
}

// Middleware to check super admin role
function requireSuperAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'superadmin') {
        return next();
    } else {
        return res.status(403).send('Access denied. Super Admin only.');
    }
}

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.redirect('/login');
    }
}

// -- Cart API --
// Helper: get or create cart for current session
function getSessionId(req) {
    // prefer session id, fall back to express-session ID
    return req.sessionID || (req.session && req.session.id) || null;
}

function ensureCartForSession(sessionId, userId) {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM carts WHERE session_id = ? AND status = "active"', [sessionId], (err, results) => {
            if (err) return reject(err);
            if (results.length > 0) return resolve(results[0]);
            db.query('INSERT INTO carts (session_id, user_id) VALUES (?, ?)', [sessionId, userId || null], function(err, result) {
                if (err) return reject(err);
                db.query('SELECT * FROM carts WHERE id = ?', [result.insertId], (e, newCart) => {
                    if (e) reject(e);
                    else resolve(newCart[0]);
                });
            });
        });
    });
}

// GET /api/cart -> get current session cart
app.get('/api/cart', requireAuth, async (req, res) => {
    try {
        const sessionId = getSessionId(req);
        if (!sessionId) return res.status(400).send('No session');
        const cart = await ensureCartForSession(sessionId, req.session.userId);
        db.query('SELECT ci.*, p.name, p.image, p.description FROM cart_items ci LEFT JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?', [cart.id], (err, results) => {
            if (err) {
                console.error('Cart items error', err);
                return res.status(500).send('Error fetching cart');
            }
            res.json({ cart, items: results });
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Server error');
    }
});

// GET /cart -> render cart page
app.get('/cart', requireAuth, async (req, res) => {
    try {
        const sessionId = getSessionId(req);
        if (!sessionId) return res.redirect('/catalog');
        const cart = await ensureCartForSession(sessionId, req.session.userId);
        db.query('SELECT ci.*, p.name, p.image, p.description FROM cart_items ci LEFT JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?', [cart.id], (err, results) => {
            if (err) {
                console.error('Cart render error', err);
                return res.status(500).send('Error fetching cart');
            }
            getCartItemCount(req, (cartItemCount) => { // Get cart item count
                getProfilePicture(req.session.userId, (profilePicture) => {
                    res.render('cart', {
                        cart,
                        items: results,
                        username: req.session.username || null,
                        isLoggedIn: !!req.session.userId,
                        role: req.session.role || null,
                        profilePicture: profilePicture,
                        cartItemCount: cartItemCount // Pass cart item count
                    });
                });
            });
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Server error');
    }
});
// POST /api/cart/add { product_id, quantity }
app.post('/api/cart/add', requireAuth, async (req, res) => {
    const { product_id, quantity, warna, ukuran } = req.body; // Get warna and ukuran
    if (!product_id) return res.status(400).json({ ok: false, message: 'Missing product_id' });
    if (!warna || !ukuran || warna === 'Tidak Tersedia' || ukuran === 'Tidak Tersedia') return res.status(400).json({ ok: false, message: 'Silakan pilih varian warna dan ukuran yang valid.' });

    const qty = parseInt(quantity, 10) || 1;
    try {
        const sessionId = getSessionId(req);
        const cart = await ensureCartForSession(sessionId, req.session.userId);
        
        db.query('SELECT * FROM products WHERE id = ?', [product_id], (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ ok: false, message: 'Product not found' });
            const product = results[0];
            
            // Check if item with same product_id, warna, and ukuran exists
            const selectQuery = 'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND warna = ? AND ukuran = ?';
            db.query(selectQuery, [cart.id, product_id, warna, ukuran], (err, itemResults) => {
                if (err) return res.status(500).json({ ok: false, message: 'DB error' });

                if (itemResults.length > 0) {
                    // Update quantity if item exists
                    const item = itemResults[0];
                    const updateQuery = 'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?';
                    db.query(updateQuery, [qty, item.id], function(err) {
                        if (err) return res.status(500).json({ ok: false, message: 'Update error' });
                        return res.json({ ok: true });
                    });
                } else {
                    // Insert new item if it does not exist
                    const insertQuery = 'INSERT INTO cart_items (cart_id, product_id, quantity, price, warna, ukuran) VALUES (?, ?, ?, ?, ?, ?)';
                    db.query(insertQuery, [cart.id, product_id, qty, product.price, warna, ukuran], function(err) {
                        if (err) return res.status(500).json({ ok: false, message: 'Insert error' });
                        return res.json({ ok: true });
                    });
                }
            });
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// POST /api/cart/remove { item_id }
app.post('/api/cart/remove', requireAuth, (req, res) => {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).send('Missing item_id');
    db.query('DELETE FROM cart_items WHERE id = ?', [item_id], function(err) {
        if (err) return res.status(500).send('Delete error');
        res.json({ ok: true });
    });
});

// POST /api/cart/update-quantity { item_id, quantity }
app.post('/api/cart/update-quantity', requireAuth, (req, res) => {
    const { item_id, quantity } = req.body;
    if (!item_id) return res.status(400).json({ ok: false, message: 'Missing item_id' });
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return res.status(400).json({ ok: false, message: 'Quantity must be a positive integer' });

    db.query('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [qty, item_id], function(err, result) {
        if (err) {
            console.error('Error updating cart item quantity:', err);
            return res.status(500).json({ ok: false, message: 'Database error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ ok: false, message: 'Cart item not found' });
        }
        return res.json({ ok: true });
    });
});

// POST /api/cart/clear -> clear current cart
app.post('/api/cart/clear', requireAuth, async (req, res) => {
    try {
        const sessionId = getSessionId(req);
        if (!sessionId) return res.status(400).send('No session');
        const cart = await ensureCartForSession(sessionId, req.session.userId);
        db.query('DELETE FROM cart_items WHERE cart_id = ?', [cart.id], function(err) {
            if (err) return res.status(500).send('Clear error');
            res.json({ ok: true });
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Server error');
    }
});

// POST /api/cart/checkout -> process checkout
app.post('/api/cart/checkout', requireAuth, async (req, res) => {
    const { paymentMethod, shippingAddress } = req.body;
    if (!paymentMethod) {
        return res.status(400).json({ ok: false, message: 'Payment method is required' });
    }

    try {
        const sessionId = getSessionId(req);
        if (!sessionId) return res.status(400).json({ ok: false, message: 'No session' });

        const cart = await ensureCartForSession(sessionId, req.session.userId);

        if (!cart) return res.status(404).json({ ok: false, message: 'Cart not found' });

        // Check if cart has items
        db.query('SELECT id FROM cart_items WHERE cart_id = ?', [cart.id], async (err, items) => {
            if (err) {
                console.error('Error checking cart items:', err);
                return res.status(500).json({ ok: false, message: 'Server error' });
            }
            if (items.length === 0) {
                return res.status(400).json({ ok: false, message: 'Cart is empty' });
            }

            console.log(`Processing checkout for cart ${cart.id} with payment method: ${paymentMethod}`);

            // Try to add optional columns if they don't exist (harmless on modern MySQL)
            try {
                await db.promise().query("ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255)");
                await db.promise().query("ALTER TABLE carts ADD COLUMN IF NOT EXISTS tipe VARCHAR(50)");
                await db.promise().query("ALTER TABLE carts ADD COLUMN IF NOT EXISTS shipping_address TEXT");
            } catch (alterErr) {
                // Not critical - log and continue. Some older MySQL versions may not support IF NOT EXISTS.
                console.warn('Could not ensure cart columns (safe to ignore on some setups):', alterErr && alterErr.message ? alterErr.message : alterErr);
            }

            const shippingJson = shippingAddress ? JSON.stringify(shippingAddress) : null;

            // Update cart status to 'completed' and tipe to 'waiting', persist payment and shipping info
            db.query("UPDATE carts SET status = 'completed', tipe = 'waiting', payment_method = ?, shipping_address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [paymentMethod, shippingJson, cart.id], function(err) {
                if (err) {
                    console.error('Checkout error:', err);
                    return res.status(500).json({ ok: false, message: 'Checkout error' });
                }
                // The cart is now "archived". The next time ensureCartForSession is called, it will create a new one.
                res.json({ ok: true });
            });
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});


// Optional: Nodemailer for sending admin notifications on contact form
let mailerTransport = null;
try {
    const nodemailer = require('nodemailer');
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
        mailerTransport = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });

        // Verify transporter in background
        mailerTransport.verify().then(() => console.log('Mailer transporter ready')).catch(err => console.warn('Mailer verification failed:', err.message || err));
    } else {
        console.log('Mailer not configured - set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to enable notifications');
    }
} catch (e) {
    console.log('Nodemailer not installed or failed to load. To enable email notifications run: npm install nodemailer');
}

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});