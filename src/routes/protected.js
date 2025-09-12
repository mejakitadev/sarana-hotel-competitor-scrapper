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

module.exports = router;
