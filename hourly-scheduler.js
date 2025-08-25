require('dotenv').config();
const cron = require('node-cron');
const chalk = require('chalk');
const HotelScraper = require('./hotel-scraper');
const DatabaseManager = require('./database');

// Konfigurasi scraping akan diambil dari .env
// Default values sebagai fallback
const defaultConfig = {
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
        // Ambil konfigurasi langsung dari .env
        const cronExpression = process.env.SCHEDULER_CRON;
        const timezone = process.env.SCHEDULER_TIMEZONE || 'Asia/Jakarta';
        const startTime = process.env.SCHEDULER_START_TIME || '00:00';
        const endTime = process.env.SCHEDULER_END_TIME || '23:59';

        if (!cronExpression) {
            console.error(chalk.red('❌ SCHEDULER_CRON tidak ada di file .env'));
            console.error(chalk.red('   Pastikan SCHEDULER_CRON berisi cron expression (contoh: 0 * * * *)'));
            process.exit(1);
        }

        // Validasi cron expression
        if (!cron.validate(cronExpression)) {
            console.error(chalk.red('❌ SCHEDULER_CRON tidak valid'));
            console.error(chalk.red(`   Cron expression: ${cronExpression}`));
            console.error(chalk.red('   Format yang benar: 0 * * * * (setiap jam pada menit ke-0)'));
            process.exit(1);
        }

        // Konfigurasi delay
        this.config = {
            delayHotels: parseInt(process.env.DELAY_BETWEEN_HOTELS) || 30,
            delayCities: parseInt(process.env.DELAY_BETWEEN_CITIES) || 60
        };

        console.log(chalk.blue(`⏰ Memulai Hotel Scheduler dengan cron: ${cronExpression}`));
        console.log(chalk.blue(`🌍 Timezone: ${timezone}`));
        console.log(chalk.blue(`⏰ Waktu aktif: ${startTime} - ${endTime}`));
        console.log(chalk.blue(`⏱️  Delay antar hotel: ${this.config.delayHotels} detik`));
        console.log(chalk.blue(`⏱️  Delay antar kota: ${this.config.delayCities} detik`));

        try {
            // Test koneksi database
            console.log(chalk.yellow('🔌 Testing koneksi database...'));
            const dbConnected = await this.db.connect();

            if (!dbConnected) {
                throw new Error('Gagal koneksi ke database. Pastikan database berjalan dan konfigurasi benar.');
            }

            console.log(chalk.green('✅ Koneksi database berhasil'));

            // Jalankan scraping pertama kali jika dalam waktu aktif
            if (this.isWithinActiveTime(startTime, endTime)) {
                console.log(chalk.blue('🚀 Menjalankan scraping pertama kali...'));
                await this.runHourlyScraping();
            } else {
                console.log(chalk.yellow(`⏰ Di luar waktu aktif (${startTime} - ${endTime}), scraping pertama ditunda`));
            }

            // Set cron job
            console.log(chalk.blue(`📅 Cron job akan berjalan: ${cronExpression}`));

            cron.schedule(cronExpression, async () => {
                // Cek apakah dalam waktu aktif
                if (!this.isWithinActiveTime(startTime, endTime)) {
                    console.log(chalk.yellow(`⏰ Di luar waktu aktif (${startTime} - ${endTime}), cron job dilewati`));
                    return;
                }

                if (!this.isRunning) {
                    console.log(chalk.blue(`\n⏰ Cron job triggered pada ${new Date().toLocaleString('id-ID', { timeZone: timezone })}`));
                    await this.runHourlyScraping();
                } else {
                    console.log(chalk.yellow('⚠️  Scraping sebelumnya masih berjalan, melewati jadwal ini'));
                }
            }, {
                scheduled: true,
                timezone: timezone
            });

            console.log(chalk.green('✅ Hotel Scheduler berhasil dimulai!'));
            console.log(chalk.blue('💡 Tekan Ctrl+C untuk menghentikan scheduler'));

        } catch (error) {
            console.error(chalk.red('❌ Error fatal saat menjalankan scheduler:'), error.message);
            console.error(chalk.red('Stack trace:'), error.stack);
            console.log(chalk.red('\n🚨 SCHEDULER GAGAL DIMULAI - Periksa error dan jalankan ulang'));
            process.exit(1);
        }
    }

    // Method untuk cek apakah waktu saat ini dalam range waktu aktif
    isWithinActiveTime(startTime, endTime) {
        try {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5); // Format HH:MM

            // Parse waktu dari string
            const [startHour, startMin] = startTime.split(':').map(Number);
            const [endHour, endMin] = endTime.split(':').map(Number);
            const [currentHour, currentMin] = currentTime.split(':').map(Number);

            // Convert ke menit untuk perbandingan
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            const currentMinutes = currentHour * 60 + currentMin;

            // Handle kasus waktu aktif melewati tengah malam
            if (startMinutes <= endMinutes) {
                // Normal case: 06:00 - 23:00
                return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
            } else {
                // Overnight case: 23:00 - 06:00
                return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
            }
        } catch (error) {
            console.error(chalk.red('❌ Error parsing waktu aktif:'), error);
            return true; // Default ke true jika ada error
        }
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

            // Check database health sebelum memulai - reconnect jika perlu
            if (!this.db.isConnected) {
                console.log(chalk.yellow('⚠️ Database tidak terkoneksi, mencoba reconnect...'));
                const reconnected = await this.db.reconnect();
                if (!reconnected) {
                    throw new Error('Database tidak terkoneksi. Pastikan koneksi database aktif.');
                }
                console.log(chalk.green('✅ Database berhasil reconnect'));
            }

            // Double check connection
            const connectionOk = await this.db.checkConnection();
            if (!connectionOk) {
                throw new Error('Database connection check gagal setelah reconnect.');
            }

            // Dapatkan daftar hotel dari database hotel_data
            const maxHotels = parseInt(process.env.MAX_HOTELS_PER_RUN);
            const hotelDataFromDB = await this.db.getHotelsForScraping(maxHotels);

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
                    id: hotel.id,
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
                        this.scraper.db = this.db; // Pass database reference
                        // initialize() akan dipanggil otomatis di dalam scrapeHotel()

                        // Scrape hotel dengan flow baru
                        const hotelData = await this.scraper.scrapeHotel(
                            hotel.id,           // hotel_id
                            hotel.name,         // hotel_name
                            hotel.searchQuery   // search_key
                        );

                        if (hotelData) {
                            // Tambahkan informasi tambahan
                            hotelData.scrapedAt = new Date();
                            hotelData.hotelConfig = hotel;
                            hotelData.city = city;

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
                            console.log(chalk.blue(`⏳ Menunggu ${this.config.delayHotels} detik sebelum hotel berikutnya...`));
                            await new Promise(resolve => setTimeout(resolve, this.config.delayHotels * 1000));
                        }

                    } catch (error) {
                        console.error(chalk.red(`❌ Error fatal saat scraping ${hotel.name}:`), error.message);
                        console.error(chalk.red(`Stack trace:`), error.stack);

                        // Cleanup scraper
                        if (this.scraper) {
                            await this.scraper.cleanup();
                            this.scraper = null;
                        }

                        // Update failed count
                        this.currentRun.failedScrapes++;

                        // Log error details
                        console.log(chalk.red(`\n🚨 ERROR FATAL - CRON JOB AKAN DIHENTIKAN`));
                        console.log(chalk.red(`   Hotel: ${hotel.name}`));
                        console.log(chalk.red(`   Kota: ${city}`));
                        console.log(chalk.red(`   Error: ${error.message}`));
                        console.log(chalk.red(`   Waktu: ${new Date().toLocaleString('id-ID')}`));

                        // Tampilkan ringkasan parsial
                        this.displayPartialSummary();

                        // Hentikan cron job dengan error
                        this.isRunning = false;
                        throw new Error(`Fatal error saat scraping ${hotel.name}: ${error.message}`);
                    }
                }

                // Jeda antar kota (kecuali kota terakhir)
                if (Object.keys(hotelsByCity).indexOf(city) < Object.keys(hotelsByCity).length - 1) {
                    console.log(chalk.blue(`\n⏳ Menunggu ${this.config.delayCities} detik sebelum kota berikutnya...`));
                    await new Promise(resolve => setTimeout(resolve, this.config.delayCities * 1000));
                }
            }

            // Tampilkan ringkasan
            this.displaySummary();

            this.currentRun.endTime = new Date();
            const duration = (this.currentRun.endTime - this.currentRun.startTime) / 1000;
            console.log(chalk.green(`\n✅ Hourly Scraping selesai dalam ${duration.toFixed(2)} detik`));

        } catch (error) {
            console.error(chalk.red(`❌ Error fatal dalam hourly scraping: ${error.message}`));
            console.error(chalk.red(`Stack trace:`), error.stack);

            // Reset running state
            this.isRunning = false;

            // Try to cleanup scraper if exists
            if (this.scraper) {
                try {
                    await this.scraper.cleanup();
                } catch (cleanupError) {
                    console.error(chalk.red('❌ Error saat cleanup scraper:'), cleanupError.message);
                }
                this.scraper = null;
            }

            // Log error details
            console.log(chalk.red('\n🚨 ERROR FATAL - CRON JOB DIHENTIKAN'));
            console.log(chalk.red(`   Error: ${error.message}`));
            console.log(chalk.red(`   Waktu: ${new Date().toLocaleString('id-ID')}`));

            // Don't exit process, just log error and continue
            console.log(chalk.yellow('⚠️  Scheduler akan mencoba lagi pada cron job berikutnya'));
        } finally {
            this.isRunning = false;
            this.currentRun.endTime = new Date();

            if (this.currentRun.startTime) {
                const duration = (this.currentRun.endTime - this.currentRun.startTime) / 1000;
                console.log(chalk.blue(`\n⏱️  Durasi scraping: ${duration.toFixed(2)} detik`));
            }

            console.log(chalk.blue('🔒 Scraping selesai, menunggu jadwal berikutnya...'));
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
            console.error(chalk.red(`❌ Error fatal saat memproses data ${hotelData.name}:`), error.message);
            console.error(chalk.red('Stack trace:'), error.stack);

            // Error saat save data adalah fatal, hentikan cron job
            throw new Error(`Fatal error saat memproses data ${hotelData.name}: ${error.message}`);
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

    displayPartialSummary() {
        console.log(chalk.red('\n🚨 RINGKASAN PARSIAL - CRON JOB DIHENTIKAN KARENA ERROR'));
        console.log(chalk.red('='.repeat(60)));

        console.log(chalk.cyan(`🏨 Total Hotel: ${this.currentRun.totalHotels}`));
        console.log(chalk.green(`✅ Berhasil: ${this.currentRun.successfulScrapes}`));
        console.log(chalk.red(`❌ Gagal: ${this.currentRun.failedScrapes}`));

        if (this.currentRun.totalHotels > 0) {
            const successRate = ((this.currentRun.successfulScrapes / this.currentRun.totalHotels) * 100).toFixed(1);
            console.log(chalk.blue(`📊 Success Rate: ${successRate}%`));
        }

        // Tampilkan hasil per kota yang sudah berhasil
        Object.keys(this.currentRun.results).forEach(city => {
            const count = this.currentRun.results[city].length;
            if (count > 0) {
                console.log(chalk.cyan(`\n${city}: ${count} hotel`));
                this.currentRun.results[city].forEach(hotel => {
                    console.log(chalk.white(`   🏨 ${hotel.name}: ${hotel.roomPrice || 'Harga tidak tersedia'}`));
                });
            }
        });

        console.log(chalk.red('\n⚠️  CRON JOB DIHENTIKAN - Periksa error dan jalankan manual jika diperlukan'));
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

    // startManualScheduler() method dihapus untuk menghindari double scheduling
    // Cron job sudah cukup untuk jadwal otomatis setiap jam

    stopScheduler() {
        console.log(chalk.blue('🛑 Menghentikan Hourly Scheduler...'));

        try {
            // Cleanup scraper jika sedang berjalan
            if (this.scraper) {
                this.scraper.cleanup();
                this.scraper = null;
            }

            // Close database connection
            if (this.db) {
                this.db.close();
            }

            // Reset state
            this.isRunning = false;
            this.currentRun = {
                startTime: null,
                endTime: null,
                totalHotels: 0,
                successfulScrapes: 0,
                failedScrapes: 0,
                results: {}
            };

            console.log(chalk.green('✅ Scheduler berhasil dihentikan'));

        } catch (error) {
            console.error(chalk.red('❌ Error saat menghentikan scheduler:'), error.message);
        }
    }

    // Method untuk emergency stop
    emergencyStop(reason = 'Unknown error') {
        console.log(chalk.red(`🚨 EMERGENCY STOP - ${reason}`));
        console.log(chalk.red('Menghentikan semua proses dan membersihkan resource...'));

        this.stopScheduler();
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGINT, menghentikan scheduler...'));
    if (global.hourlyScheduler) {
        global.hourlyScheduler.stopScheduler();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGTERM, menghentikan scheduler...'));
    if (global.hourlyScheduler) {
        global.hourlyScheduler.stopScheduler();
    }
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(chalk.red('\n🚨 UNCAUGHT EXCEPTION - CRON JOB DIHENTIKAN'));
    console.error(chalk.red('Error:'), error.message);
    console.error(chalk.red('Stack trace:'), error.stack);

    if (global.hourlyScheduler) {
        global.hourlyScheduler.emergencyStop(`Uncaught Exception: ${error.message}`);
    } else {
        process.exit(1);
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('\n🚨 UNHANDLED PROMISE REJECTION - CRON JOB DIHENTIKAN'));
    console.error(chalk.red('Reason:'), reason);
    console.error(chalk.red('Promise:'), promise);

    if (global.hourlyScheduler) {
        global.hourlyScheduler.emergencyStop(`Unhandled Promise Rejection: ${reason}`);
    } else {
        process.exit(1);
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
