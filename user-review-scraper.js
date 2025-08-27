const { firefox } = require('playwright');
const chalk = require('chalk');

// Load environment variables
require('dotenv').config();

const DatabaseManager = require('./database');

class UserReviewScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.db = new DatabaseManager();
    }

    // Helper function untuk timestamp
    getTimestamp() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        return chalk.gray(`[${hours}:${minutes}:${seconds}]`);
    }

    // Helper function untuk log yang rapi
    log(message, type = 'info') {
        const timestamp = this.getTimestamp();
        const colors = {
            info: chalk.blue,
            success: chalk.green,
            warning: chalk.yellow,
            error: chalk.red,
            cyan: chalk.cyan
        };

        const color = colors[type] || chalk.white;
        console.log(`${timestamp} ${color(message)}`);
    }

    async initialize() {
        try {
            // Initialize database connection
            await this.db.connect();

            this.log('🚀 Memulai browser Firefox untuk User Review Scraper...', 'info');

            // Launch browser dengan timeout protection (menggunakan konfigurasi yang berhasil)
            const browserPromise = firefox.launch({
                headless: false,
                timeout: 60000,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            // Set timeout untuk browser launch
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Browser launch timeout setelah 60 detik')), 60000);
            });

            this.browser = await Promise.race([browserPromise, timeoutPromise]);

            this.page = await this.browser.newPage();

            // Set timeout untuk page operations
            this.page.setDefaultTimeout(60000); // 60 detik
            this.page.setDefaultNavigationTimeout(60000); // 60 detik untuk navigation

            await this.page.setViewportSize({ width: 1366, height: 768 });

            // Block Google requests yang menghalangi
            await this.page.route('**/accounts.google.com/**', route => route.abort());
            await this.page.route('**/gsi/iframe/**', route => route.abort());

            // Event listener popup dihapus karena tidak diperlukan lagi
            // Bot hanya akan extract data dari search results

            // Set user agent yang lebih realistic
            await this.page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            });

            // Inject script untuk bypass detection dan block Google iframe
            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

                // Block Google iframe yang menghalangi
                const originalCreateElement = document.createElement;
                document.createElement = function (tagName) {
                    const element = originalCreateElement.call(this, tagName);
                    if (tagName.toLowerCase() === 'iframe' && element.src && element.src.includes('accounts.google.com')) {
                        element.style.display = 'none';
                        element.style.visibility = 'hidden';
                    }
                    return element;
                };
            });

            this.log('✅ Browser Firefox berhasil dimulai', 'success');

            // Monitor browser process (disabled untuk kompatibilitas)
            // if (this.browser.process()) {
            //     this.log('🔍 Browser process ID:', this.browser.process().pid, 'info');
            // }

            // Health check - cek apakah browser masih responsive
            try {
                const version = await this.browser.version();
                this.log(`🔍 Browser version: ${version}`, 'info');
            } catch (healthError) {
                this.log(`⚠️ Browser health check gagal: ${healthError.message}`, 'warning');
            }

            return true;

        } catch (error) {
            this.log(`❌ Gagal memulai browser: ${error.message}`, 'error');

            // Cleanup jika ada browser yang hang
            if (this.browser) {
                try {
                    await this.browser.close();
                    this.log('🧹 Browser yang hang berhasil dibersihkan', 'info');
                } catch (cleanupError) {
                    this.log(`⚠️ Gagal cleanup browser: ${cleanupError.message}`, 'warning');
                }
                this.browser = null;
            }

            return false;
        }
    }

    async openReviewProPage() {
        try {
            this.log('🌐 Membuka halaman ReviewPro...', 'info');

            // Coba buka halaman dengan retry mechanism
            let response = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    attempts++;
                    this.log(`🔄 Percobaan ke-${attempts} membuka halaman...`, 'info');

                    // Wait for 10 second
                    await this.page.waitForTimeout(10000);

                    // https://app.reviewpro.com/api/reviewpro-data/rest/reviews/_details
                    response = await this.page.goto('https://app.reviewpro.com/reviews/tracking', {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000
                    });

                    if (response && response.status() === 200) {
                        this.log(`✅ Halaman berhasil dibuka pada percobaan ke-${attempts}`, 'success');

                        // Verifikasi halaman
                        const title = await this.page.title();
                        this.log(`📄 Title: ${title}`, 'info');

                        const currentUrl = this.page.url();
                        if (currentUrl.toLowerCase().includes('login')) {
                            await this.tryLogin();
                        }

                        break;
                    } else {
                        throw new Error(`HTTP ${response?.status() || 'unknown'}`);
                    }

                } catch (error) {
                    if (attempts >= maxAttempts) {
                        throw new Error(`Gagal buka halaman setelah ${maxAttempts} percobaan: ${error.message}`);
                    }
                    this.log(`⚠️ Percobaan ke-${attempts} gagal: ${error.message}`, 'warning');
                    this.log('⏳ Menunggu 3 detik sebelum coba lagi...', 'info');
                    await this.page.waitForTimeout(3000);
                }
            }

            return true;

        } catch (error) {
            this.log(`❌ Gagal buka halaman: ${error.message}`, 'error');
            return false;
        }
    }

    async tryLogin() {
        try {
            const username = process.env.USER_REVIEW_LOGIN_USERNAME
            const password = process.env.USER_REVIEW_LOGIN_PASSWORD                

            this.log('🔒 Mencoba login...', 'info');

            // If modal cookie policy, click button that contains text "Accept all"
            const modalCookiePolicy = await this.page.$$('button:has-text("Accept all")');
            if (modalCookiePolicy.length > 0) { 
                await this.page.click('button:has-text("Accept all")');
                await this.page.waitForTimeout(1000);
            }

            // Wait for login page to load
            await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });

            // Fill login form
            await this.page.type('input[name="username"]', username);

            // wait for 1 second
            await this.page.waitForTimeout(1000);

            // Click button that contains text "Next"
            await this.page.click('button:has-text("Next")');

            // wait for 1 second
            await this.page.waitForTimeout(1000);

            // Wait for password input to appear
            await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });

            // Fill password
            await this.page.type('input[name="password"]', password);

            // Click button that contains text "Login"
            if (await this.page.isVisible('button:has-text("Log in")')) {
                await this.page.click('button:has-text("Log in")');
            } else {
                this.log('❌ Button "Log in" tidak ditemukan', 'error');
                return false;
            }

            // Wait for 1 second
            await this.page.waitForTimeout(15000);

            // Check url, if still login, then failed
            const currentUrl = this.page.url();
            if (currentUrl.toLowerCase().includes('login')) {
                this.log('❌ Login gagal', 'error');
                return false;
            }

            this.log('✅ Login berhasil', 'success');

            // Save cookies after successful login
            try {
                const cookies = await this.page.context().cookies();
                await this.page.evaluate(() => {
                    const ls = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        ls[key] = localStorage.getItem(key);
                    }
                    return ls;
                }).then(async (localStorage) => {
                    // Save cookies to file
                    const fs = require('fs').promises;
                    await fs.writeFile('tmp/reviewpro-cookies.json', JSON.stringify(cookies, null, 2));
                    this.log('✅ Cookies saved to cookies.json', 'success');

                    // Save localStorage to file
                    await fs.writeFile('tmp/reviewpro-localStorage.json', JSON.stringify(localStorage, null, 2));
                    this.log('✅ LocalStorage saved to localStorage.json', 'success');
                });
            } catch (error) {
                this.log(`⚠️ Error saving cookies/localStorage: ${error.message}`, 'warning');
            }

            return true;

        }

        catch (error) {
            this.log(`❌ Error saat login: ${error.message}`, 'error');
            return false;
        }
    }

    async setupCookies() {
        try {
            this.log('🔒 Mencoba setup cookies...', 'info');

            // Load cookies from file
            const fs = require('fs').promises;
            const cookies = await fs.readFile('tmp/reviewpro-cookies.json', 'utf8');
            const cookiesJson = JSON.parse(cookies);
            
            // Set cookies
            await this.page.context().addCookies(cookiesJson);

            this.log('✅ Cookies berhasil di-set', 'success');
            return true;

        } catch (error) {
            this.log(`❌ Error saat setup cookies: ${error.message}`, 'error');
            return false;
        }
    }

    async getDataReview() {
        try {
            this.log('🔍 Memulai proses getDataReview...', 'info');

            const responsePromise = this.page.waitForResponse('**/api/reviewpro-data/rest/reviews/_details');
            const response = await responsePromise;
            const data = await response.json();

            const insertData = data.map(review => ({
                api_id: review.id,
                text: review.text,
                author: review.author,
                review_level: review.overallScore.value,
                max_review_level: review.overallScore.outOf,
                is_replied: review.replied ? 1 : 0,
                productInfo: review.productInfo ? review.productInfo.name : "",
                reply_url: review.replyToUrl,
                reply_date: review.managementResponses ? (review.managementResponses.length > 0 ? new Date(review.managementResponses[0].date).toISOString().slice(0, 19).replace('T', ' ') : null) : null,
                reply: review.managementResponses ? (review.managementResponses.length > 0 ? review.managementResponses[0].text : "") : "",
                reply_author: review.managementResponses ? (review.managementResponses.length > 0 ? review.managementResponses[0].author : "") : "",
                metadata: JSON.stringify(review)
            }));

            console.log('<<', insertData);
            this.log('✅ Berhasil mendapatkan data review', 'success');

            await this.page.waitForTimeout(2000);
            
            this.log('✅ Setup API interceptor berhasil', 'success');
            return true;

        } catch (error) {
            this.log(`❌ Error saat getDataReview: ${error.message}`, 'error');
            return false;
        }
    }

    async scrapeUserReview() {
        let scrapingLogId = null;

        try {
            this.log(`🏨 USER REVIEW SCRAPER`, 'blue');
            this.log('='.repeat(50), 'blue');

            // Step 2: Mulai scraping
            this.log('🚀 Memulai browser Firefox untuk User Review Scraper...', 'blue');
            await this.initialize();

            // Setup cookies
            this.log('🔒 Mencoba setup cookies...', 'info');
            await this.setupCookies();

            this.log('🌐 Membuka halaman ReviewPro...', 'blue');
            await this.openReviewProPage();

            this.log('🔍 Memulai proses getDataReview...', 'info'); 
            await this.getDataReview();
            
            this.log('✅ Proses getDataReview berhasil', 'success');

            // Wait for 30 second
            await this.page.waitForTimeout(30000);

            return {};

        } catch (error) {
            this.log(`❌ Error fatal dalam scraping: ${error.message}`, 'error');

            // Step 4: Update log scraping menjadi error
            if (scrapingLogId && this.db && this.db.isConnected) {
                try {
                    await this.db.updateScrapingLogError(scrapingLogId, error.message);
                } catch (logError) {
                    this.log(`❌ Error saat update log error: ${logError.message}`, 'error');
                }
            }

            return null;
        } finally {
            // Cleanup browser
            if (this.browser) {
                await this.cleanup();
            }
        }
    }

    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.log('✅ Page ditutup', 'success');
            }

            if (this.browser) {
                await this.browser.close();
                this.log('✅ Browser ditutup', 'success');
            }

            // Tutup koneksi database
            if (this.db) {
                await this.db.close();
            }

            this.log('✅ Semua resource dibersihkan', 'success');

        } catch (error) {
            this.log(`❌ Error saat cleanup: ${error.message}`, 'error');
        }
    }
}

// Export class
module.exports = UserReviewScraper;

// Test function jika dijalankan langsung
if (require.main === module) {
    async function main() {
        try {
            const scraper = new UserReviewScraper();
            try {
                await scraper.scrapeUserReview();
            } catch (error) {
                console.log(chalk.red(`❌ Error: ${error.message}`));
            } finally {
                await scraper.cleanup();
            }
        } catch (error) {
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    main();
}