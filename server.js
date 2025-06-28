const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const port = 3000;
const saltRounds = 10; // for password hashing

// --- Database Connection ---
const db = new sqlite3.Database('./database.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) console.error("Error connecting to the database", err.message);
    else console.log("Connected to the SQLite database.");
});

// --- Middleware ---
app.set('view engine', 'ejs'); // Set EJS as the templating engine
app.use(express.static('public')); // Serve static files from the 'public' directory
app.use(express.urlencoded({ extended: true })); // Parse form data

// --- This is the new Admin protection middleware ---
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next(); // If they are an admin, let them proceed
    } else {
        res.status(403).send("Forbidden: Admins only"); // If not, block them
    }
}


// Session middleware setup
app.use(session({
    secret: 'a_very_secret_key_that_should_be_in_env', // Use a long random string here
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
// --- This is the new middleware to add ---

// Middleware to make user session data available to all templates
// --- THIS IS THE NEW, CORRECTED MIDDLEWARE ---

// Middleware to make user session data available to all templates
app.use((req, res, next) => {
    // Check if a user is logged in by looking for a userId in the session
    if (req.session.userId) {
        res.locals.isLoggedIn = true;
        res.locals.username = req.session.username;
        res.locals.isAdmin = req.session.isAdmin; // <-- ADD THIS LINE
    } else {
        res.locals.isLoggedIn = false;
        res.locals.username = null;
        res.locals.isAdmin = false; // <-- ADD THIS LINE
    }
    next(); // This is crucial! It tells Express to move on to the next route.
});

// --- Routes ---  <-- Your routes should start after this new middleware


// --- Routes ---

// Home Page

app.get('/', (req, res) => {
    const featuredProductsSql = "SELECT * FROM products WHERE is_featured = 1 LIMIT 8";
    const newArrivalsSql = "SELECT * FROM products WHERE is_new_arrival = 1 LIMIT 8";
    const activeBannerSql = "SELECT * FROM banners WHERE is_active = 1 LIMIT 1";

    db.get(activeBannerSql, [], (err, activeBanner) => {
        if (err) throw err;
        db.all(featuredProductsSql, [], (err, featured) => {
            if (err) throw err;
            db.all(newArrivalsSql, [], (err, newArrivals) => {
                if (err) throw err;
                res.render('index', { 
                    activeBanner: activeBanner, // NEW
                    featuredProducts: featured, 
                    newArrivals: newArrivals 
                });
            });
        });
    });
});

// Shop Page
app.get('/shop', (req, res) => {
    db.all("SELECT * FROM products", [], (err, products) => {
        if (err) throw err;
        res.render('shop', { products: products });
    });
});

// Single Product Page
app.get('/product/:id', (req, res) => {
    const productId = req.params.id;
    const productSql = "SELECT * FROM products WHERE id = ?";
    const featuredSql = "SELECT * FROM products WHERE is_featured = 1 AND id != ? LIMIT 4";

    db.get(productSql, [productId], (err, product) => {
        if (err) throw err;
        db.all(featuredSql, [productId], (err, featured) => {
            if (err) throw err;
            res.render('sproduct', { product: product, featuredProducts: featured });
        });
    });
});


// Static Pages
app.get('/about', (req, res) => res.render('about'));
app.get('/contact', (req, res) => res.render('contact'));

// Contact Form Submission
app.post('/submit-contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    const sql = "INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)";
    db.run(sql, [name, email, subject, message], (err) => {
        if (err) throw err;
        res.redirect('/contact'); // Redirect or show a thank you page
    });
});

// --- Shopping Cart Routes ---

// Add item to cart
app.post('/cart/add/:id', (req, res) => {
    const productId = req.params.id;
    const quantity = parseInt(req.body.quantity) || 1; // Get quantity from form, default to 1

    // Ensure user is logged in
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const sql = "SELECT * FROM products WHERE id = ?";
    db.get(sql, [productId], (err, product) => {
        if (err || !product) {
            return res.redirect('/shop'); // Or show an error
        }

        // Initialize cart if it doesn't exist
        if (!req.session.cart) {
            req.session.cart = [];
        }

        // Check if product is already in the cart
        const existingProductIndex = req.session.cart.findIndex(item => item.id == productId);

        if (existingProductIndex > -1) {
            // If it exists, just update the quantity
            req.session.cart[existingProductIndex].quantity += quantity;
        } else {
            // If it's a new product, add it to the cart
            const cartItem = {
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                quantity: quantity
            };
            req.session.cart.push(cartItem);
        }
        
        // Redirect back to the shop page after adding
        res.redirect('/shop');
    });
});

// Display Cart Page
app.get('/cart', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const cart = req.session.cart || [];
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
    });

    res.render('cart', { cart: cart, total: total });
});

// --- Authentication Routes ---

// Show Login Page
app.get('/login', (req, res) => res.render('login'));

// Handle Login
// --- Find and replace your entire POST /login route ---
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    db.get(sql, [email], (err, user) => {
        if (err) throw err;
        if (!user) return res.send('User not found!');

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.cart = [];
                req.session.isAdmin = user.is_admin === 1; // NEW: Check if they are an admin
                res.redirect('/');
            } else {
                res.send('Incorrect password!');
            }
        });
    });
});

// Show Signup Page
app.get('/signup', (req, res) => {
    res.render('signup');
});
// Handle Signup
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) throw err;
        const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        db.run(sql, [username, email, hash], (err) => {
            if (err) return res.send("Email or Username already exists.");
            res.redirect('/login');
        });
    });
});

// Handle Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.redirect('/');
        res.clearCookie('connect.sid'); // The default session cookie name
        res.redirect('/login');
    });
});


// ============================================
// ========= ADMIN PANEL ROUTES =========
// ============================================

// Middleware to protect admin routes (make sure this is in your middleware section)
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next(); // User is an admin, proceed
    } else {
        res.status(403).send("<h1>403 Forbidden</h1><p>You do not have permission to view this page.</p><a href='/'>Go Home</a>");
    }
}

// --- NEW: Show the main Admin Dashboard ---
app.get('/admin', requireAdmin, (req, res) => {
    // The username is already available via res.locals from our other middleware
    res.render('admin-dashboard');
});

// --- Show the main admin page with a list of products ---
// This handles GET requests to /admin/products
app.get('/admin/products', requireAdmin, (req, res) => {
    db.all("SELECT * FROM products ORDER BY id DESC", [], (err, products) => {
        if (err) {
            console.error("Database error fetching products for admin:", err.message);
            return res.status(500).send("Database error.");
        }
        // Renders the admin-products.ejs file and sends the products data to it
        res.render('admin-products', { products: products });
    });
});


// --- Handle the "Add New Product" form submission ---
// This handles POST requests from the form
app.post('/admin/products/add', requireAdmin, (req, res) => {
    // Get all the data from the new form
    const { name, brand, price, description, image_url, thumb1, thumb2, thumb3, thumb4 } = req.body;

    const sql = `INSERT INTO products 
        (name, brand, price, description, image_url, thumb1, thumb2, thumb3, thumb4, is_featured, is_new_arrival) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`;
    
    // Use || null to handle optional fields gracefully
    const params = [
        name, 
        brand, 
        price, 
        description, 
        image_url, 
        thumb1 || null, 
        thumb2 || null, 
        thumb3 || null, 
        thumb4 || null
    ];

    db.run(sql, params, (err) => {
        if (err) {
            console.error("Error adding product:", err.message);
            return res.status(500).send("Failed to add product.");
        }
        // If successful, redirect back to the admin products page
        res.redirect('/admin/products');
    });
});



// --- NEW: Show the "Edit Product" form ---
app.get('/admin/products/edit/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;
    const sql = "SELECT * FROM products WHERE id = ?";
    
    db.get(sql, [productId], (err, product) => {
        if (err || !product) {
            return res.status(404).send("Product not found.");
        }
        // We will create edit-product.ejs next
        res.render('edit-product', { product: product });
    });
});

// --- NEW: Handle the "Edit Product" form submission ---
app.post('/admin/products/edit/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;
    const { name, brand, price, description, image_url, thumb1, thumb2, thumb3, thumb4 } = req.body;

    const sql = `UPDATE products SET 
        name = ?, brand = ?, price = ?, description = ?, image_url = ?, 
        thumb1 = ?, thumb2 = ?, thumb3 = ?, thumb4 = ? 
        WHERE id = ?`;

    const params = [
        name, brand, price, description, image_url,
        thumb1 || null, thumb2 || null, thumb3 || null, thumb4 || null,
        productId
    ];

    db.run(sql, params, (err) => {
        if (err) {
            console.error("Error updating product:", err.message);
            return res.status(500).send("Failed to update product.");
        }
        res.redirect('/admin/products');
    });
});

// --- NEW: Handle the "Delete Product" form submission ---
app.post('/admin/products/delete/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;
    const sql = "DELETE FROM products WHERE id = ?";

    db.run(sql, [productId], (err) => {
        if (err) {
            console.error("Error deleting product:", err.message);
            return res.status(500).send("Failed to delete product.");
        }
        res.redirect('/admin/products');
    });
});

// --- TEMPORARY ADMIN PROMOTION ROUTE ---
// Use this only once, then delete it for security.
app.get('/make-me-an-admin/:email', (req, res) => {
    const userEmail = req.params.email;
    const sql = "UPDATE users SET is_admin = 1 WHERE email = ?";
    
    db.run(sql, [userEmail], function(err) {
        if (err) {
            return res.send("Error updating user.");
        }
        if (this.changes === 0) {
            return res.send("User with that email not found.");
        }
        res.send(`User ${userEmail} has been promoted to admin!`);
    });
});


// --- NEW: Admin Routes for Banners ---

// Show a page to manage all banners
app.get('/admin/banners', requireAdmin, (req, res) => {
    db.all("SELECT * FROM banners ORDER BY id DESC", [], (err, banners) => {
        if (err) throw err;
        // We will create admin-banners.ejs next
        res.render('admin-banners', { banners: banners });
    });
});

// Handle adding a new banner
app.post('/admin/banners/add', requireAdmin, (req, res) => {
    const { title, subtitle, details, button_text, button_link, image_url } = req.body;
    const sql = "INSERT INTO banners (title, subtitle, details, button_text, button_link, image_url) VALUES (?, ?, ?, ?, ?, ?)";
    db.run(sql, [title, subtitle, details, button_text, button_link, image_url], (err) => {
        if (err) throw err;
        res.redirect('/admin/banners');
    });
});

// Handle setting a banner as the active one
app.post('/admin/banners/activate/:id', requireAdmin, (req, res) => {
    const bannerId = req.params.id;
    // This is a transaction: first deactivate all, then activate one.
    db.serialize(() => {
        db.run("UPDATE banners SET is_active = 0");
        db.run("UPDATE banners SET is_active = 1 WHERE id = ?", [bannerId], (err) => {
            if (err) throw err;
            res.redirect('/admin/banners');
        });
    });
});
// --- THIS IS THE SECRET ADMIN PROMOTION ROUTE ---
// Use this only once, then delete it for security.

app.get('/super-secret-admin-promo/:emailToPromote', (req, res) => {
    const userEmail = req.params.emailToPromote;
    const sql = "UPDATE users SET is_admin = 1 WHERE email = ?";
    
    db.run(sql, [userEmail], function(err) {
        if (err) {
            return res.status(500).send("Error trying to update the user. Check the server logs.");
        }
        if (this.changes === 0) {
            return res.status(404).send(`User with the email '${userEmail}' was not found in the database.`);
        }
        res.status(200).send(`<h1>Success!</h1><p>The user with email '${userEmail}' has been promoted to an admin.</p><a href="/">Go to Homepage</a>`);
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});