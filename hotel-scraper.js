const { firefox } = require('playwright');
const chalk = require('chalk');

class HotelScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        try {
            console.log(chalk.blue('🚀 Memulai browser Firefox untuk Hotel Scraper...'));

            this.browser = await firefox.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-client-side-phishing-detection',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--disable-extensions',
                    '--disable-sync',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update'
                ]
            });

            this.page = await this.browser.newPage();
            await this.page.setViewportSize({ width: 1366, height: 768 });

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

            // Inject script untuk bypass detection
            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            });

            console.log(chalk.green('✅ Browser Firefox berhasil dimulai'));
            return true;

        } catch (error) {
            console.log(chalk.red(`❌ Gagal memulai browser: ${error.message}`));
            return false;
        }
    }

    async openTravelokaPage() {
        try {
            console.log(chalk.blue('🌐 Membuka halaman Traveloka Hotel...'));

            // Coba buka halaman dengan retry mechanism
            let response = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    attempts++;
                    console.log(chalk.blue(`🔄 Percobaan ke-${attempts} membuka halaman...`));

                    response = await this.page.goto('https://www.traveloka.com/id-id/hotel', {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000
                    });

                    if (response && response.status() === 200) {
                        console.log(chalk.green(`✅ Halaman berhasil dibuka pada percobaan ke-${attempts}`));
                        break;
                    } else {
                        throw new Error(`HTTP ${response?.status() || 'unknown'}`);
                    }

                } catch (error) {
                    if (attempts >= maxAttempts) {
                        throw new Error(`Gagal buka halaman setelah ${maxAttempts} percobaan: ${error.message}`);
                    }
                    console.log(chalk.yellow(`⚠️ Percobaan ke-${attempts} gagal: ${error.message}`));
                    console.log(chalk.blue('⏳ Menunggu 3 detik sebelum coba lagi...'));
                    await this.page.waitForTimeout(3000);
                }
            }

            console.log(chalk.green('✅ Halaman berhasil dibuka'));
            await this.page.waitForTimeout(8000);

            // Verifikasi halaman
            const title = await this.page.title();
            console.log(chalk.blue(`📄 Title: ${title}`));

            return true;

        } catch (error) {
            console.log(chalk.red(`❌ Gagal buka halaman: ${error.message}`));
            return false;
        }
    }

    async waitForSearchResults() {
        try {
            console.log(chalk.blue('⏳ Menunggu hasil search muncul...'));

            // Tunggu sampai URL berubah (menandakan search berhasil)
            let currentURL = await this.page.url();
            let attempts = 0;
            const maxAttempts = 30; // 30 detik

            while (attempts < maxAttempts) {
                await this.page.waitForTimeout(1000);
                const newURL = await this.page.url();

                if (newURL !== currentURL && (newURL.includes('search') || newURL.includes('results'))) {
                    console.log(chalk.green('✅ Search berhasil, URL berubah ke: ' + newURL));
                    return true;
                }

                attempts++;
                if (attempts % 10 === 0) {
                    console.log(chalk.blue(`⏳ Masih menunggu... (${attempts}/${maxAttempts} detik)`));
                }
            }

            console.log(chalk.yellow('⚠️ Timeout menunggu hasil search'));
            return false;

        } catch (error) {
            console.log(chalk.red(`❌ Error saat menunggu search results: ${error.message}`));
            return false;
        }
    }

    async extractHotelData(searchHotelName) {
        try {
            console.log(chalk.blue('🔍 Mulai extract data hotel...'));

            // Tunggu halaman load sempurna
            await this.page.waitForTimeout(5000);

            // Screenshot untuk debugging
            await this.page.screenshot({ path: 'hotel-search-results.png', fullPage: true });
            console.log(chalk.blue('📸 Screenshot disimpan: hotel-search-results.png'));

            // Extract data hotel yang sesuai dengan search
            const hotelData = await this.page.evaluate((searchName) => {
                console.log(`🔍 Mencari hotel: "${searchName}"...`);

                // Method 1: Cari berdasarkan data-testid yang spesifik untuk Traveloka
                const hotelNameElements = document.querySelectorAll('[data-testid="tvat-hotelName"]');
                const hotelPriceElements = document.querySelectorAll('[data-testid="tvat-hotelPrice"]');

                console.log(`Found ${hotelNameElements.length} hotel names and ${hotelPriceElements.length} hotel prices`);

                // Cari hotel yang sesuai dengan search name
                let targetHotelName = '';
                let targetHotelPrice = '';

                for (let i = 0; i < hotelNameElements.length; i++) {
                    const nameEl = hotelNameElements[i];
                    const nameText = nameEl.textContent || '';

                    if (nameText.toLowerCase().includes(searchName.toLowerCase())) {
                        targetHotelName = nameText.trim();
                        console.log('✅ Found target hotel name:', targetHotelName);

                        // Cari harga yang sesuai (biasanya di index yang sama atau berdekatan)
                        if (hotelPriceElements[i]) {
                            const priceText = hotelPriceElements[i].textContent || '';
                            if (priceText.includes('Rp')) {
                                // Ambil hanya angka dan mata uang
                                const priceMatch = priceText.match(/(Rp\s*\d+[.,\d]*)/);
                                if (priceMatch) {
                                    targetHotelPrice = priceMatch[1].trim();
                                    console.log('✅ Found target hotel price:', targetHotelPrice);
                                }
                            }
                        }
                        break;
                    }
                }

                // Method 2: Fallback jika data-testid tidak ditemukan
                if (!targetHotelName) {
                    console.log('❌ Hotel tidak ditemukan dengan data-testid, mencoba fallback...');

                    // Cari berdasarkan text content
                    const allElements = document.querySelectorAll('*');
                    for (const element of allElements) {
                        const text = element.textContent || '';
                        if (text.toLowerCase().includes(searchName.toLowerCase()) &&
                            (text.includes('Hotel') || text.includes('hotel'))) {

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

                                        console.log('✅ Found with fallback method:', targetHotelName, targetHotelPrice);
                                        break;
                                    }
                                }
                            }
                            if (targetHotelName) break;
                        }
                    }
                }

                // Debug info
                console.log('📊 Data yang ditemukan:');
                console.log('   Nama:', targetHotelName);
                console.log('   Harga:', targetHotelPrice);

                return {
                    name: targetHotelName || searchName,
                    roomPrice: targetHotelPrice || 'N/A'
                };
            }, searchHotelName);

            if (hotelData) {
                console.log(chalk.green('✅ Data hotel berhasil di-extract:'));
                console.log(chalk.blue(`   🏨 Nama: ${hotelData.name}`));
                console.log(chalk.blue(`   💰 Harga Kamar: ${hotelData.roomPrice}`));
                return hotelData;
            } else {
                console.log(chalk.yellow('⚠️ Tidak ada data hotel yang ditemukan'));
                return null;
            }

        } catch (error) {
            console.log(chalk.red(`❌ Error saat extract data: ${error.message}`));
            return null;
        }
    }

    async searchHotel(hotelName) {
        try {
            console.log(chalk.blue(`🔍 Mencari hotel: "${hotelName}"...`));

            // Cari input field
            const inputField = await this.page.$('input[placeholder*="hotel"], input[placeholder*="kota"], [class*="search-input"]');
            if (!inputField) {
                throw new Error('Input field tidak ditemukan');
            }

            // Clear dan isi dengan nama hotel
            await inputField.click();
            await inputField.fill('');
            await inputField.type(hotelName, { delay: 100 });
            console.log(chalk.green(`✅ Sudah ketik: "${hotelName}"`));

            // Tunggu recommendations muncul
            await this.page.waitForTimeout(3000);

            // Cari dan klik recommendation yang tepat
            const recommendations = await this.page.$$('[class*="dropdown"], [class*="suggestion"], [class*="autocomplete"], [role="option"]');

            let recommendationClicked = false;
            for (const rec of recommendations) {
                const text = await rec.textContent();
                if (text && text.toLowerCase().includes(hotelName.toLowerCase())) {
                    await rec.click();
                    console.log(chalk.green('✅ Recommendation diklik: ' + text.trim()));
                    recommendationClicked = true;
                    break;
                }
            }

            if (!recommendationClicked) {
                console.log(chalk.yellow('⚠️ Tidak ada recommendation yang cocok, lanjut dengan input manual'));
            }

            // Tunggu sebentar
            await this.page.waitForTimeout(2000);

            return true;

        } catch (error) {
            console.log(chalk.red(`❌ Error saat search: ${error.message}`));
            return false;
        }
    }

    async scrapeHotel(searchHotelName) {
        try {
            console.log(chalk.blue(`🏨 HOTEL SCRAPER - "${searchHotelName}"`));
            console.log(chalk.blue('=================================================='));

            // Initialize browser
            if (!await this.initialize()) {
                throw new Error('Gagal initialize browser');
            }

            // Buka halaman Traveloka
            if (!await this.openTravelokaPage()) {
                throw new Error('Gagal buka halaman Traveloka');
            }

            console.log(chalk.blue('📋 INSTRUKSI MANUAL:'));
            console.log(chalk.blue('   - Halaman Traveloka Hotel sudah terbuka'));
            console.log(chalk.blue(`   - Silakan search manual untuk hotel: "${searchHotelName}"`));
            console.log(chalk.blue('   - Pastikan search berhasil dan ada hasil yang muncul'));
            console.log(chalk.blue('   - Tunggu sampai halaman search results load sempurna'));

            // Tunggu hasil search
            if (!await this.waitForSearchResults()) {
                throw new Error('Gagal mendapatkan hasil search');
            }

            // Extract data hotel
            const hotelData = await this.extractHotelData(searchHotelName);

            if (hotelData) {
                console.log(chalk.green('\n🎉 SCRAPING BERHASIL!'));
                console.log(chalk.green('=================================================='));
                console.log(chalk.white(`🔍 Search: "${searchHotelName}"`));
                console.log(chalk.white(`🏨 Hotel: ${hotelData.name}`));
                console.log(chalk.white(`💰 Harga Kamar: ${hotelData.roomPrice}`));
                console.log(chalk.green('=================================================='));
            }

            return hotelData;

        } catch (error) {
            console.log(chalk.red(`❌ Error fatal dalam scraping: ${error.message}`));
            return null;
        }
    }

    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                console.log(chalk.green('✅ Page ditutup'));
            }

            if (this.browser) {
                await this.browser.close();
                console.log(chalk.green('✅ Browser ditutup'));
            }

            console.log(chalk.green('✅ Semua resource dibersihkan'));

        } catch (error) {
            console.log(chalk.red(`❌ Error saat cleanup: ${error.message}`));
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
        output: process.stdout
    });

    async function main() {
        try {
            console.log(chalk.blue('🏨 TRAVELOKA HOTEL SCRAPER'));
            console.log(chalk.blue('=================================================='));

            rl.question('Masukkan nama hotel yang ingin di-search: ', async (hotelName) => {
                if (!hotelName.trim()) {
                    console.log(chalk.red('❌ Nama hotel tidak boleh kosong!'));
                    rl.close();
                    return;
                }

                const scraper = new HotelScraper();

                try {
                    await scraper.scrapeHotel(hotelName.trim());
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
