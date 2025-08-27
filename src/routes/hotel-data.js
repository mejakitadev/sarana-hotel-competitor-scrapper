const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @swagger
 * /api/hotel-data/structure:
 *   get:
 *     summary: Get table structure of hotel_data
 *     description: Debug endpoint to see actual columns in hotel_data table
 *     tags: [Hotel Data]
 *     responses:
 *       200:
 *         description: Table structure information
 *       500:
 *         description: Internal server error
 */
// Debug endpoint to check table structure
router.get('/structure', async (req, res) => {
    try {
        // Get table structure
        const structureQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'hotel_data'
            ORDER BY ordinal_position
        `;

        const { rows } = await pool.query(structureQuery);

        // Get sample data (first 3 rows)
        const sampleQuery = 'SELECT * FROM hotel_data LIMIT 3';
        const sampleResult = await pool.query(sampleQuery);

        res.json({
            success: true,
            table_name: 'hotel_data',
            structure: rows,
            sample_data: sampleResult.rows,
            total_columns: rows.length
        });
    } catch (error) {
        console.error('Error checking table structure:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check table structure',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/hotel-data:
 *   get:
 *     summary: Get all hotel data (name and price only)
 *     description: Retrieve all hotels from hotel_data table with name and price
 *     tags: [Hotel Data]
 *     responses:
 *       200:
 *         description: Successfully retrieved hotel data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of hotels returned
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HotelData'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all hotel data (name and price only)
router.get('/', async (req, res) => {
    try {
        // First, let's check what columns are available
        const structureQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'hotel_data'
            ORDER BY ordinal_position
        `;

        const structureResult = await pool.query(structureQuery);
        const columns = structureResult.rows.map(row => row.column_name);

        console.log('Available columns:', columns);

        // Try to find name-like and price-like columns
        const nameColumn = columns.find(col =>
            col.toLowerCase() === 'hotel_name' ||
            col.toLowerCase() === 'name' ||
            col.toLowerCase().includes('name') && !col.toLowerCase().includes('id')
        ) || 'hotel_name'; // fallback to hotel_name

        const priceColumn = columns.find(col =>
            col.toLowerCase() === 'rate_harga' ||
            col.toLowerCase() === 'price' ||
            col.toLowerCase().includes('price') ||
            col.toLowerCase().includes('rate')
        ) || 'rate_harga'; // fallback to rate_harga

        console.log('Using columns:', { nameColumn, priceColumn });

        // Build dynamic query
        const query = `
            SELECT "${nameColumn}" as name, "${priceColumn}" as price
            FROM hotel_data 
            ORDER BY "${nameColumn}" ASC
        `;

        const { rows } = await pool.query(query);

        res.json({
            success: true,
            count: rows.length,
            columns_used: { name: nameColumn, price: priceColumn },
            available_columns: columns,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotel data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel data',
            details: error.message
        });
    }
});

// Get hotel data with pagination
router.get('/page/:page', async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const { rows } = await pool.query(`
            SELECT hotel_name as name, rate_harga as price
            FROM hotel_data 
            ORDER BY hotel_name ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        // Get total count for pagination info
        const countResult = await pool.query('SELECT COUNT(*) FROM hotel_data');
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            count: rows.length,
            total_count: totalCount,
            current_page: page,
            total_pages: Math.ceil(totalCount / limit),
            limit: limit,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotel data with pagination:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel data'
        });
    }
});

/**
 * @swagger
 * /api/hotel-data/search/{query}:
 *   get:
 *     summary: Search hotel data by name
 *     description: Search hotels by name using case-insensitive pattern matching
 *     tags: [Hotel Data]
 *     parameters:
 *       - in: path
 *         name: query
 *         required: true
 *         description: Search query for hotel name
 *         schema:
 *           type: string
 *         example: "ritz"
 *     responses:
 *       200:
 *         description: Successfully retrieved search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of search results
 *                 query:
 *                   type: string
 *                   description: Search query used
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HotelData'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Search hotel data by name
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { rows } = await pool.query(`
            SELECT hotel_name as name, rate_harga as price
            FROM hotel_data 
            WHERE hotel_name ILIKE $1
            ORDER BY hotel_name ASC
            LIMIT 50
        `, [`%${query}%`]);

        res.json({
            success: true,
            count: rows.length,
            query: query,
            data: rows
        });
    } catch (error) {
        console.error('Error searching hotel data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search hotel data'
        });
    }
});

/**
 * @swagger
 * /api/hotel-data/price/{min}/{max}:
 *   get:
 *     summary: Get hotels by price range
 *     description: Filter hotels by minimum and maximum price range
 *     tags: [Hotel Data]
 *     parameters:
 *       - in: path
 *         name: min
 *         required: true
 *         description: Minimum price
 *         schema:
 *           type: integer
 *         example: 100000
 *       - in: path
 *         name: max
 *         required: true
 *         description: Maximum price
 *         schema:
 *           type: integer
 *         example: 500000
 *     responses:
 *       200:
 *         description: Successfully retrieved hotels by price range
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of hotels in price range
 *                 price_range:
 *                   type: object
 *                   properties:
 *                     min:
 *                       type: integer
 *                       description: Minimum price filter
 *                     max:
 *                       type: integer
 *                       description: Maximum price filter
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HotelData'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get hotels by price range
router.get('/price/:min/:max', async (req, res) => {
    try {
        const { min, max } = req.params;
        const { rows } = await pool.query(`
            SELECT hotel_name as name, rate_harga as price
            FROM hotel_data 
            WHERE rate_harga >= $1 AND rate_harga <= $2
            ORDER BY rate_harga ASC
            LIMIT 100
        `, [min, max]);

        res.json({
            success: true,
            count: rows.length,
            price_range: { min: parseInt(min), max: parseInt(max) },
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotel data by price:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel data by price'
        });
    }
});

// Get hotels sorted by price (lowest first)
router.get('/price/lowest', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT hotel_name as name, rate_harga as price
            FROM hotel_data 
            ORDER BY rate_harga ASC
            LIMIT 50
        `);

        res.json({
            success: true,
            count: rows.length,
            sort: 'price_lowest_first',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotel data by lowest price:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel data by lowest price'
        });
    }
});

// Get hotels sorted by price (highest first)
router.get('/price/highest', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT hotel_name as name, rate_harga as price
            FROM hotel_data 
            ORDER BY rate_harga DESC
            LIMIT 50
        `);

        res.json({
            success: true,
            count: rows.length,
            sort: 'price_highest_first',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotel data by highest price:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel data by highest price'
        });
    }
});

module.exports = router;
