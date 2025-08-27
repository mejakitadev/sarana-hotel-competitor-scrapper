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
