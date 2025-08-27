require('dotenv').config();
const cron = require('node-cron');
const chalk = require('chalk');
const HotelScraper = require('./hotel-scraper');

class HotelPriceScheduler {
    constructor() {
        this.scraper = null;
        this.isRunning = false;
    }

    async startScheduler() {
        // Ambil konfigurasi langsung dari .env
        const interval = parseInt(process.env.SCHEDULER_INTERVAL);
        const cronExpression = process.env.SCHEDULER_CRON;
        const timezone = process.env.SCHEDULER_TIMEZONE;

        // Validasi konfigurasi
        if (!interval || !cronExpression || !timezone) {
            throw new Error('Konfigurasi SCHEDULER_INTERVAL, SCHEDULER_CRON, dan SCHEDULER_TIMEZONE harus ada di file .env');
        }

        console.log(chalk.blue(`⏰ Memulai scheduler untuk mengecek harga hotel setiap ${interval} jam...`));
        console.log(chalk.blue(`📅 Scheduler akan berjalan setiap ${interval} jam`));
        console.log(chalk.blue(`🔄 Cron Expression: ${cronExpression}`));
        console.log(chalk.blue(`🌍 Timezone: ${timezone}`));

        // Jalankan scraping pertama kali
        await this.runScraping();

        // Set cron job berdasarkan konfigurasi
        cron.schedule(cronExpression, async () => {
            if (!this.isRunning) {
                await this.runScraping();
            } else {
                console.log(chalk.yellow('⚠️  Scraping sebelumnya masih berjalan, melewati jadwal ini'));
            }
        }, {
            scheduled: true,
            timezone: timezone
        });

        console.log(chalk.green('✅ Scheduler berhasil dimulai!'));
        console.log(chalk.blue('💡 Tekan Ctrl+C untuk menghentikan scheduler'));

        // Jalankan scraping manual setiap interval untuk testing
        this.startManualScheduler(interval);
    }

    async runScraping() {
        if (this.isRunning) {
            console.log(chalk.yellow('⚠️  Scraping sudah berjalan, tunggu sampai selesai'));
            return;
        }

        this.isRunning = true;
        const startTime = new Date();

        try {
            console.log(chalk.blue(`\n🚀 Memulai scraping pada ${startTime.toLocaleString('id-ID')}`));
            console.log(chalk.blue('='.repeat(60)));

            this.scraper = new HotelScraper();
            await this.scraper.initialize();

            // Scrape hotel di beberapa kota populer
            const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta'];
            const allResults = {};

            for (const city of cities) {
                console.log(chalk.yellow(`\n🏙️  Mencari hotel di ${city}...`));
                console.log(chalk.yellow('='.repeat(50)));

                const hotelData = await this.scraper.scrapeHotel('Hotel Indonesia');
                allResults[city] = hotelData ? [hotelData] : [];

                if (hotelData) {
                    console.log(chalk.green(`✅ Ditemukan hotel di ${city}`));
                    console.log(chalk.cyan(`\n🏨 ${hotelData.name}`));
                    console.log(chalk.white(`   💰 Harga Kamar: ${hotelData.roomPrice}`));
                    console.log(chalk.blue(`   📍 Lokasi: ${hotelData.location}`));
                    console.log(chalk.yellow(`   ⭐ Rating: ${hotelData.rating}`));
                } else {
                    console.log(chalk.red('   Tidak ada data hotel yang ditemukan'));
                }

                // Jeda antar kota
                if (city !== cities[cities.length - 1]) {
                    const delayCities = parseInt(process.env.DELAY_BETWEEN_CITIES);
                    console.log(chalk.blue(`\n⏳ Menunggu ${delayCities} detik sebelum kota berikutnya...`));
                    await new Promise(resolve => setTimeout(resolve, delayCities * 1000));
                }
            }

            // Tampilkan ringkasan
            this.displaySummary(allResults);

            const endTime = new Date();
            const duration = (endTime - startTime) / 1000;
            console.log(chalk.green(`\n✅ Scraping selesai dalam ${duration.toFixed(2)} detik`));

        } catch (error) {
            console.error(chalk.red('❌ Error saat scraping:'), error);
        } finally {
            if (this.scraper) {
                await this.scraper.cleanup();
            }
            this.isRunning = false;
            console.log(chalk.blue('\n🔒 Scraping selesai, menunggu jadwal berikutnya...'));
        }
    }

    displaySummary(results) {
        console.log(chalk.blue('\n📊 RINGKASAN SCRAPING'));
        console.log(chalk.blue('='.repeat(40)));

        let totalHotels = 0;
        Object.keys(results).forEach(city => {
            const count = results[city].length;
            totalHotels += count;
            console.log(chalk.cyan(`${city}: ${count} hotel`));
        });

        console.log(chalk.green(`\nTotal: ${totalHotels} hotel ditemukan`));

        // Tampilkan hotel dengan harga terendah dan tertinggi
        this.displayPriceAnalysis(results);
    }

    displayPriceAnalysis(results) {
        console.log(chalk.blue('\n💰 ANALISIS HARGA'));
        console.log(chalk.blue('='.repeat(30)));

        let allHotels = [];
        Object.keys(results).forEach(city => {
            results[city].forEach(hotel => {
                allHotels.push({
                    ...hotel,
                    city: city
                });
            });
        });

        // Filter hotel yang memiliki harga valid
        const hotelsWithPrice = allHotels.filter(hotel =>
            hotel.price &&
            hotel.price !== 'Harga tidak tersedia' &&
            !isNaN(parseInt(hotel.price.replace(/[^\d]/g, '')))
        );

        if (hotelsWithPrice.length > 0) {
            // Urutkan berdasarkan harga
            hotelsWithPrice.sort((a, b) => {
                const priceA = parseInt(a.price.replace(/[^\d]/g, ''));
                const priceB = parseInt(b.price.replace(/[^\d]/g, ''));
                return priceA - priceB;
            });

            console.log(chalk.green(`\n🏆 Hotel Termurah: ${hotelsWithPrice[0].name} (${hotelsWithPrice[0].city})`));
            console.log(chalk.white(`   Harga: ${hotelsWithPrice[0].price}`));

            console.log(chalk.red(`\n💸 Hotel Termahal: ${hotelsWithPrice[hotelsWithPrice.length - 1].name} (${hotelsWithPrice[hotelsWithPrice.length - 1].city})`));
            console.log(chalk.white(`   Harga: ${hotelsWithPrice[hotelsWithPrice.length - 1].price}`));
        }
    }

    startManualScheduler(interval) {
        const intervalMs = interval * 60 * 60 * 1000;

        // Untuk testing, jalankan scraping setiap interval secara manual
        setInterval(async () => {
            if (!this.isRunning) {
                console.log(chalk.blue(`\n⏰ ${interval} jam telah berlalu, memulai scraping otomatis...`));
                await this.runScraping();
            }
        }, intervalMs);
    }

    stopScheduler() {
        console.log(chalk.blue('🛑 Menghentikan scheduler...'));
        if (this.scraper) {
            this.scraper.close();
        }
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGINT, menghentikan scheduler...'));
    if (global.scheduler) {
        global.scheduler.stopScheduler();
    }
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGTERM, menghentikan scheduler...'));
    if (global.scheduler) {
        global.scheduler.stopScheduler();
    }
});

// Jalankan scheduler
async function main() {
    try {
        global.scheduler = new HotelPriceScheduler();
        await global.scheduler.startScheduler();
    } catch (error) {
        console.error(chalk.red('❌ Error saat menjalankan scheduler:'), error);
        process.exit(1);
    }
}

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    main();
}

module.exports = HotelPriceScheduler;
