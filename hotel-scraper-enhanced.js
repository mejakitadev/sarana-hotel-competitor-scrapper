// Enhanced Hotel Scraper with Robust Search Button Detection
// Copy this content to replace the search button detection section in hotel-scraper.js

// Method 1: Cari tombol cari dengan text yang lebih spesifik
let searchButton = await this.page.$('button:has-text("Cari"), button:has-text("Search"), button:has-text("Cari Hotel"), button:has-text("Search Hotel")');
if (searchButton) {
    this.log('✅ Found search button with Method 1 (text-based selector)', 'success');
}

// Method 2: Cari berdasarkan data-testid yang spesifik
if (!searchButton) {
    searchButton = await this.page.$('[data-testid="search-button"], [data-testid="submit-button"], [data-testid="search-submit"]');
    if (searchButton) {
        this.log('✅ Found search button with Method 2 (data-testid selector)', 'success');
    }
}

// Method 3: Cari berdasarkan class yang spesifik
if (!searchButton) {
    searchButton = await this.page.$('[class*="search-button"], [class*="btn-search"], [class*="search-btn"], [class*="submit-button"]');
    if (searchButton) {
        this.log('✅ Found search button with Method 3 (class-based selector)', 'success');
    }
}

// Method 4: Cari berdasarkan aria-label atau title
if (!searchButton) {
    searchButton = await this.page.$('[aria-label*="cari"], [aria-label*="search"], [title*="cari"], [title*="search"]');
    if (searchButton) {
        this.log('✅ Found search button with Method 4 (aria-label/title selector)', 'success');
    }
}

// Method 5: Cari berdasarkan form submit
if (!searchButton) {
    searchButton = await this.page.$('form button[type="submit"], form input[type="submit"], form [role="button"]');
    if (searchButton) {
        this.log('✅ Found search button with Method 5 (form submit selector)', 'success');
    }
}

// Method 6: Cari berdasarkan posisi dan style (biasanya search button ada di sebelah input)
if (!searchButton) {
    try {
        const inputRect = await inputField.boundingBox();
        if (inputRect) {
            const nearbyButtons = await this.page.$$(`button, [role="button"], input[type="submit"]`);

            for (const button of nearbyButtons) {
                const buttonRect = await button.boundingBox();
                if (buttonRect) {
                    // Check if button is near input field (within reasonable distance)
                    const distance = Math.abs(buttonRect.x - inputRect.x) + Math.abs(buttonRect.y - inputRect.y);
                    if (distance < 200) { // Within 200px
                        const text = await button.textContent();
                        if (text && text.trim()) {
                            searchButton = button;
                            this.log(`✅ Found search button with Method 6 (proximity): "${text.trim()}"`, 'success');
                            break;
                        }
                    }
                }
            }
        }
    } catch (error) {
        this.log('⚠️ Method 6 (proximity) failed, continuing...', 'warning');
    }
}

// Method 7: Fallback - cari semua button yang mungkin
if (!searchButton) {
    this.log('🔍 Method 7: Scanning all buttons for search functionality...', 'info');
    const allButtons = await this.page.$$('button, [role="button"], input[type="submit"], [class*="btn"]');

    for (const button of allButtons) {
        try {
            const text = await button.textContent();
            const className = await button.getAttribute('class') || '';
            const type = await button.getAttribute('type') || '';
            const ariaLabel = await button.getAttribute('aria-label') || '';
            const title = await button.getAttribute('title') || '';

            // Check multiple criteria
            if (text && (text.toLowerCase().includes('cari') ||
                text.toLowerCase().includes('search') ||
                text.toLowerCase().includes('submit') ||
                text.toLowerCase().includes('go') ||
                text.toLowerCase().includes('lanjut') ||
                className.toLowerCase().includes('search') ||
                className.toLowerCase().includes('submit') ||
                className.toLowerCase().includes('primary') ||
                className.toLowerCase().includes('action') ||
                type === 'submit' ||
                ariaLabel.toLowerCase().includes('cari') ||
                ariaLabel.toLowerCase().includes('search') ||
                title.toLowerCase().includes('cari') ||
                title.toLowerCase().includes('search'))) {
                searchButton = button;
                this.log(`✅ Found search button with Method 7: "${text.trim()}" (class: ${className})`, 'success');
                break;
            }
        } catch (error) {
            // Skip buttons that can't be read
        }
    }
}

// Method 8: Last resort - cari button dengan warna atau style yang menonjol
if (!searchButton) {
    this.log('🔍 Method 8: Looking for prominent buttons...', 'info');
    try {
        const prominentButtons = await this.page.$$eval('button, [role="button"]', (buttons) => {
            return buttons.filter(button => {
                const style = window.getComputedStyle(button);
                const backgroundColor = style.backgroundColor;
                const color = style.color;

                // Look for buttons with prominent colors (blue, green, etc.)
                return backgroundColor.includes('rgb(0, 123, 255)') || // Bootstrap primary
                    backgroundColor.includes('rgb(40, 167, 69)') || // Bootstrap success
                    backgroundColor.includes('rgb(23, 162, 184)') || // Bootstrap info
                    backgroundColor.includes('rgb(255, 193, 7)') || // Bootstrap warning
                    backgroundColor.includes('rgb(220, 53, 69)') || // Bootstrap danger
                    backgroundColor.includes('rgb(108, 117, 125)') || // Bootstrap secondary
                    backgroundColor.includes('rgb(52, 58, 64)') || // Bootstrap dark
                    backgroundColor.includes('rgb(248, 249, 250)') || // Bootstrap light
                    backgroundColor.includes('rgb(255, 255, 255)'); // White
            });
        });

        if (prominentButtons.length > 0) {
            searchButton = await this.page.$(prominentButtons[0]);
            this.log('✅ Found search button with Method 8 (prominent styling)', 'success');
        }
    } catch (error) {
        this.log('⚠️ Method 8 (prominent styling) failed, continuing...', 'warning');
    }
}

// ENHANCED FALLBACK METHODS
if (searchButton) {
    try {
        // Screenshot tombol cari yang ditemukan
        await searchButton.screenshot({ path: 'search-button-found.png' });
        this.log('📸 Screenshot tombol cari: search-button-found.png', 'info');

        // Try multiple click methods
        try {
            await searchButton.click();
            this.log('✅ Tombol cari diklik dengan method 1!', 'success');
        } catch (clickError) {
            this.log(`⚠️ Method 1 click failed: ${clickError.message}`, 'warning');

            // Method 2: Click with coordinates
            try {
                const box = await searchButton.boundingBox();
                if (box) {
                    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                    this.log('✅ Tombol cari diklik dengan method 2 (coordinates)!', 'success');
                }
            } catch (coordError) {
                this.log(`⚠️ Method 2 click failed: ${coordError.message}`, 'warning');

                // Method 3: JavaScript click
                try {
                    await this.page.evaluate(button => button.click(), searchButton);
                    this.log('✅ Tombol cari diklik dengan method 3 (JavaScript)!', 'success');
                } catch (jsError) {
                    this.log(`⚠️ Method 3 click failed: ${jsError.message}`, 'warning');
                    throw jsError;
                }
            }
        }

        // Tunggu sebentar untuk search process
        await this.page.waitForTimeout(2000);

    } catch (error) {
        this.log(`⚠️ Semua method click gagal: ${error.message}`, 'warning');
        searchButton = null; // Reset untuk fallback
    }
}

// MULTIPLE FALLBACK METHODS JIKA TIDAK ADA SEARCH BUTTON
if (!searchButton) {
    this.log('⚠️ Tombol cari tidak ditemukan, mencoba multiple fallback methods...', 'warning');

    // Fallback 1: Tekan Enter di input field
    try {
        this.log('⌨️ Fallback 1: Mencoba tekan Enter di input field...', 'info');
        await inputField.press('Enter');
        this.log('✅ Enter berhasil ditekan!', 'success');
    } catch (enterError) {
        this.log(`⚠️ Fallback 1 gagal: ${enterError.message}`, 'warning');

        // Fallback 2: Submit form
        try {
            this.log('📝 Fallback 2: Mencoba submit form...', 'info');
            await this.page.evaluate(() => {
                const forms = document.querySelectorAll('form');
                forms.forEach(form => {
                    if (form.querySelector('input[type="text"], input[type="search"]')) {
                        form.submit();
                    }
                });
            });
            this.log('✅ Form berhasil di-submit!', 'success');
        } catch (formError) {
            this.log(`⚠️ Fallback 2 gagal: ${formError.message}`, 'warning');

            // Fallback 3: Simulate Enter key event
            try {
                this.log('⌨️ Fallback 3: Simulate Enter key event...', 'info');
                await this.page.evaluate(input => {
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13 }));
                    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13 }));
                    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13 }));
                }, inputField);
                this.log('✅ Enter key event berhasil di-simulate!', 'success');
            } catch (eventError) {
                this.log(`⚠️ Fallback 3 gagal: ${eventError.message}`, 'warning');

                // Fallback 4: Last resort - refresh page dan coba lagi
                this.log('🔄 Fallback 4: Refresh page dan coba lagi...', 'info');
                await this.page.reload();
                await this.page.waitForTimeout(3000);

                // Coba search lagi setelah refresh
                await this.searchHotel(hotelName);
            }
        }
    }
}

// Tunggu sebentar untuk search process
await this.page.waitForTimeout(3000);

// Debug: Screenshot setelah search
await this.page.screenshot({ path: 'after-search.png', fullPage: false });
this.log('📸 Screenshot setelah search: after-search.png', 'info');

return true;
