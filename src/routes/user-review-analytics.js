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

        // Get weekly averages (current week)
        const weeklyQuery = `
            SELECT 
                AVG(EXTRACT(EPOCH FROM (reply_date - published_at)) / 86400) as average_days,
                COUNT(*) as review_count,
                DATE_TRUNC('week', NOW()) as week_start,
                DATE_TRUNC('week', NOW()) + INTERVAL '6 days' as week_end
            FROM review_items 
            WHERE is_replied = 1 
                AND published_at IS NOT NULL 
                AND reply_date IS NOT NULL
                AND DATE_TRUNC('week', published_at) = DATE_TRUNC('week', NOW())
        `;

        // Get monthly averages (current month)
        const monthlyQuery = `
            SELECT 
                AVG(EXTRACT(EPOCH FROM (reply_date - published_at)) / 86400) as average_days,
                COUNT(*) as review_count,
                DATE_TRUNC('month', NOW()) as month_start,
                DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day' as month_end
            FROM review_items 
            WHERE is_replied = 1 
                AND published_at IS NOT NULL 
                AND reply_date IS NOT NULL
                AND DATE_TRUNC('month', published_at) = DATE_TRUNC('month', NOW())
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
                    week_start: weeklyResult.rows[0]?.week_start ? new Date(weeklyResult.rows[0].week_start).toISOString().split('T')[0] : null,
                    week_end: weeklyResult.rows[0]?.week_end ? new Date(weeklyResult.rows[0].week_end).toISOString().split('T')[0] : null,
                    average_days: parseFloat(weeklyResult.rows[0]?.average_days) || 0,
                    review_count: parseInt(weeklyResult.rows[0]?.review_count) || 0
                }],
                monthly_averages: [{
                    month: monthlyResult.rows[0]?.month_start ? new Date(monthlyResult.rows[0].month_start).getMonth() + 1 : null,
                    year: monthlyResult.rows[0]?.month_start ? new Date(monthlyResult.rows[0].month_start).getFullYear() : null,
                    month_start: monthlyResult.rows[0]?.month_start ? new Date(monthlyResult.rows[0].month_start).toISOString().split('T')[0] : null,
                    month_end: monthlyResult.rows[0]?.month_end ? new Date(monthlyResult.rows[0].month_end).toISOString().split('T')[0] : null,
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
