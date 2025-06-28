// This is the complete, new code for database_setup.js

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        return console.error("Error opening database " + err.message);
    }
    console.log("Database connected!");
});

db.serialize(() => {
    // --- 1. Create all tables ---
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            image_url TEXT NOT NULL,
            thumb1 TEXT, thumb2 TEXT, thumb3 TEXT, thumb4 TEXT,
            is_featured INTEGER DEFAULT 0,
            is_new_arrival INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS banners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subtitle TEXT,
            details TEXT,
            button_text TEXT,
            button_link TEXT,
            image_url TEXT NOT NULL,
            is_active INTEGER DEFAULT 0
        )
    `);

    console.log("All tables checked/created.");

    // --- 2. Insert all sample data ---
    const products = [
        { name: 'Silk Ware Soft 3 Pieces', brand: 'ZaZa', price: 4000, description: 'A beautiful 3-piece suit made from the finest silk.', image: 'img/products/f1.jpeg', thumb1: 'img/products/sm1.jpeg', thumb2: 'img/products/sm2.jpeg', thumb3: 'img/products/sm3.jpeg', thumb4: 'img/products/sm4.jpeg', featured: 1, new: 0 },
        { name: 'Floral Print Dress', brand: 'ZaZa', price: 4200, description: 'Elegant floral dress for summer evenings.', image: 'img/products/f2.jpeg', thumb1: null, thumb2: null, thumb3: null, thumb4: null, featured: 1, new: 0 },
        { name: 'Summer Blouse', brand: 'ZaZa', price: 3800, description: 'Light and airy summer blouse.', image: 'img/products/f3.jpeg', thumb1: null, thumb2: null, thumb3: null, thumb4: null, featured: 1, new: 0 },
        { name: 'Office Wear Shirt', brand: 'ZaZa', price: 3500, description: 'Professional and stylish office wear.', image: 'img/products/f4.jpeg', thumb1: null, thumb2: null, thumb3: null, thumb4: null, featured: 1, new: 0 },
        { name: 'Elegant Evening Gown', brand: 'ZaZa', price: 5500, description: 'A stunning gown for special occasions.', image: 'img/products/f9.jpeg', thumb1: null, thumb2: null, thumb3: null, thumb4: null, featured: 0, new: 1 },
        { name: 'Casual Denim Jacket', brand: 'ZaZa', price: 4800, description: 'A timeless casual denim jacket.', image: 'img/products/f10.jpeg', thumb1: null, thumb2: null, thumb3: null, thumb4: null, featured: 0, new: 1 },
        { name: 'Bohemian Skirt', brand: 'ZaZa', price: 4300, description: 'Flowy and comfortable bohemian style skirt.', image: 'img/products/f11.jpeg', thumb1: null, thumb2: null, thumb3: null, thumb4: null, featured: 0, new: 1 },
        { name: 'Knit Sweater', brand: 'ZaZa', price: 4600, description: 'Cozy knit sweater for cooler days.', image: 'img/products/f12.jpeg', thumb1: null, thumb2: null, thumb3: null, thumb4: null, featured: 0, new: 1 }
    ];

    const stmt = db.prepare("INSERT INTO products (name, brand, price, description, image_url, thumb1, thumb2, thumb3, thumb4, is_featured, is_new_arrival) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    products.forEach(p => {
        stmt.run(p.name, p.brand, p.price, p.description || '', p.image, p.thumb1, p.thumb2, p.thumb3, p.thumb4, p.featured, p.new);
    });
    stmt.finalize((err) => {
        if (!err) console.log("Sample products inserted.");
    });
    
    const bannerSql = `INSERT INTO banners (title, subtitle, details, button_text, button_link, image_url, is_active) SELECT 'super value deals', 'trade-in-offer', 'on all products', 'Shop Now', '/shop', 'img/logo/520.jpeg', 1 WHERE NOT EXISTS (SELECT 1 FROM banners WHERE is_active = 1)`;
    db.run(bannerSql, [], (err) => {
        if(!err) console.log("Default active banner checked/inserted.");
    });

    // --- 3. Create Permanent Admin User ---
    const adminEmail = 'rakibulalamnabil22@gmail.com'; // Your Admin Email
    const adminUsername = 'admin';                     // Your Admin Username
    const adminPassword = 'Bristy1020';                // Your Admin Password
    
    const saltRounds = 10;
    bcrypt.hash(adminPassword, saltRounds, (err, hash) => {
        if (err) return console.error("Error hashing password:", err.message);
        const adminSql = `INSERT INTO users (username, email, password, is_admin) SELECT ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ?)`;
        db.run(adminSql, [adminUsername, adminEmail, hash, adminEmail], function(err) {
            if (err) return console.error("Error creating admin:", err.message);
            if (this.changes > 0) {
                console.log(`Permanent admin account '${adminUsername}' created.`);
            } else {
                console.log("Permanent admin account already exists.");
            }
        });
    });

});

db.close((err) => {
    if (err) return console.error(err.message);
    console.log('Closed the database connection.');
});