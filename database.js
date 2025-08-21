const { Pool } = require('pg');
const chalk = require('chalk');

// Load environment variables
require('dotenv').config();

const { getDbConfig } = require('./db-config');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Konfigurasi database PostgreSQL
            this.pool = new Pool(getDbConfig());

            // Test koneksi
            const client = await this.pool.connect();
            console.log(chalk.green('✅ Database PostgreSQL berhasil terkoneksi'));
            client.release();

            this.isConnected = true;

            // Buat tabel jika belum ada
            await this.createTables();

            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal koneksi ke database: ${error.message}`));
            this.isConnected = false;
            return false;
        }
    }

    async createTables() {
        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS hotel_scraping_results (
                    id SERIAL PRIMARY KEY,
                    search_key VARCHAR(255) NOT NULL,
                    hotel_name VARCHAR(255) NOT NULL,
                    room_price DECIMAL(10,2),
                    price_currency VARCHAR(10) DEFAULT 'IDR',
                    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    screenshot_path VARCHAR(500),
                    status VARCHAR(50) DEFAULT 'success',
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_search_key ON hotel_scraping_results(search_key);
                CREATE INDEX IF NOT EXISTS idx_hotel_name ON hotel_scraping_results(hotel_name);
                CREATE INDEX IF NOT EXISTS idx_search_timestamp ON hotel_scraping_results(search_timestamp);
            `;

            await this.pool.query(createTableQuery);
            console.log(chalk.green('✅ Tabel database berhasil dibuat/diverifikasi'));
        } catch (error) {
            console.log(chalk.red(`❌ Gagal membuat tabel: ${error.message}`));
        }
    }

    async saveScrapingResult(searchKey, hotelName, roomPrice, screenshotPath = null, status = 'success', errorMessage = null) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi, hasil tidak disimpan'));
            return false;
        }

        try {
            // Mulai transaction
            const client = await this.pool.connect();

            try {
                await client.query('BEGIN');

                // 1. Cek apakah data sudah ada berdasarkan search_key
                const checkExistingQuery = `
                    SELECT id FROM hotel_scraping_results 
                    WHERE search_key = $1
                `;
                const existingResult = await client.query(checkExistingQuery, [searchKey]);

                let scrapingId;

                if (existingResult.rows.length > 0) {
                    // Update data existing
                    scrapingId = existingResult.rows[0].id;
                    const updateQuery = `
                        UPDATE hotel_scraping_results 
                        SET hotel_name = $2, room_price = $3, screenshot_path = $4, 
                            status = $5, error_message = $6, search_timestamp = CURRENT_TIMESTAMP
                        WHERE id = $1
                        RETURNING id
                    `;
                    const updateValues = [scrapingId, hotelName, roomPrice, screenshotPath, status, errorMessage];
                    await client.query(updateQuery, updateValues);

                    console.log(chalk.blue(`🔄 Update data existing dengan ID: ${scrapingId}`));
                } else {
                    // Insert data baru
                    const insertQuery = `
                        INSERT INTO hotel_scraping_results 
                        (search_key, hotel_name, room_price, screenshot_path, status, error_message)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        RETURNING id
                    `;
                    const values = [searchKey, hotelName, roomPrice, screenshotPath, status, errorMessage];
                    const result = await client.query(insertQuery, values);
                    scrapingId = result.rows[0].id;

                    console.log(chalk.green(`🆕 Insert data baru dengan ID: ${scrapingId}`));
                }

                // 2. Update hotel_data dengan foreign key
                const upsertHotelDataQuery = `
                    INSERT INTO hotel_data 
                    (hotel_id, hotel_name, rate_harga)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (hotel_id) 
                    DO UPDATE SET 
                        hotel_name = EXCLUDED.hotel_name,
                        rate_harga = EXCLUDED.rate_harga,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING hotel_id
                `;

                const hotelDataValues = [scrapingId, hotelName, roomPrice];
                const hotelDataResult = await client.query(upsertHotelDataQuery, hotelDataValues);

                // Commit transaction
                await client.query('COMMIT');

                console.log(chalk.green(`💾 Data berhasil disimpan ke database dengan ID: ${scrapingId}`));
                console.log(chalk.green(`   📊 Scraping ID: ${scrapingId}`));
                console.log(chalk.green(`   🏨 Hotel Data ID: ${hotelDataResult.rows[0].hotel_id}`));

                return {
                    scrapingId: scrapingId,
                    hotelDataId: hotelDataResult.rows[0].hotel_id
                };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.log(chalk.red(`❌ Gagal menyimpan ke database: ${error.message}`));
            return false;
        }
    }

    async getScrapingHistory(limit = 10) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return [];
        }

        try {
            const query = `
                SELECT * FROM hotel_scraping_results 
                ORDER BY search_timestamp DESC 
                LIMIT $1
            `;

            const result = await this.pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengambil history: ${error.message}`));
            return [];
        }
    }

    async getHotelPriceHistory(hotelName, days = 7) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return [];
        }

        try {
            const query = `
                SELECT * FROM hotel_scraping_results 
                WHERE hotel_name ILIKE $1 
                AND search_timestamp >= NOW() - INTERVAL '${days} days'
                ORDER BY search_timestamp DESC
            `;

            const result = await this.pool.query(query, [`%${hotelName}%`]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengambil history harga: ${error.message}`));
            return [];
        }
    }

    async getHotelByName(hotelName) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return null;
        }

        try {
            const query = `
                SELECT id, hotel_name, room_price, search_timestamp 
                FROM hotel_scraping_results 
                WHERE hotel_name ILIKE $1 
                ORDER BY search_timestamp DESC 
                LIMIT 1
            `;

            const result = await this.pool.query(query, [`%${hotelName}%`]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mencari hotel: ${error.message}`));
            return null;
        }
    }

    async updateHotelPrice(scrapingId, newPrice, screenshotPath = null) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return false;
        }

        try {
            // Mulai transaction
            const client = await this.pool.connect();

            try {
                await client.query('BEGIN');

                // Update hanya harga dan screenshot, bukan nama hotel
                const updateQuery = `
                    UPDATE hotel_scraping_results
                    SET room_price = $2, screenshot_path = $3,
                        status = $4, error_message = $5, search_timestamp = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING id
                `;

                const updateValues = [scrapingId, newPrice, screenshotPath, 'success', null];
                const result = await client.query(updateQuery, updateValues);

                if (result.rows.length === 0) {
                    throw new Error('Hotel tidak ditemukan dengan ID tersebut');
                }

                // Update juga di tabel hotel_data jika ada
                const updateHotelDataQuery = `
                    UPDATE hotel_data 
                    SET rate_harga = $2, updated_at = CURRENT_TIMESTAMP
                    WHERE hotel_id = $1
                `;

                await client.query(updateHotelDataQuery, [scrapingId, newPrice]);

                // Commit transaction
                await client.query('COMMIT');

                console.log(chalk.green(`✅ Harga hotel berhasil di-update dengan ID: ${scrapingId}`));
                console.log(chalk.green(`   💰 Harga baru: ${newPrice}`));

                return true;

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.log(chalk.red(`❌ Gagal update harga hotel: ${error.message}`));
            return false;
        }
    }

    async getSearchStats() {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return null;
        }

        try {
            const query = `
                SELECT 
                    COUNT(*) as total_searches,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_searches,
                    COUNT(CASE WHEN status != 'success' THEN 1 END) as failed_searches,
                    AVG(room_price) as average_price,
                    MIN(search_timestamp) as first_search,
                    MAX(search_timestamp) as last_search
                FROM hotel_scraping_results
            `;

            const result = await this.pool.query(query);
            return result.rows[0];
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengambil statistik: ${error.message}`));
            return null;
        }
    }

    // Fungsi baru untuk mendapatkan data hotel dari tabel hotel_data
    async getHotelData(limit = 50) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return [];
        }

        try {
            const query = `
                SELECT 
                    hd.hotel_id,
                    hd.hotel_name,
                    hd.rate_harga,
                    hd.created_at,
                    hd.updated_at,
                    hsr.search_key,
                    hsr.search_timestamp,
                    hsr.screenshot_path,
                    hsr.status
                FROM hotel_data hd
                JOIN hotel_scraping_results hsr ON hd.hotel_id = hsr.id
                ORDER BY hd.updated_at DESC
                LIMIT $1
            `;

            const result = await this.pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengambil data hotel: ${error.message}`));
            return [];
        }
    }

    // Fungsi untuk mendapatkan data hotel berdasarkan nama hotel
    async getHotelDataByName(hotelName, limit = 20) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return [];
        }

        try {
            const query = `
                SELECT 
                    hd.hotel_id,
                    hd.hotel_name,
                    hd.rate_harga,
                    hd.created_at,
                    hd.updated_at,
                    hsr.search_key,
                    hsr.search_timestamp,
                    hsr.screenshot_path,
                    hsr.status
                FROM hotel_data hd
                JOIN hotel_scraping_results hsr ON hd.hotel_id = hsr.id
                WHERE hd.hotel_name ILIKE $1
                ORDER BY hd.updated_at DESC
                LIMIT $2
            `;

            const result = await this.pool.query(query, [`%${hotelName}%`, limit]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengambil data hotel berdasarkan nama: ${error.message}`));
            return [];
        }
    }

    // Fungsi untuk mendapatkan data hotel berdasarkan kota
    async getHotelDataByCity(cityName, limit = 50) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return [];
        }

        try {
            const query = `
                SELECT 
                    hd.hotel_id,
                    hd.hotel_name,
                    hd.rate_harga,
                    hd.created_at,
                    hd.updated_at,
                    hsr.search_key,
                    hsr.search_timestamp,
                    hsr.screenshot_path,
                    hsr.status
                FROM hotel_data hd
                JOIN hotel_scraping_results hsr ON hd.hotel_id = hsr.id
                WHERE hsr.search_key ILIKE $1
                ORDER BY hd.updated_at DESC
                LIMIT $2
            `;

            const result = await this.pool.query(query, [`%${cityName}%`, limit]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengambil data hotel berdasarkan kota: ${error.message}`));
            return [];
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log(chalk.blue('🔌 Koneksi database ditutup'));
        }
    }
}

module.exports = DatabaseManager;
