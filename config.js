// Konfigurasi Database PostgreSQL
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dev_zuri_assistant_ai',
    password: process.env.DB_PASSWORD || 'Evan5758',
    port: process.env.DB_PORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Konfigurasi aplikasi
const appConfig = {
    screenshotDir: './screenshots',
    maxRetries: 3,
    searchTimeout: 60000,
    priceUpdateInterval: 3 * 60 * 60 * 1000, // 3 jam dalam milidetik
};

module.exports = {
    dbConfig,
    appConfig
};
