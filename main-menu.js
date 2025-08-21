const chalk = require('chalk');
const readline = require('readline');
const HourlyHotelScheduler = require('./hourly-scheduler');
const HotelListManager = require('./manage-hotels');
const HotelMonitor = require('./monitor');

class MainMenu {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.scheduler = null;
        this.isSchedulerRunning = false;
    }

    async start() {
        console.log(chalk.blue('🏨 TRAVELOKA HOTEL SCRAPER - MAIN MENU'));
        console.log(chalk.blue('=================================================='));
        console.log(chalk.blue('💡 Sistem otomatis scraping harga hotel setiap 1 jam'));
        console.log(chalk.blue('==================================================\n'));

        await this.showMainMenu();
    }

    async showMainMenu() {
        console.log(chalk.yellow('📋 MENU UTAMA:'));
        console.log(chalk.white('1. 🚀 Jalankan Hourly Scheduler (Cron Job)'));
        console.log(chalk.white('2. 🛑 Hentikan Scheduler'));
        console.log(chalk.white('3. 📋 Kelola Daftar Hotel'));
        console.log(chalk.white('4. 🏨 CRUD Hotel Management'));
        console.log(chalk.white('5. 📊 Monitoring & Dashboard'));
        console.log(chalk.white('6. 🔍 Update Selector (Website Changes)'));
        console.log(chalk.white('7. ⚙️  Konfigurasi'));
        console.log(chalk.white('8. 📚 Bantuan & Dokumentasi'));
        console.log(chalk.white('9. 🚪 Keluar'));

        const choice = await this.question(chalk.cyan('\nPilih menu (1-9): '));

        switch (choice) {
            case '1':
                await this.startScheduler();
                break;
            case '2':
                await this.stopScheduler();
                break;
            case '3':
                await this.manageHotels();
                break;
            case '4':
                await this.openMonitoring();
                break;
            case '5':
                await this.showConfiguration();
                break;
            case '6':
                await this.showHelp();
                break;
            case '4':
                await this.openCRUDManagement();
                break;
            case '5':
                await this.openMonitoring();
                break;
            case '6':
                await this.updateSelectors();
                break;
            case '7':
                await this.showConfiguration();
                break;
            case '8':
                await this.showHelp();
                break;
            case '9':
                await this.exit();
                break;
            default:
                console.log(chalk.red('❌ Pilihan tidak valid!'));
                await this.showMainMenu();
        }
    }

    async startScheduler() {
        console.log(chalk.blue('\n🚀 MENJALANKAN HOURLY SCHEDULER'));
        console.log(chalk.blue('='.repeat(50)));

        if (this.isSchedulerRunning) {
            console.log(chalk.yellow('⚠️  Scheduler sudah berjalan!'));
            await this.continueToMenu();
            return;
        }

        try {
            console.log(chalk.blue('⏰ Memulai cron job setiap 1 jam...'));
            console.log(chalk.blue('🔄 Scheduler akan berjalan di background'));
            console.log(chalk.blue('💡 Gunakan menu "Monitoring" untuk melihat status'));

            const confirm = await this.question(chalk.cyan('\nLanjutkan menjalankan scheduler? (y/N): '));

            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                // Jalankan scheduler di background
                this.scheduler = new HourlyHotelScheduler();

                // Start scheduler tanpa blocking main thread
                this.scheduler.startScheduler().then(() => {
                    this.isSchedulerRunning = true;
                    console.log(chalk.green('✅ Scheduler berhasil dimulai di background!'));
                }).catch(error => {
                    console.error(chalk.red('❌ Error saat menjalankan scheduler:'), error.message);
                    this.isSchedulerRunning = false;
                });

                console.log(chalk.green('\n✅ Scheduler sedang dimulai...'));
                console.log(chalk.blue('💡 Scheduler akan berjalan setiap 1 jam'));
                console.log(chalk.blue('💡 Gunakan menu "Monitoring" untuk melihat progress'));

            } else {
                console.log(chalk.yellow('❌ Scheduler dibatalkan'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat menjalankan scheduler:'), error.message);
        }

        await this.continueToMenu();
    }

    async stopScheduler() {
        console.log(chalk.blue('\n🛑 MENGENTIKAN SCHEDULER'));
        console.log(chalk.blue('='.repeat(40)));

        if (!this.isSchedulerRunning) {
            console.log(chalk.yellow('⚠️  Scheduler tidak sedang berjalan!'));
            await this.continueToMenu();
            return;
        }

        try {
            const confirm = await this.question(chalk.red('⚠️  Yakin ingin menghentikan scheduler? (y/N): '));

            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                if (this.scheduler) {
                    this.scheduler.stopScheduler();
                }
                this.isSchedulerRunning = false;
                this.scheduler = null;
                console.log(chalk.green('✅ Scheduler berhasil dihentikan!'));
            } else {
                console.log(chalk.yellow('❌ Penghentian scheduler dibatalkan'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat menghentikan scheduler:'), error.message);
        }

        await this.continueToMenu();
    }

    async manageHotels() {
        console.log(chalk.blue('\n📋 KELOLA DAFTAR HOTEL'));
        console.log(chalk.blue('='.repeat(40)));
        console.log(chalk.blue('💡 Buka Hotel List Manager untuk mengelola daftar hotel'));
        console.log(chalk.blue('💡 Hotel yang dikonfigurasi akan di-scrape otomatis setiap 1 jam'));

        const confirm = await this.question(chalk.cyan('\nBuka Hotel List Manager? (y/N): '));

        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            console.log(chalk.blue('\n🔄 Membuka Hotel List Manager...'));
            console.log(chalk.yellow('💡 Setelah selesai, kembali ke menu utama'));

            try {
                const manager = new HotelListManager();
                await manager.start();
            } catch (error) {
                console.error(chalk.red('❌ Error saat membuka Hotel List Manager:'), error.message);
            }
        } else {
            console.log(chalk.yellow('❌ Hotel List Manager dibatalkan'));
        }

        await this.continueToMenu();
    }

    async openMonitoring() {
        console.log(chalk.blue('\n📊 MONITORING & DASHBOARD'));
        console.log(chalk.blue('='.repeat(50)));
        console.log(chalk.blue('💡 Buka monitoring untuk melihat status scraping dan data hotel'));
        console.log(chalk.blue('💡 Monitor progress scraping real-time'));

        const confirm = await this.question(chalk.cyan('\nBuka Monitoring Dashboard? (y/N): '));

        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            console.log(chalk.blue('\n🔄 Membuka Monitoring Dashboard...'));
            console.log(chalk.yellow('💡 Setelah selesai, kembali ke menu utama'));

            try {
                const monitor = new HotelMonitor();
                await monitor.start();
            } catch (error) {
                console.error(chalk.red('❌ Error saat membuka Monitoring:'), error.message);
            }
        } else {
            console.log(chalk.yellow('❌ Monitoring Dashboard dibatalkan'));
        }

        await this.continueToMenu();
    }

    async openCRUDManagement() {
        console.log(chalk.blue('\n🏨 CRUD HOTEL MANAGEMENT'));
        console.log(chalk.blue('='.repeat(40)));
        console.log(chalk.blue('💡 Buka CRUD Management untuk mengelola hotel di database'));
        console.log(chalk.blue('💡 Tambah, edit, hapus hotel tanpa perlu scraping dulu'));

        const confirm = await this.question(chalk.cyan('\nBuka CRUD Management? (y/N): '));

        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            console.log(chalk.blue('\n🔄 Membuka CRUD Management...'));
            console.log(chalk.yellow('💡 Setelah selesai, kembali ke menu utama'));

            try {
                const HotelCRUD = require('./hotel-crud');
                const hotelCRUD = new HotelCRUD();
                await hotelCRUD.start();
            } catch (error) {
                console.error(chalk.red('❌ Error saat membuka CRUD Management:'), error.message);
            }
        } else {
            console.log(chalk.yellow('❌ CRUD Management dibatalkan'));
        }

        await this.continueToMenu();
    }

    async updateSelectors() {
        console.log(chalk.blue('\n🔍 UPDATE SELECTOR (WEBSITE CHANGES)'));
        console.log(chalk.blue('='.repeat(50)));
        console.log(chalk.blue('💡 Deteksi selector baru jika website Traveloka berubah'));
        console.log(chalk.blue('💡 Otomatis update selector untuk search button'));

        const confirm = await this.question(chalk.cyan('\nUpdate Selector? (y/N): '));

        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            console.log(chalk.blue('\n🔄 Membuka Selector Updater...'));
            console.log(chalk.yellow('💡 Browser akan terbuka untuk analisis website'));

            try {
                const SelectorUpdater = require('./selector-updater');
                const selectorUpdater = new SelectorUpdater();
                await selectorUpdater.initialize();
                await selectorUpdater.detectSearchButtonSelectors();
                await selectorUpdater.cleanup();

                console.log(chalk.green('\n✅ Selector analysis selesai!'));
                console.log(chalk.cyan('💡 Lihat rekomendasi selector di atas'));
                console.log(chalk.cyan('💡 Update hotel-scraper.js dengan selector baru jika diperlukan'));

            } catch (error) {
                console.log(chalk.red(`❌ Error update selector: ${error.message}`));
            }
        }

        await this.continueToMenu();
    }

    async showConfiguration() {
        console.log(chalk.blue('\n⚙️  KONFIGURASI SISTEM'));
        console.log(chalk.blue('='.repeat(40)));

        try {
            const { scrapingConfig, hotelList } = require('./hotel-list');

            console.log(chalk.cyan('📅 Konfigurasi Scraping:'));
            console.log(chalk.white(`   ⏰ Interval: Setiap ${scrapingConfig.intervalHours} jam`));
            console.log(chalk.white(`   🕐 Waktu Aktif: ${scrapingConfig.startTime} - ${scrapingConfig.endTime}`));
            console.log(chalk.white(`   ⏳ Jeda Antar Hotel: ${scrapingConfig.delayBetweenHotels} detik`));
            console.log(chalk.white(`   ⏳ Jeda Antar Kota: ${scrapingConfig.delayBetweenCities} detik`));
            console.log(chalk.white(`   🔄 Max Retry: ${scrapingConfig.maxRetries}`));
            console.log(chalk.white(`   ⏱️  Timeout: ${scrapingConfig.requestTimeout} detik`));
            console.log(chalk.white(`   🗓️  Weekend: ${scrapingConfig.runOnWeekends ? 'Ya' : 'Tidak'}`));
            console.log(chalk.white(`   🗓️  Weekday: ${scrapingConfig.runOnWeekdays ? 'Ya' : 'Tidak'}`));

            console.log(chalk.cyan('\n🏨 Daftar Hotel:'));
            console.log(chalk.white(`   📊 Total: ${hotelList.length} hotel`));

            // Group by city
            const hotelsByCity = {};
            hotelList.forEach(hotel => {
                if (!hotelsByCity[hotel.city]) {
                    hotelsByCity[hotel.city] = [];
                }
                hotelsByCity[hotel.city].push(hotel);
            });

            Object.keys(hotelsByCity).forEach(city => {
                console.log(chalk.white(`   🏙️  ${city}: ${hotelsByCity[city].length} hotel`));
            });

            console.log(chalk.cyan('\n💡 Untuk mengubah konfigurasi:'));
            console.log(chalk.white('   1. Edit file hotel-list.js'));
            console.log(chalk.white('   2. Atau gunakan Hotel List Manager'));

        } catch (error) {
            console.error(chalk.red('❌ Error saat membaca konfigurasi:'), error.message);
        }

        await this.continueToMenu();
    }

    async showHelp() {
        console.log(chalk.blue('\n📚 BANTUAN & DOKUMENTASI'));
        console.log(chalk.blue('='.repeat(50)));

        console.log(chalk.cyan('🚀 CARA PENGGUNAAN:'));
        console.log(chalk.white('1. Jalankan Hourly Scheduler untuk memulai cron job'));
        console.log(chalk.white('2. Kelola daftar hotel yang akan di-scrape'));
        console.log(chalk.white('3. Monitor progress dan hasil scraping'));
        console.log(chalk.white('4. Export data untuk analisis lebih lanjut'));

        console.log(chalk.cyan('\n⏰ CRON JOB:'));
        console.log(chalk.white('• Scheduler berjalan setiap 1 jam'));
        console.log(chalk.white('• Waktu aktif: 06:00 - 23:00 WIB'));
        console.log(chalk.white('• Jeda antar hotel: 30 detik'));
        console.log(chalk.white('• Jeda antar kota: 60 detik'));

        console.log(chalk.cyan('\n🏨 DAFTAR HOTEL:'));
        console.log(chalk.white('• Hotel Indonesia Kempinski Jakarta (Jakarta)'));
        console.log(chalk.white('• Hotel Borobudur Jakarta (Jakarta)'));
        console.log(chalk.white('• Hotel Grand Hyatt Jakarta (Jakarta)'));
        console.log(chalk.white('• Hotel Bandung (Bandung)'));
        console.log(chalk.white('• Hotel Santika Premiere Bandung (Bandung)'));
        console.log(chalk.white('• Hotel JW Marriott Surabaya (Surabaya)'));
        console.log(chalk.white('• Hotel Sheraton Surabaya (Surabaya)'));
        console.log(chalk.white('• Hotel Hyatt Regency Yogyakarta (Yogyakarta)'));
        console.log(chalk.white('• Hotel Melia Purosani Yogyakarta (Yogyakarta)'));

        console.log(chalk.cyan('\n📊 MONITORING:'));
        console.log(chalk.white('• Status scraping hari ini'));
        console.log(chalk.white('• Data hotel terbaru'));
        console.log(chalk.white('• Analisis harga per kota'));
        console.log(chalk.white('• Trend harga hotel'));
        console.log(chalk.white('• Statistik scraping'));

        console.log(chalk.cyan('\n💾 DATABASE:'));
        console.log(chalk.white('• Data disimpan di PostgreSQL'));
        console.log(chalk.white('• Tabel: hotel_prices'));
        console.log(chalk.white('• Backup otomatis setiap hari'));

        console.log(chalk.cyan('\n🔧 TROUBLESHOOTING:'));
        console.log(chalk.white('• Pastikan database PostgreSQL berjalan'));
        console.log(chalk.white('• Cek koneksi internet'));
        console.log(chalk.white('• Pastikan browser tidak digunakan aplikasi lain'));
        console.log(chalk.white('• Cek log error di console'));

        await this.continueToMenu();
    }

    async exit() {
        console.log(chalk.blue('\n🚪 KELUAR DARI SISTEM'));
        console.log(chalk.blue('='.repeat(40)));

        if (this.isSchedulerRunning) {
            console.log(chalk.yellow('⚠️  Scheduler masih berjalan!'));
            const confirm = await this.question(chalk.red('Hentikan scheduler sebelum keluar? (y/N): '));

            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                if (this.scheduler) {
                    this.scheduler.stopScheduler();
                }
                this.isSchedulerRunning = false;
                this.scheduler = null;
                console.log(chalk.green('✅ Scheduler berhasil dihentikan'));
            }
        }

        console.log(chalk.green('👋 Terima kasih telah menggunakan Traveloka Hotel Scraper!'));
        console.log(chalk.blue('💡 Data scraping akan tersimpan di database'));
        console.log(chalk.blue('💡 Jalankan ulang untuk scraping otomatis'));

        this.rl.close();
        process.exit(0);
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async continueToMenu() {
        await this.question(chalk.cyan('\nTekan Enter untuk kembali ke menu utama...'));
        console.clear();
        await this.showMainMenu();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGINT, menghentikan sistem...'));
    if (global.mainMenu && global.mainMenu.scheduler) {
        global.mainMenu.scheduler.stopScheduler();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⚠️  Menerima signal SIGTERM, menghentikan sistem...'));
    if (global.mainMenu && global.mainMenu.scheduler) {
        global.mainMenu.scheduler.stopScheduler();
    }
    process.exit(0);
});

// Jalankan main menu
async function main() {
    try {
        global.mainMenu = new MainMenu();
        await global.mainMenu.start();
    } catch (error) {
        console.error(chalk.red('❌ Error saat menjalankan main menu:'), error);
        process.exit(1);
    }
}

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    main();
}

module.exports = MainMenu;
