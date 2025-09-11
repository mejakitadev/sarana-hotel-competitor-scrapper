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
 * Get hourly price data for all hotels for last 12 hours
 * @route GET /api/hotel-hourly-data/today
 * @description Get price data grouped by hour for all hotels for last 12 hours dynamically
 */
router.get('/today', async (req, res) => {
    try {
        console.log('🔍 Fetching hourly data for last 12 hours...');

        // Get WIB current time
        const now = new Date();
        const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // Convert to WIB

        // First, get the latest scraping time from database
        const latestScrapingQuery = `
            SELECT MAX(hsl.search_timestamp) as latest_timestamp
            FROM hotel_scraping_results_log hsl
            WHERE hsl.status = 'success'
                AND hsl.room_price IS NOT NULL
        `;

        const latestResult = await pool.query(latestScrapingQuery);
        const latestScrapingTime = latestResult.rows[0].latest_timestamp;

        if (!latestScrapingTime) {
            return res.json({
                success: true,
                data: {
                    chartData: [],
                    hotelList: [],
                    timeSlots: [],
                    period: "Tidak ada data scraping",
                    startTime: null,
                    endTime: null,
                    totalRecords: 0
                }
            });
        }

        // Convert latest scraping time to WIB
        const latestScrapingWIB = new Date(latestScrapingTime.getTime() + (7 * 60 * 60 * 1000));

        // Calculate 12 hours back from latest scraping time
        const wibEndTime = new Date(latestScrapingWIB);
        const wibStartTime = new Date(latestScrapingWIB.getTime() - (12 * 60 * 60 * 1000)); // 12 hours ago

        console.log('🕐 Latest scraping time (UTC):', latestScrapingTime.toISOString());
        console.log('🕐 Latest scraping time (WIB):', latestScrapingWIB.toISOString());
        console.log('🕐 WIB Start time (12h ago):', wibStartTime.toISOString());
        console.log('🕐 WIB End time (latest):', wibEndTime.toISOString());

        // Convert WIB times back to UTC for database query
        const utcStartTime = new Date(wibStartTime.getTime() - (7 * 60 * 60 * 1000));
        const utcEndTime = new Date(wibEndTime.getTime() - (7 * 60 * 60 * 1000));

        console.log('📅 WIB Time range (last 12 hours):', wibStartTime.toISOString(), 'to', wibEndTime.toISOString());
        console.log('📅 UTC Time range for DB:', utcStartTime.toISOString(), 'to', utcEndTime.toISOString());

        // Query to get hourly data for last 12 hours
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

        const result = await pool.query(query, [utcStartTime, utcEndTime]);

        console.log(`📊 Found ${result.rows.length} records for last 12 hours`);

        // Debug query specifically for Swiss-Belinn
        const swissDebugQuery = `
            SELECT 
                hd.id as hotel_id,
                hd.hotel_name,
                hsl.search_timestamp,
                hsl.room_price,
                hsl.status,
                EXTRACT(HOUR FROM hsl.search_timestamp) as hour
            FROM hotel_data hd
            LEFT JOIN hotel_scraping_results_log hsl ON hd.id = hsl.hotel_id
            WHERE hd.hotel_name ILIKE '%swiss%belinn%'
                AND hsl.search_timestamp >= $1 
                AND hsl.search_timestamp <= $2
            ORDER BY hsl.search_timestamp DESC
            LIMIT 5
        `;

        const swissDebugResult = await pool.query(swissDebugQuery, [utcStartTime, utcEndTime]);
        console.log(`🏨 Swiss-Belinn debug query found ${swissDebugResult.rows.length} records:`);
        swissDebugResult.rows.forEach((row, index) => {
            console.log(`  Debug ${index}: Hotel=${row.hotel_name}, Status=${row.status}, Price=${row.room_price}, Time=${row.search_timestamp}, Hour=${row.hour}`);
        });

        // Group data by hotel and hour
        const hotelHourlyData = {};

        // Generate time slots for last 12 hours dynamically
        const timeSlots = [];

        // Round latest scraping time to the nearest hour for cleaner display
        const latestScrapingHour = latestScrapingWIB.getHours();
        const roundedLatestTime = new Date(latestScrapingWIB);
        roundedLatestTime.setMinutes(0, 0, 0); // Round to hour

        // Calculate 12 hours back from rounded latest time
        const roundedStartTime = new Date(roundedLatestTime.getTime() - (11 * 60 * 60 * 1000)); // 11 hours back to get 12 total hours

        console.log('🕐 Latest scraping hour:', latestScrapingHour);
        console.log('🕐 Rounded latest time:', roundedLatestTime.toISOString());
        console.log('🕐 Rounded start time:', roundedStartTime.toISOString());

        // Create time slots for each hour in the 12-hour window
        for (let i = 0; i < 12; i++) {
            const slotTime = new Date(roundedStartTime.getTime() + (i * 60 * 60 * 1000));
            const hour = slotTime.getHours();
            timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        }

        console.log('⏰ Generated time slots:', timeSlots);
        console.log('📊 Raw database results:');
        result.rows.forEach((row, index) => {
            if (index < 10) { // Show first 10 results for debugging
                console.log(`  Row ${index}: Hotel=${row.hotel_name}, UTC Hour=${row.hour}, WIB Hour=${(parseInt(row.hour) + 7) % 24}, Price=${row.room_price}, Time=${row.search_timestamp}`);
            }
        });

        // Check specifically for Swiss-Belinn data
        const swissBelinnRows = result.rows.filter(row =>
            row.hotel_name.toLowerCase().includes('swiss') ||
            row.hotel_name.toLowerCase().includes('belinn')
        );
        console.log(`🏨 Swiss-Belinn rows found: ${swissBelinnRows.length}`);
        swissBelinnRows.forEach((row, index) => {
            console.log(`  Swiss-Belinn ${index}: Hotel=${row.hotel_name}, UTC Hour=${row.hour}, WIB Hour=${(parseInt(row.hour) + 7) % 24}, Price=${row.room_price}, Time=${row.search_timestamp}`);
        });

        // Process results - Convert UTC hour to WIB hour
        result.rows.forEach(row => {
            const hotelId = row.hotel_id;
            const hotelName = row.hotel_name;
            const utcHour = parseInt(row.hour);
            const wibHour = (utcHour + 7) % 24; // Convert UTC to WIB
            const price = parseFloat(row.room_price);
            const timeSlot = `${wibHour.toString().padStart(2, '0')}:00`;

            // Debug logging for Swiss-Belinn Cikarang
            if (hotelName.toLowerCase().includes('swiss') || hotelName.toLowerCase().includes('belinn')) {
                console.log(`🏨 Swiss-Belinn data: UTC ${utcHour}:00 -> WIB ${wibHour}:00 (${timeSlot}), Price: Rp ${price}, Time: ${row.search_timestamp}`);
            }

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

        console.log('📈 Chart data points:');
        chartData.forEach((point, index) => {
            if (index < 3) { // Show first 3 data points
                console.log(`  Point ${index}: Time=${point.time}, Data=${JSON.stringify(point)}`);
            }
        });

        // Debug Swiss-Belinn data in chart
        const swissBelinnKey = Object.keys(hotelHourlyData).find(key =>
            hotelHourlyData[key].hotel_name.toLowerCase().includes('swiss') ||
            hotelHourlyData[key].hotel_name.toLowerCase().includes('belinn')
        );

        if (swissBelinnKey) {
            const swissBelinnData = hotelHourlyData[swissBelinnKey];
            console.log(`🏨 Swiss-Belinn chart data:`, swissBelinnData.prices);
            console.log(`🏨 Swiss-Belinn at 14:00:`, swissBelinnData.prices['14:00']);
        } else {
            console.log('❌ Swiss-Belinn not found in hotelHourlyData');
            console.log('🏨 Available hotels:', Object.values(hotelHourlyData).map(h => h.hotel_name));
        }

        // Get hotel list for legend
        const hotelList = Object.values(hotelHourlyData).map(hotel => ({
            id: hotel.hotel_id,
            name: hotel.hotel_name,
            key: hotel.hotel_name.replace(/[^a-zA-Z0-9]/g, '_')
        }));

        console.log(`✅ Processed data for ${hotelList.length} hotels`);

        // Calculate period display string based on rounded latest scraping time
        const periodStart = `${roundedStartTime.getHours().toString().padStart(2, '0')}:00`;
        const periodEnd = `${roundedLatestTime.getHours().toString().padStart(2, '0')}:00`;
        const periodString = `${periodStart} - ${periodEnd} WIB (12 jam terakhir dari scraping terbaru)`;

        res.json({
            success: true,
            data: {
                chartData,
                hotelList,
                timeSlots,
                period: periodString,
                startTime: roundedStartTime.toISOString(),
                endTime: roundedLatestTime.toISOString(),
                latestScrapingTime: latestScrapingWIB.toISOString(),
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

        // Get WIB hour range
        const wibStartOfHour = new Date(wibNow);
        wibStartOfHour.setMinutes(0, 0, 0);

        const wibEndOfHour = new Date(wibNow);
        wibEndOfHour.setMinutes(59, 59, 999);

        // Convert WIB times back to UTC for database query
        const utcStartOfHour = new Date(wibStartOfHour.getTime() - (7 * 60 * 60 * 1000));
        const utcEndOfHour = new Date(wibEndOfHour.getTime() - (7 * 60 * 60 * 1000));

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

        const result = await pool.query(query, [utcStartOfHour, utcEndOfHour]);

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



