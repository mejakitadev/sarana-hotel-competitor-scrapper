-- Setup Database PostgreSQL untuk Traveloka Hotel Scraper - Cron Job System
-- Jalankan file ini di PostgreSQL untuk membuat database dan tabel

-- 1. Buat database (jalankan sebagai superuser)
-- CREATE DATABASE traveloka_scraper;

-- 2. Connect ke database traveloka_scraper
-- \c traveloka_scraper;

-- 3. Buat tabel utama untuk menyimpan log pencarian hotel
CREATE TABLE IF NOT EXISTS search_hotel_log (
    id SERIAL PRIMARY KEY,
    search_key VARCHAR(255) NOT NULL,
    search_result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Buat index untuk optimasi query
CREATE INDEX IF NOT EXISTS idx_search_hotel_log_search_key ON search_hotel_log(search_key);
CREATE INDEX IF NOT EXISTS idx_search_hotel_log_created_at ON search_hotel_log(created_at);
CREATE INDEX IF NOT EXISTS idx_search_hotel_log_hotel_name ON search_hotel_log USING GIN ((search_result->>'hotel_name'));
CREATE INDEX IF NOT EXISTS idx_search_hotel_log_city ON search_hotel_log USING GIN ((search_result->>'city'));

-- 5. Buat view untuk memudahkan query data hotel
CREATE OR REPLACE VIEW hotel_search_results AS
SELECT 
    id,
    search_key,
    search_result->>'hotel_name' as hotel_name,
    search_result->>'city' as city,
    search_result->>'room_price' as room_price,
    search_result->>'location' as location,
    search_result->>'rating' as rating,
    search_result->>'room_name' as room_name,
    search_result->>'amenities' as amenities,
    search_result->>'search_query' as search_query,
    search_result->>'scraped_at' as scraped_at,
    created_at
FROM search_hotel_log;

-- 6. Buat tabel untuk tracking perubahan harga (opsional)
CREATE TABLE IF NOT EXISTS price_change_log (
    id SERIAL PRIMARY KEY,
    hotel_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    old_price TEXT,
    new_price TEXT,
    price_change_percent DECIMAL(5,2),
    change_type VARCHAR(20), -- 'increase', 'decrease', 'stable'
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Buat index untuk price_change_log
CREATE INDEX IF NOT EXISTS idx_price_change_log_hotel ON price_change_log(hotel_name, city);
CREATE INDEX IF NOT EXISTS idx_price_change_log_recorded_at ON price_change_log(recorded_at);

-- 8. Insert sample data untuk testing (opsional)
-- INSERT INTO search_hotel_log (search_key, search_result) VALUES (
--     'Hotel Indonesia Kempinski Jakarta',
--     '{"hotel_name": "Hotel Indonesia Kempinski Jakarta", "city": "Jakarta", "room_price": "Rp 2,500,000", "location": "Jl. M.H. Thamrin No.1", "rating": "4.8", "room_name": "Deluxe Room", "amenities": ["WiFi", "Pool", "Spa"], "search_query": "Hotel Indonesia Kempinski Jakarta", "scraped_at": "2024-01-01T10:00:00Z"}'
-- );

-- 9. Tampilkan struktur tabel
\d search_hotel_log;
\d price_change_log;
\d hotel_search_results;

-- 10. Test query
SELECT 
    search_key,
    search_result->>'hotel_name' as hotel_name,
    search_result->>'room_price' as price,
    created_at
FROM search_hotel_log 
ORDER BY created_at DESC 
LIMIT 5;
