const chalk = require('chalk');
const readline = require('readline');

// Load environment variables
require('dotenv').config();

const HotelScraper = require('./hotel-scraper');
const HotelPriceScheduler = require('./scheduler');
const DatabaseManager = require('./database');

class HotelScraperApp {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false // Prevent terminal echo issues
        });
        this.db = new DatabaseManager();
    }

    // Helper method untuk membersihkan dan validasi input
    cleanInput(input, fieldName = 'input') {
        if (!input) return null;

        // Clean input - remove extra spaces and special characters
        const cleaned = input.trim().replace(/\s+/g, ' ');

        // Validate input length
        if (cleaned.length < 3) {
            console.log(chalk.red(`❌ ${fieldName} terlalu pendek! Minimal 3 karakter.`));
            return null;
        }

        if (cleaned.length > 100) {
            console.log(chalk.red(`❌ ${fieldName} terlalu panjang! Maksimal 100 karakter.`));
            return null;
        }

        return cleaned;
    }

    async showMenu() {
        console.clear();
        console.log(chalk.blue('🏨 TRAVELOKA HOTEL PRICE SCRAPER'));
        console.log(chalk.blue('='.repeat(50)));
        console.log(chalk.white('1. Scrape hotel sekali (manual)'));
        console.log(chalk.white('2. Jalankan scheduler otomatis (setiap 3 jam)'));
        console.log(chalk.white('3. Scrape hotel di kota tertentu'));
        console.log(chalk.white('4. Scrape hotel berdasarkan nama hotel'));
        console.log(chalk.white('5. Pilih dari daftar hotel populer'));
        console.log(chalk.white('6. Lihat history scraping'));
        console.log(chalk.white('7. Statistik scraping'));
        console.log(chalk.white('8. Keluar'));
        console.log(chalk.blue('='.repeat(50)));

        const choice = await this.question(chalk.yellow('Pilih menu (1-8): '));

        switch (choice) {
            case '1':
                await this.runManualScraping();
                break;
            case '2':
                await this.runScheduler();
                break;
            case '3':
                await this.runCityScraping();
                break;
            case '4':
                await this.runCustomHotelScraping();
                break;
            case '5':
                await this.runPopularHotelScraping();
                break;
            case '6':
                await this.showScrapingHistory();
                break;
            case '7':
                await this.showScrapingStats();
                break;
            case '8':
                console.log(chalk.green('👋 Terima kasih telah menggunakan Hotel Scraper!'));
                this.rl.close();
                process.exit(0);
                break;
            default:
                console.log(chalk.red('❌ Pilihan tidak valid!'));
                await this.waitAndShowMenu();
                break;
        }
    }

    async runManualScraping() {
        try {
            console.log(chalk.blue('🚀 Memulai scraping manual...'));
            console.log(chalk.blue('💡 Tips: Ketik nama hotel dengan jelas (contoh: "Gets Hotel Malang")'));

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: false // Prevent terminal echo issues
            });

            return new Promise((resolve) => {
                rl.question('Masukkan nama hotel yang ingin di-search: ', async (hotelName) => {
                    rl.close();

                    // Clean dan validasi input
                    const cleanHotelName = this.cleanInput(hotelName, 'Nama hotel');
                    if (!cleanHotelName) {
                        resolve();
                        return;
                    }

                    console.log(chalk.blue(`🔍 Akan search untuk: "${cleanHotelName}"`));
                    console.log(chalk.blue('⏳ Memulai scraping...'));

                    const scraper = new HotelScraper();

                    try {
                        await scraper.scrapeHotel(cleanHotelName);
                    } catch (error) {
                        console.log(chalk.red(`❌ Error: ${error.message}`));
                    } finally {
                        await scraper.cleanup();
                        resolve();
                    }
                });
            });

        } catch (error) {
            console.log(chalk.red(`❌ Error dalam scraping manual: ${error.message}`));
        }
    }

    async runScheduler() {
        console.log(chalk.blue('\n⏰ Memulai scheduler otomatis...'));
        console.log(chalk.blue('Scheduler akan berjalan setiap 3 jam'));
        console.log(chalk.blue('Tekan Ctrl+C untuk menghentikan'));

        const scheduler = new HotelPriceScheduler();
        await scheduler.startScheduler();
    }

    async runCityScraping() {
        try {
            console.log(chalk.blue('💡 Tips: Ketik nama kota dengan jelas (contoh: "Jakarta")'));
            const city = await this.question(chalk.yellow('Masukkan nama kota: '));

            // Clean dan validasi input
            const cleanCity = this.cleanInput(city, 'Nama kota');
            if (!cleanCity) {
                await this.waitAndShowMenu();
                return;
            }

            console.log(chalk.blue(`\n🚀 Memulai scraping untuk kota: ${cleanCity}`));

            const scraper = new HotelScraper();

            try {
                await scraper.scrapeHotel('Hotel Indonesia', cleanCity);
            } catch (error) {
                console.log(chalk.red(`❌ Error saat scraping kota ${cleanCity}: ${error.message}`));
            } finally {
                await scraper.cleanup();
            }

        } catch (error) {
            console.log(chalk.red(`❌ Error dalam scraping kota: ${error.message}`));
        }
    }

    async runCustomHotelScraping() {
        try {
            console.log(chalk.blue('💡 Tips: Ketik nama hotel dan kota dengan jelas'));

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: false // Prevent terminal echo issues
            });

            return new Promise((resolve) => {
                rl.question('Masukkan nama hotel: ', async (hotelName) => {
                    rl.question('Masukkan nama kota: ', async (cityName) => {
                        rl.close();

                        // Clean dan validasi input
                        const cleanHotelName = this.cleanInput(hotelName, 'Nama hotel');
                        const cleanCityName = this.cleanInput(cityName, 'Nama kota');

                        if (!cleanHotelName || !cleanCityName) {
                            resolve();
                            return;
                        }

                        console.log(chalk.blue(`🔍 Akan search untuk: "${cleanHotelName}" di "${cleanCityName}"`));
                        console.log(chalk.blue('⏳ Memulai scraping...'));

                        const scraper = new HotelScraper();

                        try {
                            await scraper.scrapeHotel(cleanHotelName);
                        } catch (error) {
                            console.log(chalk.red(`❌ Error saat scraping hotel: ${error.message}`));
                        } finally {
                            await scraper.cleanup();
                            resolve();
                        }
                    });
                });
            });

        } catch (error) {
            console.log(chalk.red(`❌ Error dalam scraping custom hotel: ${error.message}`));
        }
    }

    async runPopularHotelScraping() {
        try {
            const popularHotels = [
                'Hotel Indonesia',
                'Grand Hyatt Jakarta',
                'The Ritz-Carlton Jakarta',
                'Shangri-La Hotel Jakarta',
                'Four Seasons Hotel Jakarta'
            ];

            console.log(chalk.blue('\n🏨 Daftar Hotel Populer:'));
            popularHotels.forEach((hotel, index) => {
                console.log(chalk.white(`${index + 1}. ${hotel}`));
            });

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question('Pilih hotel (1-5): ', async (choice) => {
                    rl.close();

                    const selectedIndex = parseInt(choice) - 1;
                    if (selectedIndex < 0 || selectedIndex >= popularHotels.length) {
                        console.log(chalk.red('❌ Pilihan tidak valid!'));
                        resolve();
                        return;
                    }

                    const selectedHotel = popularHotels[selectedIndex];
                    console.log(chalk.blue(`\n🚀 Memulai scraping untuk: ${selectedHotel}`));

                    const scraper = new HotelScraper();

                    try {
                        await scraper.scrapeHotel(selectedHotel);
                    } catch (error) {
                        console.log(chalk.red(`❌ Error saat scraping hotel populer: ${error.message}`));
                    } finally {
                        await scraper.cleanup();
                        resolve();
                    }
                });
            });

        } catch (error) {
            console.log(chalk.red(`❌ Error dalam scraping hotel populer: ${error.message}`));
        }
    }

    question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async waitAndShowMenu() {
        console.log(chalk.blue('\n⏳ Tekan Enter untuk kembali ke menu utama...'));
        await this.question('');
        await this.showMenu();
    }

    async showScrapingHistory() {
        try {
            console.log(chalk.blue('\n📊 HISTORY SCRAPING HOTEL'));
            console.log(chalk.blue('='.repeat(50)));

            // Initialize database connection
            await this.db.connect();

            const history = await this.db.getScrapingHistory(20);

            if (history.length === 0) {
                console.log(chalk.yellow('📭 Belum ada data scraping yang tersimpan'));
            } else {
                console.log(chalk.green(`📈 Total ${history.length} data scraping:`));
                console.log(chalk.blue('='.repeat(80)));

                history.forEach((record, index) => {
                    const timestamp = new Date(record.search_timestamp).toLocaleString('id-ID');
                    const status = record.status === 'success' ? chalk.green('✅') : chalk.red('❌');
                    const price = record.room_price ? `Rp ${record.room_price.toLocaleString('id-ID')}` : 'N/A';

                    console.log(chalk.white(`${index + 1}. ${status} ${record.hotel_name}`));
                    console.log(chalk.gray(`   🔍 Search: "${record.search_key}"`));
                    console.log(chalk.gray(`   💰 Harga: ${price}`));
                    console.log(chalk.gray(`   📅 Waktu: ${timestamp}`));
                    console.log(chalk.gray(`   📸 Screenshot: ${record.screenshot_path || 'Tidak ada'}`));
                    console.log('');
                });
            }

        } catch (error) {
            console.log(chalk.red(`❌ Error saat mengambil history: ${error.message}`));
        } finally {
            await this.waitAndShowMenu();
        }
    }

    async showScrapingStats() {
        try {
            console.log(chalk.blue('\n📊 STATISTIK SCRAPING HOTEL'));
            console.log(chalk.blue('='.repeat(50)));

            // Initialize database connection
            await this.db.connect();

            const stats = await this.db.getSearchStats();

            if (!stats) {
                console.log(chalk.yellow('📭 Belum ada data statistik yang tersedia'));
            } else {
                console.log(chalk.green('📈 Statistik Keseluruhan:'));
                console.log(chalk.blue('='.repeat(50)));

                console.log(chalk.white(`🔍 Total Pencarian: ${stats.total_searches}`));
                console.log(chalk.green(`✅ Berhasil: ${stats.successful_searches}`));
                console.log(chalk.red(`❌ Gagal: ${stats.failed_searches}`));

                if (stats.average_price) {
                    console.log(chalk.blue(`💰 Rata-rata Harga: Rp ${stats.average_price.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`));
                }

                if (stats.first_search) {
                    const firstSearch = new Date(stats.first_search).toLocaleString('id-ID');
                    console.log(chalk.gray(`📅 Pencarian Pertama: ${firstSearch}`));
                }

                if (stats.last_search) {
                    const lastSearch = new Date(stats.last_search).toLocaleString('id-ID');
                    console.log(chalk.gray(`📅 Pencarian Terakhir: ${lastSearch}`));
                }
            }

        } catch (error) {
            console.log(chalk.red(`❌ Error saat mengambil statistik: ${error.message}`));
        } finally {
            await this.waitAndShowMenu();
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGINT, menghentikan aplikasi...'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGTERM, menghentikan aplikasi...'));
    process.exit(0);
});

// Jalankan aplikasi
async function main() {
    try {
        const app = new HotelScraperApp();
        await app.showMenu();
    } catch (error) {
        console.error(chalk.red('❌ Error saat menjalankan aplikasi:'), error);
        process.exit(1);
    }
}

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    main();
}

module.exports = HotelScraperApp;
