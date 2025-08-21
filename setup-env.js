const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class EnvironmentSetup {
    constructor() {
        this.envContent = `# ==================================================
# 🗄️ DATABASE CONFIGURATION
# ==================================================
# PostgreSQL Database Settings
DB_USER=postgres
DB_HOST=localhost
DB_NAME=traveloka_scraper
DB_PASSWORD=Evan5758
DB_PORT=5432

# ==================================================
# 🔧 APPLICATION CONFIGURATION
# ==================================================
# Screenshot directory
SCREENSHOT_DIR=./screenshots

# Maximum retry attempts for scraping
MAX_RETRIES=3

# Search timeout in milliseconds
SEARCH_TIMEOUT=60000

# Price update interval in milliseconds (3 hours)
PRICE_UPDATE_INTERVAL=10800000

# ==================================================
# 🌐 BROWSER CONFIGURATION
# ==================================================
# Browser type (firefox, chromium, webkit)
BROWSER_TYPE=firefox

# Headless mode (true/false)
HEADLESS=false

# Browser viewport
BROWSER_WIDTH=1366
BROWSER_HEIGHT=768

# ==================================================
# 🔒 SECURITY CONFIGURATION
# ==================================================
# Enable SSL for database connection (true/false)
DB_SSL=false

# Database connection pool size
DB_POOL_SIZE=20

# Database connection timeout (milliseconds)
DB_CONNECTION_TIMEOUT=2000

# Database idle timeout (milliseconds)
DB_IDLE_TIMEOUT=30000

# ==================================================
# 📸 SCREENSHOT CONFIGURATION
# ==================================================
# Enable screenshots (true/false)
ENABLE_SCREENSHOTS=true

# Screenshot quality (1-100)
SCREENSHOT_QUALITY=80

# Screenshot format (png, jpeg)
SCREENSHOT_FORMAT=png

# ==================================================
# ⏰ SCHEDULER CONFIGURATION
# ==================================================
# Enable automatic scheduling (true/false)
ENABLE_SCHEDULER=true

# Cron schedule for automatic scraping (every 3 hours)
SCHEDULE_CRON=0 */3 * * *

# ==================================================
# 🌍 REGIONAL SETTINGS
# ==================================================
# Default currency
DEFAULT_CURRENCY=IDR

# Default timezone
DEFAULT_TIMEZONE=Asia/Jakarta

# Language preference
LANGUAGE=id-ID

# ==================================================
# 💾 DATA RETENTION
# ==================================================
# Days to keep old data
DATA_RETENTION_DAYS=30

# Enable automatic cleanup (true/false)
ENABLE_AUTO_CLEANUP=true

# Cleanup schedule (cron format)
CLEANUP_SCHEDULE=0 2 * * 0

# ==================================================
# 🔐 SECURITY NOTES
# ==================================================
# - Never hardcode passwords in code
# - Use strong, unique passwords
# - Regularly rotate database credentials
# - Restrict database access to necessary users only
# - Enable SSL in production environments
# - Monitor database access logs

# ==================================================
# 📞 SUPPORT
# ==================================================
# If you need help:
# 1. Check the README.md file
# 2. Review QUICK-START.md
# 3. Check troubleshooting section
# 4. Create an issue on GitHub`;
    }

    async setup() {
        console.log(chalk.blue('🚀 SETUP ENVIRONMENT VARIABLES'));
        console.log(chalk.blue('='.repeat(50)));

        try {
            const envPath = path.join(process.cwd(), '.env');

            // Check if .env already exists
            if (fs.existsSync(envPath)) {
                console.log(chalk.yellow('⚠️ File .env sudah ada'));

                const choice = await this.askQuestion('Apakah ingin overwrite? (y/N): ');
                if (choice.toLowerCase() !== 'y' && choice.toLowerCase() !== 'yes') {
                    console.log(chalk.blue('✅ Setup dibatalkan, file .env tidak berubah'));
                    return;
                }
            }

            // Create .env file
            fs.writeFileSync(envPath, this.envContent);
            console.log(chalk.green('✅ File .env berhasil dibuat'));
            console.log(chalk.blue(`📁 Lokasi: ${envPath}`));

            // Show next steps
            console.log(chalk.blue('\n🚀 Langkah selanjutnya:'));
            console.log(chalk.white('   1. Setup database: npm run setup-db'));
            console.log(chalk.white('   2. Test koneksi: npm run test-db'));
            console.log(chalk.white('   3. Jalankan aplikasi: npm start'));

            // Show important variables
            console.log(chalk.blue('\n🔑 Variabel penting yang sudah diset:'));
            console.log(chalk.white(`   DB_USER: postgres`));
            console.log(chalk.white(`   DB_HOST: localhost`));
            console.log(chalk.white(`   DB_NAME: traveloka_scraper`));
            console.log(chalk.white(`   DB_PASSWORD: Evan5758`));
            console.log(chalk.white(`   DB_PORT: 5432`));

            console.log(chalk.blue('\n📊 Database yang akan dibuat:'));
            console.log(chalk.white(`   • hotel_scraping_results - Hasil scraping`));
            console.log(chalk.white(`   • hotel_data - Data hotel terintegrasi`));
            console.log(chalk.white(`   • Functions: cleanup_old_data, update_hotel_data_updated_at`));

            console.log(chalk.green('\n🎉 Environment setup completed successfully!'));

        } catch (error) {
            console.log(chalk.red(`❌ Setup failed: ${error.message}`));
        }
    }

    askQuestion(question) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }
}

// Jalankan setup jika file ini dijalankan langsung
if (require.main === module) {
    const setup = new EnvironmentSetup();
    setup.setup().then(() => {
        console.log(chalk.blue('\n👋 Setup completed!'));
        process.exit(0);
    }).catch((error) => {
        console.log(chalk.red(`\n💥 Setup failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = EnvironmentSetup;
