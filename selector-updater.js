const chalk = require('chalk');
const { chromium } = require('playwright');

class SelectorUpdater {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        try {
            this.browser = await chromium.launch({
                headless: false,
                slowMo: 1000
            });
            this.page = await this.browser.newPage();
            console.log(chalk.green('✅ Browser berhasil dimulai'));
        } catch (error) {
            console.error(chalk.red('❌ Gagal memulai browser:'), error.message);
        }
    }

    async detectSearchButtonSelectors() {
        try {
            console.log(chalk.blue('🔍 Mencari selector tombol search yang baru...'));

            // Buka Traveloka
            await this.page.goto('https://www.traveloka.com/id-id/hotel');
            await this.page.waitForTimeout(3000);

            // Cari input field
            const inputField = await this.page.$('input[placeholder*="hotel"], input[placeholder*="kota"], input[placeholder*="Hotel"], input[placeholder*="Kota"]');
            if (!inputField) {
                console.log(chalk.red('❌ Input field tidak ditemukan'));
                return;
            }

            // Click input field
            await inputField.click();
            await this.page.waitForTimeout(1000);

            // Type something
            await inputField.type('Jakarta');
            await this.page.waitForTimeout(2000);

            // Screenshot untuk analisis
            await this.page.screenshot({ path: 'selector-analysis.png', fullPage: false });
            console.log(chalk.blue('📸 Screenshot disimpan: selector-analysis.png'));

            // Deteksi semua button yang mungkin
            const allButtons = await this.page.$$('button, [role="button"], input[type="submit"]');
            console.log(chalk.cyan(`🔍 Ditemukan ${allButtons.length} button`));

            const buttonInfo = [];
            for (let i = 0; i < allButtons.length; i++) {
                try {
                    const button = allButtons[i];
                    const text = await button.textContent();
                    const className = await button.getAttribute('class') || '';
                    const type = await button.getAttribute('type') || '';
                    const dataTestId = await button.getAttribute('data-testid') || '';
                    const ariaLabel = await button.getAttribute('aria-label') || '';
                    const title = await button.getAttribute('title') || '';

                    // Check if button is visible and near input
                    const isVisible = await button.isVisible();
                    const boundingBox = await button.boundingBox();

                    buttonInfo.push({
                        index: i,
                        text: text ? text.trim() : '',
                        className,
                        type,
                        dataTestId,
                        ariaLabel,
                        title,
                        isVisible,
                        boundingBox
                    });

                    console.log(chalk.white(`${i + 1}. Text: "${text ? text.trim() : 'N/A'}" | Class: ${className} | Type: ${type} | Visible: ${isVisible}`));

                } catch (error) {
                    console.log(chalk.red(`❌ Error membaca button ${i + 1}: ${error.message}`));
                }
            }

            // Analisis button yang paling mungkin search button
            const potentialSearchButtons = buttonInfo.filter(btn =>
                btn.isVisible &&
                (btn.text.toLowerCase().includes('cari') ||
                    btn.text.toLowerCase().includes('search') ||
                    btn.text.toLowerCase().includes('submit') ||
                    btn.className.toLowerCase().includes('search') ||
                    btn.className.toLowerCase().includes('submit') ||
                    btn.className.toLowerCase().includes('primary') ||
                    btn.type === 'submit' ||
                    btn.dataTestId.toLowerCase().includes('search') ||
                    btn.ariaLabel.toLowerCase().includes('cari') ||
                    btn.ariaLabel.toLowerCase().includes('search'))
            );

            console.log(chalk.blue('\n🎯 BUTTON YANG BERKEMUNGKINAN SEARCH BUTTON:'));
            potentialSearchButtons.forEach((btn, index) => {
                console.log(chalk.green(`${index + 1}. Text: "${btn.text}" | Class: ${btn.className} | Type: ${btn.type}`));
            });

            // Generate selector recommendations
            this.generateSelectorRecommendations(buttonInfo);

        } catch (error) {
            console.error(chalk.red('❌ Error saat detect selector:'), error.message);
        }
    }

    generateSelectorRecommendations(buttonInfo) {
        console.log(chalk.blue('\n💡 REKOMENDASI SELECTOR:'));

        // Text-based selectors
        const textButtons = buttonInfo.filter(btn => btn.text && btn.text.trim());
        if (textButtons.length > 0) {
            console.log(chalk.cyan('\n📝 Text-based selectors:'));
            textButtons.forEach(btn => {
                if (btn.text.toLowerCase().includes('cari') || btn.text.toLowerCase().includes('search')) {
                    console.log(chalk.green(`   button:has-text("${btn.text}")`));
                }
            });
        }

        // Data-testid selectors
        const testIdButtons = buttonInfo.filter(btn => btn.dataTestId);
        if (testIdButtons.length > 0) {
            console.log(chalk.cyan('\n🏷️ Data-testid selectors:'));
            testIdButtons.forEach(btn => {
                console.log(chalk.green(`   [data-testid="${btn.dataTestId}"]`));
            });
        }

        // Class-based selectors
        const classButtons = buttonInfo.filter(btn => btn.className);
        if (classButtons.length > 0) {
            console.log(chalk.cyan('\n🎨 Class-based selectors:'));
            const uniqueClasses = [...new Set(classButtons.map(btn => btn.className))];
            uniqueClasses.forEach(className => {
                if (className.toLowerCase().includes('search') ||
                    className.toLowerCase().includes('submit') ||
                    className.toLowerCase().includes('btn')) {
                    console.log(chalk.green(`   [class*="${className.split(' ')[0]}"]`));
                }
            });
        }

        // Aria-label selectors
        const ariaButtons = buttonInfo.filter(btn => btn.ariaLabel);
        if (ariaButtons.length > 0) {
            console.log(chalk.cyan('\n♿ Aria-label selectors:'));
            ariaButtons.forEach(btn => {
                if (btn.ariaLabel.toLowerCase().includes('cari') ||
                    btn.ariaLabel.toLowerCase().includes('search')) {
                    console.log(chalk.green(`   [aria-label*="${btn.ariaLabel.split(' ')[0]}"]`));
                }
            });
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log(chalk.blue('🔌 Browser ditutup'));
        }
    }
}

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    const updater = new SelectorUpdater();

    updater.initialize()
        .then(() => updater.detectSearchButtonSelectors())
        .then(() => updater.cleanup())
        .catch(error => {
            console.error(chalk.red('❌ Error fatal:'), error);
            updater.cleanup();
            process.exit(1);
        });
}

module.exports = SelectorUpdater;
