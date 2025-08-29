const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all hotels
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(`
      SELECT * FROM hotels 
      ORDER BY last_updated DESC 
      LIMIT 100
    `);
        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotels'
        });
    }
});

router.get('/daily-rate', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            WITH daily_rates AS (
                SELECT 
                    h.hotel_name,
                    DATE(l.search_timestamp) as date,
                    AVG(l.room_price) as daily_average_rate
                FROM hotel_data h
                JOIN hotel_scraping_results_log l ON h.id = l.hotel_id
                WHERE 
                    l.status = 'success' 
                    AND l.search_timestamp >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY 
                    h.hotel_name,
                    DATE(l.search_timestamp)
                ORDER BY 
                    h.hotel_name,
                    DATE(l.search_timestamp) DESC
            )
            SELECT 
                hotel_name,
                json_agg(
                    json_build_object(
                        'date', date,
                        'daily_average_rate', daily_average_rate
                    )
                ) as log_rate_data
            FROM daily_rates
            GROUP BY hotel_name
        `);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotel rates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel rates'
        });
    }
});

// Get hotel by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(`
      SELECT * FROM hotels WHERE id = $1
    `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching hotel:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel'
        });
    }
});

// Search hotels by name or location
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { rows } = await pool.query(`
      SELECT * FROM hotels 
      WHERE name ILIKE $1 OR location ILIKE $1
      ORDER BY last_updated DESC
      LIMIT 50
    `, [`%${query}%`]);

        res.json({
            success: true,
            count: rows.length,
            query: query,
            data: rows
        });
    } catch (error) {
        console.error('Error searching hotels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search hotels'
        });
    }
});

// Get hotels by price range
router.get('/price/:min/:max', async (req, res) => {
    try {
        const { min, max } = req.params;
        const { rows } = await pool.query(`
      SELECT * FROM hotels 
      WHERE price >= $1 AND price <= $2
      ORDER BY price ASC
      LIMIT 50
    `, [min, max]);

        res.json({
            success: true,
            count: rows.length,
            price_range: { min: parseInt(min), max: parseInt(max) },
            data: rows
        });
    } catch (error) {
        console.error('Error fetching hotels by price:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotels by price'
        });
    }
});

module.exports = router;
