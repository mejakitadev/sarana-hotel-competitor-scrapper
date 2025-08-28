const { Pool } = require('pg');
const chalk = require('chalk');
const { getDbConfig } = require('../../config/db-config');

class ReviewItemsService {
    constructor() {
        this.pool = new Pool(getDbConfig());
    }

    // Create a new review item
    async createReviewItemFromScraper({
        ota_platform,
        username,
        review,
        review_level,
        reply,
        api_id,
        max_review_level,
        is_replied,
        product_name,
        reply_url,
        reply_date,
        reply_author,
        ai_reply,
        published_at,
        metadata
    }) {
        try {
            // Check if the review item already exists by api_id
            const checkQuery = `
                SELECT * FROM review_items WHERE api_id = $1 AND is_deleted = 0
            `;
            const checkResult = await this.pool.query(checkQuery, [api_id]);
            if (checkResult.rows.length > 0) {
                console.log(chalk.yellow('⛔️ Review item already exists, updating instead'));
                // update the review item
                const updateQuery = `
                    UPDATE review_items SET 
                    metadata = $1,
                    is_replied = $2,
                    reply_date = $3,
                    reply_author = $4,
                    reply = $5,
                    WHERE api_id = $6
                    RETURNING * 
                `;
                const updateResult = await this.pool.query(updateQuery, [metadata, is_replied, reply_date, reply_author, reply, api_id]);
                console.log(chalk.green('✅ Review item updated successfully'));
                return updateResult.rows[0];
            }

            const query = `
                INSERT INTO review_items (
                    review_id,
                    ota_platform,
                    username,
                    review,
                    review_level,
                    reply,
                    api_id,
                    max_review_level,
                    is_replied,
                    product_name,
                    reply_url,
                    reply_date,
                    reply_author,
                    ai_reply,
                    published_at,
                    metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `;

            const values = [
                0,
                ota_platform,
                username,
                review,
                review_level,
                reply,
                api_id,
                max_review_level,
                is_replied || 0,
                product_name,
                reply_url,
                reply_date,
                reply_author,
                ai_reply,
                published_at,
                metadata
            ];

            const result = await this.pool.query(query, values);
            console.log(chalk.green('✅ Review item created successfully'));
            return result.rows[0];
        } catch (error) {
            console.error(chalk.red(`❌ Error creating review item: ${error.message}`));
            throw error;
        }
    }

    // Close the database connection
    async close() {
        try {
            await this.pool.end();
            console.log(chalk.blue('🔌 Database connection closed'));
        } catch (error) {
            console.error(chalk.red(`❌ Error closing database connection: ${error.message}`));
            throw error;
        }
    }
}

module.exports = ReviewItemsService;
