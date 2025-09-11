const { Pool } = require('pg');
const chalk = require('chalk');

// Load environment variables
require('dotenv').config();

const { getDbConfig } = require('../../config/db-config');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Don't close existing pool if already connected
            if (this.pool && this.isConnected) {
                console.log(chalk.yellow('⚠️ Database sudah terkoneksi'));
                return true;
            }

            // Close existing pool only if exists but not connected
            if (this.pool && !this.isConnected) {
                try {
                    await this.pool.end();
                } catch (error) {
                    console.log(chalk.yellow('⚠️ Error closing existing pool:', error.message));
                }
                this.pool = null;
            }

            // Konfigurasi database PostgreSQL
            this.pool = new Pool(getDbConfig());

            // Test koneksi
            const client = await this.pool.connect();
            console.log(chalk.green('✅ Database PostgreSQL berhasil terkoneksi'));
            client.release();

            this.isConnected = true;

            // Buat tabel jika belum ada
            await this.createTables();
            await this.createSocmedTablesIfNotExists();

            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal koneksi ke database: ${error.message}`));
            this.isConnected = false;
            return false;
        }
    }

    async reconnect() {
        console.log(chalk.yellow('🔄 Mencoba reconnect ke database...'));
        this.isConnected = false;
        return await this.connect();
    }

    async checkConnection() {
        if (!this.pool || !this.isConnected) {
            return false;
        }

        try {
            const client = await this.pool.connect();
            client.release();
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Database connection check failed: ${error.message}`));
            this.isConnected = false;
            return false;
        }
    }

    async createTables() {
        try {
            // Create hotel_data table first (parent table)
            const createHotelDataTableQuery = `
                CREATE TABLE IF NOT EXISTS hotel_data (
                    id SERIAL PRIMARY KEY,
                    hotel_name VARCHAR(255) NOT NULL,
                    rate_harga DECIMAL(10,2) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_hotel_data_name ON hotel_data(hotel_name);
                CREATE INDEX IF NOT EXISTS idx_hotel_data_created_at ON hotel_data(created_at);
                CREATE INDEX IF NOT EXISTS idx_hotel_data_updated_at ON hotel_data(updated_at);
            `;

            await this.pool.query(createHotelDataTableQuery);

            // Create hotel_scraping_results_log table (child table with foreign key)
            const createScrapingLogTableQuery = `
                CREATE TABLE IF NOT EXISTS hotel_scraping_results_log (
                    id SERIAL PRIMARY KEY,
                    hotel_id INTEGER NOT NULL,
                    search_key VARCHAR(255) NOT NULL,
                    room_price DECIMAL(10,2),
                    price_currency VARCHAR(10) DEFAULT 'IDR',
                    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    screenshot_path VARCHAR(500),
                    status VARCHAR(50) DEFAULT 'success',
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    -- Foreign key constraint ke hotel_data
                    CONSTRAINT fk_hotel_id 
                        FOREIGN KEY (hotel_id) 
                        REFERENCES hotel_data(id) 
                        ON DELETE CASCADE
                );
                
                CREATE INDEX IF NOT EXISTS idx_scraping_log_hotel_id ON hotel_scraping_results_log(hotel_id);
                CREATE INDEX IF NOT EXISTS idx_scraping_log_search_key ON hotel_scraping_results_log(search_key);
                CREATE INDEX IF NOT EXISTS idx_scraping_log_search_timestamp ON hotel_scraping_results_log(search_timestamp);
                CREATE INDEX IF NOT EXISTS idx_scraping_log_status ON hotel_scraping_results_log(status);
            `;

            await this.pool.query(createScrapingLogTableQuery);
            console.log(chalk.green('✅ Tabel database berhasil dibuat/diverifikasi'));
        } catch (error) {
            console.log(chalk.red(`❌ Gagal membuat tabel: ${error.message}`));
        }
    }

    async createSocmedTablesIfNotExists() {
        try {
            // Check if tables already exist
            const checkTablesQuery = `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('socmed_list', 'socmed_post', 'socmed_scraping_log');
            `;

            const result = await this.pool.query(checkTablesQuery);
            const existingTables = result.rows.map(row => row.table_name);

            // If all tables exist, skip creation
            if (existingTables.length === 3) {
                console.log(chalk.blue('ℹ️ Tabel Social Media sudah ada, skip migration'));
                return;
            }

            console.log(chalk.yellow('🔄 Membuat tabel Social Media...'));

            // Create socmed_list table (social media accounts list)
            const createSocmedListTableQuery = `
                CREATE TABLE IF NOT EXISTS socmed_list (
                    id SERIAL PRIMARY KEY,
                    account_url VARCHAR(500) NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_socmed_list_username ON socmed_list(username);
                CREATE INDEX IF NOT EXISTS idx_socmed_list_account_url ON socmed_list(account_url);
                CREATE INDEX IF NOT EXISTS idx_socmed_list_created_at ON socmed_list(created_at);
            `;

            await this.pool.query(createSocmedListTableQuery);

            // Create socmed_post table (social media posts)
            const createSocmedPostTableQuery = `
                CREATE TABLE IF NOT EXISTS socmed_post (
                    id SERIAL PRIMARY KEY,
                    post_url VARCHAR(500) UNIQUE NOT NULL,
                    caption TEXT,
                    post_date TIMESTAMP,
                    type VARCHAR(50) DEFAULT 'post' CHECK (type IN ('reel', 'post'))
                );
                
                CREATE INDEX IF NOT EXISTS idx_socmed_post_url ON socmed_post(post_url);
                CREATE INDEX IF NOT EXISTS idx_socmed_post_date ON socmed_post(post_date);
                CREATE INDEX IF NOT EXISTS idx_socmed_post_type ON socmed_post(type);
            `;

            await this.pool.query(createSocmedPostTableQuery);

            // Create socmed_scraping_log table (scraping logs)
            const createSocmedScrapingLogTableQuery = `
                CREATE TABLE IF NOT EXISTS socmed_scraping_log (
                    id SERIAL PRIMARY KEY,
                    account_id INTEGER REFERENCES socmed_list(id) ON DELETE CASCADE,
                    url_post VARCHAR(500) NOT NULL,
                    caption TEXT,
                    status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'error', 'in_progress')),
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_socmed_scraping_log_account_id ON socmed_scraping_log(account_id);
                CREATE INDEX IF NOT EXISTS idx_socmed_scraping_log_url_post ON socmed_scraping_log(url_post);
                CREATE INDEX IF NOT EXISTS idx_socmed_scraping_log_status ON socmed_scraping_log(status);
                CREATE INDEX IF NOT EXISTS idx_socmed_scraping_log_created_at ON socmed_scraping_log(created_at);
            `;

            await this.pool.query(createSocmedScrapingLogTableQuery);

            // Insert default social media account
            const insertDefaultAccountQuery = `
                INSERT INTO socmed_list (account_url, username) 
                VALUES ('https://www.instagram.com/cikarang.people/', 'cikarang.people')
                ON CONFLICT DO NOTHING;
            `;

            await this.pool.query(insertDefaultAccountQuery);

            console.log(chalk.green('✅ Tabel Social Media berhasil dibuat'));
        } catch (error) {
            console.log(chalk.red(`❌ Gagal membuat tabel Social Media: ${error.message}`));
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

                let hotelId;

                // 1. Cek apakah hotel sudah ada di hotel_data berdasarkan nama
                const checkHotelQuery = `
                    SELECT id FROM hotel_data 
                    WHERE hotel_name ILIKE $1
                `;
                const existingHotel = await client.query(checkHotelQuery, [hotelName]);

                if (existingHotel.rows.length > 0) {
                    // Hotel sudah ada, gunakan ID yang ada
                    hotelId = existingHotel.rows[0].id;

                    // Update harga di hotel_data
                    const updateHotelQuery = `
                        UPDATE hotel_data 
                        SET rate_harga = $2, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                        RETURNING id
                    `;
                    await client.query(updateHotelQuery, [hotelId, roomPrice]);

                    console.log(chalk.blue(`🔄 Update hotel existing dengan ID: ${hotelId}`));
                } else {
                    // Hotel belum ada, buat baru di hotel_data
                    const insertHotelQuery = `
                        INSERT INTO hotel_data 
                        (hotel_name, rate_harga)
                        VALUES ($1, $2)
                        RETURNING id
                    `;
                    const hotelResult = await client.query(insertHotelQuery, [hotelName, roomPrice]);
                    hotelId = hotelResult.rows[0].id;

                    console.log(chalk.green(`🆕 Hotel baru dibuat dengan ID: ${hotelId}`));
                }

                // 2. Insert log scraping ke hotel_scraping_results_log
                const insertLogQuery = `
                    INSERT INTO hotel_scraping_results_log 
                    (hotel_id, search_key, room_price, screenshot_path, status, error_message)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `;
                const logValues = [hotelId, searchKey, roomPrice, screenshotPath, status, errorMessage];
                const logResult = await client.query(insertLogQuery, logValues);
                const logId = logResult.rows[0].id;

                // Commit transaction
                await client.query('COMMIT');

                console.log(chalk.green(`💾 Data berhasil disimpan ke database`));
                console.log(chalk.green(`   🏨 Hotel ID: ${hotelId}`));
                console.log(chalk.green(`   📝 Log ID: ${logId}`));

                return {
                    hotelId: hotelId,
                    logId: logId
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
                SELECT * FROM hotel_scraping_results_log 
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
                SELECT * FROM hotel_scraping_results_log 
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
                SELECT id, hotel_name, rate_harga, updated_at 
                FROM hotel_data 
                WHERE hotel_name ILIKE $1 
                ORDER BY updated_at DESC 
                LIMIT 1
            `;

            const result = await this.pool.query(query, [`%${hotelName}%`]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mencari hotel: ${error.message}`));
            return null;
        }
    }

    async updateHotelPrice(hotelId, newPrice, screenshotPath = null) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return false;
        }

        try {
            // Mulai transaction
            const client = await this.pool.connect();

            try {
                await client.query('BEGIN');

                // Update harga di hotel_data
                const updateHotelQuery = `
                    UPDATE hotel_data
                    SET rate_harga = $2, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING id
                `;

                const result = await client.query(updateHotelQuery, [hotelId, newPrice]);

                if (result.rows.length === 0) {
                    throw new Error('Hotel tidak ditemukan dengan ID tersebut');
                }

                // Insert log scraping baru ke hotel_scraping_results_log
                const insertLogQuery = `
                    INSERT INTO hotel_scraping_results_log 
                    (hotel_id, search_key, room_price, screenshot_path, status, error_message)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `;

                // Get hotel name for search_key
                const hotelNameQuery = `SELECT hotel_name FROM hotel_data WHERE id = $1`;
                const hotelNameResult = await client.query(hotelNameQuery, [hotelId]);
                const hotelName = hotelNameResult.rows[0].hotel_name;

                const logValues = [hotelId, hotelName, newPrice, screenshotPath, 'success', null];
                await client.query(insertLogQuery, logValues);

                // Commit transaction
                await client.query('COMMIT');

                console.log(chalk.green(`✅ Harga hotel berhasil di-update dengan ID: ${hotelId}`));
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
                FROM hotel_scraping_results_log
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
                    hd.id,
                    hd.hotel_name,
                    hd.rate_harga,
                    hd.created_at,
                    hd.updated_at,
                    hsl.search_key,
                    hsl.search_timestamp,
                    hsl.screenshot_path,
                    hsl.status
                FROM hotel_data hd
                JOIN hotel_scraping_results_log hsl ON hd.id = hsl.hotel_id
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
                    hd.id,
                    hd.hotel_name,
                    hd.rate_harga,
                    hd.created_at,
                    hd.updated_at,
                    hsl.search_key,
                    hsl.search_timestamp,
                    hsl.screenshot_path,
                    hsl.status
                FROM hotel_data hd
                JOIN hotel_scraping_results_log hsl ON hd.id = hsl.hotel_id
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
                    hd.id,
                    hd.hotel_name,
                    hd.rate_harga,
                    hd.created_at,
                    hd.updated_at,
                    hsl.search_key,
                    hsl.search_timestamp,
                    hsl.screenshot_path,
                    hsl.status
                FROM hotel_data hd
                JOIN hotel_scraping_results_log hsl ON hd.id = hsl.hotel_id
                WHERE hsl.search_key ILIKE $1
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
        if (this.pool && this.isConnected) {
            try {
                await this.pool.end();
                this.isConnected = false;
                console.log(chalk.blue('🔌 Koneksi database ditutup'));
            } catch (error) {
                console.log(chalk.yellow('⚠️ Error saat menutup database:', error.message));
                this.isConnected = false;
            }
        } else {
            console.log(chalk.yellow('⚠️ Database sudah ditutup atau tidak terkoneksi'));
        }
    }

    // Method baru untuk flow scraping yang baru
    async startScrapingLog(hotelId, hotelName, searchKey) {
        // Ensure database connection before operation
        if (!(await this.ensureConnection())) {
            console.log(chalk.red('❌ Tidak bisa membuat log scraping: database tidak terkoneksi'));
            return null;
        }

        try {
            const insertQuery = `
                INSERT INTO hotel_scraping_results_log 
                (hotel_id, search_key, status, error_message)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;

            const values = [hotelId, searchKey, 'in_progress', null];
            const result = await this.pool.query(insertQuery, values);

            console.log(chalk.blue(`📝 Log scraping dimulai untuk ${hotelName} (ID: ${result.rows[0].id})`));
            return result.rows[0].id;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal membuat log scraping: ${error.message}`));
            return null;
        }
    }

    async updateScrapingLogSuccess(logId, roomPrice, screenshotPath = null) {
        // Ensure database connection before operation
        if (!(await this.ensureConnection())) {
            console.log(chalk.red('❌ Tidak bisa update log scraping: database tidak terkoneksi'));
            return false;
        }

        try {
            // Create new success log entry (selang-seling dengan in_progress)
            const insertQuery = `
                INSERT INTO hotel_scraping_results_log 
                (hotel_id, search_key, room_price, screenshot_path, status, search_timestamp)
                SELECT hotel_id, search_key, $2, $3, 'success', CURRENT_TIMESTAMP
                FROM hotel_scraping_results_log
                WHERE id = $1
                RETURNING id
            `;

            const values = [logId, roomPrice, screenshotPath];
            const result = await this.pool.query(insertQuery, values);

            if (result.rows.length > 0) {
                console.log(chalk.green(`✅ Log scraping success baru dibuat (ID: ${result.rows[0].id})`));
                return true;
            } else {
                console.log(chalk.red(`❌ Log scraping tidak ditemukan (ID: ${logId})`));
                return false;
            }
        } catch (error) {
            console.log(chalk.red(`❌ Gagal membuat log scraping success: ${error.message}`));
            return false;
        }
    }

    async updateScrapingLogStatus(logId, newStatus) {
        // Ensure database connection before operation
        if (!(await this.ensureConnection())) {
            console.log(chalk.red('❌ Tidak bisa update status log scraping: database tidak terkoneksi'));
            return false;
        }

        try {
            // Only update status for in_progress logs (not success/error)
            const updateQuery = `
                UPDATE hotel_scraping_results_log 
                SET status = $2, search_timestamp = CURRENT_TIMESTAMP
                WHERE id = $1 AND status = 'in_progress'
                RETURNING id
            `;

            const values = [logId, newStatus];
            const result = await this.pool.query(updateQuery, values);

            if (result.rows.length > 0) {
                console.log(chalk.blue(`✅ Status log scraping diupdate ke '${newStatus}' (ID: ${logId})`));
                return true;
            } else {
                console.log(chalk.yellow(`⚠️ Log scraping tidak ditemukan atau bukan in_progress (ID: ${logId})`));
                return false;
            }
        } catch (error) {
            console.log(chalk.red(`❌ Gagal update status log scraping: ${error.message}`));
            return false;
        }
    }

    async updateScrapingLogError(logId, errorMessage) {
        // Ensure database connection before operation
        if (!(await this.ensureConnection())) {
            console.log(chalk.red('❌ Tidak bisa update log scraping error: database tidak terkoneksi'));
            return false;
        }

        try {
            // Create new error log entry (selang-seling dengan in_progress)
            const insertQuery = `
                INSERT INTO hotel_scraping_results_log 
                (hotel_id, search_key, status, error_message, search_timestamp)
                SELECT hotel_id, search_key, 'error', $2, CURRENT_TIMESTAMP
                FROM hotel_scraping_results_log
                WHERE id = $1
                RETURNING id
            `;

            const values = [logId, errorMessage];
            const result = await this.pool.query(insertQuery, values);

            if (result.rows.length > 0) {
                console.log(chalk.red(`❌ Log scraping error baru dibuat (ID: ${result.rows[0].id})`));
                return true;
            } else {
                console.log(chalk.red(`❌ Log scraping tidak ditemukan (ID: ${logId})`));
                return false;
            }
        } catch (error) {
            console.log(chalk.red(`❌ Gagal membuat log scraping error: ${error.message}`));
            return false;
        }
    }

    async updateHotelDataPrice(hotelId, newPrice) {
        // Ensure database connection before operation
        if (!(await this.ensureConnection())) {
            console.log(chalk.red('❌ Tidak bisa update harga hotel: database tidak terkoneksi'));
            return false;
        }

        try {
            const updateQuery = `
                UPDATE hotel_data 
                SET rate_harga = $2, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING id
            `;

            const values = [hotelId, newPrice];
            const result = await this.pool.query(updateQuery, values);

            if (result.rows.length > 0) {
                console.log(chalk.green(`✅ Harga hotel berhasil diupdate (ID: ${hotelId})`));
                return true;
            } else {
                console.log(chalk.red(`❌ Hotel tidak ditemukan (ID: ${hotelId})`));
                return false;
            }
        } catch (error) {
            console.log(chalk.red(`❌ Gagal update harga hotel: ${error.message}`));
            return false;
        }
    }

    // Method untuk mendapatkan hotel yang belum pernah di-scrape atau perlu di-update
    async getHotelsForScraping(limit = 50) {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi'));
            return [];
        }

        try {
            const query = `
                SELECT 
                    hd.id,
                    hd.hotel_name,
                    hd.rate_harga,
                    hd.created_at,
                    hd.updated_at,
                    COALESCE(hd.hotel_name, '') as search_key
                FROM hotel_data hd
                ORDER BY hd.updated_at ASC
                LIMIT $1
            `;

            const result = await this.pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengambil data hotel untuk scraping: ${error.message}`));
            return [];
        }
    }

    async ensureConnection() {
        if (!this.isConnected || !this.pool) {
            console.log(chalk.yellow('⚠️ Database tidak terkoneksi, mencoba reconnect...'));
            return await this.connect();
        }

        // Test connection
        try {
            const client = await this.pool.connect();
            client.release();
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Database connection test failed: ${error.message}`));
            this.isConnected = false;
            return await this.connect();
        }
    }

    // Method untuk membersihkan data duplikasi (tetap mempertahankan pattern selang-seling)
    async cleanupDuplicateData() {
        if (!(await this.ensureConnection())) {
            console.log(chalk.red('❌ Tidak bisa cleanup data: database tidak terkoneksi'));
            return false;
        }

        try {
            console.log(chalk.yellow('🧹 Memulai cleanup data duplikasi...'));

            // 1. Hapus entry in_progress yang sudah lama (lebih dari 1 jam)
            const deleteOldInProgressQuery = `
                DELETE FROM hotel_scraping_results_log 
                WHERE status = 'in_progress' 
                AND search_timestamp < NOW() - INTERVAL '1 hour'
            `;
            const oldInProgressResult = await this.pool.query(deleteOldInProgressQuery);
            console.log(chalk.blue(`🗑️ Dihapus ${oldInProgressResult.rowCount} entry in_progress yang lama`));

            // 2. Hapus duplikasi yang tidak perlu (bukan pattern selang-seling yang valid)
            // Hapus entry success/error yang duplikasi dalam waktu yang sama (dalam 1 menit)
            const deleteInvalidDuplicatesQuery = `
                DELETE FROM hotel_scraping_results_log 
                WHERE id NOT IN (
                    SELECT DISTINCT ON (hotel_id, search_key, DATE_TRUNC('minute', search_timestamp)) id
                    FROM hotel_scraping_results_log
                    WHERE status IN ('success', 'error')
                    ORDER BY hotel_id, search_key, DATE_TRUNC('minute', search_timestamp), search_timestamp DESC
                )
                AND status IN ('success', 'error')
            `;
            const duplicatesResult = await this.pool.query(deleteInvalidDuplicatesQuery);
            console.log(chalk.blue(`🗑️ Dihapus ${duplicatesResult.rowCount} entry duplikasi yang tidak valid`));

            // 3. Update hotel_data dengan harga terbaru dari log yang berhasil
            const updateHotelDataQuery = `
                UPDATE hotel_data 
                SET rate_harga = latest_prices.room_price,
                    updated_at = CURRENT_TIMESTAMP
                FROM (
                    SELECT DISTINCT ON (hotel_id) 
                        hotel_id, 
                        room_price
                    FROM hotel_scraping_results_log
                    WHERE status = 'success' 
                        AND room_price IS NOT NULL
                    ORDER BY hotel_id, search_timestamp DESC
                ) latest_prices
                WHERE hotel_data.id = latest_prices.hotel_id
            `;
            const updateResult = await this.pool.query(updateHotelDataQuery);
            console.log(chalk.blue(`🔄 Diupdate ${updateResult.rowCount} harga hotel`));

            // 4. Tampilkan statistik setelah cleanup
            const statsQuery = `
                SELECT 
                    status,
                    COUNT(*) as count
                FROM hotel_scraping_results_log
                GROUP BY status
                ORDER BY status
            `;
            const statsResult = await this.pool.query(statsQuery);

            console.log(chalk.green('📊 Statistik setelah cleanup:'));
            statsResult.rows.forEach(row => {
                console.log(chalk.white(`   ${row.status}: ${row.count} entries`));
            });

            console.log(chalk.green('✅ Cleanup data duplikasi selesai (pattern selang-seling tetap dipertahankan)'));
            return true;

        } catch (error) {
            console.log(chalk.red(`❌ Gagal cleanup data duplikasi: ${error.message}`));
            return false;
        }
    }

    // Method untuk mendapatkan statistik database
    async getDatabaseStats() {
        if (!(await this.ensureConnection())) {
            console.log(chalk.red('❌ Tidak bisa ambil statistik: database tidak terkoneksi'));
            return null;
        }

        try {
            const statsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM hotel_data) as total_hotels,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log WHERE status = 'success') as successful_scrapes,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log WHERE status = 'error') as failed_scrapes,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log WHERE status = 'in_progress') as in_progress_scrapes,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log) as total_logs,
                    (SELECT MAX(search_timestamp) FROM hotel_scraping_results_log) as last_scrape_time
            `;

            const result = await this.pool.query(statsQuery);
            return result.rows[0];

        } catch (error) {
            console.log(chalk.red(`❌ Gagal ambil statistik database: ${error.message}`));
            return null;
        }
    }

    // ==================== SOCIAL MEDIA DATABASE METHODS ====================

    // Social Media Accounts Management (socmed_list)
    async getAllSocmedAccounts() {
        try {
            const query = `
                SELECT id, account_url, username, created_at
                FROM socmed_list
                ORDER BY created_at DESC
            `;
            const result = await this.pool.query(query);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Error getting all social media accounts: ${error.message}`));
            throw error;
        }
    }

    async getSocmedAccountById(id) {
        try {
            const query = `
                SELECT id, account_url, username, created_at
                FROM socmed_list
                WHERE id = $1
            `;
            const result = await this.pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media account by ID: ${error.message}`));
            throw error;
        }
    }

    async getSocmedAccountByUsername(username) {
        try {
            const query = `
                SELECT id, account_url, username, created_at
                FROM socmed_list
                WHERE username = $1
            `;
            const result = await this.pool.query(query, [username]);
            return result.rows[0] || null;
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media account by username: ${error.message}`));
            throw error;
        }
    }

    async addSocmedAccount(accountUrl, username) {
        try {
            const query = `
                INSERT INTO socmed_list (account_url, username)
                VALUES ($1, $2)
                RETURNING id, account_url, username, created_at
            `;
            const result = await this.pool.query(query, [accountUrl, username]);
            console.log(chalk.green(`✅ Social media account ${username} added successfully`));
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                console.log(chalk.red(`❌ Social media account ${username} already exists`));
            } else {
                console.log(chalk.red(`❌ Error adding social media account ${username}: ${error.message}`));
            }
            throw error;
        }
    }

    async updateSocmedAccount(id, accountUrl, username) {
        try {
            const query = `
                UPDATE socmed_list
                SET account_url = $2, username = $3
                WHERE id = $1
                RETURNING id, account_url, username, created_at
            `;
            const result = await this.pool.query(query, [id, accountUrl, username]);

            if (result.rows.length === 0) {
                throw new Error(`Social media account with ID ${id} not found`);
            }

            console.log(chalk.green(`✅ Social media account ${username} updated successfully`));
            return result.rows[0];
        } catch (error) {
            console.log(chalk.red(`❌ Error updating social media account: ${error.message}`));
            throw error;
        }
    }

    async deleteSocmedAccount(id) {
        try {
            const query = `
                DELETE FROM socmed_list
                WHERE id = $1
                RETURNING username
            `;
            const result = await this.pool.query(query, [id]);

            if (result.rows.length === 0) {
                throw new Error(`Social media account with ID ${id} not found`);
            }

            console.log(chalk.green(`✅ Social media account ${result.rows[0].username} deleted successfully`));
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Error deleting social media account: ${error.message}`));
            throw error;
        }
    }

    // Social Media Posts Management (socmed_post)
    async getSocmedPostByUrl(postUrl) {
        try {
            const query = `
                SELECT id, post_url, caption, post_date, type
                FROM socmed_post
                WHERE post_url = $1
            `;
            const result = await this.pool.query(query, [postUrl]);
            return result.rows[0] || null;
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media post by URL: ${error.message}`));
            throw error;
        }
    }

    async upsertSocmedPost(postUrl, caption, postDate, type = 'post') {
        try {
            const query = `
                INSERT INTO socmed_post (post_url, caption, post_date, type)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (post_url) 
                DO UPDATE SET 
                    caption = EXCLUDED.caption,
                    post_date = EXCLUDED.post_date,
                    type = EXCLUDED.type
                RETURNING id, post_url, caption, post_date, type
            `;
            const result = await this.pool.query(query, [postUrl, caption, postDate, type]);
            return result.rows[0];
        } catch (error) {
            console.log(chalk.red(`❌ Error upserting social media post: ${error.message}`));
            throw error;
        }
    }

    async getSocmedPostsByAccount(accountId, limit = 100, offset = 0) {
        try {
            const query = `
                SELECT p.id, p.post_url, p.caption, p.post_date, p.type
                FROM socmed_post p
                JOIN socmed_scraping_log s ON p.post_url = s.url_post
                WHERE s.account_id = $1
                ORDER BY p.post_date DESC, s.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            const result = await this.pool.query(query, [accountId, limit, offset]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media posts by account: ${error.message}`));
            throw error;
        }
    }

    async getRecentSocmedPosts(limit = 50) {
        try {
            const query = `
                SELECT p.id, p.post_url, p.caption, p.post_date, p.type,
                       s.account_id, sl.username
                FROM socmed_post p
                JOIN socmed_scraping_log s ON p.post_url = s.url_post
                JOIN socmed_list sl ON s.account_id = sl.id
                ORDER BY p.post_date DESC, s.created_at DESC
                LIMIT $1
            `;
            const result = await this.pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Error getting recent social media posts: ${error.message}`));
            throw error;
        }
    }

    async getSocmedPostsCount() {
        try {
            const query = 'SELECT COUNT(*) as total FROM socmed_post';
            const result = await this.pool.query(query);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media posts count: ${error.message}`));
            throw error;
        }
    }

    async getSocmedAccountsCount() {
        try {
            const query = 'SELECT COUNT(*) as total FROM socmed_list';
            const result = await this.pool.query(query);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media accounts count: ${error.message}`));
            throw error;
        }
    }

    // Social Media Scraping Log Management (socmed_scraping_log)
    async addSocmedScrapingLog(accountId, urlPost, caption, status = 'success', errorMessage = null) {
        try {
            const query = `
                INSERT INTO socmed_scraping_log (account_id, url_post, caption, status, error_message)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, account_id, url_post, caption, status, error_message, created_at
            `;
            const result = await this.pool.query(query, [accountId, urlPost, caption, status, errorMessage]);
            return result.rows[0];
        } catch (error) {
            console.log(chalk.red(`❌ Error adding social media scraping log: ${error.message}`));
            throw error;
        }
    }

    async getSocmedScrapingLogs(accountId = null, limit = 100, offset = 0) {
        try {
            let query = `
                SELECT s.id, s.account_id, s.url_post, s.caption, s.status, s.error_message, s.created_at,
                       sl.username, sl.account_url
                FROM socmed_scraping_log s
                JOIN socmed_list sl ON s.account_id = sl.id
            `;
            const params = [];

            if (accountId) {
                query += ' WHERE s.account_id = $1';
                params.push(accountId);
            }

            query += ' ORDER BY s.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(limit, offset);

            const result = await this.pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media scraping logs: ${error.message}`));
            throw error;
        }
    }

    async getSocmedScrapingStats() {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT sl.id) as total_accounts,
                    COUNT(s.id) as total_scraping_logs,
                    COUNT(CASE WHEN s.status = 'success' THEN 1 END) as successful_scrapes,
                    COUNT(CASE WHEN s.status = 'error' THEN 1 END) as failed_scrapes,
                    COUNT(CASE WHEN s.status = 'in_progress' THEN 1 END) as in_progress_scrapes,
                    MAX(s.created_at) as last_scraping_time
                FROM socmed_list sl
                LEFT JOIN socmed_scraping_log s ON sl.id = s.account_id
            `;
            const result = await this.pool.query(query);
            return result.rows[0];
        } catch (error) {
            console.log(chalk.red(`❌ Error getting social media scraping stats: ${error.message}`));
            throw error;
        }
    }

    // Combined Statistics (Hotel + Social Media)
    async getCombinedDatabaseStats() {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM hotel_data) as total_hotels,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log WHERE status = 'success') as successful_hotel_scrapes,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log WHERE status = 'error') as failed_hotel_scrapes,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log WHERE status = 'in_progress') as in_progress_hotel_scrapes,
                    (SELECT COUNT(*) FROM hotel_scraping_results_log) as total_hotel_logs,
                    (SELECT COUNT(*) FROM socmed_list) as total_socmed_accounts,
                    (SELECT COUNT(*) FROM socmed_post) as total_socmed_posts,
                    (SELECT COUNT(*) FROM socmed_scraping_log) as total_socmed_logs,
                    (SELECT MAX(search_timestamp) FROM hotel_scraping_results_log) as last_hotel_scrape_time,
                    (SELECT MAX(created_at) FROM socmed_scraping_log) as last_socmed_scrape_time
            `;
            const result = await this.pool.query(query);
            return result.rows[0];
        } catch (error) {
            console.log(chalk.red(`❌ Error getting combined database stats: ${error.message}`));
            throw error;
        }
    }
}

module.exports = DatabaseManager;
