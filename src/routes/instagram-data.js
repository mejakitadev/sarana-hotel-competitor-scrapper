const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

/**
 * @swagger
 * tags:
 *   name: Instagram Data
 *   description: API untuk mengakses data Instagram scraper
 */

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Get Instagram accounts with latest posts
/**
 * @swagger
 * /api/instagram-data/accounts:
 *   get:
 *     summary: Mengambil daftar akun Instagram dengan statistik
 *     tags: [Instagram Data]
 *     responses:
 *       200:
 *         description: Daftar akun Instagram berhasil diambil
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
 *                     $ref: '#/components/schemas/InstagramAccount'
 *                 total:
 *                   type: integer
 *                   description: Jumlah total akun
 *       500:
 *         description: Error server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/accounts', async (req, res) => {
    try {
        console.log('📱 Fetching Instagram accounts with latest posts...');

        // Get accounts with stats using JOIN with scraping log
        const accountsQuery = `
            SELECT 
                sl.id,
                sl.username,
                sl.account_url,
                sl.created_at,
                COUNT(DISTINCT ssl.url_post) as total_posts,
                MAX(ssl.created_at) as latest_scrape_date
            FROM socmed_list sl
            LEFT JOIN socmed_scraping_log ssl ON sl.id = ssl.account_id
            GROUP BY sl.id, sl.username, sl.account_url, sl.created_at
            ORDER BY sl.username ASC
        `;

        const accountsResult = await pool.query(accountsQuery);

        console.log(`✅ Found ${accountsResult.rows.length} Instagram accounts`);

        res.json({
            success: true,
            data: accountsResult.rows.map(account => ({
                id: account.id,
                username: account.username,
                account_url: account.account_url,
                created_at: account.created_at,
                total_posts: parseInt(account.total_posts),
                latest_post_date: account.latest_scrape_date
            })),
            total: accountsResult.rows.length
        });

    } catch (error) {
        console.error('❌ Error fetching Instagram accounts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get latest posts for a specific account
/**
 * @swagger
 * /api/instagram-data/posts/{accountId}:
 *   get:
 *     summary: Mengambil postingan terbaru untuk akun tertentu
 *     tags: [Instagram Data]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID akun Instagram
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Jumlah postingan yang diambil
 *     responses:
 *       200:
 *         description: Postingan berhasil diambil
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
 *                     $ref: '#/components/schemas/InstagramPost'
 *                 total:
 *                   type: integer
 *                   description: Jumlah postingan
 *                 accountId:
 *                   type: integer
 *                   description: ID akun
 *       500:
 *         description: Error server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/posts/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const limit = parseInt(req.query.limit) || 6;

        console.log(`📱 Fetching latest ${limit} posts for account ID: ${accountId}`);

        // Get posts by joining scraping log with socmed_post
        const query = `
            SELECT DISTINCT
                sp.id,
                sp.post_url,
                sp.caption,
                sp.post_date,
                sp.type
            FROM socmed_scraping_log ssl
            JOIN socmed_post sp ON ssl.url_post = sp.post_url
            WHERE ssl.account_id = $1
            ORDER BY sp.post_date DESC
            LIMIT $2
        `;

        const result = await pool.query(query, [accountId, limit]);

        console.log(`✅ Found ${result.rows.length} posts for account ID: ${accountId}`);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length,
            accountId: accountId
        });

    } catch (error) {
        console.error('❌ Error fetching posts for account:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all posts grouped by account
/**
 * @swagger
 * /api/instagram-data/posts-grouped:
 *   get:
 *     summary: Mengambil semua postingan dikelompokkan per akun
 *     tags: [Instagram Data]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Jumlah postingan per akun
 *     responses:
 *       200:
 *         description: Postingan berhasil diambil dan dikelompokkan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/InstagramAccountWithPosts'
 *                 total:
 *                   type: integer
 *                   description: Jumlah akun
 *       500:
 *         description: Error server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/posts-grouped', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 6;

        console.log(`📱 Fetching all posts grouped by account (${limit} posts per account)...`);

        // Get all accounts first
        const accountsQuery = `
            SELECT 
                id,
                username,
                account_url
            FROM socmed_list
            ORDER BY username ASC
        `;

        const accountsResult = await pool.query(accountsQuery);

        // Get posts for each account using JOIN
        const groupedData = {};

        for (const account of accountsResult.rows) {
            const postsQuery = `
                SELECT DISTINCT
                    sp.id,
                    sp.post_url,
                    sp.caption,
                    sp.post_date,
                    sp.type
                FROM socmed_scraping_log ssl
                JOIN socmed_post sp ON ssl.url_post = sp.post_url
                WHERE ssl.account_id = $1
                ORDER BY sp.post_date DESC
                LIMIT $2
            `;

            const postsResult = await pool.query(postsQuery, [account.id, limit]);

            groupedData[account.username] = {
                account_id: account.id,
                username: account.username,
                account_url: account.account_url,
                posts: postsResult.rows
            };
        }

        console.log(`✅ Found ${Object.keys(groupedData).length} accounts with posts`);

        res.json({
            success: true,
            data: groupedData,
            total: Object.keys(groupedData).length
        });

    } catch (error) {
        console.error('❌ Error fetching grouped posts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Instagram scraping statistics
/**
 * @swagger
 * /api/instagram-data/stats:
 *   get:
 *     summary: Mengambil statistik scraping Instagram
 *     tags: [Instagram Data]
 *     responses:
 *       200:
 *         description: Statistik berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/InstagramStats'
 *       500:
 *         description: Error server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 Fetching Instagram scraping statistics...');

        // Get account count
        const accountsQuery = `
            SELECT COUNT(*) as total_accounts
            FROM socmed_list
        `;

        // Get posts statistics using scraping log
        const postsQuery = `
            SELECT 
                COUNT(DISTINCT ssl.url_post) as total_posts,
                COUNT(DISTINCT CASE WHEN ssl.created_at >= CURRENT_DATE THEN ssl.url_post END) as posts_today,
                COUNT(DISTINCT CASE WHEN ssl.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN ssl.url_post END) as posts_this_week,
                MAX(ssl.created_at) as latest_scrape_date,
                MIN(ssl.created_at) as earliest_scrape_date
            FROM socmed_scraping_log ssl
        `;

        const [accountsResult, postsResult] = await Promise.all([
            pool.query(accountsQuery),
            pool.query(postsQuery)
        ]);

        const stats = {
            total_accounts: parseInt(accountsResult.rows[0].total_accounts),
            total_posts: parseInt(postsResult.rows[0].total_posts),
            posts_today: parseInt(postsResult.rows[0].posts_today),
            posts_this_week: parseInt(postsResult.rows[0].posts_this_week),
            latest_post_date: postsResult.rows[0].latest_scrape_date,
            earliest_post_date: postsResult.rows[0].earliest_scrape_date
        };

        console.log('✅ Instagram statistics fetched');

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error fetching Instagram statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== INSTAGRAM ACCOUNTS MANAGEMENT (socmed_list table) =====

/**
 * @swagger
 * /api/instagram-data/accounts-management:
 *   get:
 *     summary: Mengambil daftar akun Instagram untuk management
 *     tags: [Instagram Data]
 *     responses:
 *       200:
 *         description: Daftar akun Instagram berhasil diambil
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
 *                       username:
 *                         type: string
 *                         example: "infomalang"
 *                       account_url:
 *                         type: string
 *                         example: "https://instagram.com/infomalang"
 *                       status:
 *                         type: string
 *                         example: "active"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Error server
 */
router.get('/accounts-management', async (req, res) => {
    try {
        console.log('📱 GET /accounts-management: Fetching Instagram accounts for management...');

        const query = `
      SELECT 
        id,
        username,
        account_url,
        created_at
      FROM socmed_list 
      ORDER BY created_at DESC
    `;

        const result = await pool.query(query);
        console.log('📊 Database query result:', result.rows.length, 'accounts found');
        console.log('📋 Accounts:', result.rows);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching Instagram accounts for management:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching Instagram accounts',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/instagram-data/accounts-management/bulk-create:
 *   post:
 *     summary: Bulk create Instagram accounts
 *     tags: [Instagram Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accounts
 *             properties:
 *               accounts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     account_url:
 *                       type: string
 *                       description: Instagram account URL
 *                       example: "https://instagram.com/infomalang"
 *                     status:
 *                       type: string
 *                       description: Account status
 *                       example: "active"
 *     responses:
 *       201:
 *         description: Accounts created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InstagramAccount'
 *       400:
 *         description: Data tidak valid
 *       500:
 *         description: Error server
 */
router.post('/accounts-management/bulk-create', async (req, res) => {
    try {
        const { accounts } = req.body;

        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Accounts array is required and must not be empty'
            });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const createdAccounts = [];

            for (const account of accounts) {
                const { account_url, status = 'active' } = account;

                if (!account_url) {
                    throw new Error('Account URL is required for all accounts');
                }

                // Extract username from URL
                let username = '';
                try {
                    const url = new URL(account_url);
                    username = url.pathname.replace('/', '').replace('@', '');
                } catch (error) {
                    throw new Error(`Invalid URL: ${account_url}`);
                }

                // Check if account already exists
                const checkQuery = `
          SELECT id FROM socmed_list 
          WHERE username = $1 OR account_url = $2
        `;
                const existingAccount = await client.query(checkQuery, [username, account_url]);

                if (existingAccount.rows.length > 0) {
                    // Account exists, skip or update
                    console.log(`Account ${username} already exists, skipping...`);
                    continue;
                }

                // Insert new account
                const insertQuery = `
          INSERT INTO socmed_list (username, account_url, created_at)
          VALUES ($1, $2, NOW())
          RETURNING *
        `;

                const result = await client.query(insertQuery, [username, account_url]);
                createdAccounts.push(result.rows[0]);
            }

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: `${createdAccounts.length} Instagram accounts created successfully`,
                count: createdAccounts.length,
                data: createdAccounts
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error bulk creating Instagram accounts:', error);
        res.status(500).json({
            success: false,
            message: 'Error bulk creating Instagram accounts',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/instagram-data/accounts-management:
 *   post:
 *     summary: Menambah akun Instagram baru
 *     tags: [Instagram Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - account_url
 *             properties:
 *               username:
 *                 type: string
 *                 example: "infomalang"
 *               account_url:
 *                 type: string
 *                 example: "https://instagram.com/infomalang"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Akun Instagram berhasil ditambahkan
 *       400:
 *         description: Data tidak valid
 *       500:
 *         description: Error server
 */
router.post('/accounts-management', async (req, res) => {
    try {
        const { account_url, status = 'active' } = req.body;

        if (!account_url) {
            return res.status(400).json({
                success: false,
                message: 'Account URL harus diisi'
            });
        }

        // Extract username from URL
        let username = '';
        try {
            const url = new URL(account_url);
            username = url.pathname.replace('/', '').replace('@', '');
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'URL tidak valid'
            });
        }

        const query = `
      INSERT INTO socmed_list (username, account_url, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *
    `;

        const result = await pool.query(query, [username, account_url]);

        res.status(201).json({
            success: true,
            message: 'Akun Instagram berhasil ditambahkan',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding Instagram account:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding Instagram account',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/instagram-data/accounts-management/{id}:
 *   put:
 *     summary: Mengupdate akun Instagram
 *     tags: [Instagram Data]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID akun Instagram
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "infomalang"
 *               account_url:
 *                 type: string
 *                 example: "https://instagram.com/infomalang"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Akun Instagram berhasil diupdate
 *       404:
 *         description: Akun tidak ditemukan
 *       500:
 *         description: Error server
 */
router.put('/accounts-management/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { account_url, status } = req.body;

        if (!account_url) {
            return res.status(400).json({
                success: false,
                message: 'Account URL harus diisi'
            });
        }

        // Extract username from URL
        let username = '';
        try {
            const url = new URL(account_url);
            username = url.pathname.replace('/', '').replace('@', '');
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'URL tidak valid'
            });
        }

        const query = `
      UPDATE socmed_list 
      SET username = $1, account_url = $2
      WHERE id = $3
      RETURNING *
    `;

        const result = await pool.query(query, [username, account_url, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Akun Instagram tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Akun Instagram berhasil diupdate',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating Instagram account:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating Instagram account',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/instagram-data/accounts-management/{id}:
 *   delete:
 *     summary: Menghapus akun Instagram
 *     tags: [Instagram Data]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID akun Instagram
 *     responses:
 *       200:
 *         description: Akun Instagram berhasil dihapus
 *       404:
 *         description: Akun tidak ditemukan
 *       500:
 *         description: Error server
 */
router.delete('/accounts-management/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
      DELETE FROM socmed_list 
      WHERE id = $1
      RETURNING *
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Akun Instagram tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Akun Instagram berhasil dihapus',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting Instagram account:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting Instagram account',
            error: error.message
        });
    }
});

module.exports = router;
