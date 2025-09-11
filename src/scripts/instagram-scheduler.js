require('dotenv').config();
const cron = require('node-cron');
const chalk = require('chalk');
const InstagramScraperBot = require('./instagram-scraper');

class InstagramScheduler {
    constructor() {
        this.scraper = null;
        this.isRunning = false;
    }

    async startScheduler() {
        // Ambil konfigurasi langsung dari .env - Sama dengan hotel scheduler
        const cronExpression = process.env.INSTAGRAM_SCHEDULER_CRON || '0 */3 * * *'; // Default setiap 3 jam pada menit 00
        const timezone = process.env.INSTAGRAM_SCHEDULER_TIMEZONE || 'Asia/Jakarta';
        const startTime = process.env.INSTAGRAM_SCHEDULER_START_TIME || '00:00';
        const endTime = process.env.INSTAGRAM_SCHEDULER_END_TIME || '23:59';

        // Validasi cron expression
        if (!cron.validate(cronExpression)) {
            console.error(chalk.red('❌ INSTAGRAM_SCHEDULER_CRON tidak valid'));
            console.error(chalk.red(`   Cron expression: ${cronExpression}`));
            console.error(chalk.red('   Format yang benar: 0 */3 * * * (setiap 3 jam pada menit ke-0)'));
            process.exit(1);
        }

        console.log(chalk.blue(`⏰ Memulai Instagram scheduler setiap 3 jam pada menit 00...`));
        console.log(chalk.blue(`🔄 Cron Expression: ${cronExpression}`));
        console.log(chalk.blue(`🌍 Timezone: ${timezone}`));
        console.log(chalk.blue(`⏰ Waktu aktif: ${startTime} - ${endTime}`));

        // Jalankan scraping pertama kali jika dalam waktu aktif
        if (this.isWithinActiveTime(startTime, endTime)) {
            console.log(chalk.blue('🚀 Menjalankan Instagram scraping pertama kali...'));
            await this.runScraping();
        } else {
            console.log(chalk.yellow('⏰ Waktu belum aktif, menunggu jadwal berikutnya...'));
        }

        // Set cron job berdasarkan konfigurasi
        cron.schedule(cronExpression, async () => {
            if (!this.isRunning && this.isWithinActiveTime(startTime, endTime)) {
                await this.runScraping();
            } else if (this.isRunning) {
                console.log(chalk.yellow('⚠️  Instagram scraping sebelumnya masih berjalan, melewati jadwal ini'));
            } else {
                console.log(chalk.yellow('⏰ Waktu belum aktif, melewati jadwal ini'));
            }
        }, {
            scheduled: true,
            timezone: timezone
        });

        console.log(chalk.green('✅ Instagram Scheduler berhasil dimulai!'));
        console.log(chalk.blue('💡 Tekan Ctrl+C untuk menghentikan scheduler'));
    }

    isWithinActiveTime(startTime, endTime) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        return currentTime >= startMinutes && currentTime <= endMinutes;
    }

    async runScraping() {
        if (this.isRunning) {
            console.log(chalk.yellow('⚠️  Instagram scraping sudah berjalan, melewati jadwal ini'));
            return;
        }

        this.isRunning = true;
        const startTime = new Date();

        try {
            console.log(chalk.cyan(`\n🚀 Memulai Instagram scraping pada ${startTime.toLocaleString('id-ID')}`));

            this.scraper = new InstagramScraperBot();

            // Load accounts list
            this.scraper.loadAccountsList();

            // Initialize browser
            await this.scraper.initialize();

            // Login to Instagram
            const loginSuccess = await this.scraper.loginToInstagram();
            if (!loginSuccess) {
                console.log(chalk.red('❌ Login Instagram gagal. Melewati scraping ini.'));
                return;
            }

            // Scrape all accounts
            await this.scraper.scrapeAllAccounts();

            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);

            console.log(chalk.green(`✅ Instagram scraping selesai dalam ${duration} detik`));
            console.log(chalk.green(`📊 Selesai pada: ${endTime.toLocaleString('id-ID')}`));

        } catch (error) {
            console.log(chalk.red(`❌ Error saat Instagram scraping: ${error.message}`));
        } finally {
            if (this.scraper) {
                await this.scraper.cleanup();
            }
            this.isRunning = false;
        }
    }


    async stopScheduler() {
        console.log(chalk.yellow('🛑 Menghentikan Instagram scheduler...'));
        if (this.scraper) {
            await this.scraper.cleanup();
        }
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 Menerima signal SIGINT, menghentikan Instagram scheduler...'));
    if (global.instagramScheduler) {
        await global.instagramScheduler.stopScheduler();
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n🛑 Menerima signal SIGTERM, menghentikan Instagram scheduler...'));
    if (global.instagramScheduler) {
        await global.instagramScheduler.stopScheduler();
    } else {
        process.exit(0);
    }
});

// Main execution
async function main() {
    try {
        global.instagramScheduler = new InstagramScheduler();
        await global.instagramScheduler.startScheduler();
    } catch (error) {
        console.log(chalk.red(`❌ Error starting Instagram scheduler: ${error.message}`));
        process.exit(1);
    }
}

// Run the scheduler
if (require.main === module) {
    main().catch(console.error);
}

module.exports = InstagramScheduler;
