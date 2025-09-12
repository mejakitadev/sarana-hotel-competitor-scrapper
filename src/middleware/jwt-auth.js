const jwt = require('jsonwebtoken');
const chalk = require('chalk');

// JWT Secret - dalam production harus dari environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Middleware untuk verifikasi JWT token
 * Token diambil dari Authorization header sebagai Bearer token
 */
const authenticateToken = (req, res, next) => {
    try {
        // Ambil token dari Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            console.log(chalk.red('❌ No token provided'));
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        // Verify token
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                console.log(chalk.red(`❌ Token verification failed: ${err.message}`));
                return res.status(403).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            // Token valid, tambahkan user info ke request
            req.user = decoded;
            console.log(chalk.green(`✅ Token verified for user: ${decoded.username}`));
            next();
        });

    } catch (error) {
        console.log(chalk.red(`❌ Authentication error: ${error.message}`));
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

/**
 * Generate JWT token untuk user yang berhasil login
 * @param {string} username - Username untuk payload
 * @returns {string} JWT token
 */
const generateToken = (username) => {
    try {
        const payload = {
            username: username,
            iat: Math.floor(Date.now() / 1000) // issued at
        };

        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN
        });

        console.log(chalk.green(`✅ JWT token generated for user: ${username}`));
        return token;
    } catch (error) {
        console.log(chalk.red(`❌ Error generating token: ${error.message}`));
        throw error;
    }
};

/**
 * Decode JWT token tanpa verifikasi (untuk debugging)
 * @param {string} token - JWT token
 * @returns {object} Decoded payload
 */
const decodeToken = (token) => {
    try {
        const decoded = jwt.decode(token);
        console.log(chalk.blue(`🔍 Token decoded: ${JSON.stringify(decoded)}`));
        return decoded;
    } catch (error) {
        console.log(chalk.red(`❌ Error decoding token: ${error.message}`));
        throw error;
    }
};

/**
 * Middleware untuk set cookie dengan JWT token
 * @param {string} token - JWT token
 * @param {object} res - Express response object
 */
const setTokenCookie = (token, res) => {
    try {
        // Set cookie dengan JWT token
        res.cookie('jwt_token', token, {
            httpOnly: true, // Tidak bisa diakses dari JavaScript di browser
            secure: process.env.NODE_ENV === 'production', // HTTPS only di production
            sameSite: 'strict', // CSRF protection
            maxAge: 24 * 60 * 60 * 1000 // 24 jam dalam milliseconds
        });

        console.log(chalk.green('✅ JWT token set in cookie'));
    } catch (error) {
        console.log(chalk.red(`❌ Error setting cookie: ${error.message}`));
        throw error;
    }
};

/**
 * Middleware untuk clear JWT cookie (untuk logout)
 * @param {object} res - Express response object
 */
const clearTokenCookie = (res) => {
    try {
        res.clearCookie('jwt_token');
        console.log(chalk.green('✅ JWT cookie cleared'));
    } catch (error) {
        console.log(chalk.red(`❌ Error clearing cookie: ${error.message}`));
        throw error;
    }
};

module.exports = {
    authenticateToken,
    generateToken,
    decodeToken,
    setTokenCookie,
    clearTokenCookie,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
