const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @swagger
 * /api/hotel-crud/bulk-create:
 *   post:
 *     summary: Bulk create hotels
 *     description: Create multiple hotels at once (only hotel name required, price defaults to 0)
 *     tags: [Hotel CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotels
 *             properties:
 *               hotels:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - hotel_name
 *                   properties:
 *                     hotel_name:
 *                       type: string
 *                       description: Hotel name (required)
 *                       example: "Hotel Ritz Carlton"
 *                     rate_harga:
 *                       type: integer
 *                       description: Hotel price (optional, defaults to 0)
 *                       example: 0
 *                       default: 0
 *     responses:
 *       201:
 *         description: Hotels created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
// Bulk create hotels
router.post('/bulk-create', async (req, res) => {
    try {
        const { hotels } = req.body;

        if (!hotels || !Array.isArray(hotels) || hotels.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Hotels array is required and must not be empty'
            });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const createdHotels = [];

            for (const hotel of hotels) {
                const { hotel_name, rate_harga } = hotel;

                if (!hotel_name) {
                    throw new Error(`Hotel name is required for all hotels`);
                }

                // Default rate_harga to 0 if not provided (akan di-update saat scraping)
                const price = rate_harga || 0;

                // Insert ke hotel_data (parent table) saja
                const insertHotelQuery = `
                    INSERT INTO hotel_data (hotel_name, rate_harga, created_at, updated_at)
                    VALUES ($1, $2, NOW(), NOW())
                    RETURNING id, hotel_name, rate_harga, created_at, updated_at
                `;

                const hotelValues = [hotel_name, price];
                const hotelResult = await client.query(insertHotelQuery, hotelValues);

                createdHotels.push(hotelResult.rows[0]);
            }

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: `${createdHotels.length} hotels created successfully`,
                count: createdHotels.length,
                data: createdHotels
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error bulk creating hotels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create hotels',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/hotel-crud/bulk-update:
 *   put:
 *     summary: Bulk update hotels
 *     description: Update multiple hotels at once
 *     tags: [Hotel CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     hotel_id:
 *                       type: integer
 *                       description: Hotel ID to update
 *                     hotel_name:
 *                       type: string
 *                       description: New hotel name
 *                     rate_harga:
 *                       type: integer
 *                       description: New hotel price
 *                     location:
 *                       type: string
 *                       description: New hotel location
 *                     description:
 *                       type: string
 *                       description: New hotel description
 *     responses:
 *       200:
 *         description: Hotels updated successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
// Bulk update hotels
router.put('/bulk-update', async (req, res) => {
    try {
        const { updates } = req.body;

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Updates array is required and must not be empty'
            });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const updatedHotels = [];

            for (const update of updates) {
                const { hotel_id, hotel_name, rate_harga, location, description } = update;

                if (!hotel_id) {
                    throw new Error('Hotel ID is required for all updates');
                }

                // Check if hotel exists
                const checkQuery = 'SELECT hotel_id FROM hotel_data WHERE hotel_id = $1';
                const checkResult = await client.query(checkQuery, [hotel_id]);

                if (checkResult.rows.length === 0) {
                    throw new Error(`Hotel with ID ${hotel_id} not found`);
                }

                // Build dynamic update query
                const updateFields = [];
                const values = [];
                let paramCount = 1;

                if (hotel_name !== undefined) {
                    updateFields.push(`hotel_name = $${++paramCount}`);
                    values.push(hotel_name);
                }

                if (rate_harga !== undefined) {
                    updateFields.push(`rate_harga = $${++paramCount}`);
                    values.push(rate_harga);
                }

                if (location !== undefined) {
                    updateFields.push(`location = $${++paramCount}`);
                    values.push(location);
                }

                if (description !== undefined) {
                    updateFields.push(`description = $${++paramCount}`);
                    values.push(description);
                }

                if (updateFields.length === 0) {
                    continue; // Skip if no fields to update
                }

                updateFields.push(`updated_at = NOW()`);
                values.unshift(hotel_id); // Add hotel_id as first parameter

                const updateQuery = `
                    UPDATE hotel_data 
                    SET ${updateFields.join(', ')}
                    WHERE hotel_id = $1
                    RETURNING hotel_id, hotel_name, rate_harga, location, description, created_at, updated_at
                `;

                const result = await client.query(updateQuery, values);
                updatedHotels.push(result.rows[0]);
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `${updatedHotels.length} hotels updated successfully`,
                count: updatedHotels.length,
                data: updatedHotels
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error bulk updating hotels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update hotels',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/hotel-crud/bulk-delete:
 *   delete:
 *     summary: Bulk delete hotels
 *     description: Delete multiple hotels by IDs
 *     tags: [Hotel CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hotel_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of hotel IDs to delete
 *     responses:
 *       200:
 *         description: Hotels deleted successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
// Bulk delete hotels
router.delete('/bulk-delete', async (req, res) => {
    try {
        const { hotel_ids } = req.body;

        if (!hotel_ids || !Array.isArray(hotel_ids) || hotel_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Hotel IDs array is required and must not be empty'
            });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Check if all hotels exist
            const checkQuery = `
                SELECT hotel_id, hotel_name 
                FROM hotel_data 
                WHERE hotel_id = ANY($1)
            `;
            const checkResult = await client.query(checkQuery, [hotel_ids]);

            if (checkResult.rows.length !== hotel_ids.length) {
                const foundIds = checkResult.rows.map(row => row.hotel_id);
                const missingIds = hotel_ids.filter(id => !foundIds.includes(id));
                throw new Error(`Hotels not found: ${missingIds.join(', ')}`);
            }

            // Delete hotels
            const deleteQuery = `
                DELETE FROM hotel_data 
                WHERE hotel_id = ANY($1)
                RETURNING hotel_id, hotel_name
            `;

            const result = await client.query(deleteQuery, [hotel_ids]);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `${result.rows.length} hotels deleted successfully`,
                count: result.rows.length,
                deleted_hotels: result.rows
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error bulk deleting hotels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete hotels',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/hotel-crud/sync-from-scraper:
 *   post:
 *     summary: Sync hotels from scraper
 *     description: Sync hotel data from bot scrapper (placeholder for future integration)
 *     tags: [Hotel CRUD]
 *     responses:
 *       200:
 *         description: Sync initiated successfully
 *       500:
 *         description: Internal server error
 */
// Sync from scraper (placeholder)
router.post('/sync-from-scraper', async (req, res) => {
    try {
        // This would integrate with the bot scrapper
        // For now, just return success message
        res.json({
            success: true,
            message: 'Hotel sync from scraper initiated',
            note: 'Integration with bot scrapper pending',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error syncing from scraper:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync from scraper'
        });
    }
});

/**
 * @swagger
 * /api/hotel-crud/hotels:
 *   get:
 *     summary: Get all hotels
 *     description: Retrieve all hotels from the hotel_data table
 *     tags: [Hotel CRUD]
 *     responses:
 *       200:
 *         description: Hotels retrieved successfully
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
 *                       hotel_name:
 *                         type: string
 *                         example: "Hotel Ritz Carlton"
 *                       rate_harga:
 *                         type: number
 *                         example: 1500000
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Internal server error
 */
// Get all hotels
router.get('/hotels', async (req, res) => {
    try {
        const client = await pool.connect();

        try {
            // Get all hotels from hotel_data table
            const query = `
                SELECT 
                    id,
                    hotel_name,
                    rate_harga,
                    created_at,
                    updated_at
                FROM hotel_data 
                ORDER BY created_at DESC
            `;

            const result = await client.query(query);

            res.status(200).json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotels',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/hotel-crud/{id}:
 *   put:
 *     summary: Update a hotel
 *     description: Update an existing hotel's name and price
 *     tags: [Hotel CRUD]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hotel ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hotel_name:
 *                 type: string
 *                 description: Hotel name
 *                 example: "Hotel Updated Name"
 *               rate_harga:
 *                 type: number
 *                 description: Hotel price
 *                 example: 500000
 *     responses:
 *       200:
 *         description: Hotel updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Internal server error
 */
// Update a hotel
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { hotel_name, rate_harga } = req.body;

        if (!hotel_name) {
            return res.status(400).json({
                success: false,
                error: 'Hotel name is required'
            });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Check if hotel exists
            const checkQuery = 'SELECT id FROM hotel_data WHERE id = $1';
            const checkResult = await client.query(checkQuery, [id]);

            if (checkResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Hotel not found'
                });
            }

            // Update hotel
            const updateQuery = `
                UPDATE hotel_data 
                SET hotel_name = $2, 
                    rate_harga = $3, 
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, hotel_name, rate_harga, created_at, updated_at
            `;

            const updateValues = [id, hotel_name, rate_harga || 0];
            const result = await client.query(updateQuery, updateValues);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Hotel updated successfully',
                data: result.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error updating hotel:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update hotel',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /api/hotel-crud/{id}:
 *   delete:
 *     summary: Delete a hotel
 *     description: Delete a hotel and all its scraping logs
 *     tags: [Hotel CRUD]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: Hotel deleted successfully
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Internal server error
 */
// Delete a hotel
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Check if hotel exists
            const checkQuery = 'SELECT id, hotel_name FROM hotel_data WHERE id = $1';
            const checkResult = await client.query(checkQuery, [id]);

            if (checkResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Hotel not found'
                });
            }

            const hotelName = checkResult.rows[0].hotel_name;

            // Delete hotel (will cascade to hotel_scraping_results_log due to foreign key)
            const deleteQuery = 'DELETE FROM hotel_data WHERE id = $1';
            await client.query(deleteQuery, [id]);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Hotel "${hotelName}" deleted successfully`,
                deletedHotel: { id, hotel_name: hotelName }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error deleting hotel:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete hotel',
            details: error.message
        });
    }
});

module.exports = router;
