const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get review time analytics
router.get('/time-analytics', async (req, res) => {
    try {
        // Get overall average response time
        const overallQuery = `
            SELECT 
                AVG(EXTRACT(EPOCH FROM (reply_date - published_at)) / 86400) as average_days,
                COUNT(*) as total_reviews
            FROM review_items 
            WHERE is_replied = 1 
                AND published_at IS NOT NULL 
                AND reply_date IS NOT NULL
        `;

        // Get weekly averages (last 7 days)
        const weeklyQuery = `
            SELECT 
                AVG(EXTRACT(EPOCH FROM (reply_date - published_at)) / 86400) as average_days,
                COUNT(*) as review_count
            FROM review_items 
            WHERE is_replied = 1 
                AND published_at IS NOT NULL 
                AND reply_date IS NOT NULL
                AND published_at >= NOW() - INTERVAL '7 days'
        `;

        // Get monthly averages (last 30 days)
        const monthlyQuery = `
            SELECT 
                AVG(EXTRACT(EPOCH FROM (reply_date - published_at)) / 86400) as average_days,
                COUNT(*) as review_count
            FROM review_items 
            WHERE is_replied = 1 
                AND published_at IS NOT NULL 
                AND reply_date IS NOT NULL
                AND published_at >= NOW() - INTERVAL '30 days'
        `;

        // Execute all queries
        const [overallResult, weeklyResult, monthlyResult] = await Promise.all([
            pool.query(overallQuery),
            pool.query(weeklyQuery),
            pool.query(monthlyQuery)
        ]);

        const response = {
            status_code: 200,
            fulfilled: true,
            message: "Time analytics fetched successfully",
            data: {
                overall_average_days: parseFloat(overallResult.rows[0]?.average_days) || 0,
                weekly_averages: [{
                    week_start: '2025-09-01',
                    week_end: '2025-09-07',
                    average_days: parseFloat(weeklyResult.rows[0]?.average_days) || 0,
                    review_count: parseInt(weeklyResult.rows[0]?.review_count) || 0
                }],
                monthly_averages: [{
                    month: 9,
                    year: 2025,
                    average_days: parseFloat(monthlyResult.rows[0]?.average_days) || 0,
                    review_count: parseInt(monthlyResult.rows[0]?.review_count) || 0
                }]
            },
            pagination: null,
            error: null,
            extra_fields: null
        };

        res.json(response);

    } catch (error) {
        console.error('Error fetching review time analytics:', error);
        res.status(500).json({
            status_code: 500,
            fulfilled: false,
            message: "Failed to fetch time analytics",
            data: null,
            pagination: null,
            error: error.message,
            extra_fields: null
        });
    }
});

module.exports = router;
