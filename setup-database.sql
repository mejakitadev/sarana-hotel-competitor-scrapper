-- Setup Database PostgreSQL untuk Traveloka Hotel Scraper
-- Jalankan file ini di PostgreSQL untuk membuat database dan tabel

-- 1. Buat database (jalankan sebagai superuser)
-- CREATE DATABASE traveloka_scraper;

-- 2. Connect ke database traveloka_scraper
-- \c traveloka_scraper;

-- 3. Buat tabel untuk menyimpan hasil scraping
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

-- 4. Buat index untuk performa query
CREATE INDEX IF NOT EXISTS idx_search_key ON hotel_scraping_results(search_key);
CREATE INDEX IF NOT EXISTS idx_hotel_name ON hotel_scraping_results(hotel_name);
CREATE INDEX IF NOT EXISTS idx_search_timestamp ON hotel_scraping_results(search_timestamp);
CREATE INDEX IF NOT EXISTS idx_status ON hotel_scraping_results(status);

-- 5. Buat tabel tambahan untuk tracking kota (opsional)
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL UNIQUE,
    province VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Indonesia',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Insert beberapa kota populer
INSERT INTO cities (city_name, province) VALUES 
    ('Jakarta', 'DKI Jakarta'),
    ('Surabaya', 'Jawa Timur'),
    ('Bandung', 'Jawa Barat'),
    ('Semarang', 'Jawa Tengah'),
    ('Yogyakarta', 'DI Yogyakarta'),
    ('Malang', 'Jawa Timur'),
    ('Batu', 'Jawa Timur'),
    ('Bali', 'Bali'),
    ('Medan', 'Sumatera Utara'),
    ('Palembang', 'Sumatera Selatan')
ON CONFLICT (city_name) DO NOTHING;

-- 7. Buat view untuk statistik
CREATE OR REPLACE VIEW scraping_stats AS
SELECT 
    COUNT(*) as total_searches,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_searches,
    COUNT(CASE WHEN status != 'success' THEN 1 END) as failed_searches,
    AVG(room_price) as average_price,
    MIN(search_timestamp) as first_search,
    MAX(search_timestamp) as last_search,
    COUNT(DISTINCT search_key) as unique_searches,
    COUNT(DISTINCT hotel_name) as unique_hotels
FROM hotel_scraping_results;

-- 8. Buat view untuk history per hotel
CREATE OR REPLACE VIEW hotel_price_history AS
SELECT 
    hotel_name,
    search_key,
    room_price,
    search_timestamp,
    status,
    screenshot_path
FROM hotel_scraping_results
ORDER BY hotel_name, search_timestamp DESC;

-- 9. Buat function untuk cleanup data lama (opsional)
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

-- 10. Buat trigger untuk update timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hotel_scraping_results_modtime
    BEFORE UPDATE ON hotel_scraping_results
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 11. Grant permissions (sesuaikan dengan user database Anda)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;

-- 12. Buat tabel baru hotel_data dengan foreign key ke hotel_scraping_results
CREATE TABLE IF NOT EXISTS hotel_data (
    hotel_id SERIAL PRIMARY KEY,
    hotel_name VARCHAR(255) NOT NULL,
    rate_harga DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint ke hotel_scraping_results
    CONSTRAINT fk_hotel_id
        FOREIGN KEY (hotel_id) 
        REFERENCES hotel_scraping_results(id) 
        ON DELETE CASCADE
);

-- 13. Buat index untuk tabel hotel_data
CREATE INDEX IF NOT EXISTS idx_hotel_data_scraping_id ON hotel_data(hotel_scraping_id);
CREATE INDEX IF NOT EXISTS idx_hotel_data_name ON hotel_data(hotel_name);
CREATE INDEX IF NOT EXISTS idx_hotel_data_created_at ON hotel_data(created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_data_updated_at ON hotel_data(updated_at);

-- 14. Buat trigger untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_hotel_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hotel_data_modtime
    BEFORE UPDATE ON hotel_data
    FOR EACH ROW
    EXECUTE FUNCTION update_hotel_data_updated_at();

-- 15. Buat view untuk data hotel yang terintegrasi
CREATE OR REPLACE VIEW hotel_data_integrated AS
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
JOIN hotel_scraping_results hsr ON hd.hotel_scraping_id = hsr.id
ORDER BY hd.updated_at DESC;

-- 16. Verifikasi setup
SELECT 'Database setup completed successfully!' as status;

-- 17. Test query
SELECT COUNT(*) as total_records FROM hotel_scraping_results;
SELECT COUNT(*) as total_hotel_data FROM hotel_data;
SELECT * FROM scraping_stats;
