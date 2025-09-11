const { firefox } = require('playwright');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const DatabaseManager = require('../utils/database');

class InstagramScraperBot {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.db = new DatabaseManager();
        this.accountsList = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const colors = {
            info: chalk.blue,
            success: chalk.green,
            error: chalk.red,
            warning: chalk.yellow,
            debug: chalk.gray
        };
        const color = colors[type] || chalk.white;
        console.log(`${timestamp} ${color(message)}`);
    }

    // Load accounts list from database
    async loadAccountsList() {
        try {
            await this.db.connect();
            this.accountsList = await this.db.getAllSocmedAccounts();
            this.log(`📋 Loaded ${this.accountsList.length} social media accounts from database`, 'info');
        } catch (error) {
            this.log(`❌ Error loading accounts from database: ${error.message}`, 'error');
            this.accountsList = [];
        }
    }

    async initialize() {
        try {
            this.log('🚀 Memulai browser Firefox untuk Instagram Scraper...', 'info');

            // Add retry logic for browser startup
            let browserStarted = false;
            let retryCount = 0;
            const maxRetries = 3;

            while (!browserStarted && retryCount < maxRetries) {
                try {
                    this.log(`🔄 Mencoba memulai browser (attempt ${retryCount + 1}/${maxRetries})...`, 'info');

                    // Launch browser dengan timeout protection
                    const browserPromise = firefox.launch({
                        headless: true, // Headless mode - browser tidak muncul di window
                        timeout: 30000, // 30 seconds timeout
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-gpu',
                            '--no-first-run',
                            '--disable-default-apps',
                            '--disable-web-security',
                            '--disable-features=VizDisplayCompositor',
                            '--window-size=1366,768',
                            '--disable-blink-features=AutomationControlled'
                        ]
                    });

                    // Set timeout untuk browser launch
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Browser launch timeout setelah 30 detik')), 30000);
                    });

                    this.browser = await Promise.race([browserPromise, timeoutPromise]);

                    // Wait a bit for browser to fully initialize
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    browserStarted = true;
                    this.log('✅ Browser berhasil dimulai', 'success');

                } catch (error) {
                    retryCount++;
                    this.log(`⚠️ Browser startup gagal (attempt ${retryCount}): ${error.message}`, 'warning');

                    if (retryCount < maxRetries) {
                        this.log('⏳ Menunggu 5 detik sebelum mencoba lagi...', 'info');
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } else {
                        throw error;
                    }
                }
            }

            this.page = await this.browser.newPage();

            // Set timeout untuk page operations
            this.page.setDefaultTimeout(60000); // 60 detik
            this.page.setDefaultNavigationTimeout(60000); // 60 detik untuk navigation

            await this.page.setViewportSize({ width: 1366, height: 768 });

            // Block Google requests yang menghalangi
            await this.page.route('**/accounts.google.com/**', route => route.abort());
            await this.page.route('**/gsi/iframe/**', route => route.abort());

            // Set user agent yang lebih realistic
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
            });

            this.log('✅ Browser berhasil dimulai', 'success');

        } catch (error) {
            this.log(`❌ Error saat initialize browser: ${error.message}`, 'error');
            throw error;
        }
    }

    async loginToInstagram() {
        try {
            this.log('📱 Membuka halaman login Instagram...', 'info');
            await this.page.goto('https://www.instagram.com/accounts/login/');

            // Wait for page to load
            await this.page.waitForLoadState('networkidle');

            // Hardcoded credentials for development
            const email = 'amankalikan13';
            const password = 'amankali13';

            this.log('🔐 Menggunakan kredensial hardcode untuk development...', 'info');
            this.log(`👤 Username: ${email}`, 'debug');

            this.log('⏳ Mengisi form login...', 'info');

            // Find and fill email field
            await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
            await this.page.fill('input[name="username"]', email);

            // Find and fill password field
            await this.page.fill('input[name="password"]', password);

            // Click login button
            await this.page.click('button[type="submit"]', { timeout: 30000 });

            this.log('⏳ Sedang login...', 'info');

            // Handle potential popups after login
            try {
                // Wait for potential popups and dismiss them
                await this.page.waitForTimeout(2000);

                // Check for "Save Login Info" popup
                const saveLoginSelectors = [
                    'button:has-text("Not Now")',
                    'button:has-text("Not now")',
                    'button:has-text("Tidak Sekarang")',
                    '[data-testid="not-now-button"]'
                ];

                for (const selector of saveLoginSelectors) {
                    try {
                        const popupButton = await this.page.waitForSelector(selector, { timeout: 1000 });
                        if (popupButton) {
                            await popupButton.click();
                            this.log('✅ Popup "Save Login Info" ditutup', 'success');
                            await this.page.waitForTimeout(1000);
                        }
                    } catch (e) {
                        // No popup found, continue
                    }
                }

                // Check for "Turn on Notifications" popup
                const notificationSelectors = [
                    'button:has-text("Not Now")',
                    'button:has-text("Not now")',
                    'button:has-text("Tidak Sekarang")',
                    '[data-testid="not-now-button"]'
                ];

                for (const selector of notificationSelectors) {
                    try {
                        const notificationButton = await this.page.waitForSelector(selector, { timeout: 1000 });
                        if (notificationButton) {
                            await notificationButton.click();
                            this.log('✅ Popup "Turn on Notifications" ditutup', 'success');
                            await this.page.waitForTimeout(1000);
                        }
                    } catch (e) {
                        // No popup found, continue
                    }
                }

            } catch (error) {
                this.log(`⚠️ Error handling popups: ${error.message}`, 'warning');
            }

            // Wait for login to complete
            try {
                // Wait a bit for the page to process
                await this.page.waitForTimeout(3000);

                // Check for various success indicators
                const currentUrl = this.page.url();
                this.log(`🔍 Current URL: ${currentUrl}`, 'debug');

                // Check if we're redirected away from login page
                if (!currentUrl.includes('/accounts/login/')) {
                    this.isLoggedIn = true;
                    this.log('✅ Login berhasil! (Redirected from login page)', 'success');
                    return true;
                }

                // Check for error messages
                const errorSelectors = [
                    'div[role="alert"]',
                    '[data-testid="error-message"]',
                    '.error-message',
                    'div:has-text("incorrect")',
                    'div:has-text("wrong")',
                    'div:has-text("invalid")'
                ];

                let hasError = false;
                for (const selector of errorSelectors) {
                    try {
                        const errorElement = await this.page.waitForSelector(selector, { timeout: 2000 });
                        if (errorElement) {
                            const errorText = await errorElement.textContent();
                            this.log(`❌ Error detected: ${errorText}`, 'error');
                            hasError = true;
                            break;
                        }
                    } catch (e) {
                        // No error found with this selector, continue
                    }
                }

                if (hasError) {
                    this.log('❌ Login gagal karena error yang terdeteksi.', 'error');
                    return false;
                }

                // Check if we can find Instagram home elements (indicating successful login)
                const homeSelectors = [
                    'svg[aria-label="Home"]',
                    'a[href="/"]',
                    '[data-testid="home"]',
                    'nav[role="navigation"]'
                ];

                for (const selector of homeSelectors) {
                    try {
                        const homeElement = await this.page.waitForSelector(selector, { timeout: 2000 });
                        if (homeElement) {
                            this.isLoggedIn = true;
                            this.log('✅ Login berhasil! (Home elements detected)', 'success');
                            return true;
                        }
                    } catch (e) {
                        // Home element not found, continue
                    }
                }

                // If we're still on login page but no error, wait a bit more and check again
                this.log('⏳ Menunggu proses login...', 'info');
                await this.page.waitForTimeout(5000);

                const finalUrl = this.page.url();
                this.log(`🔍 Final URL: ${finalUrl}`, 'debug');

                if (!finalUrl.includes('/accounts/login/')) {
                    this.isLoggedIn = true;
                    this.log('✅ Login berhasil! (Final check passed)', 'success');
                    return true;
                }

                // Last resort: check if we can find any Instagram content
                const instagramContent = await this.page.evaluate(() => {
                    return document.querySelector('main') || document.querySelector('[role="main"]') || document.querySelector('article');
                });

                if (instagramContent) {
                    this.isLoggedIn = true;
                    this.log('✅ Login berhasil! (Instagram content detected)', 'success');
                    return true;
                }

                this.log('❌ Login gagal. Tidak dapat mendeteksi keberhasilan login.', 'error');
                return false;

            } catch (error) {
                this.log(`❌ Error saat mengecek status login: ${error.message}`, 'error');
                return false;
            }

        } catch (error) {
            this.log(`❌ Error saat login: ${error.message}`, 'error');
            return false;
        }
    }

    async scrapeAllAccounts() {
        if (!this.isLoggedIn) {
            this.log('❌ Silakan login terlebih dahulu!', 'error');
            return;
        }

        this.log(`📋 Akan scrape ${this.accountsList.length} akun yang aktif`, 'info');

        for (let i = 0; i < this.accountsList.length; i++) {
            const account = this.accountsList[i];
            this.log(`\n🎯 Scraping akun ${i + 1}/${this.accountsList.length}: ${account.username}`, 'info');
            this.log(`📝 URL: ${account.account_url}`, 'debug');

            try {
                await this.searchAndScrapeProfile(account.account_url, account.username, account.id);

                // Delay antara akun untuk menghindari rate limiting
                if (i < this.accountsList.length - 1) {
                    this.log('⏳ Menunggu 10 detik sebelum scrape akun berikutnya...', 'info');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            } catch (error) {
                this.log(`❌ Error saat scraping akun ${account.username}: ${error.message}`, 'error');
                // Continue dengan akun berikutnya
                continue;
            }
        }

        this.log(`✅ Selesai scraping semua akun!`, 'success');
    }

    async searchAndScrapeProfile(targetLink, username, accountId) {
        try {
            this.log(`🔍 Navigasi ke profil target: ${targetLink}`, 'info');

            // Navigate to the target profile with retry logic
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    this.log(`🔄 Attempt ${retryCount + 1}/${maxRetries} - Navigate to profile...`, 'info');
                    await this.page.goto(targetLink, { timeout: 60000 }); // Increase timeout to 60s
                    await this.page.waitForLoadState('networkidle', { timeout: 60000 }); // Increase timeout to 60s
                    break; // Success, exit retry loop
                } catch (error) {
                    retryCount++;
                    this.log(`⚠️ Attempt ${retryCount} failed: ${error.message}`, 'warning');

                    if (retryCount >= maxRetries) {
                        throw error; // Re-throw error if all retries failed
                    }

                    this.log(`⏳ Waiting 5 seconds before retry...`, 'info');
                    await this.page.waitForTimeout(5000);
                }
            }

            this.log('📸 Memulai scraping postingan...', 'info');

            // Scroll to load more posts
            await this.scrollToLoadPosts();

            // Get all post links from the target account only
            const postLinks = await this.getPostLinksFromTargetAccount(username);

            this.log(`📊 Ditemukan ${postLinks.length} postingan dari akun ${username}`, 'info');

            // Filter posts by date - only today's posts
            const today = new Date();
            const todayStr = today.toLocaleDateString('id-ID');

            this.log(`📅 Filtering posts from today only (${todayStr})`, 'info');

            // Take only the first 9 posts (most recent) - we'll filter by date during scraping
            const maxPosts = Math.min(postLinks.length, 9);
            const recentPosts = postLinks.slice(0, maxPosts);

            this.log(`📝 Akan scrape ${recentPosts.length} postingan teratas (filter hari ini)`, 'info');

            // Scrape each post
            const scrapedData = [];
            let todayPostsCount = 0;

            for (let i = 0; i < Math.min(recentPosts.length, 9); i++) {
                this.log(`📝 Scraping postingan ${i + 1}/9`, 'info');

                // Check if browser is still active
                if (!this.browser || !this.page) {
                    this.log(`❌ Browser tidak aktif, menghentikan scraping`, 'error');
                    break;
                }

                try {
                    // Check date BEFORE scraping
                    const isToday = await this.checkPostDate(recentPosts[i]);

                    if (!isToday) {
                        this.log(`⏭️ Postingan ${i + 1} di-skip (bukan hari ini)`, 'info');
                        continue;
                    }

                    this.log(`📅 Postingan ${i + 1} adalah hari ini, mulai scraping...`, 'info');

                    const postData = await this.scrapePost(recentPosts[i]);
                    if (postData) {
                        scrapedData.push(postData);
                        todayPostsCount++;

                        // Save to database immediately after scraping
                        await this.saveSinglePostToDatabase(postData, accountId, username);

                        this.log(`✅ Postingan ${i + 1} berhasil di-scrape dan disimpan`, 'success');
                    }
                } catch (error) {
                    this.log(`❌ Error saat scraping postingan ${i + 1}: ${error.message}`, 'error');

                    // If browser is closed or timeout, break the loop
                    if (error.message.includes('Target page, context or browser has been closed') ||
                        error.message.includes('Timeout') ||
                        error.message.includes('Protocol error')) {
                        this.log(`❌ Browser error, menghentikan scraping`, 'error');
                        break;
                    }

                    // Try to save error log
                    try {
                        await this.db.addSocmedScrapingLog(
                            accountId,
                            recentPosts[i],
                            '',
                            'error',
                            error.message
                        );
                    } catch (logError) {
                        this.log(`⚠️ Error saving error log: ${logError.message}`, 'warning');
                    }
                    // Continue dengan postingan berikutnya
                    continue;
                }

                // Small delay between posts
                try {
                    await this.page.waitForTimeout(2000);
                } catch (error) {
                    this.log(`⚠️ Delay error (continuing): ${error.message}`, 'warning');

                    // If browser is closed, break the loop
                    if (error.message.includes('Target page, context or browser has been closed')) {
                        this.log(`❌ Browser ditutup, menghentikan scraping`, 'error');
                        break;
                    }
                }
            }

            // Data sudah disimpan satu per satu, tidak perlu batch save lagi

            this.log(`✅ Scraping ${username} selesai! ${scrapedData.length} postingan hari ini berhasil di-scrape`, 'success');
            this.log(`📅 Total postingan hari ini: ${todayPostsCount}`, 'info');

            return scrapedData;

        } catch (error) {
            this.log(`❌ Error saat scraping profil ${username}: ${error.message}`, 'error');
            return [];
        }
    }

    extractUsernameFromUrl(url) {
        try {
            const match = url.match(/instagram\.com\/([^\/\?]+)/);
            return match ? match[1] : null;
        } catch (error) {
            this.log(`❌ Error extracting username: ${error.message}`, 'error');
            return null;
        }
    }

    async scrollToLoadPosts() {
        this.log('📜 Scroll untuk memuat lebih banyak postingan...', 'info');

        // Wait for initial load
        await this.page.waitForTimeout(3000);

        // Multiple scroll attempts to ensure posts are loaded
        for (let i = 0; i < 5; i++) {
            this.log(`📜 Scroll ${i + 1}/5...`, 'info');
            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await this.page.waitForTimeout(3000);

            // Check if we can see posts
            const postCount = await this.page.evaluate(() => {
                return document.querySelectorAll('a[href*="/p/"]').length;
            });

            this.log(`📊 Postingan terlihat: ${postCount}`, 'debug');

            if (postCount > 0) {
                break;
            }
        }

        // Final scroll to make sure everything is loaded
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.page.waitForTimeout(2000);

        this.log('✅ Scroll selesai', 'success');
    }

    async getPostLinksFromTargetAccount(targetUsername) {
        try {
            this.log(`🔍 Mencari postingan dari akun: ${targetUsername}`, 'info');

            // Get posts in visual order (top to bottom, left to right)
            const postsInOrder = await this.page.evaluate((targetUsername) => {
                const posts = [];

                // Find all post links that belong to the target account
                // Include both regular posts (/p/) and reels (/reel/)
                const allPostElements = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');

                allPostElements.forEach(element => {
                    const href = element.href;
                    if (href.includes(`instagram.com/${targetUsername}/p/`) ||
                        href.includes(`instagram.com/${targetUsername}/reel/`)) {
                        // Get the position of the element in the DOM
                        const rect = element.getBoundingClientRect();
                        const postId = href.match(/\/(?:p|reel)\/([^\/]+)\//)?.[1] || '';

                        posts.push({
                            url: href,
                            postId: postId,
                            top: rect.top,
                            left: rect.left,
                            type: href.includes('/reel/') ? 'reel' : 'post'
                        });
                    }
                });

                // Sort by visual position: top first, then left
                posts.sort((a, b) => {
                    // First sort by top position (higher = earlier)
                    if (Math.abs(a.top - b.top) > 10) {
                        return a.top - b.top;
                    }
                    // If same row, sort by left position
                    return a.left - b.left;
                });

                return posts;
            }, targetUsername);

            this.log(`📊 Total postingan ditemukan: ${postsInOrder.length}`, 'debug');

            this.log(`📝 12 postingan teratas (berdasarkan urutan visual):`, 'info');
            postsInOrder.slice(0, 12).forEach((post, index) => {
                const typeIcon = post.type === 'reel' ? '🎬' : '📸';
                this.log(`   ${index + 1}. ${typeIcon} ${post.type.toUpperCase()} - ${post.url}`, 'debug');
            });

            return postsInOrder.slice(0, 12).map(post => post.url);

        } catch (error) {
            this.log(`❌ Error saat mendapatkan link postingan: ${error.message}`, 'error');
            return [];
        }
    }

    async checkPostDate(postUrl) {
        try {
            // Check if browser is still active before navigating
            if (!this.browser || !this.page) {
                this.log(`❌ Browser tidak aktif, skip check tanggal`, 'error');
                return false;
            }

            await this.page.goto(postUrl, { timeout: 60000 });
            await this.page.waitForLoadState('networkidle', { timeout: 60000 });
            await this.page.waitForTimeout(2000);

            // Get post date with multiple selectors
            let postDate = '';
            const dateSelectors = [
                'time[datetime]',
                'time',
                'span:has-text("ago")',
                'span:has-text("hours ago")',
                'span:has-text("days ago")',
                'span:has-text("weeks ago")',
                'span:has-text("months ago")'
            ];

            for (const selector of dateSelectors) {
                try {
                    const dateElement = await this.page.waitForSelector(selector, { timeout: 2000 });
                    if (dateElement) {
                        // Try to get datetime attribute first
                        postDate = await dateElement.getAttribute('datetime');
                        if (postDate) {
                            break;
                        }

                        // If no datetime, get text content
                        const dateText = await dateElement.textContent();
                        if (dateText && dateText.trim()) {
                            postDate = dateText.trim();
                            break;
                        }
                    }
                } catch (error) {
                    // Try next selector
                }
            }

            // Check if post is from today
            const today = new Date();
            const todayStr = today.toLocaleDateString('id-ID');
            let isToday = false;

            if (postDate) {
                try {
                    let postDateObj;
                    if (postDate.includes('T')) {
                        // ISO format
                        postDateObj = new Date(postDate);
                    } else if (postDate.includes('ago') || postDate.includes('hours') || postDate.includes('days')) {
                        // Relative time format
                        const hoursAgo = postDate.match(/(\d+)\s*hours?\s*ago/);
                        const daysAgo = postDate.match(/(\d+)\s*days?\s*ago/);

                        if (hoursAgo) {
                            postDateObj = new Date(today.getTime() - (parseInt(hoursAgo[1]) * 60 * 60 * 1000));
                        } else if (daysAgo) {
                            const days = parseInt(daysAgo[1]);
                            if (days === 0) {
                                postDateObj = today; // Today
                            } else {
                                postDateObj = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
                            }
                        } else {
                            postDateObj = today; // Assume today if can't parse
                        }
                    } else {
                        postDateObj = new Date(postDate);
                    }

                    const postDateStr = postDateObj.toLocaleDateString('id-ID');
                    isToday = postDateStr === todayStr;

                } catch (error) {
                    this.log(`⚠️ Error parsing date: ${postDate}`, 'warning');
                    isToday = false; // Skip if can't parse date
                }
            } else {
                // No date found, assume it's recent and include it
                isToday = true;
            }

            const dateDisplay = postDate || 'No date';
            this.log(`📅 Postingan tanggal: ${dateDisplay} - ${isToday ? 'HARI INI' : 'BUKAN HARI INI'}`, 'info');

            return isToday;

        } catch (error) {
            this.log(`❌ Error saat check tanggal postingan ${postUrl}: ${error.message}`, 'error');

            // If browser is closed, return false to skip this post
            if (error.message.includes('Target page, context or browser has been closed') ||
                error.message.includes('Protocol error') ||
                error.message.includes('Browser has been closed')) {
                this.log(`❌ Browser ditutup, skip postingan ini`, 'error');
                return false;
            }

            return false; // Skip if can't check date
        }
    }

    async scrapePost(postUrl) {
        try {
            await this.page.goto(postUrl, { timeout: 60000 });
            await this.page.waitForLoadState('networkidle', { timeout: 60000 });

            // Get post caption with multiple selectors
            console.log('🔍 Mencari caption...');
            try {
                await this.page.waitForTimeout(2000); // 2 detik untuk loading
            } catch (error) {
                console.log(`⚠️ Loading timeout error (continuing): ${error.message}`);
            }

            let caption = '';
            const captionSelectors = [
                // Instagram's specific caption class (HIGHEST PRIORITY)
                'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.xt0psk2.x1i0vuye.xvs91rp.xo1l8bm.x5n08af.x10wh9bi.xpm28yp.x8viiok.x1o7cslx.x126k92a',
                // Universal selectors yang bekerja untuk semua akun
                'article div span[dir="auto"]',
                'article h1[dir="auto"]',
                'article div[data-testid="post-caption"] span',
                'article div[role="button"] span',
                'article span[dir="auto"]',
                'article h1',
                'article div span',
                // Fallback selectors
                'div[data-testid="post-caption"] span',
                'div[role="button"] span',
                'h1[dir="auto"]',
                'span[dir="auto"]',
                'h1',
                'div:has-text("View all comments") + div span',
                'div:has-text("View all comments") + div h1'
            ];

            for (const selector of captionSelectors) {
                try {
                    const captionElement = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (captionElement) {
                        // Get innerHTML to preserve <br> tags, then convert to text
                        const innerHTML = await captionElement.innerHTML();
                        if (innerHTML) {
                            // Convert <br> tags to newlines
                            caption = innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim();
                        } else {
                            // Fallback to textContent
                            caption = await captionElement.textContent();
                        }

                        if (caption && caption.trim().length > 0) {
                            this.log(`✅ Caption ditemukan dengan selector: ${selector}`, 'debug');
                            this.log(`📝 Caption length: ${caption.length} characters`, 'debug');
                            break;
                        }
                    }
                } catch (error) {
                    // Try next selector
                }
            }

            // Fallback: Try to get text content from article elements
            if (!caption || caption.trim().length === 0) {
                try {
                    // Cari semua elemen text dalam article
                    const articleElements = await this.page.$$('article span, article h1, article div');
                    this.log(`📊 Ditemukan ${articleElements.length} elemen dalam article`, 'debug');

                    for (let i = 0; i < articleElements.length; i++) {
                        const element = articleElements[i];
                        const text = await element.textContent();

                        // Look for caption-like content (longer text, not just single words)
                        if (text && text.trim().length > 30 &&
                            !text.includes('View all comments') &&
                            !text.includes('likes') &&
                            !text.includes('comments') &&
                            !text.includes('Share') &&
                            !text.includes('Save') &&
                            !text.match(/^\d+$/)) { // Not just numbers

                            caption = text.trim();
                            this.log(`✅ Caption ditemukan dari article element (${i + 1})`, 'debug');
                            this.log(`📝 Caption preview: ${caption.substring(0, 50)}...`, 'debug');
                            break;
                        }
                    }
                } catch (error) {
                    this.log('❌ Article fallback gagal', 'debug');
                }
            }

            // Fallback kedua: Try to get any text content from all text elements
            if (!caption || caption.trim().length === 0) {
                try {
                    // Try all text elements on the page
                    const allTextElements = await this.page.$$('span, h1, h2, h3, div, p');
                    this.log(`📊 Ditemukan ${allTextElements.length} elemen text`, 'debug');

                    for (let i = 0; i < allTextElements.length; i++) {
                        const element = allTextElements[i];
                        const text = await element.textContent();

                        // Look for caption-like content (longer text, not UI elements)
                        if (text && text.trim().length > 50 &&
                            !text.includes('View all comments') &&
                            !text.includes('likes') &&
                            !text.includes('comments') &&
                            !text.includes('Share') &&
                            !text.includes('Save') &&
                            !text.includes('Follow') &&
                            !text.includes('Message') &&
                            !text.match(/^\d+$/) && // Not just numbers
                            !text.match(/^[A-Z\s]+$/) && // Not just uppercase (like buttons)
                            text.includes(' ')) { // Must contain spaces (actual text)

                            caption = text.trim();
                            this.log(`✅ Caption ditemukan dari text element (${i + 1})`, 'debug');
                            this.log(`📝 Caption preview: ${caption.substring(0, 50)}...`, 'debug');
                            break;
                        }
                    }
                } catch (error) {
                    this.log('❌ Text element fallback gagal', 'debug');
                }
            }

            // Final fallback: Try h1 elements
            if (!caption || caption.trim().length === 0) {
                try {
                    const h1Elements = await this.page.$$('h1');
                    for (const h1 of h1Elements) {
                        const text = await h1.textContent();
                        if (text && text.trim().length > 10) { // Caption usually longer than 10 chars
                            caption = text.trim();
                            this.log(`✅ Caption ditemukan dari h1 fallback`, 'debug');
                            break;
                        }
                    }
                } catch (error) {
                    // No caption found
                }
            }

            if (!caption || caption.trim().length === 0) {
                this.log('⚠️ Tidak dapat menemukan caption untuk postingan ini', 'warning');
            }

            // Get post image/video info
            let mediaType = 'post'; // Default to 'post' for database constraint
            const isReel = postUrl.includes('/reel/');

            if (isReel) {
                mediaType = 'reel';
            } else {
                try {
                    const videoElement = await this.page.waitForSelector('video', { timeout: 2000 });
                    if (videoElement) {
                        mediaType = 'post'; // Video posts are also stored as 'post'
                    }
                } catch (error) {
                    // No video found, it's an image post
                }
            }

            // Get likes count with multiple selectors
            let likesCount = 0;
            const likesSelectors = [
                'span:has-text("likes")',
                'span:has-text("like")',
                'a[href*="/liked_by/"] span',
                'div:has-text("likes") span'
            ];

            for (const selector of likesSelectors) {
                try {
                    const likesElement = await this.page.waitForSelector(selector, { timeout: 2000 });
                    if (likesElement) {
                        const likesText = await likesElement.textContent();
                        const extractedLikes = parseInt(likesText.replace(/[^\d]/g, '')) || 0;
                        if (extractedLikes > 0) {
                            likesCount = extractedLikes;
                            break;
                        }
                    }
                } catch (error) {
                    // Try next selector
                }
            }

            // Get post date with multiple selectors
            let postDate = '';
            const dateSelectors = [
                'time[datetime]',
                'time',
                'span:has-text("ago")',
                'span:has-text("hours ago")',
                'span:has-text("days ago")',
                'span:has-text("weeks ago")',
                'span:has-text("months ago")'
            ];

            for (const selector of dateSelectors) {
                try {
                    const dateElement = await this.page.waitForSelector(selector, { timeout: 2000 });
                    if (dateElement) {
                        // Try to get datetime attribute first
                        postDate = await dateElement.getAttribute('datetime');
                        if (postDate) {
                            break;
                        }

                        // If no datetime, get text content
                        const dateText = await dateElement.textContent();
                        if (dateText && dateText.trim()) {
                            postDate = dateText.trim();
                            break;
                        }
                    }
                } catch (error) {
                    // Try next selector
                }
            }

            // Extract post ID for fallback sorting
            const postId = postUrl.match(/\/p\/([^\/]+)\//)?.[1] || '';

            const postData = {
                url: postUrl,
                caption: caption.trim(),
                mediaType: mediaType,
                likesCount: likesCount,
                postDate: postDate,
                postId: postId,
                scrapedAt: new Date().toISOString()
            };

            const dateDisplay = postDate && postDate.includes('T')
                ? new Date(postDate).toLocaleDateString('id-ID')
                : postDate || 'No date';

            const captionPreview = caption ? caption.substring(0, 50) : 'No caption';
            const mediaIcon = mediaType === 'reel' ? '🎬' : '📸'; // All non-reel posts are images
            this.log(`✅ ${mediaIcon} ${mediaType.toUpperCase()} di-scrape: ${dateDisplay} - ${captionPreview}...`, 'success');
            return postData;

        } catch (error) {
            this.log(`❌ Error saat scraping postingan ${postUrl}: ${error.message}`, 'error');
            return null;
        }
    }

    async saveSinglePostToDatabase(postData, accountId, username) {
        try {
            // Check if post already exists
            const existingPost = await this.db.getSocmedPostByUrl(postData.url);

            if (existingPost) {
                // Update existing post
                await this.db.upsertSocmedPost(
                    postData.url,
                    postData.caption,
                    postData.postDate,
                    postData.mediaType
                );
                this.log(`🔄 Postingan di-update: ${postData.url}`, 'info');
            } else {
                // Insert new post
                await this.db.upsertSocmedPost(
                    postData.url,
                    postData.caption,
                    postData.postDate,
                    postData.mediaType
                );
                this.log(`💾 Postingan baru disimpan: ${postData.url}`, 'success');
            }

            // Add scraping log
            try {
                await this.db.addSocmedScrapingLog(
                    accountId,
                    postData.url,
                    postData.caption,
                    'success',
                    null
                );
            } catch (logError) {
                this.log(`⚠️ Error saving log: ${logError.message}`, 'warning');
            }

        } catch (error) {
            this.log(`❌ Error saving post to database: ${error.message}`, 'error');

            // Try to save error log
            try {
                await this.db.addSocmedScrapingLog(
                    accountId,
                    postData.url,
                    postData.caption,
                    'error',
                    error.message
                );
            } catch (logError) {
                this.log(`❌ Error saving error log: ${logError.message}`, 'error');
            }
        }
    }

    async saveScrapedDataToDatabase(data, accountId, username) {
        try {
            let savedCount = 0;
            let updatedCount = 0;

            for (const post of data) {
                try {
                    // Determine post type (reel or post)
                    const postType = post.mediaType === 'reel' ? 'reel' : 'post';

                    // Fix timestamp issue - convert empty string to null
                    let postDate = post.postDate;
                    if (!postDate || postDate === '' || postDate === 'No date') {
                        postDate = null;
                    } else if (typeof postDate === 'string') {
                        // Try to parse the date string
                        try {
                            postDate = new Date(postDate);
                            if (isNaN(postDate.getTime())) {
                                postDate = null;
                            }
                        } catch (error) {
                            postDate = null;
                        }
                    }

                    // Check if post already exists
                    const existingPost = await this.db.getSocmedPostByUrl(post.url);

                    if (existingPost) {
                        // Update existing post
                        await this.db.upsertSocmedPost(
                            post.url,
                            post.caption || '',
                            postDate,
                            postType
                        );

                        // Add scraping log
                        await this.db.addSocmedScrapingLog(
                            accountId,
                            post.url,
                            post.caption || '',
                            'success'
                        );

                        updatedCount++;
                        this.log(`🔄 Updated post: ${post.url}`, 'debug');
                    } else {
                        // Insert new post
                        await this.db.upsertSocmedPost(
                            post.url,
                            post.caption || '',
                            postDate,
                            postType
                        );

                        // Add scraping log
                        await this.db.addSocmedScrapingLog(
                            accountId,
                            post.url,
                            post.caption || '',
                            'success'
                        );

                        savedCount++;
                        this.log(`💾 Saved new post: ${post.url}`, 'debug');
                    }
                } catch (error) {
                    // Add error log
                    try {
                        await this.db.addSocmedScrapingLog(
                            accountId,
                            post.url,
                            post.caption || '',
                            'error',
                            error.message
                        );
                    } catch (dbError) {
                        this.log(`❌ Error saving error log: ${dbError.message}`, 'error');
                    }
                    this.log(`❌ Error saving post ${post.url}: ${error.message}`, 'error');
                }
            }

            this.log(`💾 Database save complete for ${username}: ${savedCount} new, ${updatedCount} updated`, 'success');
        } catch (error) {
            this.log(`❌ Error saving data to database: ${error.message}`, 'error');
        }
    }

    async saveScrapedData(data, username) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `instagram_${username}_${timestamp}.json`;
        // Update path to save in root scraped_data folder
        const filepath = path.join(__dirname, '..', '..', 'scraped_data', filename);

        // Create directory if it doesn't exist
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        this.log(`💾 Data scraping ${username} disimpan ke: ${filepath}`, 'success');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.log('🔚 Browser ditutup', 'info');
        }
        if (this.db && this.db.pool) {
            try {
                await this.db.pool.end();
                this.log('🔚 Database connection ditutup', 'info');
            } catch (error) {
                this.log(`⚠️ Error closing database: ${error.message}`, 'warning');
            }
        }
    }
}

// Main execution
async function main() {
    const bot = new InstagramScraperBot();

    try {
        console.log(chalk.blue('🤖 INSTAGRAM SCRAPER BOT'));
        console.log(chalk.blue('='.repeat(50)));
        console.log(chalk.blue('💡 Bot scraping Instagram dengan Playwright'));
        console.log(chalk.blue('='.repeat(50)));

        // Load accounts list from database
        await bot.loadAccountsList();

        // Initialize driver
        await bot.initialize();

        // Login flow
        const loginSuccess = await bot.loginToInstagram();
        if (!loginSuccess) {
            bot.log('❌ Login gagal. Keluar...', 'error');
            return;
        }

        // Scrape all accounts
        await bot.scrapeAllAccounts();

        bot.log('✅ Scraping semua akun selesai dengan sukses!', 'success');

    } catch (error) {
        bot.log(`❌ Terjadi error: ${error.message}`, 'error');
    } finally {
        await bot.cleanup();
    }
}

// Run the bot
if (require.main === module) {
    main().catch(console.error);
}

module.exports = InstagramScraperBot;