const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db'); // Use your actual database connection here
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const port = 3000;
const SECRET_KEY = 'Psds@07052025'; // Change this to a more secure value in production

// Middleware to parse JSON bodies
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});
const upload = multer({ storage });
app.use('/uploads', express.static('uploads')); // Serve uploaded images

// Swagger setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'PSDS Api',
            version: '1.0.0',
            description: 'Parth Shah Design Studio',
        },
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ BearerAuth: [] }],
    },
    apis: ['./server.js'],
};

// Initialize Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           example: user1
 *         password:
 *           type: string
 *           example: password123
 *     AboutUs:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           example: "About our company"
 *         image:
 *           type: string
 *           format: binary
 *     Work:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - category_id
 *       properties:
 *         title:
 *           type: string
 *           example: "Commercial Project"
 *         description:
 *           type: string
 *           example: "A detailed description of the project"
 *         category_id:
 *           type: integer
 *           example: 1
 *     ContactDetail:
 *       type: object
 *       required:
 *         - email
 *         - phone
 *       properties:
 *         email:
 *           type: string
 *           example: "contact@company.com"
 *         phone:
 *           type: string
 *           example: "123-456-7890"
 */

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Logs in and generates a token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *       401:
 *         description: Unauthorized, incorrect credentials
 */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.execute('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }
            const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '1h' });
            res.status(200).json({ token });
        });
    });
});

/**
 * @swagger
 * /api/about:
 *   post:
 *     summary: Create About Us entry
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AboutUs'
 *     responses:
 *       201:
 *         description: About Us created
 */
app.post('/api/about', authenticateToken, upload.single('image'), (req, res) => {
    const content = req.body.content;
    const image = req.file ? req.file.filename : null;
    db.execute('INSERT INTO about_us (image, content) VALUES (?, ?)', [image, content], (err) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.status(201).json({ message: 'About Us created' });
    });
});

/**
 * @swagger
 * /api/about:
 *   get:
 *     summary: Get About Us entries with optional filters
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         description: ID of the about entry
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: About Us content retrieved
 */
app.get('/api/about', (req, res) => {
    const { id, limit } = req.query;
    let sql = `SELECT * FROM about_us WHERE 1=1`;
    const params = [];

    if (id) {
        sql += ` AND id = ?`;
        params.push(id);
    }

    sql += ` ORDER BY id DESC`;

    if (limit) {
        sql += ` LIMIT ?`;
        params.push(parseInt(limit));
    }

    db.execute(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        if (results.length === 0) return res.status(404).json({ message: 'No content' });

        const formatted = results.map(item => ({
            ...item,
            image_url: item.image ? `${req.protocol}://${req.get('host')}/uploads/${item.image}` : null
        }));

        res.json(id || limit ? formatted : formatted[0]); // if single item requested, return as object
    });
});


/**
 * @swagger
 * /api/about/{id}:
 *   put:
 *     summary: Update About Us entry
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AboutUs'
 *     responses:
 *       200:
 *         description: Updated
 */
app.put('/api/about/:id', authenticateToken, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const content = req.body.content;
    const image = req.file ? req.file.filename : null;

    if (image) {
        db.execute('SELECT image FROM about_us WHERE id = ?', [id], (err, result) => {
            if (!err && result[0]?.image) fs.unlink(`uploads/${result[0].image}`, () => { });
        });
    }

    db.execute('UPDATE about_us SET content = ?, image = COALESCE(?, image) WHERE id = ?', [content, image, id], (err) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ message: 'Updated' });
    });
});

/**
 * @swagger
 * /api/about/{id}:
 *   delete:
 *     summary: Delete About Us entry
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted
 */
app.delete('/api/about/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.execute('SELECT image FROM about_us WHERE id = ?', [id], (err, result) => {
        if (err || result.length === 0) return res.status(404).json({ message: 'Not found' });

        if (result[0].image) fs.unlink(`uploads/${result[0].image}`, () => { });
        db.execute('DELETE FROM about_us WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            res.json({ message: 'Deleted' });
        });
    });
});

// Auth middleware for JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        next();
    });
}


/**
 * @swagger
 * components:
 *   schemas:
 *     Work:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         image:
 *           type: string
 *           format: binary
 *         category_id:
 *           type: integer
 */

/**
 * @swagger
 * /api/work:
 *   post:
 *     summary: Create new work item
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Work'
 *     responses:
 *       201:
 *         description: Work created
 */
app.post('/api/work', authenticateToken, upload.single('image'), (req, res) => {
    const { title, description, category_id } = req.body;
    const image = req.file ? req.file.filename : null;

    db.execute(
        'INSERT INTO work (title, description, image, category_id) VALUES (?, ?, ?, ?)',
        [title, description, image, category_id],
        (err) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            res.status(201).json({ message: 'Work created' });
        }
    );
});

/**
 * @swagger
 * /api/work:
 *   get:
 *     summary: Get work items with optional filters
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         description: ID of the work item
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: List of work items
 */
app.get('/api/work', (req, res) => {
    const { id, limit, category_id } = req.query;
    let sql = `
        SELECT w.*, 
        CONCAT('${req.protocol}://${req.get('host')}/uploads/', w.image) AS image_url, 
        c.name AS category 
        FROM work w 
        LEFT JOIN categories c ON w.category_id = c.id 
        WHERE 1=1`;
    const params = [];

    if (id) {
        sql += ' AND w.id = ?';
        params.push(id);
    }

    if (category_id) {
        sql += ' AND w.category_id = ?';
        params.push(category_id);
    }

    sql += ' ORDER BY w.id DESC';

    if (limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(limit));
    }

    db.execute(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json(results);
    });
});


/**
 * @swagger
 * /api/work/{id}:
 *   put:
 *     summary: Update work item
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Work'
 *     responses:
 *       200:
 *         description: Work updated
 */
app.put('/api/work/:id', authenticateToken, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description, category_id } = req.body;
    const image = req.file ? req.file.filename : null;

    if (image) {
        db.execute('SELECT image FROM work WHERE id = ?', [id], (err, result) => {
            if (!err && result[0]?.image) fs.unlink(`uploads/${result[0].image}`, () => { });
        });
    }

    db.execute(
        'UPDATE work SET title = ?, description = ?, image = COALESCE(?, image), category_id = ? WHERE id = ?',
        [title, description, image, category_id, id],
        (err) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            res.json({ message: 'Work updated' });
        }
    );
});

/**
 * @swagger
 * /api/work/{id}:
 *   delete:
 *     summary: Delete work item
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Work deleted
 */
app.delete('/api/work/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.execute('SELECT image FROM work WHERE id = ?', [id], (err, result) => {
        if (err || result.length === 0) return res.status(404).json({ message: 'Not found' });

        if (result[0].image) fs.unlink(`uploads/${result[0].image}`, () => { });
        db.execute('DELETE FROM work WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            res.json({ message: 'Work deleted' });
        });
    });
});


/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Create or update contact details
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactDetail'
 *     responses:
 *       200:
 *         description: Contact details updated or created
 */
app.post('/api/contact', authenticateToken, (req, res) => {
    const { email, phone } = req.body;

    db.execute('SELECT * FROM contact_details WHERE id = 1', (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });

        if (results.length > 0) {
            db.execute('UPDATE contact_details SET email = ?, phone = ? WHERE id = 1', [email, phone], (err) => {
                if (err) return res.status(500).json({ message: 'DB error' });
                res.json({ message: 'Contact details updated' });
            });
        } else {
            db.execute('INSERT INTO contact_details (email, phone) VALUES (?, ?)', [email, phone], (err) => {
                if (err) return res.status(500).json({ message: 'DB error' });
                res.status(201).json({ message: 'Contact details created' });
            });
        }
    });
});

/**
 * @swagger
 * /api/contact:
 *   get:
 *     summary: Get contact details
 *     responses:
 *       200:
 *         description: Contact details retrieved
 */
app.get('/api/contact', (req, res) => {
    db.execute('SELECT * FROM contact_details WHERE id = 1', (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        if (results.length === 0) return res.status(404).json({ message: 'Contact details not found' });
        res.json(results[0]);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Swagger docs at http://localhost:${port}/api-docs`);
});
