const { firefox } = require('playwright');
const chalk = require('chalk');

// Load environment variables
require('dotenv').config();

const DatabaseManager = require('../utils/database');

class HotelScraper {
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

            this.log('🚀 Memulai browser Firefox untuk Hotel Scraper...', 'info');

            // Launch browser dengan timeout protection (menggunakan konfigurasi yang berhasil)
            const browserPromise = firefox.launch({
                headless: true,
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

    async openTravelokaPage() {
        try {
            this.log('🌐 Membuka halaman Traveloka Hotel...', 'info');

            // Coba buka halaman dengan retry mechanism
            let response = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    attempts++;
                    this.log(`🔄 Percobaan ke-${attempts} membuka halaman...`, 'info');

                    response = await this.page.goto('https://www.traveloka.com/id-id/hotel', {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000
                    });

                    if (response && response.status() === 200) {
                        this.log(`✅ Halaman berhasil dibuka pada percobaan ke-${attempts}`, 'success');
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

            this.log('✅ Halaman berhasil dibuka', 'success');
            await this.page.waitForTimeout(8000);

            // Verifikasi halaman
            const title = await this.page.title();
            this.log(`📄 Title: ${title}`, 'info');

            return true;

        } catch (error) {
            this.log(`❌ Gagal buka halaman: ${error.message}`, 'error');
            return false;
        }
    }

    async waitForSearchResults() {
        try {
            this.log('⏳ Menunggu hasil search muncul...', 'info');

            // Wait for page to load completely
            await this.page.waitForTimeout(3000);

            // Method 1: Wait for hotel data elements to appear
            try {
                await this.page.waitForSelector('[data-testid="tvat-hotelName"]', { timeout: 10000 });
                this.log('✅ Hotel names found with data-testid', 'success');
                return true;
            } catch (error) {
                this.log('⚠️ data-testid selector not found, trying fallback...', 'warning');
            }

            // Method 2: Wait for any hotel-related content
            try {
                await this.page.waitForSelector('[class*="hotel"], [class*="property"], [class*="listing"]', { timeout: 10000 });
                this.log('✅ Hotel content found with class selectors', 'success');
                return true;
            } catch (error) {
                this.log('⚠️ Class selectors not found, trying fallback...', 'warning');
            }

            // Method 3: Wait for any content that looks like search results
            try {
                await this.page.waitForFunction(() => {
                    const text = document.body.textContent || '';
                    return text.includes('Rp') || text.includes('hotel') || text.includes('Hotel');
                }, { timeout: 10000 });
                this.log('✅ Search results content found', 'success');
                return true;
            } catch (error) {
                this.log('⚠️ Content detection failed', 'warning');
            }

            this.log('❌ Timeout menunggu hasil search', 'error');
            return false;

        } catch (error) {
            this.log(`❌ Error saat menunggu hasil search: ${error.message}`, 'error');
            return false;
        }
    }

    async dismissOverlaysAndModals() {
        try {
            this.log('🔒 Mencoba dismiss overlay dan modal...', 'info');

            // Method 1: Click outside to dismiss overlays (PERBAIKAN: dengan retry dan timeout yang lebih pendek)
            try {
                this.log('🎯 Mencoba click outside untuk dismiss overlay...', 'info');

                let clickSuccess = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        this.log(`🔄 Percobaan click outside ke-${attempt}...`, 'info');

                        // Tunggu body element siap dengan timeout yang lebih pendek
                        await this.page.waitForSelector('body', { timeout: 3000 });

                        // Click dengan timeout yang lebih pendek dan force jika diperlukan
                        await this.page.click('body', {
                            position: { x: 100, y: 100 },
                            timeout: 5000, // PERBAIKAN: Timeout lebih pendek
                            force: attempt === 3 // Force click pada percobaan terakhir
                        });

                        this.log(`✅ Click outside berhasil pada percobaan ke-${attempt}`, 'success');
                        clickSuccess = true;
                        break;

                    } catch (clickError) {
                        this.log(`⚠️ Percobaan ke-${attempt} gagal: ${clickError.message}`, 'warning');

                        if (attempt < 3) {
                            this.log('⏳ Menunggu 1 detik sebelum coba lagi...', 'info');
                            await this.page.waitForTimeout(1000);
                        }
                    }
                }

                if (clickSuccess) {
                    await this.page.waitForTimeout(1000);
                } else {
                    this.log('⚠️ Click outside gagal, lanjut ke method berikutnya', 'warning');
                }

            } catch (error) {
                this.log(`⚠️ Click outside failed: ${error.message}`, 'warning');
            }

            // Method 2: Press Escape key
            try {
                await this.page.keyboard.press('Escape');
                this.log('✅ Pressed Escape to dismiss modal', 'success');
                await this.page.waitForTimeout(1000);
            } catch (error) {
                this.log(`⚠️ Escape key failed: ${error.message}`, 'warning');
            }

            // Method 3: Look for and close specific overlay elements
            try {
                const overlaySelectors = [
                    '[class*="overlay"]',
                    '[class*="modal"]',
                    '[class*="popup"]',
                    '[class*="loading"]',
                    '[class*="spinner"]',
                    '[class*="blue"]',
                    '[style*="background-color: blue"]',
                    '[style*="background: blue"]'
                ];

                for (const selector of overlaySelectors) {
                    const overlays = await this.page.$$(selector);
                    if (overlays.length > 0) {
                        this.log(`Found ${overlays.length} overlay elements with selector: ${selector}`, 'info');

                        for (const overlay of overlays) {
                            try {
                                // Try to click close button or the overlay itself
                                const closeButton = await overlay.$('[class*="close"], [class*="dismiss"], [aria-label*="close"], [aria-label*="dismiss"]');
                                if (closeButton) {
                                    await closeButton.click();
                                    this.log('✅ Closed overlay with close button', 'success');
                                } else {
                                    await overlay.click();
                                    this.log('✅ Clicked overlay to dismiss', 'success');
                                }
                                await this.page.waitForTimeout(500);
                            } catch (error) {
                                this.log(`⚠️ Failed to dismiss overlay: ${error.message}`, 'warning');
                            }
                        }
                    }
                }
            } catch (error) {
                this.log(`⚠️ Overlay dismissal failed: ${error.message}`, 'warning');
            }

            // Method 4: Wait for overlays to disappear naturally
            try {
                await this.page.waitForFunction(() => {
                    const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"], [class*="popup"], [class*="loading"]');
                    return overlays.length === 0;
                }, { timeout: 5000 });
                this.log('✅ Overlays disappeared naturally', 'success');
            } catch (error) {
                this.log(`⚠️ Waiting for overlays to disappear failed: ${error.message}`, 'warning');
            }

            this.log('✅ Overlay dismissal completed', 'success');

        } catch (error) {
            this.log(`❌ Error saat dismiss overlay: ${error.message}`, 'error');
        }
    }

    async extractHotelData(searchHotelName) {
        try {
            this.log('🔍 Mulai extract data hotel...', 'info');

            // Tunggu halaman load sempurna
            await this.page.waitForTimeout(5000);

            // Screenshot untuk debugging
            await this.page.screenshot({ path: 'hotel-search-results.png', fullPage: true });
            this.log('📸 Screenshot disimpan: hotel-search-results.png', 'info');

            // Extract data hotel yang sesuai dengan search
            const hotelData = await this.page.evaluate((searchName) => {
                // Method 1: Cari berdasarkan data-testid yang spesifik untuk Traveloka
                const hotelNameElements = document.querySelectorAll('[data-testid="tvat-hotelName"]');
                const hotelPriceElements = document.querySelectorAll('[data-testid="tvat-hotelPrice"]');

                // Cari hotel yang sesuai dengan search name
                let targetHotelName = '';
                let targetHotelPrice = '';

                for (let i = 0; i < hotelNameElements.length; i++) {
                    const nameEl = hotelNameElements[i];
                    const nameText = nameEl.textContent || '';

                    if (nameText.toLowerCase().includes(searchName.toLowerCase())) {
                        targetHotelName = nameText.trim();

                        // Cari harga yang sesuai (biasanya di index yang sama atau berdekatan)
                        if (hotelPriceElements[i]) {
                            const priceText = hotelPriceElements[i].textContent || '';
                            if (priceText.includes('Rp')) {
                                // Ambil hanya angka dan mata uang
                                const priceMatch = priceText.match(/(Rp\s*\d+[.,\d]*)/);
                                if (priceMatch) {
                                    targetHotelPrice = priceMatch[1].trim();
                                }
                            }
                        }
                        break;
                    }
                }

                // Method 2: Fallback - cari berdasarkan class yang umum untuk Traveloka
                if (!targetHotelName) {
                    // Cari berdasarkan class yang umum untuk hotel names
                    const hotelNameSelectors = [
                        '[class*="hotel-name"]',
                        '[class*="property-name"]',
                        '[class*="hotel-title"]',
                        '[class*="hotel-name"]',
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
                    ];

                    for (const selector of hotelNameSelectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const element of elements) {
                            const text = element.textContent || '';
                            if (text.toLowerCase().includes(searchName.toLowerCase()) && text.length > 3) {
                                targetHotelName = text.trim();

                                // Cari harga di parent container
                                let container = element;
                                for (let i = 0; i < 5; i++) {
                                    if (container.parentElement) {
                                        container = container.parentElement;
                                        const containerText = container.textContent || '';

                                        if (containerText.includes('Rp')) {
                                            const priceMatch = containerText.match(/(Rp\s*\d+[.,\d]*)/);
                                            if (priceMatch) {
                                                targetHotelPrice = priceMatch[1].trim();
                                            }
                                            break;
                                        }
                                    }
                                }
                                if (targetHotelName) break;
                            }
                        }
                        if (targetHotelName) break;
                    }
                }

                // Method 3: Fallback - cari berdasarkan text content yang lebih luas
                if (!targetHotelName) {
                    // Cari berdasarkan text content yang lebih luas
                    const allElements = document.querySelectorAll('*');

                    for (const element of allElements) {
                        const text = element.textContent || '';
                        if (text.toLowerCase().includes(searchName.toLowerCase()) &&
                            (text.includes('Hotel') || text.includes('hotel') || text.includes('Rp'))) {

                            // Cari parent container yang berisi harga
                            let container = element;
                            for (let i = 0; i < 5; i++) {
                                if (container.parentElement) {
                                    container = container.parentElement;
                                    const containerText = container.textContent || '';

                                    if (containerText.includes('Rp')) {
                                        targetHotelName = text.trim();

                                        // Extract harga dari container
                                        const priceMatch = containerText.match(/(Rp\s*\d+[.,\d]*)/);
                                        if (priceMatch) {
                                            targetHotelPrice = priceMatch[1].trim();
                                        }
                                        break;
                                    }
                                }
                            }
                            if (targetHotelName) break;
                        }
                    }
                }

                return {
                    name: targetHotelName || searchName,
                    roomPrice: targetHotelPrice || 'N/A'
                };
            }, searchHotelName);

            if (hotelData) {
                // Validasi data sebelum save
                if (!hotelData.name || hotelData.name === 'undefined' || hotelData.name.trim() === '') {
                    this.log('⚠️ Nama hotel tidak valid, menggunakan search query sebagai fallback', 'warning');
                    hotelData.name = searchHotelName;
                }

                if (!hotelData.roomPrice || hotelData.roomPrice === 'undefined' || hotelData.roomPrice === 'N/A') {
                    this.log('⚠️ Harga kamar tidak tersedia', 'warning');
                    hotelData.roomPrice = 'Tidak tersedia';
                }

                this.log('✅ Data hotel berhasil di-extract:', 'success');
                this.log(`   🏨 Nama: ${hotelData.name}`, 'cyan');
                this.log(`   💰 Harga Kamar: ${hotelData.roomPrice}`, 'cyan');

                // Data hotel sudah disimpan melalui flow baru di scrapeHotel()
                // Tidak perlu menyimpan lagi di sini untuk menghindari duplikasi
                this.log('✅ Data hotel berhasil di-extract dan akan disimpan melalui flow baru', 'success');

                return hotelData;
            } else {
                this.log('⚠️ Tidak ada data hotel yang ditemukan', 'warning');

                // Error sudah ditangani melalui flow baru di scrapeHotel()
                // Tidak perlu menyimpan error lagi di sini untuk menghindari duplikasi

                return null;
            }

        } catch (error) {
            this.log(`❌ Error saat extract data: ${error.message}`, 'error');
            return null;
        }
    }

    async searchHotel(hotelName) {
        try {
            this.log(`🔍 Mencari hotel: "${hotelName}"...`, 'info');

            // Tunggu halaman load sempurna
            await this.page.waitForTimeout(3000);

            // Debug: Screenshot sebelum search
            // Screenshot sebelum search (dihapus untuk efisiensi)
            // await this.page.screenshot({ path: 'before-search.png', fullPage: false });
            // this.log('📸 Screenshot sebelum search: before-search.png', 'info');

            // Method 1: Cari input field dengan selector yang lebih spesifik untuk Traveloka
            let inputField = await this.page.$('input[placeholder*="hotel"], input[placeholder*="kota"], input[placeholder*="Hotel"], input[placeholder*="Kota"]');

            // Method 2: Fallback - cari berdasarkan class atau data-testid
            if (!inputField) {
                inputField = await this.page.$('[class*="search-input"], [class*="searchInput"], [data-testid*="search"], [class*="input"]');
            }

            // Method 3: Fallback - cari semua input yang mungkin
            if (!inputField) {
                const allInputs = await this.page.$$('input');
                this.log(`Found ${allInputs.length} input fields, searching for search input...`, 'info');

                for (const input of allInputs) {
                    const placeholder = await input.getAttribute('placeholder') || '';
                    const className = await input.getAttribute('class') || '';
                    const type = await input.getAttribute('type') || '';

                    if (placeholder.toLowerCase().includes('hotel') ||
                        placeholder.toLowerCase().includes('kota') ||
                        className.toLowerCase().includes('search') ||
                        (type === 'text' && (placeholder || className))) {
                        inputField = input;
                        this.log(`✅ Selected input: placeholder="${placeholder}", class="${className}"`, 'success');
                        break;
                    }
                }
            }

            if (!inputField) {
                throw new Error('Input field pencarian tidak ditemukan');
            }

            this.log('✅ Input field ditemukan', 'success');

            // Clear dan isi dengan nama hotel dengan error handling yang lebih baik
            try {
                // Tunggu input field siap
                await this.page.waitForTimeout(1000);

                // Coba click dengan timeout yang lebih panjang
                await inputField.click({ timeout: 30000 });
                await this.page.waitForTimeout(1000);

                // Clear input
                await inputField.fill('');
                await this.page.waitForTimeout(500);

                // Type dengan delay yang lebih pendek
                await inputField.type(hotelName, { delay: 50 });
                this.log(`✅ Sudah ketik: "${hotelName}"`, 'success');

            } catch (clickError) {
                this.log(`⚠️ Error saat click input field: ${clickError.message}`, 'warning');
                this.log('🔄 Mencoba method alternatif...', 'info');

                try {
                    // Method alternatif: focus dan type langsung
                    await inputField.focus();
                    await this.page.waitForTimeout(500);
                    await inputField.fill(hotelName);
                    this.log(`✅ Berhasil ketik dengan method alternatif: "${hotelName}"`, 'success');
                } catch (focusError) {
                    this.log(`⚠️ Method alternatif juga gagal: ${focusError.message}`, 'warning');
                    throw new Error(`Gagal mengisi input field: ${focusError.message}`);
                }
            }

            // Tunggu recommendations muncul
            await this.page.waitForTimeout(3000);

            // Debug: Screenshot setelah ketik
            // Screenshot setelah ketik (dihapus untuk efisiensi)
            // await this.page.screenshot({ path: 'after-typing.png', fullPage: false });
            // this.log('📸 Screenshot setelah ketik: after-typing.png', 'info');

            // Cari dan klik recommendation yang sesuai untuk menutup dropdown
            this.log('🔍 Mencari recommendation yang sesuai...', 'info');

            const recommendationSelectors = [
                // Selector spesifik untuk Traveloka
                '[data-testid="autocomplete-item-name"]',
                '[class*="autocomplete-item"]',
                '[class*="suggestion-item"]',
                '[class*="dropdown-item"]',
                '[class*="recommendation-item"]',
                // Fallback selectors
                '[class*="dropdown"]',
                '[class*="suggestion"]',
                '[class*="autocomplete"]',
                '[role="option"]',
                '[class*="option"]',
                '[class*="item"]'
            ];

            let recommendations = [];
            for (const selector of recommendationSelectors) {
                const elements = await this.page.$$(selector);
                if (elements.length > 0) {
                    recommendations = elements;
                    this.log(`Found ${elements.length} recommendations with selector: ${selector}`, 'info');
                    break;
                }
            }

            let recommendationClicked = false;
            if (recommendations.length > 0) {
                for (const rec of recommendations) {
                    try {
                        const text = await rec.textContent();
                        if (text && text.trim()) {
                            // Cek apakah recommendation mengandung nama hotel yang dicari
                            // Gunakan text matching yang lebih fleksibel
                            const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ''); // Hapus karakter khusus
                            const cleanHotelName = hotelName.toLowerCase().replace(/[^\w\s]/g, ''); // Hapus karakter khusus

                            // Cek apakah semua kata dalam hotel name ada di recommendation
                            const hotelWords = cleanHotelName.split(' ').filter(word => word.length > 0);
                            const matchingWords = hotelWords.filter(word => cleanText.includes(word));

                            // Jika 70% kata cocok atau ada exact match
                            if (matchingWords.length >= hotelWords.length * 0.7 ||
                                cleanText.includes(cleanHotelName) ||
                                cleanHotelName.includes(cleanText)) {

                                // PERBAIKAN: Tunggu element benar-benar stabil sebelum click
                                this.log(`🎯 Mencoba click recommendation: ${text.trim()}`, 'info');

                                // Tunggu element visible dan stable
                                await this.page.waitForTimeout(1000);

                                // Coba click dengan timeout yang lebih pendek dan retry
                                let clickSuccess = false;
                                for (let attempt = 1; attempt <= 3; attempt++) {
                                    try {
                                        this.log(`🔄 Percobaan click ke-${attempt}...`, 'info');

                                        // PERBAIKAN: Bypass waitForElementState jika terlalu lama
                                        if (attempt <= 2) {
                                            try {
                                                // Tunggu element siap dengan timeout yang lebih pendek
                                                await rec.waitForElementState('stable', { timeout: 5000 });
                                            } catch (waitError) {
                                                this.log(`⚠️ Wait for stable gagal, lanjut tanpa menunggu: ${waitError.message}`, 'warning');
                                            }
                                        }

                                        // Click dengan force jika diperlukan
                                        await rec.click({
                                            timeout: 15000,
                                            force: attempt === 3 // Force click pada percobaan terakhir
                                        });

                                        this.log(`✅ Recommendation berhasil diklik pada percobaan ke-${attempt}: ${text.trim()}`, 'success');
                                        recommendationClicked = true;
                                        clickSuccess = true;
                                        break;

                                    } catch (clickError) {
                                        this.log(`⚠️ Percobaan ke-${attempt} gagal: ${clickError.message}`, 'warning');

                                        if (attempt < 3) {
                                            this.log('⏳ Menunggu 2 detik sebelum coba lagi...', 'info');
                                            await this.page.waitForTimeout(2000);
                                        }
                                    }
                                }

                                if (clickSuccess) {
                                    // Tunggu dropdown hilang dan input terisi
                                    await this.page.waitForTimeout(2000);
                                    break;
                                } else {
                                    this.log('❌ Semua percobaan click gagal, lanjut ke recommendation berikutnya', 'error');
                                }
                            }
                        }
                    } catch (error) {
                        this.log(`⚠️ Error saat baca recommendation: ${error.message}`, 'warning');
                    }
                }

                if (!recommendationClicked) {
                    this.log('⚠️ Tidak ada recommendation yang berhasil diklik', 'warning');

                    // PERBAIKAN: Fallback mechanism jika recommendation gagal
                    this.log('🔄 Mencoba fallback: tekan Enter untuk search tanpa recommendation...', 'info');
                    try {
                        // Tunggu sebentar untuk memastikan input field siap
                        await this.page.waitForTimeout(1000);

                        // Tekan Enter untuk search langsung
                        await inputField.press('Enter');
                        this.log('✅ Fallback Enter berhasil, melanjutkan search...', 'success');

                        // Tunggu sebentar untuk search process
                        await this.page.waitForTimeout(2000);

                    } catch (fallbackError) {
                        this.log(`⚠️ Fallback Enter juga gagal: ${fallbackError.message}`, 'warning');
                    }
                } else {
                    this.log('✅ Recommendation berhasil diklik, melanjutkan...', 'success');
                }
            } else {
                this.log('ℹ️ Tidak ada recommendations yang muncul', 'info');
            }

            // PERBAIKAN: Pastikan dropdown benar-benar hilang sebelum cari tombol search
            this.log('🔒 Memastikan dropdown benar-benar hilang...', 'info');

            // Tunggu dropdown hilang dengan timeout yang lebih panjang
            await this.page.waitForTimeout(3000);

            // Coba dismiss dropdown dengan Escape jika masih ada
            try {
                const hasDropdown = await this.page.evaluate(() => {
                    const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="autocomplete"], [class*="suggestion"], [role="listbox"]');
                    return dropdowns.length > 0;
                });

                if (hasDropdown) {
                    this.log('⚠️ Dropdown masih terlihat, mencoba dismiss dengan Escape...', 'warning');
                    await this.page.keyboard.press('Escape');
                    await this.page.waitForTimeout(2000);
                }
            } catch (error) {
                this.log(`⚠️ Error saat cek dropdown: ${error.message}`, 'warning');
            }

            // Screenshot setelah dropdown ditutup
            // Screenshot setelah dropdown ditutup (dihapus untuk efisiensi)
            // await this.page.screenshot({ path: 'dropdown-closed.png', fullPage: false });
            // this.log('📸 Screenshot setelah dropdown ditutup: dropdown-closed.png', 'info');

            // Sekarang cari dan klik tombol cari yang sudah terlihat
            this.log('🔍 Mencari tombol cari setelah dropdown ditutup...', 'info');

            // Method 1: Cari tombol cari dengan text "Cari"
            let searchButton = await this.page.$('button:has-text("Cari"), button:has-text("Search"), [class*="search-button"], [class*="btn-search"]');
            if (searchButton) {
                this.log('✅ Found search button with Method 1 (text-based selector)', 'success');
            }

            // Method 2: Fallback - cari berdasarkan class atau data-testid
            if (!searchButton) {
                searchButton = await this.page.$('[class*="search"], [class*="btn"], [data-testid*="search"], [class*="submit"]');
                if (searchButton) {
                    this.log('✅ Found search button with Method 2 (class-based selector)', 'success');
                }
            }

            // Method 3: Fallback - cari semua button yang mungkin
            if (!searchButton) {
                this.log('�� Method 3: Scanning all buttons for search functionality...', 'info');
                const allButtons = await this.page.$$('button, [role="button"], input[type="submit"]');

                for (const button of allButtons) {
                    try {
                        const text = await button.textContent();
                        const className = await button.getAttribute('class') || '';
                        const type = await button.getAttribute('type') || '';

                        if (text && (text.toLowerCase().includes('cari') ||
                            text.toLowerCase().includes('search') ||
                            className.toLowerCase().includes('search') ||
                            type === 'submit')) {
                            searchButton = button;
                            this.log(`✅ Found search button with Method 3: "${text.trim()}"`, 'success');
                            break;
                        }
                    } catch (error) {
                        // Skip buttons that can't be read
                    }
                }
            }

            if (searchButton) {
                try {
                    // PERBAIKAN: Screenshot dengan timeout yang lebih pendek atau skip jika gagal
                    try {
                        await searchButton.screenshot({
                            // path: 'search-button-found.png', // Screenshot dihapus untuk efisiensi
                            timeout: 10000 // Timeout lebih pendek untuk screenshot
                        });
                        // this.log('📸 Screenshot tombol cari: search-button-found.png', 'info');
                    } catch (screenshotError) {
                        this.log(`⚠️ Screenshot tombol cari gagal, lanjut tanpa screenshot: ${screenshotError.message}`, 'warning');
                    }

                    // PERBAIKAN: Tunggu element stabil dan coba click dengan retry
                    this.log('🎯 Mencoba click tombol search...', 'info');

                    let clickSuccess = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            this.log(`🔄 Percobaan click tombol search ke-${attempt}...`, 'info');

                            // PERBAIKAN: Bypass waitForElementState jika terlalu lama
                            if (attempt <= 2) {
                                try {
                                    // Tunggu element siap dengan timeout yang lebih pendek
                                    await searchButton.waitForElementState('stable', { timeout: 5000 });
                                } catch (waitError) {
                                    this.log(`⚠️ Wait for stable gagal, lanjut tanpa menunggu: ${waitError.message}`, 'warning');
                                }
                            }

                            // Click dengan timeout yang lebih pendek dan force jika diperlukan
                            await searchButton.click({
                                timeout: 15000,
                                force: attempt === 3 // Force click pada percobaan terakhir
                            });

                            this.log(`✅ Tombol cari berhasil diklik pada percobaan ke-${attempt}!`, 'success');
                            clickSuccess = true;
                            break;

                        } catch (clickError) {
                            this.log(`⚠️ Percobaan ke-${attempt} gagal: ${clickError.message}`, 'warning');

                            // Jika error karena Google iframe, coba dismiss overlay dulu
                            if (clickError.message.includes('accounts.google.com') ||
                                clickError.message.includes('intercepts pointer events')) {
                                this.log('🚫 Google iframe menghalangi, coba dismiss overlay...', 'warning');
                                try {
                                    // Coba click di luar area untuk dismiss overlay
                                    await this.page.click('body', { timeout: 3000 });
                                    await this.page.keyboard.press('Escape');
                                    await this.page.waitForTimeout(1000);
                                } catch (dismissError) {
                                    this.log('⚠️ Gagal dismiss Google overlay', 'warning');
                                }
                            }

                            if (attempt < 3) {
                                this.log('⏳ Menunggu 2 detik sebelum coba lagi...', 'info');
                                await this.page.waitForTimeout(2000);
                            }
                        }
                    }

                    if (!clickSuccess) {
                        throw new Error('Semua percobaan click tombol search gagal');
                    }

                    // Tunggu sebentar untuk search process
                    await this.page.waitForTimeout(2000);

                } catch (error) {
                    this.log(`⚠️ Error saat klik tombol cari: ${error.message}`, 'warning');

                    // Fallback: coba tekan Enter
                    this.log('⌨️ Mencoba tekan Enter sebagai fallback...', 'info');
                    await inputField.press('Enter');
                }
            } else {
                this.log('⚠️ Tombol cari tidak ditemukan, mencoba tekan Enter...', 'warning');
                await inputField.press('Enter');
            }

            // Tunggu sebentar untuk search process
            await this.page.waitForTimeout(3000);

            // Debug: Screenshot setelah search
            // Screenshot setelah search (dihapus untuk efisiensi)
            // await this.page.screenshot({ path: 'after-search.png', fullPage: false });
            // this.log('📸 Screenshot setelah search: after-search.png', 'info');

            return true;

        } catch (error) {
            this.log(`❌ Error saat search: ${error.message}`, 'error');
            return false;
        }
    }

    // Fungsi clickFirstHotel dihapus karena tidak diperlukan lagi
    // Bot hanya akan extract data dari search results

    // Fungsi waitForHotelDetailPage dihapus karena tidak diperlukan lagi
    // Bot hanya akan extract data dari search results

    // Fungsi extractRoomDetails dihapus karena tidak diperlukan lagi
    // Bot hanya akan extract data dari search results

    async extractHotelLocation() {
        try {
            this.log('📍 Extracting hotel location...', 'info');

            const location = await this.page.evaluate(() => {
                // Method 1: Look for location elements with data-testid
                const locationSelectors = [
                    '[data-testid*="location"]',
                    '[data-testid*="address"]',
                    '[data-testid*="city"]'
                ];

                for (const selector of locationSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || '';
                        if (text.length > 3 && text.length < 100) {
                            return text.trim();
                        }
                    }
                }

                // Method 2: Look for location elements by class
                const classSelectors = [
                    '[class*="location"]',
                    '[class*="address"]',
                    '[class*="city"]',
                    '[class*="area"]'
                ];

                for (const selector of classSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || '';
                        if (text.length > 3 && text.length < 100) {
                            return text.trim();
                        }
                    }
                }

                // Method 3: Look for common location patterns
                const allElements = document.querySelectorAll('*');
                for (const element of allElements) {
                    const text = element.textContent || '';
                    if (text.length > 3 && text.length < 100) {
                        // Look for city names or location patterns
                        if (text.includes('Malang') || text.includes('Jakarta') || text.includes('Bandung') ||
                            text.includes('Surabaya') || text.includes('Yogyakarta') || text.includes('Semarang')) {
                            return text.trim();
                        }

                        // Look for address patterns
                        if (text.includes('Jl.') || text.includes('Street') || text.includes('Avenue') ||
                            text.includes('Road') || text.includes('Boulevard')) {
                            return text.trim();
                        }
                    }
                }

                return 'Lokasi tidak ditemukan';
            });

            this.log(`📍 Lokasi hotel: ${location}`, 'info');
            return location;

        } catch (error) {
            this.log(`❌ Error saat extract location: ${error.message}`, 'error');
            return 'Lokasi tidak ditemukan';
        }
    }

    async scrapeHotel(hotelId, hotelName, searchKey) {
        let scrapingLogId = null;

        try {
            this.log(`🏨 HOTEL SCRAPER - "${hotelName}"`, 'blue');
            this.log('='.repeat(50), 'blue');

            // Step 1: Start scraping log dengan status in_progress
            if (this.db && this.db.isConnected) {
                scrapingLogId = await this.db.startScrapingLog(hotelId, hotelName, searchKey);
                if (!scrapingLogId) {
                    throw new Error('Gagal membuat log scraping');
                }
            }


            // Step 2: Mulai scraping
            this.log('🚀 Memulai browser Firefox untuk Hotel Scraper...', 'blue');
            await this.initialize();

            this.log('🌐 Membuka halaman Traveloka Hotel...', 'blue');
            await this.openTravelokaPage();

            this.log('🔍 Mulai search hotel secara otomatis...', 'blue');
            this.log(`🔍 Mencari hotel: "${searchKey}"...`, 'blue');

            // Search hotel
            await this.searchHotel(searchKey);

            // Extract data hotel
            this.log('🔍 Mulai extract data hotel dari search results...', 'blue');
            const hotelData = await this.extractHotelData(searchKey);

            if (hotelData && hotelData.name && hotelData.roomPrice !== 'Tidak tersedia') {
                // Step 3: Update log scraping menjadi success
                if (scrapingLogId && this.db && this.db.isConnected) {
                    try {
                        // Extract angka dari harga (hapus "Rp" dan spasi)
                        const priceNumber = hotelData.roomPrice.replace(/[^\d]/g, '');

                        if (priceNumber && priceNumber.length > 0) {
                            const price = parseFloat(priceNumber);
                            const screenshotPath = 'hotel-search-results.png';

                            // Update log scraping menjadi success
                            await this.db.updateScrapingLogSuccess(scrapingLogId, price, screenshotPath);

                            // Update harga di hotel_data
                            await this.db.updateHotelDataPrice(hotelId, price);

                            this.log('✅ Data hotel berhasil di-scrape dan disimpan', 'success');
                            this.log(`   💰 Harga: ${hotelData.roomPrice}`, 'cyan');
                            this.log(`   📍 Lokasi: ${hotelData.location || 'Tidak tersedia'}`, 'cyan');
                            this.log(`   ⭐ Rating: ${hotelData.rating || 'Tidak tersedia'}`, 'cyan');
                        } else {
                            throw new Error('Harga tidak valid');
                        }
                    } catch (error) {
                        this.log(`❌ Error saat menyimpan data: ${error.message}`, 'error');
                        // Update log menjadi error
                        if (scrapingLogId) {
                            await this.db.updateScrapingLogError(scrapingLogId, `Error saat menyimpan data: ${error.message}`);
                        }
                        throw error;
                    }
                }
            } else {
                // Data tidak valid, update log menjadi error
                const errorMsg = 'Data hotel tidak valid atau tidak ditemukan';
                if (scrapingLogId && this.db && this.db.isConnected) {
                    await this.db.updateScrapingLogError(scrapingLogId, errorMsg);
                }
                throw new Error(errorMsg);
            }

            return hotelData;

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
            // Cleanup browser (tidak tutup database connection)
            if (this.browser) {
                await this.cleanup(false);
            }
        }
    }

    async dismissLoginPopup() {
        try {
            this.log('🔒 Cek dan dismiss popup jika ada...', 'info');

            // Tunggu sebentar untuk popup muncul
            await this.page.waitForTimeout(3000);

            // Check if popup exists
            const hasPopup = await this.page.evaluate(() => {
                const popups = document.querySelectorAll('[role="dialog"], [aria-modal="true"], [class*="popup"], [class*="modal"], [class*="overlay"]');
                return popups.length > 0;
            });

            if (!hasPopup) {
                this.log('✅ Tidak ada popup yang muncul', 'success');
                return;
            }

            this.log('🎯 Popup terdeteksi! Mencoba dismiss...', 'info');

            // Take screenshot of popup for debugging
            try {
                // Screenshot popup (dihapus untuk efisiensi)
                // await this.page.screenshot({ path: 'popup-appeared.png' });
                // this.log('📸 Screenshot popup: popup-appeared.png', 'info');
            } catch (screenshotError) {
                this.log(`⚠️ Failed to take popup screenshot: ${screenshotError.message}`, 'warning');
            }

            // Simple selector for "Nanti Saja" button
            const nantiButton = await this.page.$('[role="button"]:has-text("nanti"), button:has-text("nanti"), div:has-text("nanti")');

            if (nantiButton) {
                this.log('✅ Tombol "Nanti Saja" ditemukan!', 'success');
                await nantiButton.click();
                this.log('✅ Popup berhasil di-dismiss', 'success');
                await this.page.waitForTimeout(2000);
            } else {
                this.log('⚠️ Tombol "Nanti Saja" tidak ditemukan, menggunakan Escape...', 'warning');
                await this.page.keyboard.press('Escape');
                await this.page.waitForTimeout(2000);
            }

        } catch (error) {
            this.log(`⚠️ Popup dismissal failed: ${error.message}`, 'warning');
        }
    }

    async cleanup(closeDatabase = true) {
        try {
            if (this.page) {
                await this.page.close();
                this.log('✅ Page ditutup', 'success');
            }

            if (this.browser) {
                await this.browser.close();
                this.log('✅ Browser ditutup', 'success');
            }

            // Tutup koneksi database hanya jika diminta dan tidak shared
            // Untuk scheduler, database connection tidak ditutup agar bisa digunakan untuk hotel berikutnya
            if (closeDatabase && this.db && !this.dbConnectionShared) {
                await this.db.close();
                this.log('✅ Database connection ditutup', 'success');
            } else if (this.dbConnectionShared) {
                this.log('✅ Database connection tetap hidup (shared)', 'success');
            }

            this.log('✅ Semua resource dibersihkan', 'success');

        } catch (error) {
            this.log(`❌ Error saat cleanup: ${error.message}`, 'error');
        }
    }
}

// Export class
module.exports = HotelScraper;

// Test function jika dijalankan langsung
if (require.main === module) {
    const readline = require('readline');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false // Prevent terminal echo issues
    });

    async function main() {
        try {
            console.log(chalk.blue('🏨 TRAVELOKA HOTEL SCRAPER'));
            console.log(chalk.blue('=================================================='));
            console.log(chalk.blue('💡 Tips: Ketik nama hotel dengan jelas (contoh: "Gets Hotel Malang")'));
            console.log(chalk.blue('=================================================='));

            rl.question('Masukkan nama hotel yang ingin di-search: ', async (hotelName) => {
                // Clean input - remove extra spaces and special characters
                const cleanHotelName = hotelName.trim().replace(/\s+/g, ' ');

                if (!cleanHotelName) {
                    console.log(chalk.red('❌ Nama hotel tidak boleh kosong!'));
                    rl.close();
                    return;
                }

                // Validate input length
                if (cleanHotelName.length < 3) {
                    console.log(chalk.red('❌ Nama hotel terlalu pendek! Minimal 3 karakter.'));
                    rl.close();
                    return;
                }

                if (cleanHotelName.length > 100) {
                    console.log(chalk.red('❌ Nama hotel terlalu panjang! Maksimal 100 karakter.'));
                    rl.close();
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
                    rl.close();
                }
            });

        } catch (error) {
            console.log(chalk.red(`❌ Error: ${error.message}`));
            rl.close();
        }
    }

    main();
}