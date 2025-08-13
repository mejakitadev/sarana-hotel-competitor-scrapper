const chalk = require('chalk');
const readline = require('readline');
const HotelScraper = require('./hotel-scraper');
const HotelPriceScheduler = require('./scheduler');

class HotelScraperApp {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
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
        console.log(chalk.white('6. Keluar'));
        console.log(chalk.blue('='.repeat(50)));

        const choice = await this.question(chalk.yellow('Pilih menu (1-6): '));

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

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question('Masukkan nama hotel yang ingin di-search: ', async (hotelName) => {
                    rl.close();

                    if (!hotelName.trim()) {
                        console.log(chalk.red('❌ Nama hotel tidak boleh kosong!'));
                        resolve();
                        return;
                    }

                    const scraper = new HotelScraper();

                    try {
                        await scraper.scrapeHotel(hotelName.trim());
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
            const city = await this.question(chalk.yellow('Masukkan nama kota: '));

            if (!city.trim()) {
                console.log(chalk.red('❌ Nama kota tidak boleh kosong!'));
                await this.waitAndShowMenu();
                return;
            }

            console.log(chalk.blue(`\n🚀 Memulai scraping untuk kota: ${city}`));

            const scraper = new HotelScraper();

            try {
                await scraper.scrapeHotel('Hotel Indonesia', city);
            } catch (error) {
                console.log(chalk.red(`❌ Error saat scraping kota ${city}: ${error.message}`));
            } finally {
                await scraper.cleanup();
            }

        } catch (error) {
            console.log(chalk.red(`❌ Error dalam scraping kota: ${error.message}`));
        }
    }

    async runCustomHotelScraping() {
        try {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question('Masukkan nama hotel: ', async (hotelName) => {
                    rl.question('Masukkan nama kota: ', async (cityName) => {
                        rl.close();

                        if (!hotelName.trim() || !cityName.trim()) {
                            console.log(chalk.red('❌ Nama hotel dan kota tidak boleh kosong!'));
                            resolve();
                            return;
                        }

                        const scraper = new HotelScraper();

                        try {
                            await scraper.scrapeHotel(hotelName.trim());
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
