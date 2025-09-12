const express = require('express');
const bcrypt = require('bcryptjs');
const DatabaseManager = require('../utils/database');
const { generateToken, setTokenCookie, clearTokenCookie } = require('../middleware/jwt-auth');
const chalk = require('chalk');

const router = express.Router();
const dbManager = new DatabaseManager();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user dengan email dan password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login berhasil"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *       400:
 *         description: Data tidak valid
 *       401:
 *         description: Email atau password salah
 *       500:
 *         description: Error server
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validasi input
        if (!email || !password) {
            console.log(chalk.red('❌ Email dan password harus diisi'));
            return res.status(400).json({
                success: false,
                message: 'Email dan password harus diisi'
            });
        }

        // Validasi format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log(chalk.red('❌ Format email tidak valid'));
            return res.status(400).json({
                success: false,
                message: 'Format email tidak valid'
            });
        }

        console.log(chalk.yellow(`🔄 Attempting login for: ${email}`));

        // Connect to database
        const connected = await dbManager.connect();
        if (!connected) {
            console.log(chalk.red('❌ Database connection failed'));
            return res.status(500).json({
                success: false,
                message: 'Database connection failed'
            });
        }

        // Cari user berdasarkan email
        const user = await dbManager.getUserByEmail(email);
        if (!user) {
            console.log(chalk.red(`❌ User not found: ${email}`));
            return res.status(401).json({
                success: false,
                message: 'Email atau password salah'
            });
        }

        // Verifikasi password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log(chalk.red(`❌ Invalid password for: ${email}`));
            return res.status(401).json({
                success: false,
                message: 'Email atau password salah'
            });
        }

        // Generate JWT token dengan username (email) sebagai payload
        const token = generateToken(user.email);

        // Set cookie dengan JWT token
        setTokenCookie(token, res);

        console.log(chalk.green(`✅ Login successful for: ${email}`));

        // Response berhasil
        res.status(200).json({
            success: true,
            message: 'Login berhasil',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.log(chalk.red(`❌ Login error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user dan clear JWT cookie
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logout berhasil"
 */
router.post('/logout', (req, res) => {
    try {
        // Clear JWT cookie
        clearTokenCookie(res);

        console.log(chalk.green('✅ Logout successful'));

        res.status(200).json({
            success: true,
            message: 'Logout berhasil'
        });

    } catch (error) {
        console.log(chalk.red(`❌ Logout error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register user baru
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "newuser@example.com"
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 example: "john_doe"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: User berhasil didaftarkan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User berhasil didaftarkan"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: "newuser@example.com"
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T00:00:00.000Z"
 *       400:
 *         description: Data tidak valid
 *       409:
 *         description: Email atau username sudah terdaftar
 *       500:
 *         description: Error server
 */
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        // Validasi input
        if (!email || !username || !password) {
            console.log(chalk.red('❌ Email, username dan password harus diisi'));
            return res.status(400).json({
                success: false,
                message: 'Email, username dan password harus diisi'
            });
        }

        // Validasi format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log(chalk.red('❌ Format email tidak valid'));
            return res.status(400).json({
                success: false,
                message: 'Format email tidak valid'
            });
        }

        // Validasi password minimal 6 karakter
        if (password.length < 6) {
            console.log(chalk.red('❌ Password minimal 6 karakter'));
            return res.status(400).json({
                success: false,
                message: 'Password minimal 6 karakter'
            });
        }

        // Validasi username minimal 3 karakter
        if (username.length < 3) {
            console.log(chalk.red('❌ Username minimal 3 karakter'));
            return res.status(400).json({
                success: false,
                message: 'Username minimal 3 karakter'
            });
        }

        console.log(chalk.yellow(`🔄 Attempting registration for: ${email}`));

        // Connect to database
        const connected = await dbManager.connect();
        if (!connected) {
            console.log(chalk.red('❌ Database connection failed'));
            return res.status(500).json({
                success: false,
                message: 'Database connection failed'
            });
        }

        // Cek apakah email sudah terdaftar
        const existingUser = await dbManager.getUserByEmail(email);
        if (existingUser) {
            console.log(chalk.red(`❌ Email already registered: ${email}`));
            return res.status(409).json({
                success: false,
                message: 'Email sudah terdaftar'
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Buat user baru
        const newUser = await dbManager.createUserAccount(email, username, hashedPassword);

        console.log(chalk.green(`✅ Registration successful for: ${email} (${username})`));

        res.status(201).json({
            success: true,
            message: 'User berhasil didaftarkan',
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
                created_at: newUser.created_at
            }
        });

    } catch (error) {
        console.log(chalk.red(`❌ Registration error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

module.exports = router;
