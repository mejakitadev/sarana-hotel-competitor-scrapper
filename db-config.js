// Konfigurasi Database PostgreSQL
// Ubah nilai sesuai dengan setup PostgreSQL Anda

// Load environment variables from .env file
require('dotenv').config();

const dbConfig = {
    // Kredensial Database
    user: 'postgres',                    // Username PostgreSQL
    host: 'localhost',                   // Host database (localhost untuk local)
    database: 'dev_zuri_assistant_ai',       // Nama database
    password: 'Evan5758',                // Password PostgreSQL - GANTI INI!
    port: 5432,                          // Port PostgreSQL (default: 5432)

    // Konfigurasi Connection Pool
    max: 20,                             // Maksimal koneksi dalam pool
    idleTimeoutMillis: 30000,            // Timeout untuk koneksi idle (30 detik)
    connectionTimeoutMillis: 2000,       // Timeout untuk koneksi baru (2 detik)

    // SSL (untuk production)
    ssl: false,                          // Set true jika menggunakan SSL

    // Retry Configuration
    maxRetries: 3,                       // Maksimal retry untuk koneksi
    retryDelay: 1000,                    // Delay antar retry (1 detik)
};

// Konfigurasi Environment Variables
// Buat file .env di root project dengan format:
/*
DB_USER=postgres
DB_HOST=localhost
DB_NAME=dev_zuri_assistant_ai
DB_PASSWORD=your_actual_password
DB_PORT=5432
*/

// Helper function untuk mendapatkan konfigurasi
function getDbConfig() {
    return {
        user: process.env.DB_USER || dbConfig.user,
        host: process.env.DB_HOST || dbConfig.host,
        database: process.env.DB_NAME || dbConfig.database,
        password: process.env.DB_PASSWORD || dbConfig.password,
        port: parseInt(process.env.DB_PORT) || dbConfig.port,
        max: dbConfig.max,
        idleTimeoutMillis: dbConfig.idleTimeoutMillis,
        connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
        ssl: dbConfig.ssl,
    };
}

// Helper function untuk test koneksi
function getTestConfig() {
    return {
        ...getDbConfig(),
        database: 'postgres' // Connect ke default database untuk test
    };
}

module.exports = {
    dbConfig,
    getDbConfig,
    getTestConfig
};
