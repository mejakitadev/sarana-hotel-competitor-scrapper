const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Test endpoint to verify routing
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Scraping routes are working!',
        timestamp: new Date().toISOString()
    });
});

// Get scraping status and statistics
router.get('/status', async (req, res) => {
    try {
        // Get total hotels count
        const totalHotels = await pool.query('SELECT COUNT(*) FROM hotels');

        // Get last updated hotel
        const lastUpdated = await pool.query(`
      SELECT name, last_updated, price 
      FROM hotels 
      ORDER BY last_updated DESC 
      LIMIT 1
    `);

        // Get hotels updated today
        const todayHotels = await pool.query(`
      SELECT COUNT(*) FROM hotels 
      WHERE DATE(last_updated) = CURRENT_DATE
    `);

        res.json({
            success: true,
            data: {
                total_hotels: parseInt(totalHotels.rows[0].count),
                last_updated: lastUpdated.rows[0] || null,
                updated_today: parseInt(todayHotels.rows[0].count),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting scraping status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scraping status'
        });
    }
});

// Get scraping history
router.get('/history', async (req, res) => {
    try {
        const { rows } = await pool.query(`
      SELECT 
        DATE(last_updated) as date,
        COUNT(*) as hotels_updated,
        AVG(price) as avg_price
      FROM hotels 
      WHERE last_updated >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(last_updated)
      ORDER BY date DESC
    `);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error getting scraping history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scraping history'
        });
    }
});

// Get hotels by update frequency
router.get('/frequency', async (req, res) => {
    try {
        const { rows } = await pool.query(`
      SELECT 
        name,
        location,
        last_updated,
        price,
        EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 as hours_since_update
      FROM hotels 
      ORDER BY last_updated ASC
      LIMIT 20
    `);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error getting update frequency:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get update frequency'
        });
    }
});

// Manual trigger scraping (placeholder for future integration)
router.post('/trigger', async (req, res) => {
    try {
        // This would integrate with the bot scrapper
        // For now, just return success message
        res.json({
            success: true,
            message: 'Scraping triggered successfully',
            note: 'Integration with bot scrapper pending',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error triggering scraping:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger scraping'
        });
    }
});

// Get last synchronization time
router.get('/last-sync', async (req, res) => {
    try {
        console.log('🔍 /last-sync endpoint called');

        // Get the most recent successful scraping log
        const lastSyncQuery = `
            SELECT 
                hsl.created_at,
                hd.hotel_name,
                hsl.room_price
            FROM hotel_scraping_results_log hsl
            JOIN hotel_data hd ON hd.id = hsl.hotel_id
            WHERE hsl.status = 'success'
            ORDER BY hsl.created_at DESC
            LIMIT 1
        `;

        console.log('🔍 Executing lastSyncQuery...');
        const lastSyncResult = await pool.query(lastSyncQuery);

        if (lastSyncResult.rows.length === 0) {
            console.log('⚠️ No successful scraping logs found');
            return res.json({
                success: true,
                data: {
                    last_sync_time: null,
                    last_sync_date: null,
                    hotel_name: null,
                    room_price: null,
                    message: 'Belum ada data sinkronisasi tersedia',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const lastSync = lastSyncResult.rows[0];

        // Return raw UTC timestamp for frontend to convert
        const response = {
            success: true,
            data: {
                last_sync_time: `${lastSync.created_at.getUTCHours().toString().padStart(2, '0')}:${lastSync.created_at.getUTCMinutes().toString().padStart(2, '0')}`,
                last_sync_date: `${lastSync.created_at.getUTCDate().toString().padStart(2, '0')}/${(lastSync.created_at.getUTCMonth() + 1).toString().padStart(2, '0')}/${lastSync.created_at.getUTCFullYear()}`,
                hotel_name: lastSync.hotel_name,
                room_price: lastSync.room_price,
                raw_timestamp: lastSync.created_at.toISOString(),
                message: `Terakhir sinkronisasi: ${lastSync.hotel_name}`
            },
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Last sync found: ${lastSync.hotel_name} at ${response.data.last_sync_time} UTC on ${response.data.last_sync_date}`);
        console.log(`🔍 Debug: UTC time: ${lastSync.created_at.toISOString()}`);

        res.json(response);
    } catch (error) {
        console.error('❌ Error getting last sync time:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get last sync time'
        });
    }
});

// Get real-time scraping status
router.get('/real-time-status', async (req, res) => {
    try {
        console.log('🔍 /real-time-status endpoint called');

        // Get hotels currently being scraped (status = 'in_progress') - only recent ones
        const inProgressQuery = `
            SELECT DISTINCT ON (hsl.hotel_id)
                hd.hotel_name,
                hsl.search_key,
                hsl.created_at as started_at,
                hsl.id as log_id
            FROM hotel_scraping_results_log hsl
            JOIN hotel_data hd ON hd.id = hsl.hotel_id
            WHERE hsl.status = 'in_progress'
            AND hsl.created_at >= NOW() - INTERVAL '1 hour'
            ORDER BY hsl.hotel_id, hsl.created_at DESC
            LIMIT 5
        `;

        console.log('🔍 Executing inProgressQuery...');
        const inProgressResult = await pool.query(inProgressQuery);
        console.log(`✅ In progress hotels found: ${inProgressResult.rows.length}`);

        // Get last successful scrape
        const lastSuccessQuery = `
            SELECT 
                hd.hotel_name,
                hsl.search_key,
                hsl.room_price,
                hsl.created_at
            FROM hotel_scraping_results_log hsl
            JOIN hotel_data hd ON hd.id = hsl.hotel_id
            WHERE hsl.status = 'success'
            ORDER BY hsl.created_at DESC
            LIMIT 1
        `;

        console.log('🔍 Executing lastSuccessQuery...');
        const lastSuccessResult = await pool.query(lastSuccessQuery);
        console.log(`✅ Last success found: ${lastSuccessResult.rows.length > 0 ? lastSuccessResult.rows[0].hotel_name : 'None'}`);

        // Get last error
        const lastErrorQuery = `
            SELECT 
                hd.hotel_name,
                hsl.search_key,
                hsl.error_message,
                hsl.created_at
            FROM hotel_scraping_results_log hsl
            JOIN hotel_data hd ON hd.id = hsl.hotel_id
            WHERE hsl.status = 'error'
            ORDER BY hsl.created_at DESC
            LIMIT 1
        `;

        console.log('🔍 Executing lastErrorQuery...');
        const lastErrorResult = await pool.query(lastErrorQuery);
        console.log(`✅ Last error found: ${lastErrorResult.rows.length > 0 ? lastErrorResult.rows[0].hotel_name : 'None'}`);

        // Determine overall status
        let overallStatus = 'inactive';
        if (inProgressResult.rows.length > 0) {
            overallStatus = 'active';
        } else if (lastSuccessResult.rows.length > 0) {
            overallStatus = 'success';
        } else if (lastErrorResult.rows.length > 0) {
            overallStatus = 'error';
        }

        console.log(`🎯 Final status determined: ${overallStatus}`);

        const responseData = {
            success: true,
            data: {
                status: overallStatus,
                in_progress_hotels: inProgressResult.rows,
                last_success: lastSuccessResult.rows[0] || null,
                last_error: lastErrorResult.rows[0] || null,
                timestamp: new Date().toISOString()
            }
        };

        console.log('📤 Sending response:', JSON.stringify(responseData, null, 2));
        res.json(responseData);
    } catch (error) {
        console.error('❌ Error getting real-time scraping status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get real-time scraping status'
        });
    }
});

/**
 * @swagger
 * /api/scraping/price-trends:
 *   get:
 *     summary: Get hotel price trends and changes
 *     description: Mendapatkan tren harga hotel berdasarkan perbandingan data log scraping terbaru dengan data sebelumnya. Menampilkan persentase perubahan sekecil apapun, tapi tren ditentukan berdasarkan threshold 1%
 *     tags: [Scraping]
 *     responses:
 *       200:
 *         description: Successfully retrieved price trends
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
 *                   properties:
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hotel_name:
 *                             type: string
 *                             example: "Joglo Wardani"
 *                           current_price:
 *                             type: number
 *                             example: 3442473
 *                           previous_price:
 *                             type: number
 *                             example: 3350000
 *                           price_change:
 *                             type: number
 *                             example: 92473
 *                           price_change_percentage:
 *                             type: number
 *                             example: 2.76
 *                           trend:
 *                             type: string
 *                             enum: [up, down, stable]
 *                             example: "up"
 *                           trend_label:
 *                             type: string
 *                             example: "Naik"
 *                           current_timestamp:
 *                             type: string
 *                             format: date-time
 *                           previous_timestamp:
 *                             type: string
 *                             format: date-time
 *                           has_previous_data:
 *                             type: boolean
 *                             example: true
 *                     total_hotels:
 *                       type: integer
 *                       example: 4
 *                     hotels_with_trends:
 *                       type: integer
 *                       example: 3
 *                     price_increases:
 *                       type: integer
 *                       example: 2
 *                     price_decreases:
 *                       type: integer
 *                       example: 1
 *                     stable_prices:
 *                       type: integer
 *                       example: 1
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to get price trends"
 */
// Get hotel price trends and changes based on log data comparison
router.get('/price-trends', async (req, res) => {
    try {
        console.log('🔍 /price-trends endpoint called - using log data comparison');

        // Get all hotels with their latest successful scraping results
        const latestPricesQuery = `
            SELECT DISTINCT ON (hsl.hotel_id)
                hsl.hotel_id,
                hd.hotel_name,
                hsl.room_price as current_price,
                hsl.search_timestamp as current_timestamp,
                hsl.search_key
            FROM hotel_scraping_results_log hsl
            JOIN hotel_data hd ON hsl.hotel_id = hd.id
            WHERE hsl.status = 'success'
            AND hsl.room_price IS NOT NULL
            AND hsl.room_price > 0
            ORDER BY hsl.hotel_id, hsl.search_timestamp DESC
        `;

        const latestPricesResult = await pool.query(latestPricesQuery);
        console.log(`✅ Latest prices found: ${latestPricesResult.rows.length} hotels`);

        const trends = [];

        for (const hotel of latestPricesResult.rows) {
            // Get the previous successful scraping result (1 hour before or closest previous)
            const previousPriceQuery = `
                SELECT 
                    room_price as previous_price,
                    search_timestamp as previous_timestamp,
                    search_key
                FROM hotel_scraping_results_log
                WHERE hotel_id = $1
                AND status = 'success'
                AND room_price IS NOT NULL
                AND room_price > 0
                AND search_timestamp < $2
                ORDER BY search_timestamp DESC
                LIMIT 1
            `;

            const previousResult = await pool.query(previousPriceQuery, [hotel.hotel_id, hotel.current_timestamp]);
            const currentPrice = parseFloat(hotel.current_price);

            if (previousResult.rows.length === 0) {
                // No previous data - show as stable
                trends.push({
                    hotel_name: hotel.hotel_name,
                    current_price: currentPrice,
                    previous_price: null,
                    price_change: 0,
                    price_change_percentage: 0.0,
                    trend: 'stable',
                    trend_label: 'Stabil',
                    current_timestamp: hotel.current_timestamp,
                    previous_timestamp: null,
                    search_key: hotel.search_key,
                    has_previous_data: false
                });
            } else {
                // Calculate trend based on previous data
                const previousData = previousResult.rows[0];
                const previousPrice = parseFloat(previousData.previous_price);
                const priceChange = currentPrice - previousPrice;
                const priceChangePercentage = previousPrice > 0 ?
                    parseFloat(((priceChange / previousPrice) * 100).toFixed(2)) : 0;

                // Determine trend based on price change (threshold 1%)
                let trend = 'stable';
                let trendLabel = 'Stabil';

                if (priceChangePercentage > 1) {
                    trend = 'up';
                    trendLabel = 'Naik';
                } else if (priceChangePercentage < -1) {
                    trend = 'down';
                    trendLabel = 'Turun';
                }

                trends.push({
                    hotel_name: hotel.hotel_name,
                    current_price: currentPrice,
                    previous_price: previousPrice,
                    price_change: priceChange,
                    price_change_percentage: priceChangePercentage,
                    trend: trend,
                    trend_label: trendLabel,
                    current_timestamp: hotel.current_timestamp,
                    previous_timestamp: previousData.previous_timestamp,
                    search_key: hotel.search_key,
                    has_previous_data: true
                });
            }
        }

        // Calculate summary statistics
        const hotelsWithTrends = trends.filter(t => t.has_previous_data);
        const priceIncreases = hotelsWithTrends.filter(t => t.trend === 'up').length;
        const priceDecreases = hotelsWithTrends.filter(t => t.trend === 'down').length;
        const stablePrices = hotelsWithTrends.filter(t => t.trend === 'stable').length;

        console.log(`✅ Trends calculated: ${trends.length} hotels, ${hotelsWithTrends.length} with trends`);

        res.json({
            success: true,
            data: {
                trends: trends,
                total_hotels: trends.length,
                hotels_with_trends: hotelsWithTrends.length,
                price_increases: priceIncreases,
                price_decreases: priceDecreases,
                stable_prices: stablePrices,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting price trends:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get price trends'
        });
    }
});

// Get real hotel price trends based on actual log data - straightforward approach
router.get('/real-price-trends', async (req, res) => {
    try {
        console.log('🔍 /real-price-trends endpoint called');

        // Get all hotels with their latest scraping results
        const hotelsQuery = `
            SELECT 
                hd.id,
                hd.hotel_name,
                hd.rate_harga as current_price,
                hd.updated_at
            FROM hotel_data hd
            ORDER BY hd.hotel_name
        `;

        const hotelsResult = await pool.query(hotelsQuery);
        console.log(`✅ Hotels found: ${hotelsResult.rows.length}`);

        // Get previous prices from log for each hotel
        const trends = [];

        for (const hotel of hotelsResult.rows) {
            const previousPriceQuery = `
                SELECT 
                    room_price,
                    created_at,
                    search_key
                FROM hotel_scraping_results_log
                WHERE hotel_id = $1
                AND status = 'success'
                AND room_price IS NOT NULL
                AND room_price > 0
                AND created_at < $2
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const previousResult = await pool.query(previousPriceQuery, [hotel.id, hotel.updated_at]);
            const currentPrice = parseFloat(hotel.current_price);

            if (previousResult.rows.length === 0) {
                // No previous data available
                trends.push({
                    hotel_name: hotel.hotel_name,
                    current_price: currentPrice,
                    previous_price: null,
                    price_change: 0,
                    price_change_percentage: 0,
                    trend: 'new',
                    trend_label: 'Data Baru',
                    current_scraped_at: hotel.updated_at,
                    previous_scraped_at: null,
                    search_key: null,
                    has_previous_data: false
                });
            } else {
                // Calculate trend based on previous price
                const previousData = previousResult.rows[0];
                const previousPrice = parseFloat(previousData.room_price);
                const priceChange = currentPrice - previousPrice;
                const priceChangePercentage = previousPrice > 0 ?
                    ((priceChange / previousPrice) * 100) : 0;

                // Determine trend
                let trend = 'stable';
                let trendLabel = 'Stabil';

                if (priceChangePercentage > 1) {
                    trend = 'up';
                    trendLabel = 'Naik';
                } else if (priceChangePercentage < -1) {
                    trend = 'down';
                    trendLabel = 'Turun';
                }

                trends.push({
                    hotel_name: hotel.hotel_name,
                    current_price: currentPrice,
                    previous_price: previousPrice,
                    price_change: priceChange,
                    price_change_percentage: parseFloat(priceChangePercentage.toFixed(2)),
                    trend: trend,
                    trend_label: trendLabel,
                    current_scraped_at: hotel.updated_at,
                    previous_scraped_at: previousData.created_at,
                    search_key: previousData.search_key,
                    has_previous_data: true
                });
            }
        }

        // Calculate summary statistics
        const hotelsWithTrends = trends.filter(t => t.has_previous_data);
        const priceIncreases = hotelsWithTrends.filter(t => t.trend === 'up').length;
        const priceDecreases = hotelsWithTrends.filter(t => t.trend === 'down').length;
        const stablePrices = hotelsWithTrends.filter(t => t.trend === 'stable').length;
        const newHotels = trends.filter(t => !t.has_previous_data).length;

        const summary = {
            total_hotels: trends.length,
            hotels_with_trends: hotelsWithTrends.length,
            price_increases: priceIncreases,
            price_decreases: priceDecreases,
            stable_prices: stablePrices,
            new_hotels: newHotels,
            average_price_change_percentage: hotelsWithTrends.length > 0 ?
                parseFloat((hotelsWithTrends.reduce((sum, t) => sum + t.price_change_percentage, 0) / hotelsWithTrends.length).toFixed(2)) : 0
        };

        console.log(`✅ Trends calculated: ${trends.length} hotels, ${hotelsWithTrends.length} with trends`);

        res.json({
            success: true,
            data: {
                trends: trends,
                summary: summary,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error getting real price trends:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get real price trends'
        });
    }
});

// Get latest hotel prices from scraping log
router.get('/latest-prices', async (req, res) => {
    try {
        console.log('🔍 /latest-prices endpoint called');

        // Get the most recent successful scraping result for each hotel
        const latestPricesQuery = `
            SELECT DISTINCT ON (hsl.hotel_id)
                hd.id,
                hd.hotel_name,
                hsl.room_price as latest_price,
                hsl.created_at as scraped_at,
                hsl.status,
                hsl.search_key
            FROM hotel_data hd
            LEFT JOIN LATERAL (
                SELECT 
                    hotel_id,
                    room_price,
                    created_at,
                    status,
                    search_key
                FROM hotel_scraping_results_log
                WHERE hotel_id = hd.id
                AND status = 'success'
                AND room_price IS NOT NULL
                AND room_price > 0
                ORDER BY created_at DESC
                LIMIT 1
            ) hsl ON true
            WHERE hsl.room_price IS NOT NULL
            ORDER BY hd.id, hsl.created_at DESC
        `;

        const result = await pool.query(latestPricesQuery);
        console.log(`✅ Latest prices found: ${result.rows.length} hotels`);

        // Calculate average price
        let totalPrice = 0;
        let validPrices = 0;

        result.rows.forEach(hotel => {
            const price = parseFloat(hotel.latest_price);
            if (price > 0 && !isNaN(price)) {
                totalPrice += price;
                validPrices++;
            }
        });

        const averagePrice = validPrices > 0 ? totalPrice / validPrices : 0;

        res.json({
            success: true,
            data: {
                hotels: result.rows,
                average_price: Math.round(averagePrice),
                total_hotels: result.rows.length,
                hotels_with_price: validPrices,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error getting latest prices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get latest prices'
        });
    }
});

// Get average price calculation
router.get('/average-price', async (req, res) => {
    try {
        console.log('🔍 /average-price endpoint called');

        // Get the most recent successful scraping result for each hotel
        const latestPricesQuery = `
            SELECT DISTINCT ON (hsl.hotel_id)
                hd.hotel_name,
                hsl.room_price as latest_price
            FROM hotel_data hd
            LEFT JOIN LATERAL (
                SELECT 
                    hotel_id,
                    room_price
                FROM hotel_scraping_results_log
                WHERE hotel_id = hd.id
                AND status = 'success'
                AND room_price IS NOT NULL
                AND room_price > 0
                ORDER BY created_at DESC
                LIMIT 1
            ) hsl ON true
            WHERE hsl.room_price IS NOT NULL
            ORDER BY hd.id, hsl.created_at DESC
        `;

        const result = await pool.query(latestPricesQuery);
        console.log(`✅ Latest prices found: ${result.rows.length} hotels`);

        // Calculate average price
        let totalPrice = 0;
        let validPrices = 0;

        result.rows.forEach(hotel => {
            const price = parseFloat(hotel.latest_price);
            if (price > 0 && !isNaN(price)) {
                totalPrice += price;
                validPrices++;
            }
        });

        const averagePrice = validPrices > 0 ? totalPrice / validPrices : 0;

        res.json({
            success: true,
            data: {
                average_price: Math.round(averagePrice),
                total_hotels: result.rows.length,
                hotels_with_price: validPrices,
                calculation_details: {
                    total_price: totalPrice,
                    valid_hotels: validPrices,
                    formula: validPrices > 0 ? `${totalPrice} ÷ ${validPrices} = ${averagePrice.toFixed(2)}` : 'No valid prices'
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error calculating average price:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate average price'
        });
    }
});

// Get detailed price history for a specific hotel
router.get('/hotel-price-history/:hotelId', async (req, res) => {
    try {
        const { hotelId } = req.params;
        console.log(`🔍 /hotel-price-history/${hotelId} endpoint called`);

        // Get all successful scraping results for a specific hotel
        const priceHistoryQuery = `
            SELECT 
                hsl.room_price,
                hsl.created_at,
                hsl.search_key,
                hsl.status
            FROM hotel_scraping_results_log hsl
            WHERE hsl.hotel_id = $1
            AND hsl.status = 'success'
            AND hsl.room_price IS NOT NULL
            AND hsl.room_price > 0
            ORDER BY hsl.created_at DESC
            LIMIT 10
        `;

        const priceHistoryResult = await pool.query(priceHistoryQuery, [hotelId]);
        console.log(`✅ Price history found: ${priceHistoryResult.rows.length} records`);

        if (priceHistoryResult.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    hotel_id: hotelId,
                    price_history: [],
                    message: 'No price history available for this hotel'
                }
            });
        }

        // Calculate price changes between consecutive records
        const priceHistory = priceHistoryResult.rows.map((record, index) => {
            const currentPrice = parseFloat(record.room_price);
            const previousRecord = index < priceHistoryResult.rows.length - 1 ? priceHistoryResult.rows[index + 1] : null;

            if (!previousRecord) {
                return {
                    price: currentPrice,
                    scraped_at: record.created_at,
                    search_key: record.search_key,
                    price_change: null,
                    price_change_percentage: null,
                    trend: 'latest'
                };
            }

            const previousPrice = parseFloat(previousRecord.room_price);
            const priceChange = currentPrice - previousPrice;
            const priceChangePercentage = previousPrice > 0 ?
                ((priceChange / previousPrice) * 100) : 0;

            let trend = 'stable';
            if (priceChangePercentage > 1) trend = 'up';
            else if (priceChangePercentage < -1) trend = 'down';

            return {
                price: currentPrice,
                scraped_at: record.created_at,
                search_key: record.search_key,
                price_change: priceChange,
                price_change_percentage: parseFloat(priceChangePercentage.toFixed(2)),
                trend: trend
            };
        });

        res.json({
            success: true,
            data: {
                hotel_id: hotelId,
                price_history: priceHistory,
                total_records: priceHistory.length
            }
        });

    } catch (error) {
        console.error('❌ Error getting hotel price history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get hotel price history'
        });
    }
});

/**
 * @swagger
 * /api/scraping/competitor-trend:
 *   get:
 *     summary: Get competitor price trend
 *     description: Menghitung tren harga kompetitor berdasarkan rumus (harga rata-rata sekarang - harga rata-rata sebelumnya) / harga rata-rata sekarang
 *     tags: [Scraping]
 *     responses:
 *       200:
 *         description: Successfully calculated competitor trend
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
 *                   properties:
 *                     current_average_price:
 *                       type: number
 *                       example: 2429647
 *                     previous_average_price:
 *                       type: number
 *                       example: 2250000
 *                     price_change:
 *                       type: number
 *                       example: 179647
 *                     trend_percentage:
 *                       type: number
 *                       example: 7.39
 *                     trend_direction:
 *                       type: string
 *                       enum: [up, down, stable]
 *                       example: "up"
 *                     trend_label:
 *                       type: string
 *                       example: "Cenderung Naik"
 *                     current_timestamp:
 *                       type: string
 *                       format: date-time
 *                     previous_timestamp:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Internal server error
 */
// Get competitor price trend based on average price comparison
router.get('/competitor-trend', async (req, res) => {
    try {
        console.log('🔍 /competitor-trend endpoint called');

        // Get current average price from latest successful scraping results
        const currentAverageQuery = `
            SELECT 
                AVG(hsl.room_price) as current_average_price,
                MAX(hsl.search_timestamp) as current_timestamp
            FROM hotel_scraping_results_log hsl
            WHERE hsl.status = 'success'
            AND hsl.room_price IS NOT NULL
            AND hsl.room_price > 0
            AND hsl.search_timestamp >= CURRENT_DATE
        `;

        const currentResult = await pool.query(currentAverageQuery);
        const currentAveragePrice = parseFloat(currentResult.rows[0].current_average_price) || 0;
        const currentTimestamp = currentResult.rows[0].current_timestamp;

        console.log(`✅ Current average price: ${currentAveragePrice}`);

        // Get previous average price (1 hour before or closest previous)
        const previousAverageQuery = `
            SELECT 
                AVG(hsl.room_price) as previous_average_price,
                MAX(hsl.search_timestamp) as previous_timestamp
            FROM hotel_scraping_results_log hsl
            WHERE hsl.status = 'success'
            AND hsl.room_price IS NOT NULL
            AND hsl.room_price > 0
            AND hsl.search_timestamp < $1
            AND hsl.search_timestamp >= CURRENT_DATE
        `;

        const previousResult = await pool.query(previousAverageQuery, [currentTimestamp]);
        const previousAveragePrice = parseFloat(previousResult.rows[0].previous_average_price) || 0;
        const previousTimestamp = previousResult.rows[0].previous_timestamp;

        console.log(`✅ Previous average price: ${previousAveragePrice}`);

        // Calculate trend using the new formula
        // Trend = (current_average - previous_average) / current_average
        const priceChange = currentAveragePrice - previousAveragePrice;
        const trendPercentage = currentAveragePrice > 0 ?
            parseFloat(((priceChange / currentAveragePrice) * 100).toFixed(2)) : 0;

        // Determine trend direction
        let trendDirection = 'stable';
        let trendLabel = 'Stabil';

        if (trendPercentage > 1) {
            trendDirection = 'up';
            trendLabel = 'Cenderung Naik';
        } else if (trendPercentage < -1) {
            trendDirection = 'down';
            trendLabel = 'Cenderung Turun';
        }

        console.log(`✅ Trend calculated: ${trendPercentage}% (${trendLabel})`);

        res.json({
            success: true,
            data: {
                current_average_price: currentAveragePrice,
                previous_average_price: previousAveragePrice,
                price_change: priceChange,
                trend_percentage: trendPercentage,
                trend_direction: trendDirection,
                trend_label: trendLabel,
                current_timestamp: currentTimestamp,
                previous_timestamp: previousTimestamp
            }
        });
    } catch (error) {
        console.error('Error getting competitor trend:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get competitor trend'
        });
    }
});

module.exports = router;
