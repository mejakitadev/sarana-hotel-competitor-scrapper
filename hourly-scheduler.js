const cron = require('node-cron');
const chalk = require('chalk');
const HotelScraper = require('./hotel-scraper');
const DatabaseManager = require('./database');

// Konfigurasi scraping
const scrapingConfig = {
    intervalHours: 1,
    startTime: '06:00',
    endTime: '23:00',
    delayBetweenHotels: 30,
    delayBetweenCities: 60
};

class HourlyHotelScheduler {
    constructor() {
        this.scraper = null;
        this.isRunning = false;
        this.db = new DatabaseManager();
        this.currentRun = {
            startTime: null,
            endTime: null,
            totalHotels: 0,
            successfulScrapes: 0,
            failedScrapes: 0,
            results: {}
        };
    }

    async startScheduler() {
        console.log(chalk.blue('⏰ Memulai Hourly Hotel Scheduler...'));
        console.log(chalk.blue(`📅 Scheduler akan berjalan setiap ${scrapingConfig.intervalHours} jam`));
        console.log(chalk.blue(`⏰ Waktu aktif: ${scrapingConfig.startTime} - ${scrapingConfig.endTime}`));

        // Connect ke database
        await this.db.connect();

        // Jalankan scraping pertama kali
        await this.runHourlyScraping();

        // Set cron job untuk setiap 1 jam
        const cronExpression = `0 */${scrapingConfig.intervalHours} * * *`;
        console.log(chalk.blue(`🔄 Cron expression: ${cronExpression}`));

        cron.schedule(cronExpression, async () => {
            if (!this.isRunning) {
                console.log(chalk.blue('\n⏰ Cron job triggered, memulai scraping...'));
                await this.runHourlyScraping();
            } else {
                console.log(chalk.yellow('⚠️  Scraping sebelumnya masih berjalan, melewati jadwal ini'));
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });

        console.log(chalk.green('✅ Hourly Scheduler berhasil dimulai!'));
        console.log(chalk.blue('💡 Tekan Ctrl+C untuk menghentikan scheduler'));

        // Jalankan scraping manual setiap interval untuk testing
        this.startManualScheduler();
    }

    async runHourlyScraping() {
        if (this.isRunning) {
            console.log(chalk.yellow('⚠️  Scraping sudah berjalan, tunggu sampai selesai'));
            return;
        }

        this.isRunning = true;
        this.currentRun.startTime = new Date();
        this.currentRun.totalHotels = 0;
        this.currentRun.successfulScrapes = 0;
        this.currentRun.failedScrapes = 0;
        this.currentRun.results = {};

        try {
            console.log(chalk.blue(`\n🚀 Memulai Hourly Scraping pada ${this.currentRun.startTime.toLocaleString('id-ID')}`));
            console.log(chalk.blue('='.repeat(80)));

            // Dapatkan daftar hotel dari database hotel_data
            const hotelDataFromDB = await this.db.getHotelData(100); // Ambil 100 hotel terbaru

            if (hotelDataFromDB.length === 0) {
                console.log(chalk.yellow('⏰ Tidak ada data hotel di database, scraping ditunda'));
                return;
            }

            this.currentRun.totalHotels = hotelDataFromDB.length;
            console.log(chalk.blue(`🎯 Akan scrape ${this.currentRun.totalHotels} hotel dari database`));

            // Group hotel berdasarkan kota dari search_key
            const hotelsByCity = {};
            hotelDataFromDB.forEach(hotel => {
                // Extract kota dari search_key (contoh: "Ashley Sabang Jakarta" -> "Jakarta")
                const city = this.extractCityFromSearchKey(hotel.search_key);
                if (!hotelsByCity[city]) {
                    hotelsByCity[city] = [];
                }
                hotelsByCity[city].push({
                    name: hotel.hotel_name,
                    searchQuery: hotel.search_key,
                    city: city,
                    lastPrice: hotel.rate_harga,
                    lastScraped: hotel.updated_at
                });
            });

            // Tampilkan info kota yang akan di-scrape
            const cities = Object.keys(hotelsByCity);
            console.log(chalk.blue(`🌆 Kota yang akan di-scrape: ${cities.join(', ')}`));

            // Scrape hotel per kota
            for (const [city, hotels] of Object.entries(hotelsByCity)) {
                console.log(chalk.yellow(`\n🏙️  Mencari hotel di ${city} (${hotels.length} hotel)...`));
                console.log(chalk.yellow('='.repeat(60)));

                this.currentRun.results[city] = [];

                for (let i = 0; i < hotels.length; i++) {
                    const hotel = hotels[i];
                    console.log(chalk.blue(`\n🏨 [${i + 1}/${hotels.length}] Scraping: ${hotel.name}`));

                    try {
                        // Buat instance scraper baru untuk setiap hotel
                        this.scraper = new HotelScraper();
                        await this.scraper.initialize();

                        // Scrape hotel
                        const hotelData = await this.scraper.scrapeHotel(hotel.searchQuery);

                        if (hotelData) {
                            // Tambahkan informasi tambahan
                            hotelData.scrapedAt = new Date();
                            hotelData.hotelConfig = hotel;
                            hotelData.city = city;

                            // Simpan ke database
                            await this.saveHotelData(hotelData);

                            this.currentRun.results[city].push(hotelData);
                            this.currentRun.successfulScrapes++;

                            console.log(chalk.green(`✅ Berhasil scrape ${hotel.name}`));
                            console.log(chalk.cyan(`   💰 Harga: ${hotelData.roomPrice || 'Tidak tersedia'}`));
                            console.log(chalk.cyan(`   📍 Lokasi: ${hotelData.location || 'Tidak tersedia'}`));
                            console.log(chalk.cyan(`   ⭐ Rating: ${hotelData.rating || 'Tidak tersedia'}`));
                        } else {
                            console.log(chalk.red(`❌ Gagal scrape ${hotel.name}`));
                            this.currentRun.failedScrapes++;
                        }

                        // Cleanup scraper
                        await this.scraper.cleanup();
                        this.scraper = null;

                        // Jeda antar hotel (kecuali hotel terakhir)
                        if (i < hotels.length - 1) {
                            console.log(chalk.blue(`⏳ Menunggu ${scrapingConfig.delayBetweenHotels} detik sebelum hotel berikutnya...`));
                            await new Promise(resolve => setTimeout(resolve, scrapingConfig.delayBetweenHotels * 1000));
                        }

                    } catch (error) {
                        console.error(chalk.red(`❌ Error saat scraping ${hotel.name}:`), error.message);
                        this.currentRun.failedScrapes++;

                        // Cleanup jika ada error
                        if (this.scraper) {
                            await this.scraper.cleanup();
                            this.scraper = null;
                        }
                    }
                }

                // Jeda antar kota (kecuali kota terakhir)
                if (Object.keys(hotelsByCity).indexOf(city) < Object.keys(hotelsByCity).length - 1) {
                    console.log(chalk.blue(`\n⏳ Menunggu ${scrapingConfig.delayBetweenCities} detik sebelum kota berikutnya...`));
                    await new Promise(resolve => setTimeout(resolve, scrapingConfig.delayBetweenCities * 1000));
                }
            }

            // Tampilkan ringkasan
            this.displaySummary();

            this.currentRun.endTime = new Date();
            const duration = (this.currentRun.endTime - this.currentRun.startTime) / 1000;
            console.log(chalk.green(`\n✅ Hourly Scraping selesai dalam ${duration.toFixed(2)} detik`));

        } catch (error) {
            console.error(chalk.red('❌ Error fatal dalam hourly scraping:'), error);
        } finally {
            this.isRunning = false;
            console.log(chalk.blue('\n🔒 Scraping selesai, menunggu jadwal berikutnya...'));
        }
    }

    // Method untuk extract kota dari search_key
    extractCityFromSearchKey(searchKey) {
        // Extract kota dari search_key (contoh: "Ashley Sabang Jakarta" -> "Jakarta")
        const cityPatterns = [
            'Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Malang', 'Batu', 'Bali',
            'Medan', 'Palembang', 'Semarang', 'Solo', 'Magelang', 'Salatiga'
        ];

        for (const city of cityPatterns) {
            if (searchKey.includes(city)) {
                return city;
            }
        }

        // Jika tidak ada pattern yang cocok, return "Unknown"
        return 'Unknown';
    }

    async saveHotelData(hotelData) {
        try {
            // Data hotel sudah otomatis tersimpan ke hotel_data dan hotel_scraping_results
            // melalui method saveScrapingResult di HotelScraper
            // Tidak perlu insert manual ke tabel lain

            console.log(chalk.green(`💾 Data ${hotelData.name} sudah tersimpan otomatis ke database`));
            console.log(chalk.cyan(`   📊 Harga: ${hotelData.roomPrice || 'Tidak tersedia'}`));
            console.log(chalk.cyan(`   📍 Lokasi: ${hotelData.location || 'Tidak tersedia'}`));

        } catch (error) {
            console.error(chalk.red(`❌ Error saat memproses data ${hotelData.name}:`), error.message);
        }
    }

    displaySummary() {
        console.log(chalk.blue('\n📊 RINGKASAN HOURLY SCRAPING'));
        console.log(chalk.blue('='.repeat(50)));

        console.log(chalk.cyan(`🏨 Total Hotel: ${this.currentRun.totalHotels}`));
        console.log(chalk.green(`✅ Berhasil: ${this.currentRun.successfulScrapes}`));
        console.log(chalk.red(`❌ Gagal: ${this.currentRun.failedScrapes}`));
        console.log(chalk.blue(`📊 Success Rate: ${((this.currentRun.successfulScrapes / this.currentRun.totalHotels) * 100).toFixed(1)}%`));

        // Tampilkan hasil per kota
        Object.keys(this.currentRun.results).forEach(city => {
            const count = this.currentRun.results[city].length;
            console.log(chalk.cyan(`\n${city}: ${count} hotel`));

            this.currentRun.results[city].forEach(hotel => {
                console.log(chalk.white(`   🏨 ${hotel.name}: ${hotel.roomPrice || 'Harga tidak tersedia'}`));
            });
        });

        // Analisis harga
        this.displayPriceAnalysis();
    }

    displayPriceAnalysis() {
        console.log(chalk.blue('\n💰 ANALISIS HARGA'));
        console.log(chalk.blue('='.repeat(30)));

        let allHotels = [];
        Object.keys(this.currentRun.results).forEach(city => {
            this.currentRun.results[city].forEach(hotel => {
                if (hotel.roomPrice && hotel.roomPrice !== 'Harga tidak tersedia') {
                    allHotels.push({
                        ...hotel,
                        city: city
                    });
                }
            });
        });

        if (allHotels.length > 0) {
            // Urutkan berdasarkan harga
            allHotels.sort((a, b) => {
                const priceA = this.extractPrice(a.roomPrice);
                const priceB = this.extractPrice(b.roomPrice);
                return priceA - priceB;
            });

            console.log(chalk.green(`\n🏆 Hotel Termurah: ${allHotels[0].name} (${allHotels[0].city})`));
            console.log(chalk.white(`   Harga: ${allHotels[0].roomPrice}`));

            console.log(chalk.red(`\n💸 Hotel Termahal: ${allHotels[allHotels.length - 1].name} (${allHotels[allHotels.length - 1].city})`));
            console.log(chalk.white(`   Harga: ${allHotels[allHotels.length - 1].roomPrice}`));

            // Hitung rata-rata harga
            const totalPrice = allHotels.reduce((sum, hotel) => sum + this.extractPrice(hotel.roomPrice), 0);
            const avgPrice = totalPrice / allHotels.length;
            console.log(chalk.blue(`\n📊 Rata-rata Harga: Rp ${avgPrice.toLocaleString('id-ID')}`));
        }
    }

    extractPrice(priceString) {
        if (!priceString) return 0;
        const match = priceString.match(/Rp\s*([\d,]+)/);
        if (match) {
            return parseInt(match[1].replace(/,/g, ''));
        }
        return 0;
    }

    startManualScheduler() {
        // Untuk testing, jalankan scraping setiap interval secara manual
        const intervalMs = scrapingConfig.intervalHours * 60 * 60 * 1000;

        setInterval(async () => {
            if (!this.isRunning) {
                console.log(chalk.blue(`\n⏰ ${scrapingConfig.intervalHours} jam telah berlalu, memulai scraping otomatis...`));
                await this.runHourlyScraping();
            }
        }, intervalMs);
    }

    stopScheduler() {
        console.log(chalk.blue('🛑 Menghentikan Hourly Scheduler...'));
        if (this.scraper) {
            this.scraper.cleanup();
        }
        if (this.db) {
            this.db.close();
        }
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGINT, menghentikan scheduler...'));
    if (global.hourlyScheduler) {
        global.hourlyScheduler.stopScheduler();
    }
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGTERM, menghentikan scheduler...'));
    if (global.hourlyScheduler) {
        global.hourlyScheduler.stopScheduler();
    }
});

// Jalankan scheduler
async function main() {
    try {
        global.hourlyScheduler = new HourlyHotelScheduler();
        await global.hourlyScheduler.startScheduler();
    } catch (error) {
        console.error(chalk.red('❌ Error saat menjalankan hourly scheduler:'), error);
        process.exit(1);
    }
}

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    main();
}

module.exports = HourlyHotelScheduler;
