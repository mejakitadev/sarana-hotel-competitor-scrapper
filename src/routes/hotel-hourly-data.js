const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// Database configuration
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

/**
 * Get hourly price data for all hotels for today
 * @route GET /api/hotel-hourly-data/today
 * @description Get price data grouped by hour for all hotels for today only
 */
router.get('/today', async (req, res) => {
    try {
        console.log('🔍 Fetching hourly data for today...');

        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        console.log('📅 Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());

        // Query to get hourly data for today
        const query = `
            SELECT 
                hd.id as hotel_id,
                hd.hotel_name,
                EXTRACT(HOUR FROM hsl.search_timestamp) as hour,
                hsl.room_price,
                hsl.search_timestamp,
                hsl.status
            FROM hotel_data hd
            LEFT JOIN hotel_scraping_results_log hsl ON hd.id = hsl.hotel_id
            WHERE hsl.search_timestamp >= $1 
                AND hsl.search_timestamp <= $2
                AND hsl.status = 'success'
                AND hsl.room_price IS NOT NULL
            ORDER BY hd.id, EXTRACT(HOUR FROM hsl.search_timestamp), hsl.search_timestamp DESC
        `;

        const result = await pool.query(query, [startOfDay, endOfDay]);

        console.log(`📊 Found ${result.rows.length} records for today`);

        // Group data by hotel and hour
        const hotelHourlyData = {};

        // Initialize time slots (00:00 to 23:00) - Full 24 hours
        const timeSlots = [];
        for (let hour = 0; hour <= 23; hour++) {
            timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        }

        // Process results - Convert UTC hour to WIB hour
        result.rows.forEach(row => {
            const hotelId = row.hotel_id;
            const hotelName = row.hotel_name;
            const utcHour = parseInt(row.hour);
            const wibHour = (utcHour + 7) % 24; // Convert UTC to WIB
            const price = parseFloat(row.room_price);
            const timeSlot = `${wibHour.toString().padStart(2, '0')}:00`;

            if (!hotelHourlyData[hotelId]) {
                hotelHourlyData[hotelId] = {
                    hotel_id: hotelId,
                    hotel_name: hotelName,
                    prices: {}
                };
            }

            // Only keep the latest price for each hour (since we ordered by timestamp DESC)
            if (!hotelHourlyData[hotelId].prices[timeSlot]) {
                hotelHourlyData[hotelId].prices[timeSlot] = price;
            }
        });

        // Convert to array format for chart
        const chartData = timeSlots.map(timeSlot => {
            const dataPoint = { time: timeSlot };

            Object.values(hotelHourlyData).forEach(hotel => {
                const price = hotel.prices[timeSlot];
                // Use hotel name as key, but sanitize it for object key
                const key = hotel.hotel_name.replace(/[^a-zA-Z0-9]/g, '_');
                dataPoint[key] = price || null;
            });

            return dataPoint;
        });

        // Get hotel list for legend
        const hotelList = Object.values(hotelHourlyData).map(hotel => ({
            id: hotel.hotel_id,
            name: hotel.hotel_name,
            key: hotel.hotel_name.replace(/[^a-zA-Z0-9]/g, '_')
        }));

        console.log(`✅ Processed data for ${hotelList.length} hotels`);

        res.json({
            success: true,
            data: {
                chartData,
                hotelList,
                timeSlots,
                date: today.toISOString().split('T')[0],
                totalRecords: result.rows.length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching hourly data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get hourly price data for specific hotel for today
 * @route GET /api/hotel-hourly-data/hotel/:hotelId/today
 * @description Get price data for specific hotel for today only
 */
router.get('/hotel/:hotelId/today', async (req, res) => {
    try {
        const { hotelId } = req.params;
        console.log(`🔍 Fetching hourly data for hotel ${hotelId} today...`);

        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        // Query to get hourly data for specific hotel
        const query = `
            SELECT 
                hd.id as hotel_id,
                hd.hotel_name,
                EXTRACT(HOUR FROM hsl.search_timestamp) as hour,
                hsl.room_price,
                hsl.search_timestamp,
                hsl.status
            FROM hotel_data hd
            LEFT JOIN hotel_scraping_results_log hsl ON hd.id = hsl.hotel_id
            WHERE hd.id = $1
                AND hsl.search_timestamp >= $2 
                AND hsl.search_timestamp <= $3
                AND hsl.status = 'success'
                AND hsl.room_price IS NOT NULL
            ORDER BY EXTRACT(HOUR FROM hsl.search_timestamp), hsl.search_timestamp DESC
        `;

        const result = await pool.query(query, [hotelId, startOfDay, endOfDay]);

        console.log(`📊 Found ${result.rows.length} records for hotel ${hotelId}`);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    hotel_id: hotelId,
                    hotel_name: 'Unknown Hotel',
                    chartData: [],
                    timeSlots: [],
                    date: today.toISOString().split('T')[0],
                    totalRecords: 0
                }
            });
        }

        // Process results
        const hotelName = result.rows[0].hotel_name;
        const hourlyPrices = {};

        result.rows.forEach(row => {
            const utcHour = parseInt(row.hour);
            const wibHour = (utcHour + 7) % 24; // Convert UTC to WIB
            const price = parseFloat(row.room_price);
            const timeSlot = `${wibHour.toString().padStart(2, '0')}:00`;

            // Only keep the latest price for each hour
            if (!hourlyPrices[timeSlot]) {
                hourlyPrices[timeSlot] = price;
            }
        });

        // Generate time slots and chart data - Convert to WIB
        const wibToday = new Date(today.getTime() + (7 * 60 * 60 * 1000)); // Convert to WIB
        const currentHour = wibToday.getHours();
        const timeSlots = [];
        const chartData = [];

        for (let hour = 0; hour <= currentHour; hour++) {
            const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
            timeSlots.push(timeSlot);

            chartData.push({
                time: timeSlot,
                price: hourlyPrices[timeSlot] || null
            });
        }

        res.json({
            success: true,
            data: {
                hotel_id: hotelId,
                hotel_name: hotelName,
                chartData,
                timeSlots,
                date: today.toISOString().split('T')[0],
                totalRecords: result.rows.length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching hotel hourly data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get latest prices for all hotels (current hour)
 * @route GET /api/hotel-hourly-data/latest
 * @description Get latest prices for all hotels
 */
router.get('/latest', async (req, res) => {
    try {
        console.log('🔍 Fetching latest prices for all hotels...');

        // Get current hour rounded down - Convert to WIB
        const now = new Date();
        const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // Convert to WIB
        const currentHour = wibNow.getHours();
        const startOfHour = new Date(now);
        startOfHour.setMinutes(0, 0, 0);

        const endOfHour = new Date(now);
        endOfHour.setMinutes(59, 59, 999);

        // Query to get latest prices
        const query = `
            SELECT DISTINCT ON (hd.id)
                hd.id as hotel_id,
                hd.hotel_name,
                hsl.room_price,
                hsl.search_timestamp,
                hsl.status
            FROM hotel_data hd
            LEFT JOIN hotel_scraping_results_log hsl ON hd.id = hsl.hotel_id
            WHERE hsl.search_timestamp >= $1 
                AND hsl.search_timestamp <= $2
                AND hsl.status = 'success'
                AND hsl.room_price IS NOT NULL
            ORDER BY hd.id, hsl.search_timestamp DESC
        `;

        const result = await pool.query(query, [startOfHour, endOfHour]);

        console.log(`📊 Found ${result.rows.length} latest prices`);

        const latestPrices = result.rows.map(row => ({
            hotel_id: row.hotel_id,
            hotel_name: row.hotel_name,
            price: parseFloat(row.room_price),
            timestamp: row.search_timestamp
        }));

        res.json({
            success: true,
            data: {
                latestPrices,
                currentHour: currentHour,
                timestamp: now.toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error fetching latest prices:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
