const express = require('express');
const { authenticateToken } = require('../middleware/jwt-auth');
const chalk = require('chalk');

const router = express.Router();

/**
 * @swagger
 * /api/protected/profile:
 *   get:
 *     summary: Get user profile (Protected route)
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile berhasil diambil
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
 *                   example: "Profile berhasil diambil"
 *                 user:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     iat:
 *                       type: integer
 *                       example: 1640995200
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Token expired
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        console.log(chalk.green(`✅ Profile accessed by: ${req.user.username}`));

        // Get user data from database to get actual username
        const DatabaseManager = require('../utils/database');
        const dbManager = new DatabaseManager();

        const connected = await dbManager.connect();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        const userData = await dbManager.getUserByEmail(req.user.username);
        await dbManager.close();

        if (!userData) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile berhasil diambil',
            user: {
                username: userData.username,
                email: userData.email,
                iat: req.user.iat
            }
        });

    } catch (error) {
        console.log(chalk.red(`❌ Profile error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/protected/dashboard:
 *   get:
 *     summary: Get dashboard data (Protected route)
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data berhasil diambil
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
 *                   example: "Dashboard data berhasil diambil"
 *                 data:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                       example: "user@example.com"
 *                     timestamp:
 *                       type: string
 *                       example: "2023-12-31T12:00:00.000Z"
 *                     message:
 *                       type: string
 *                       example: "Welcome to dashboard!"
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Token expired
 */
router.get('/dashboard', authenticateToken, (req, res) => {
    try {
        console.log(chalk.green(`✅ Dashboard accessed by: ${req.user.username}`));

        res.status(200).json({
            success: true,
            message: 'Dashboard data berhasil diambil',
            data: {
                username: req.user.username,
                timestamp: new Date().toISOString(),
                message: 'Welcome to dashboard!'
            }
        });

    } catch (error) {
        console.log(chalk.red(`❌ Dashboard error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/protected/test:
 *   get:
 *     summary: Test protected route
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test berhasil
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
 *                   example: "Protected route berhasil diakses"
 *                 tokenInfo:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                       example: "user@example.com"
 *                     issuedAt:
 *                       type: integer
 *                       example: 1640995200
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Token expired
 */
router.get('/test', authenticateToken, (req, res) => {
    try {
        console.log(chalk.green(`✅ Test route accessed by: ${req.user.username}`));

        res.status(200).json({
            success: true,
            message: 'Protected route berhasil diakses',
            tokenInfo: {
                username: req.user.username,
                issuedAt: req.user.iat
            }
        });

    } catch (error) {
        console.log(chalk.red(`❌ Test route error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/protected/users:
 *   get:
 *     summary: Get all user accounts
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       email:
 *                         type: string
 *                         example: "user@example.com"
 *                       username:
 *                         type: string
 *                         example: "john_doe"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Error server
 */
router.get('/users', authenticateToken, async (req, res) => {
    try {
        console.log(chalk.green(`✅ Users list accessed by: ${req.user.username}`));

        const DatabaseManager = require('../utils/database');
        const dbManager = new DatabaseManager();

        const connected = await dbManager.connect();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        const users = await dbManager.getAllUsers();
        await dbManager.close();

        res.status(200).json({
            success: true,
            data: users
        });

    } catch (error) {
        console.log(chalk.red(`❌ Users list error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/protected/users:
 *   post:
 *     summary: Create new user account
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
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
 *                 example: "newuser@example.com"
 *               username:
 *                 type: string
 *                 example: "newuser"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: User account created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Email or username already exists
 *       500:
 *         description: Error server
 */
router.post('/users', authenticateToken, async (req, res) => {
    try {
        const { email, username, password } = req.body;

        console.log(chalk.yellow(`🔄 Creating user account: ${email} (${username})`));

        // Validasi input
        if (!email || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email, username dan password harus diisi'
            });
        }

        // Validasi format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Format email tidak valid'
            });
        }

        // Validasi password minimal 6 karakter
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password minimal 6 karakter'
            });
        }

        // Validasi username minimal 3 karakter
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username minimal 3 karakter'
            });
        }

        const DatabaseManager = require('../utils/database');
        const bcrypt = require('bcryptjs');
        const dbManager = new DatabaseManager();

        const connected = await dbManager.connect();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        // Cek apakah email sudah terdaftar
        const existingUser = await dbManager.getUserByEmail(email);
        if (existingUser) {
            await dbManager.close();
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
        await dbManager.close();

        console.log(chalk.green(`✅ User account created successfully: ${email} (${username})`));

        res.status(201).json({
            success: true,
            message: 'User account berhasil dibuat',
            data: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
                created_at: newUser.created_at
            }
        });

    } catch (error) {
        console.log(chalk.red(`❌ Create user error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/protected/users/{id}:
 *   put:
 *     summary: Update user account
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "updated@example.com"
 *               username:
 *                 type: string
 *                 example: "updateduser"
 *               password:
 *                 type: string
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: User account updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: User not found
 *       500:
 *         description: Error server
 */
router.put('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, username, password } = req.body;

        console.log(chalk.yellow(`🔄 Updating user account ID: ${id}`));

        const DatabaseManager = require('../utils/database');
        const bcrypt = require('bcryptjs');
        const dbManager = new DatabaseManager();

        const connected = await dbManager.connect();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        // Cek apakah user ada
        const existingUser = await dbManager.getUserById(id);
        if (!existingUser) {
            await dbManager.close();
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan'
            });
        }

        // Validasi input jika ada
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await dbManager.close();
                return res.status(400).json({
                    success: false,
                    message: 'Format email tidak valid'
                });
            }
        }

        if (username && username.length < 3) {
            await dbManager.close();
            return res.status(400).json({
                success: false,
                message: 'Username minimal 3 karakter'
            });
        }

        if (password && password.length < 6) {
            await dbManager.close();
            return res.status(400).json({
                success: false,
                message: 'Password minimal 6 karakter'
            });
        }

        // Update user
        const updateData = {};
        if (email) updateData.email = email;
        if (username) updateData.username = username;
        if (password) {
            const saltRounds = 12;
            updateData.password = await bcrypt.hash(password, saltRounds);
        }

        const updatedUser = await dbManager.updateUserAccount(id, updateData);
        await dbManager.close();

        console.log(chalk.green(`✅ User account updated successfully: ID ${id}`));

        res.status(200).json({
            success: true,
            message: 'User account berhasil diupdate',
            data: updatedUser
        });

    } catch (error) {
        console.log(chalk.red(`❌ Update user error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/protected/users/{id}:
 *   delete:
 *     summary: Delete user account
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User account deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Error server
 */
router.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        console.log(chalk.yellow(`🔄 Deleting user account ID: ${id}`));

        const DatabaseManager = require('../utils/database');
        const dbManager = new DatabaseManager();

        const connected = await dbManager.connect();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        // Cek apakah user ada
        const existingUser = await dbManager.getUserById(id);
        if (!existingUser) {
            await dbManager.close();
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan'
            });
        }

        // Delete user
        await dbManager.deleteUserAccount(id);
        await dbManager.close();

        console.log(chalk.green(`✅ User account deleted successfully: ID ${id}`));

        res.status(200).json({
            success: true,
            message: 'User account berhasil dihapus'
        });

    } catch (error) {
        console.log(chalk.red(`❌ Delete user error: ${error.message}`));
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        });
    }
});

module.exports = router;
