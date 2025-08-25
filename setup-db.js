const { Client } = require('pg');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

class DatabaseSetup {
    constructor() {
        this.config = {
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        };
    }

    async setup() {
        console.log(chalk.blue('🚀 SETUP DATABASE POSTGRESQL'));
        console.log(chalk.blue('='.repeat(50)));

        try {
            // Step 1: Connect to default database
            console.log(chalk.yellow('🔌 Connecting to PostgreSQL...'));
            const client = new Client(this.config);
            await client.connect();
            console.log(chalk.green('✅ Connected to PostgreSQL'));

            // Step 2: Check if database exists
            console.log(chalk.yellow('\n🔍 Checking if database exists...'));
            const dbExists = await this.checkDatabaseExists(client, this.config.database);

            if (!dbExists) {
                console.log(chalk.yellow('📝 Database tidak ditemukan, akan dibuat...'));
                await this.createDatabase(client);
            } else {
                console.log(chalk.green(`✅ Database ${this.config.database} sudah ada`));
            }

            // Step 3: Connect to target database
            await client.end();

            const scraperConfig = {
                ...this.config,
                database: this.config.database
            };

            const scraperClient = new Client(scraperConfig);
            await scraperClient.connect();
            console.log(chalk.green(`✅ Connected to ${this.config.database} database`));

            // Step 4: Create tables
            console.log(chalk.yellow('\n📋 Creating tables...'));
            await this.createTables(scraperClient);

            // Step 5: Insert sample data
            console.log(chalk.yellow('\n📝 Inserting sample data...'));
            await this.insertSampleData(scraperClient);

            // Step 6: Create views and functions
            console.log(chalk.yellow('\n🔧 Creating views and functions...'));
            await this.createViewsAndFunctions(scraperClient);

            await scraperClient.end();

            console.log(chalk.green('\n🎉 Database setup completed successfully!'));
            console.log(chalk.blue('\n📊 Database Info:'));
            console.log(chalk.white(`   Name: ${this.config.database}`));
            console.log(chalk.white(`   Host: ${this.config.host}:${this.config.port}`));
            console.log(chalk.white(`   User: ${this.config.user}`));
            console.log(chalk.blue('\n🚀 Next steps:'));
            console.log(chalk.white('   1. Test connection: node test-database.js'));
            console.log(chalk.white('   2. Run scraper: npm start'));

        } catch (error) {
            console.log(chalk.red(`❌ Setup failed: ${error.message}`));
            console.log(chalk.red(`Stack trace: ${error.stack}`));

            if (error.code === 'ECONNREFUSED') {
                console.log(chalk.yellow('\n💡 Troubleshooting:'));
                console.log(chalk.white('   1. Pastikan PostgreSQL sudah running'));
                console.log(chalk.white('   2. Cek port 5432 tidak diblokir'));
                console.log(chalk.white('   3. Cek kredensial database'));
            }
        }
    }

    async checkDatabaseExists(client, dbName) {
        const result = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );
        return result.rows.length > 0;
    }

    async createDatabase(client) {
        try {
            await client.query(`CREATE DATABASE ${this.config.database}`);
            console.log(chalk.green(`✅ Database ${this.config.database} created`));
        } catch (error) {
            if (error.code === '42501') {
                console.log(chalk.red('❌ Permission denied. Run as superuser or grant CREATE privileges'));
                throw error;
            }
            throw error;
        }
    }

    async createTables(client) {
        // Create hotel_data table first (parent table)
        const createHotelDataTableSQL = `
            CREATE TABLE IF NOT EXISTS hotel_data (
                id SERIAL PRIMARY KEY,
                hotel_name VARCHAR(255) NOT NULL,
                rate_harga DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await client.query(createHotelDataTableSQL);
        console.log(chalk.green('✅ Table hotel_data created'));

        // Create hotel_scraping_results_log table (child table with foreign key)
        const createScrapingLogTableSQL = `
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
        `;

        await client.query(createScrapingLogTableSQL);
        console.log(chalk.green('✅ Table hotel_scraping_results_log created'));

        // Create indexes for hotel_data table
        const hotelDataIndexSQL = `
            CREATE INDEX IF NOT EXISTS idx_hotel_data_name ON hotel_data(hotel_name);
            CREATE INDEX IF NOT EXISTS idx_hotel_data_created_at ON hotel_data(created_at);
            CREATE INDEX IF NOT EXISTS idx_hotel_data_updated_at ON hotel_data(updated_at);
        `;

        await client.query(hotelDataIndexSQL);
        console.log(chalk.green('✅ Indexes for hotel_data created'));

        // Create indexes for hotel_scraping_results_log table
        const scrapingLogIndexSQL = `
            CREATE INDEX IF NOT EXISTS idx_scraping_log_hotel_id ON hotel_scraping_results_log(hotel_id);
            CREATE INDEX IF NOT EXISTS idx_scraping_log_search_key ON hotel_scraping_results_log(search_key);
            CREATE INDEX IF NOT EXISTS idx_scraping_log_search_timestamp ON hotel_scraping_results_log(search_timestamp);
            CREATE INDEX IF NOT EXISTS idx_scraping_log_status ON hotel_scraping_results_log(status);
        `;

        await client.query(scrapingLogIndexSQL);
        console.log(chalk.green('✅ Indexes for hotel_scraping_results_log created'));
    }

    async insertSampleData(client) {
        // Tidak ada sample data yang diinsert
        console.log(chalk.blue('ℹ️ Tidak ada sample data yang diinsert'));
        console.log(chalk.blue('ℹ️ Data akan diisi saat scraping berjalan'));
    }

    async createViewsAndFunctions(client) {


        // Create cleanup function
        const cleanupFunctionSQL = `
            CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 30)
            RETURNS INTEGER AS $$
            DECLARE
                deleted_count INTEGER;
            BEGIN
                DELETE FROM hotel_scraping_results 
                WHERE search_timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
                
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RETURN deleted_count;
            END;
            $$ LANGUAGE plpgsql;
        `;

        await client.query(cleanupFunctionSQL);
        console.log(chalk.green('✅ Function cleanup_old_data created'));

        // Create update hotel_data timestamp function
        const updateHotelDataTimestampFunctionSQL = `
            CREATE OR REPLACE FUNCTION update_hotel_data_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `;

        await client.query(updateHotelDataTimestampFunctionSQL);
        console.log(chalk.green('✅ Function update_hotel_data_updated_at created'));

        // Create trigger for hotel_data table
        const createHotelDataTriggerSQL = `
            CREATE TRIGGER update_hotel_data_modtime
                BEFORE UPDATE ON hotel_data
                FOR EACH ROW
                EXECUTE FUNCTION update_hotel_data_updated_at();
        `;

        try {
            await client.query(createHotelDataTriggerSQL);
            console.log(chalk.green('✅ Trigger update_hotel_data_modtime created'));
        } catch (error) {
            if (error.code === '42710') { // Trigger already exists
                console.log(chalk.yellow('⚠️ Trigger update_hotel_data_modtime already exists'));
            } else {
                throw error;
            }
        }
    }
}

// Jalankan setup jika file ini dijalankan langsung
if (require.main === module) {
    const setup = new DatabaseSetup();
    setup.setup().then(() => {
        console.log(chalk.blue('\n👋 Setup completed!'));
        process.exit(0);
    }).catch((error) => {
        console.log(chalk.red(`\n💥 Setup failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = DatabaseSetup;
