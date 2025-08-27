const chalk = require('chalk');
const readline = require('readline');
const DatabaseManager = require('../utils/database');
const { hotelList, getUniqueCities } = require('./hotel-list');

class HotelMonitor {
    constructor() {
        this.db = new DatabaseManager();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log(chalk.blue('📊 HOTEL SCRAPING MONITOR'));
        console.log(chalk.blue('=================================================='));
        console.log(chalk.blue('💡 Monitor status scraping dan data hotel yang sudah di-scrape'));
        console.log(chalk.blue('==================================================\n'));

        await this.showMainMenu();
    }

    async showMainMenu() {
        console.log(chalk.yellow('📋 MENU MONITORING:'));
        console.log(chalk.white('1. Status scraping hari ini'));
        console.log(chalk.white('2. Data hotel terbaru'));
        console.log(chalk.white('3. Analisis harga per kota'));
        console.log(chalk.white('4. Trend harga hotel tertentu'));
        console.log(chalk.white('5. Statistik scraping'));
        console.log(chalk.white('6. Export data ke CSV'));
        console.log(chalk.white('7. Kembali ke menu utama'));

        const choice = await this.question(chalk.cyan('\nPilih menu (1-7): '));

        switch (choice) {
            case '1':
                await this.showTodayStatus();
                break;
            case '2':
                await this.showLatestData();
                break;
            case '3':
                await this.showPriceAnalysis();
                break;
            case '4':
                await this.showPriceTrend();
                break;
            case '5':
                await this.showScrapingStats();
                break;
            case '6':
                await this.exportDataToCSV();
                break;
            case '7':
                console.log(chalk.green('👋 Kembali ke menu utama...'));
                this.rl.close();
                return;
            default:
                console.log(chalk.red('❌ Pilihan tidak valid!'));
                await this.showMainMenu();
        }
    }

    async showTodayStatus() {
        console.log(chalk.blue('\n📊 STATUS SCRAPING HARI INI'));
        console.log(chalk.blue('='.repeat(50)));

        try {
            await this.db.connect();

            const today = new Date().toISOString().split('T')[0];
            const query = `
                SELECT 
                    COUNT(*) as total_scrapes,
                    COUNT(CASE WHEN search_result->>'room_price' IS NOT NULL AND search_result->>'room_price' != 'Harga tidak tersedia' THEN 1 END) as successful_scrapes,
                    COUNT(CASE WHEN search_result->>'room_price' IS NULL OR search_result->>'room_price' = 'Harga tidak tersedia' THEN 1 END) as failed_scrapes,
                    MIN(created_at) as first_scrape,
                    MAX(created_at) as last_scrape
                FROM search_hotel_log 
                WHERE DATE(created_at) = $1
            `;

            const result = await this.db.query(query, [today]);
            const stats = result.rows[0];

            if (stats.total_scrapes > 0) {
                const successRate = ((stats.successful_scrapes / stats.total_scrapes) * 100).toFixed(1);

                console.log(chalk.cyan(`📅 Tanggal: ${today}`));
                console.log(chalk.blue(`🔄 Total Scraping: ${stats.total_scrapes}`));
                console.log(chalk.green(`✅ Berhasil: ${stats.successful_scrapes}`));
                console.log(chalk.red(`❌ Gagal: ${stats.failed_scrapes}`));
                console.log(chalk.blue(`📊 Success Rate: ${successRate}%`));
                console.log(chalk.yellow(`⏰ Pertama: ${stats.first_scrape ? new Date(stats.first_scrape).toLocaleTimeString('id-ID') : 'N/A'}`));
                console.log(chalk.yellow(`⏰ Terakhir: ${stats.last_scrape ? new Date(stats.last_scrape).toLocaleTimeString('id-ID') : 'N/A'}`));

                // Status per kota
                await this.showCityStatus(today);
            } else {
                console.log(chalk.yellow('📭 Belum ada scraping hari ini'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat mengambil status:'), error.message);
        }

        await this.continueToMenu();
    }

    async showCityStatus(date) {
        console.log(chalk.blue('\n🏙️  STATUS PER KOTA:'));
        console.log(chalk.blue('='.repeat(30)));

        try {
            const query = `
                SELECT 
                    search_result->>'city' as city,
                    COUNT(*) as total,
                    COUNT(CASE WHEN search_result->>'room_price' IS NOT NULL AND search_result->>'room_price' != 'Harga tidak tersedia' THEN 1 END) as successful
                FROM search_hotel_log 
                WHERE DATE(created_at) = $1
                GROUP BY search_result->>'city'
                ORDER BY search_result->>'city'
            `;

            const result = await this.db.query(query, [date]);

            result.rows.forEach(row => {
                const successRate = ((row.successful / row.total) * 100).toFixed(1);
                const statusColor = successRate >= 80 ? chalk.green : successRate >= 60 ? chalk.yellow : chalk.red;

                console.log(chalk.cyan(`\n${row.city}:`));
                console.log(chalk.white(`   Total: ${row.total} hotel`));
                console.log(chalk.white(`   Berhasil: ${row.successful} hotel`));
                console.log(statusColor(`   Success Rate: ${successRate}%`));
            });

        } catch (error) {
            console.error(chalk.red('❌ Error saat mengambil status kota:'), error.message);
        }
    }

    async showLatestData() {
        console.log(chalk.blue('\n📋 DATA HOTEL TERBARU'));
        console.log(chalk.blue('='.repeat(50)));

        try {
            await this.db.connect();

            const query = `
                SELECT 
                    search_result->>'hotel_name' as hotel_name,
                    search_result->>'city' as city,
                    search_result->>'room_price' as room_price,
                    search_result->>'location' as location,
                    search_result->>'rating' as rating,
                    search_result->>'room_name' as room_name,
                    created_at
                FROM search_hotel_log 
                WHERE search_result->>'room_price' IS NOT NULL AND search_result->>'room_price' != 'Harga tidak tersedia'
                ORDER BY created_at DESC
                LIMIT 20
            `;

            const result = await this.db.query(query);

            if (result.rows.length > 0) {
                console.log(chalk.cyan(`📊 Menampilkan ${result.rows.length} data terbaru:\n`));

                result.rows.forEach((row, index) => {
                    const timeAgo = this.getTimeAgo(new Date(row.created_at));
                    console.log(chalk.white(`${index + 1}. ${row.hotel_name}`));
                    console.log(chalk.gray(`   🏙️  Kota: ${row.city}`));
                    console.log(chalk.green(`   💰 Harga: ${row.room_price}`));
                    if (row.room_name) console.log(chalk.blue(`   🏠 Kamar: ${row.room_name}`));
                    if (row.location) console.log(chalk.blue(`   📍 Lokasi: ${row.location}`));
                    if (row.rating) console.log(chalk.yellow(`   ⭐ Rating: ${row.rating}`));
                    console.log(chalk.gray(`   ⏰ ${timeAgo}`));
                    console.log('');
                });
            } else {
                console.log(chalk.yellow('📭 Belum ada data hotel yang berhasil di-scrape'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat mengambil data:'), error.message);
        }

        await this.continueToMenu();
    }

    async showPriceAnalysis() {
        console.log(chalk.blue('\n💰 ANALISIS HARGA PER KOTA'));
        console.log(chalk.blue('='.repeat(50)));

        try {
            await this.db.connect();

            const cities = getUniqueCities();

            for (const city of cities) {
                console.log(chalk.cyan(`\n🏙️  ${city}:`));
                console.log(chalk.blue('='.repeat(30)));

                const query = `
                    SELECT 
                        search_result->>'hotel_name' as hotel_name,
                        search_result->>'room_price' as room_price,
                        search_result->>'room_name' as room_name,
                        created_at
                    FROM search_hotel_log 
                    WHERE search_result->>'city' = $1 
                    AND search_result->>'room_price' IS NOT NULL 
                    AND search_result->>'room_price' != 'Harga tidak tersedia'
                    AND created_at >= NOW() - INTERVAL '24 hours'
                    ORDER BY created_at DESC
                `;

                const result = await this.db.query(query, [city]);

                if (result.rows.length > 0) {
                    // Analisis harga
                    const prices = result.rows.map(row => this.extractPrice(row.room_price)).filter(price => price > 0);

                    if (prices.length > 0) {
                        const minPrice = Math.min(...prices);
                        const maxPrice = Math.max(...prices);
                        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

                        console.log(chalk.green(`🏆 Termurah: Rp ${minPrice.toLocaleString('id-ID')}`));
                        console.log(chalk.red(`💸 Termahal: Rp ${maxPrice.toLocaleString('id-ID')}`));
                        console.log(chalk.blue(`📊 Rata-rata: Rp ${avgPrice.toLocaleString('id-ID')}`));
                        console.log(chalk.white(`📈 Total data: ${prices.length} hotel`));

                        // Tampilkan hotel dengan harga terendah dan tertinggi
                        const cheapestHotel = result.rows.find(row => this.extractPrice(row.room_price) === minPrice);
                        const mostExpensiveHotel = result.rows.find(row => this.extractPrice(row.room_price) === maxPrice);

                        console.log(chalk.green(`\n🏆 Hotel Termurah: ${cheapestHotel.hotel_name}`));
                        console.log(chalk.red(`💸 Hotel Termahal: ${mostExpensiveHotel.hotel_name}`));
                    }
                } else {
                    console.log(chalk.yellow('📭 Tidak ada data harga dalam 24 jam terakhir'));
                }
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat analisis harga:'), error.message);
        }

        await this.continueToMenu();
    }

    async showPriceTrend() {
        console.log(chalk.blue('\n📈 TREND HARGA HOTEL'));
        console.log(chalk.blue('='.repeat(40)));

        try {
            await this.db.connect();

            // Pilih hotel
            const { hotelList } = require('./hotel-list');

            if (hotelList.length === 0) {
                console.log(chalk.yellow('📭 Belum ada hotel yang dikonfigurasi'));
                await this.continueToMenu();
                return;
            }

            console.log(chalk.cyan('Pilih hotel untuk melihat trend harga:'));
            hotelList.forEach((hotel, index) => {
                console.log(chalk.white(`${index + 1}. ${hotel.name} (${hotel.city})`));
            });

            const choice = await this.question(chalk.cyan(`\nPilih nomor (1-${hotelList.length}): `));
            const hotelIndex = parseInt(choice) - 1;

            if (hotelIndex < 0 || hotelIndex >= hotelList.length) {
                console.log(chalk.red('❌ Nomor hotel tidak valid!'));
                await this.continueToMenu();
                return;
            }

            const selectedHotel = hotelList[hotelIndex];
            console.log(chalk.blue(`\n📈 Trend harga: ${selectedHotel.name}`));

            // Ambil data trend 7 hari terakhir
            const query = `
                SELECT 
                    DATE(created_at) as date,
                    search_result->>'room_price' as room_price,
                    search_result->>'room_name' as room_name,
                    created_at
                FROM search_hotel_log 
                WHERE search_result->>'hotel_name' = $1 
                AND search_result->>'room_price' IS NOT NULL 
                AND search_result->>'room_price' != 'Harga tidak tersedia'
                AND created_at >= NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
            `;

            const result = await this.db.query(query, [selectedHotel.name]);

            if (result.rows.length > 0) {
                console.log(chalk.cyan('\n📊 Data 7 hari terakhir:'));
                console.log(chalk.blue('='.repeat(50)));

                // Group by date
                const dailyData = {};
                result.rows.forEach(row => {
                    const date = row.date;
                    if (!dailyData[date]) {
                        dailyData[date] = [];
                    }
                    dailyData[date].push(row);
                });

                Object.keys(dailyData).sort().forEach(date => {
                    const prices = dailyData[date].map(row => this.extractPrice(row.room_price)).filter(price => price > 0);

                    if (prices.length > 0) {
                        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                        const dateObj = new Date(date);
                        const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });

                        console.log(chalk.white(`${dayName} (${date}): Rp ${avgPrice.toLocaleString('id-ID')}`));
                    }
                });

                // Analisis trend
                const allPrices = result.rows.map(row => this.extractPrice(row.room_price)).filter(price => price > 0);
                if (allPrices.length >= 2) {
                    const firstPrice = allPrices[allPrices.length - 1];
                    const lastPrice = allPrices[0];
                    const change = lastPrice - firstPrice;
                    const changePercent = ((change / firstPrice) * 100).toFixed(1);

                    console.log(chalk.blue('\n📈 Analisis Trend:'));
                    if (change > 0) {
                        console.log(chalk.red(`   Harga naik: +Rp ${change.toLocaleString('id-ID')} (+${changePercent}%)`));
                    } else if (change < 0) {
                        console.log(chalk.green(`   Harga turun: -Rp ${Math.abs(change).toLocaleString('id-ID')} (${changePercent}%)`));
                    } else {
                        console.log(chalk.blue('   Harga stabil'));
                    }
                }
            } else {
                console.log(chalk.yellow('📭 Tidak ada data trend untuk hotel ini'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat analisis trend:'), error.message);
        }

        await this.continueToMenu();
    }

    async showScrapingStats() {
        console.log(chalk.blue('\n📊 STATISTIK SCRAPING'));
        console.log(chalk.blue('='.repeat(40)));

        try {
            await this.db.connect();

            // Statistik 30 hari terakhir
            const query = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_scrapes,
                    COUNT(CASE WHEN search_result->>'room_price' IS NOT NULL AND search_result->>'room_price' != 'Harga tidak tersedia' THEN 1 END) as successful_scrapes
                FROM search_hotel_log 
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `;

            const result = await this.db.query(query);

            if (result.rows.length > 0) {
                console.log(chalk.cyan('📈 Statistik 30 hari terakhir:'));
                console.log(chalk.blue('='.repeat(50)));

                let totalScrapes = 0;
                let totalSuccessful = 0;

                result.rows.forEach(row => {
                    const successRate = ((row.successful_scrapes / row.total_scrapes) * 100).toFixed(1);
                    const dateObj = new Date(row.date);
                    const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });

                    console.log(chalk.white(`${dayName} (${row.date}): ${row.successful_scrapes}/${row.total_scrapes} (${successRate}%)`));

                    totalScrapes += row.total_scrapes;
                    totalSuccessful += row.successful_scrapes;
                });

                const overallSuccessRate = ((totalSuccessful / totalScrapes) * 100).toFixed(1);
                console.log(chalk.blue('\n📊 TOTAL 30 HARI:'));
                console.log(chalk.white(`   Total Scraping: ${totalScrapes}`));
                console.log(chalk.green(`   Berhasil: ${totalSuccessful}`));
                console.log(chalk.blue(`   Success Rate: ${overallSuccessRate}%`));
                console.log(chalk.yellow(`   Rata-rata per hari: ${(totalScrapes / 30).toFixed(1)}`));
            } else {
                console.log(chalk.yellow('📭 Tidak ada data statistik dalam 30 hari terakhir'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat mengambil statistik:'), error.message);
        }

        await this.continueToMenu();
    }

    async exportDataToCSV() {
        console.log(chalk.blue('\n📤 EXPORT DATA KE CSV'));
        console.log(chalk.blue('='.repeat(40)));

        try {
            await this.db.connect();

            const filename = await this.question(chalk.cyan('Nama file CSV (default: hotel-data-export.csv): ')) || 'hotel-data-export.csv';

            // Ambil data 30 hari terakhir
            const query = `
                SELECT 
                    search_result->>'hotel_name' as hotel_name,
                    search_result->>'city' as city,
                    search_result->>'room_price' as room_price,
                    search_result->>'location' as location,
                    search_result->>'rating' as rating,
                    search_result->>'room_name' as room_name,
                    search_result->>'amenities' as amenities,
                    search_result->>'search_query' as search_query,
                    created_at
                FROM search_hotel_log 
                WHERE created_at >= NOW() - INTERVAL '30 days'
                ORDER BY created_at DESC
            `;

            const result = await this.db.query(query);

            if (result.rows.length > 0) {
                // Buat konten CSV
                const csvHeader = 'hotel_name,city,room_price,location,rating,room_name,amenities,search_query,created_at\n';
                const csvContent = csvHeader + result.rows.map(row =>
                    `"${row.hotel_name || ''}","${row.city || ''}","${row.room_price || ''}","${row.location || ''}","${row.rating || ''}","${row.room_name || ''}","${row.amenities || ''}","${row.search_query || ''}","${row.created_at || ''}"`
                ).join('\n');

                const fs = require('fs');
                fs.writeFileSync(filename, csvContent);

                console.log(chalk.green(`✅ Berhasil export ${result.rows.length} data ke file ${filename}!`));
            } else {
                console.log(chalk.yellow('📭 Tidak ada data yang bisa diexport'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat export data:'), error.message);
        }

        await this.continueToMenu();
    }

    extractPrice(priceString) {
        if (!priceString) return 0;
        const match = priceString.match(/Rp\s*([\d,]+)/);
        if (match) {
            return parseInt(match[1].replace(/,/g, ''));
        }
        return 0;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Baru saja';
        if (diffMins < 60) return `${diffMins} menit yang lalu`;
        if (diffHours < 24) return `${diffHours} jam yang lalu`;
        return `${diffDays} hari yang lalu`;
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async continueToMenu() {
        await this.question(chalk.cyan('\nTekan Enter untuk kembali ke menu monitoring...'));
        console.clear();
        await this.showMainMenu();
    }
}

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    const monitor = new HotelMonitor();
    monitor.start().catch(console.error);
}

module.exports = HotelMonitor;
