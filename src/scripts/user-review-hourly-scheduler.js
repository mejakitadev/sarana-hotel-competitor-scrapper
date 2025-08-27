require('dotenv').config();
const cron = require('node-cron');
const chalk = require('chalk');
const UserReviewScraper = require('./user-review-scraper');

class UserReviewHourlyScheduler {
    constructor() {
        this.scraper = null;
        this.isRunning = false;
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

        console.log(chalk.blue(`⏰ Memulai User Review Scraper dengan cron: ${cronExpression}`));
        console.log(chalk.blue(`🌍 Timezone: ${timezone}`));
        console.log(chalk.blue(`⏰ Waktu aktif: ${startTime} - ${endTime}`));

        try {
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

            console.log(chalk.green('✅ User Review Scraper berhasil dimulai!'));
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
            // Format waktu menjadi HH:MM
            const localCurrentTime = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
            const currentTime = localCurrentTime.split('.')[0] + ':' + localCurrentTime.split('.')[1]
            console.log(chalk.blue(`Waktu saat ini: ${currentTime}`));

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
            console.log(chalk.blue(`\n🚀 Memulai User Review Scraping pada ${this.currentRun.startTime.toLocaleString('id-ID')}`));
            console.log(chalk.blue('='.repeat(80)));

            try {
                // Buat instance scraper baru untuk setiap hotel
                this.scraper = new UserReviewScraper();

                // Scrape hotel dengan flow baru
                const scrapStatus = await this.scraper.scrapeUserReview();

                if (scrapStatus) {
                    console.log(chalk.green(`✅ Berhasil scrape user review`));
                } else {
                    console.log(chalk.red(`❌ Gagal scrape user review`));
                    this.currentRun.failedScrapes++;
                }

                // Cleanup scraper
                await this.scraper.cleanup();
                this.scraper = null;
            } catch (error) {
                console.error(chalk.red(`❌ Error fatal saat scraping user review:`), error.message);
                console.error(chalk.red(`Stack trace:`), error.stack);

                // Cleanup scraper
                if (this.scraper) {
                    await this.scraper.cleanup();
                    this.scraper = null;
                }

                // Hentikan cron job dengan error
                this.isRunning = false;
                throw new Error(`Fatal error saat scraping user review: ${error.message}`);
            }


            this.currentRun.endTime = new Date();
            const duration = (this.currentRun.endTime - this.currentRun.startTime) / 1000;
            console.log(chalk.green(`\n✅ User Review Scraping selesai dalam ${duration.toFixed(2)} detik`));

        } catch (error) {
            console.error(chalk.red(`❌ Error fatal dalam user review scraping: ${error.message}`));
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

    stopScheduler() {
        console.log(chalk.blue('🛑 Menghentikan User Review Scraper...'));

        try {
            // Cleanup scraper jika sedang berjalan
            if (this.scraper) {
                this.scraper.cleanup();
                this.scraper = null;
            }

            // Reset state
            this.isRunning = false;
            this.currentRun = {
                startTime: null,
                endTime: null,
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
        global.hourlyScheduler = new UserReviewHourlyScheduler();
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

module.exports = UserReviewHourlyScheduler;
