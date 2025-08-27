// Konfigurasi Database PostgreSQL
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
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
