const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

class HotelListManager {
    constructor() {
        this.hotelListPath = './hotel-list.js';
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log(chalk.blue('🏨 HOTEL LIST MANAGER'));
        console.log(chalk.blue('=================================================='));
        console.log(chalk.blue('💡 Kelola daftar hotel yang akan di-scrape otomatis'));
        console.log(chalk.blue('==================================================\n'));

        await this.showMainMenu();
    }

    async showMainMenu() {
        console.log(chalk.yellow('📋 MENU UTAMA:'));
        console.log(chalk.white('1. Lihat daftar hotel'));
        console.log(chalk.white('2. Tambah hotel baru'));
        console.log(chalk.white('3. Edit hotel'));
        console.log(chalk.white('4. Hapus hotel'));
        console.log(chalk.white('5. Import dari file CSV'));
        console.log(chalk.white('6. Export ke file CSV'));
        console.log(chalk.white('7. Test scraping hotel tertentu'));
        console.log(chalk.white('8. Keluar'));

        const choice = await this.question(chalk.cyan('\nPilih menu (1-8): '));

        switch (choice) {
            case '1':
                await this.viewHotels();
                break;
            case '2':
                await this.addHotel();
                break;
            case '3':
                await this.editHotel();
                break;
            case '4':
                await this.deleteHotel();
                break;
            case '5':
                await this.importFromCSV();
                break;
            case '6':
                await this.exportToCSV();
                break;
            case '7':
                await this.testScraping();
                break;
            case '8':
                console.log(chalk.green('👋 Terima kasih telah menggunakan Hotel List Manager!'));
                this.rl.close();
                process.exit(0);
                break;
            default:
                console.log(chalk.red('❌ Pilihan tidak valid!'));
                await this.showMainMenu();
        }
    }

    async viewHotels() {
        console.log(chalk.blue('\n📋 DAFTAR HOTEL YANG AKAN DI-SCRAPE'));
        console.log(chalk.blue('='.repeat(80)));

        try {
            const { hotelList } = require('./hotel-list');

            if (hotelList.length === 0) {
                console.log(chalk.yellow('📭 Belum ada hotel yang ditambahkan'));
            } else {
                // Group berdasarkan kota
                const hotelsByCity = {};
                hotelList.forEach(hotel => {
                    if (!hotelsByCity[hotel.city]) {
                        hotelsByCity[hotel.city] = [];
                    }
                    hotelsByCity[hotel.city].push(hotel);
                });

                Object.keys(hotelsByCity).forEach(city => {
                    console.log(chalk.cyan(`\n🏙️  ${city} (${hotelsByCity[city].length} hotel):`));
                    hotelsByCity[city].forEach((hotel, index) => {
                        const priorityColor = hotel.priority === 'high' ? chalk.red :
                            hotel.priority === 'medium' ? chalk.yellow : chalk.green;

                        console.log(chalk.white(`   ${index + 1}. ${hotel.name}`));
                        console.log(chalk.gray(`      🔍 Query: ${hotel.searchQuery}`));
                        console.log(priorityColor(`      ⭐ Prioritas: ${hotel.priority}`));
                    });
                });

                console.log(chalk.blue(`\n📊 Total: ${hotelList.length} hotel`));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat membaca daftar hotel:'), error.message);
        }

        await this.continueToMenu();
    }

    async addHotel() {
        console.log(chalk.blue('\n➕ TAMBAH HOTEL BARU'));
        console.log(chalk.blue('='.repeat(40)));

        try {
            const name = await this.question(chalk.cyan('Nama Hotel: '));
            const city = await this.question(chalk.cyan('Kota: '));
            const searchQuery = await this.question(chalk.cyan('Query Pencarian (kosongkan jika sama dengan nama): '));
            const priority = await this.question(chalk.cyan('Prioritas (high/medium/low, default: medium): '));

            if (!name || !city) {
                console.log(chalk.red('❌ Nama hotel dan kota harus diisi!'));
                await this.continueToMenu();
                return;
            }

            const newHotel = {
                name: name.trim(),
                city: city.trim(),
                searchQuery: searchQuery.trim() || name.trim(),
                priority: priority.trim() || 'medium'
            };

            // Validasi prioritas
            if (!['high', 'medium', 'low'].includes(newHotel.priority)) {
                newHotel.priority = 'medium';
            }

            // Baca file hotel-list.js
            let fileContent = fs.readFileSync(this.hotelListPath, 'utf8');

            // Tambahkan hotel baru ke array
            const hotelArrayStart = fileContent.indexOf('const hotelList = [');
            const hotelArrayEnd = fileContent.indexOf('];', hotelArrayStart);

            if (hotelArrayStart !== -1 && hotelArrayEnd !== -1) {
                const beforeArray = fileContent.substring(0, hotelArrayEnd);
                const afterArray = fileContent.substring(hotelArrayEnd);

                const newHotelString = `    {
        name: "${newHotel.name}",
        city: "${newHotel.city}",
        searchQuery: "${newHotel.searchQuery}",
        priority: "${newHotel.priority}"
    },`;

                const updatedContent = beforeArray + newHotelString + '\n' + afterArray;
                fs.writeFileSync(this.hotelListPath, updatedContent);

                console.log(chalk.green(`✅ Hotel "${newHotel.name}" berhasil ditambahkan!`));
            } else {
                throw new Error('Tidak dapat menemukan array hotelList dalam file');
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat menambah hotel:'), error.message);
        }

        await this.continueToMenu();
    }

    async editHotel() {
        console.log(chalk.blue('\n✏️  EDIT HOTEL'));
        console.log(chalk.blue('='.repeat(30)));

        try {
            const { hotelList } = require('./hotel-list');

            if (hotelList.length === 0) {
                console.log(chalk.yellow('📭 Belum ada hotel yang bisa diedit'));
                await this.continueToMenu();
                return;
            }

            // Tampilkan daftar hotel dengan nomor
            console.log(chalk.cyan('Pilih hotel yang akan diedit:'));
            hotelList.forEach((hotel, index) => {
                console.log(chalk.white(`${index + 1}. ${hotel.name} (${hotel.city})`));
            });

            const choice = await this.question(chalk.cyan(`\nPilih nomor (1-${hotelList.length}): `));
            const hotelIndex = parseInt(choice) - 1;

            if (hotelIndex < 0 || hotelIndex >= hotelList.length) {
                console.log(chalk.red('❌ Nomor hotel tidak valid!'));
                await this.continueToMenu();
                return;
            }

            const selectedHotel = hotelList[hotelIndex];
            console.log(chalk.blue(`\n✏️  Edit hotel: ${selectedHotel.name}`));

            const name = await this.question(chalk.cyan(`Nama Hotel (${selectedHotel.name}): `));
            const city = await this.question(chalk.cyan(`Kota (${selectedHotel.city}): `));
            const searchQuery = await this.question(chalk.cyan(`Query Pencarian (${selectedHotel.searchQuery}): `));
            const priority = await this.question(chalk.cyan(`Prioritas (${selectedHotel.priority}): `));

            // Update hotel
            const updatedHotel = {
                name: name.trim() || selectedHotel.name,
                city: city.trim() || selectedHotel.city,
                searchQuery: searchQuery.trim() || selectedHotel.searchQuery,
                priority: priority.trim() || selectedHotel.priority
            };

            // Validasi prioritas
            if (!['high', 'medium', 'low'].includes(updatedHotel.priority)) {
                updatedHotel.priority = selectedHotel.priority;
            }

            // Update file
            await this.updateHotelInFile(hotelIndex, updatedHotel);
            console.log(chalk.green(`✅ Hotel "${updatedHotel.name}" berhasil diupdate!`));

        } catch (error) {
            console.error(chalk.red('❌ Error saat edit hotel:'), error.message);
        }

        await this.continueToMenu();
    }

    async deleteHotel() {
        console.log(chalk.blue('\n🗑️  HAPUS HOTEL'));
        console.log(chalk.blue('='.repeat(30)));

        try {
            const { hotelList } = require('./hotel-list');

            if (hotelList.length === 0) {
                console.log(chalk.yellow('📭 Belum ada hotel yang bisa dihapus'));
                await this.continueToMenu();
                return;
            }

            // Tampilkan daftar hotel dengan nomor
            console.log(chalk.cyan('Pilih hotel yang akan dihapus:'));
            hotelList.forEach((hotel, index) => {
                console.log(chalk.white(`${index + 1}. ${hotel.name} (${hotel.city})`));
            });

            const choice = await this.question(chalk.cyan(`\nPilih nomor (1-${hotelList.length}): `));
            const hotelIndex = parseInt(choice) - 1;

            if (hotelIndex < 0 || hotelIndex >= hotelList.length) {
                console.log(chalk.red('❌ Nomor hotel tidak valid!'));
                await this.continueToMenu();
                return;
            }

            const selectedHotel = hotelList[hotelIndex];
            const confirm = await this.question(chalk.red(`\n⚠️  Yakin ingin menghapus hotel "${selectedHotel.name}"? (y/N): `));

            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                await this.removeHotelFromFile(hotelIndex);
                console.log(chalk.green(`✅ Hotel "${selectedHotel.name}" berhasil dihapus!`));
            } else {
                console.log(chalk.yellow('❌ Penghapusan dibatalkan'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat hapus hotel:'), error.message);
        }

        await this.continueToMenu();
    }

    async importFromCSV() {
        console.log(chalk.blue('\n📥 IMPORT DARI CSV'));
        console.log(chalk.blue('='.repeat(30)));
        console.log(chalk.yellow('💡 Format CSV: name,city,searchQuery,priority'));
        console.log(chalk.yellow('💡 File harus berada di folder yang sama dengan script ini'));

        const filename = await this.question(chalk.cyan('Nama file CSV (contoh: hotels.csv): '));

        try {
            const filePath = path.join(process.cwd(), filename);

            if (!fs.existsSync(filePath)) {
                console.log(chalk.red(`❌ File ${filename} tidak ditemukan!`));
                await this.continueToMenu();
                return;
            }

            const csvContent = fs.readFileSync(filePath, 'utf8');
            const lines = csvContent.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                console.log(chalk.red('❌ File CSV kosong atau format tidak valid!'));
                await this.continueToMenu();
                return;
            }

            // Skip header
            const hotels = lines.slice(1).map(line => {
                const [name, city, searchQuery, priority] = line.split(',').map(field => field.trim());
                return {
                    name: name || '',
                    city: city || '',
                    searchQuery: searchQuery || name || '',
                    priority: priority || 'medium'
                };
            }).filter(hotel => hotel.name && hotel.city);

            if (hotels.length === 0) {
                console.log(chalk.red('❌ Tidak ada data hotel yang valid dalam CSV!'));
                await this.continueToMenu();
                return;
            }

            console.log(chalk.blue(`\n📊 Ditemukan ${hotels.length} hotel dalam CSV`));
            console.log(chalk.cyan('Preview data:'));
            hotels.slice(0, 3).forEach(hotel => {
                console.log(chalk.white(`   🏨 ${hotel.name} (${hotel.city})`));
            });

            const confirm = await this.question(chalk.cyan('\nLanjutkan import? (y/N): '));

            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                // Baca file hotel-list.js
                let fileContent = fs.readFileSync(this.hotelListPath, 'utf8');

                // Ganti array hotelList dengan yang baru
                const hotelArrayStart = fileContent.indexOf('const hotelList = [');
                const hotelArrayEnd = fileContent.indexOf('];', hotelArrayStart);

                if (hotelArrayStart !== -1 && hotelArrayEnd !== -1) {
                    const beforeArray = fileContent.substring(0, hotelArrayStart + 'const hotelList = ['.length);
                    const afterArray = fileContent.substring(hotelArrayEnd);

                    const newHotelArray = hotels.map(hotel => `    {
        name: "${hotel.name}",
        city: "${hotel.city}",
        searchQuery: "${hotel.searchQuery}",
        priority: "${hotel.priority}"
    }`).join(',\n');

                    const updatedContent = beforeArray + '\n' + newHotelArray + '\n' + afterArray;
                    fs.writeFileSync(this.hotelListPath, updatedContent);

                    console.log(chalk.green(`✅ Berhasil import ${hotels.length} hotel dari CSV!`));
                } else {
                    throw new Error('Tidak dapat menemukan array hotelList dalam file');
                }
            } else {
                console.log(chalk.yellow('❌ Import dibatalkan'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat import CSV:'), error.message);
        }

        await this.continueToMenu();
    }

    async exportToCSV() {
        console.log(chalk.blue('\n📤 EXPORT KE CSV'));
        console.log(chalk.blue('='.repeat(30)));

        try {
            const { hotelList } = require('./hotel-list');

            if (hotelList.length === 0) {
                console.log(chalk.yellow('📭 Tidak ada hotel yang bisa diexport'));
                await this.continueToMenu();
                return;
            }

            const filename = await this.question(chalk.cyan('Nama file CSV (default: hotels-export.csv): ')) || 'hotels-export.csv';

            // Buat konten CSV
            const csvHeader = 'name,city,searchQuery,priority\n';
            const csvContent = csvHeader + hotelList.map(hotel =>
                `"${hotel.name}","${hotel.city}","${hotel.searchQuery}","${hotel.priority}"`
            ).join('\n');

            fs.writeFileSync(filename, csvContent);
            console.log(chalk.green(`✅ Berhasil export ${hotelList.length} hotel ke file ${filename}!`));

        } catch (error) {
            console.error(chalk.red('❌ Error saat export CSV:'), error.message);
        }

        await this.continueToMenu();
    }

    async testScraping() {
        console.log(chalk.blue('\n🧪 TEST SCRAPING'));
        console.log(chalk.blue('='.repeat(30)));

        try {
            const { hotelList } = require('./hotel-list');

            if (hotelList.length === 0) {
                console.log(chalk.yellow('📭 Belum ada hotel yang bisa ditest'));
                await this.continueToMenu();
                return;
            }

            // Tampilkan daftar hotel dengan nomor
            console.log(chalk.cyan('Pilih hotel yang akan ditest:'));
            hotelList.forEach((hotel, index) => {
                console.log(chalk.white(`${index + 1}. ${hotel.name} (${hotel.city})`));
            });

            const choice = await this.question(chalk.cyan(`\nPilih nomor (1-${hotelList.length}): `));
            const hotelIndex = parseInt(choice) - 1;

            if (hotelIndex < 0 || hotelIndex >= hotelList.length) {
                console.log(chalk.red('❌ Nomor hotel tidak valid!'));
                await this.continueToMenu();
                return;
            }

            const selectedHotel = hotelList[hotelIndex];
            console.log(chalk.blue(`\n🧪 Test scraping hotel: ${selectedHotel.name}`));
            console.log(chalk.cyan(`🔍 Query: ${selectedHotel.searchQuery}`));
            console.log(chalk.cyan(`🏙️  Kota: ${selectedHotel.city}`));

            const confirm = await this.question(chalk.cyan('\nLanjutkan test scraping? (y/N): '));

            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                console.log(chalk.blue('\n🚀 Memulai test scraping...'));
                console.log(chalk.yellow('⚠️  Pastikan browser tidak sedang digunakan oleh scraper lain'));

                // Jalankan test scraping
                const HotelScraper = require('./hotel-scraper');
                const scraper = new HotelScraper();

                try {
                    await scraper.initialize();
                    const result = await scraper.scrapeHotel(selectedHotel.searchQuery);

                    if (result) {
                        console.log(chalk.green('\n✅ Test scraping berhasil!'));
                        console.log(chalk.cyan(`🏨 Hotel: ${result.name}`));
                        console.log(chalk.cyan(`💰 Harga: ${result.roomPrice || 'Tidak tersedia'}`));
                        console.log(chalk.cyan(`📍 Lokasi: ${result.location || 'Tidak tersedia'}`));
                        console.log(chalk.cyan(`⭐ Rating: ${result.rating || 'Tidak tersedia'}`));
                    } else {
                        console.log(chalk.red('\n❌ Test scraping gagal!'));
                    }
                } finally {
                    await scraper.cleanup();
                }
            } else {
                console.log(chalk.yellow('❌ Test scraping dibatalkan'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error saat test scraping:'), error.message);
        }

        await this.continueToMenu();
    }

    async updateHotelInFile(index, updatedHotel) {
        // Implementasi update hotel dalam file
        // Ini adalah implementasi sederhana, bisa ditingkatkan
        const { hotelList } = require('./hotel-list');
        hotelList[index] = updatedHotel;

        // Rebuild file content
        let fileContent = fs.readFileSync(this.hotelListPath, 'utf8');
        const hotelArrayStart = fileContent.indexOf('const hotelList = [');
        const hotelArrayEnd = fileContent.indexOf('];', hotelArrayStart);

        if (hotelArrayStart !== -1 && hotelArrayEnd !== -1) {
            const beforeArray = fileContent.substring(0, hotelArrayStart + 'const hotelList = ['.length);
            const afterArray = fileContent.substring(hotelArrayEnd);

            const newHotelArray = hotelList.map(hotel => `    {
        name: "${hotel.name}",
        city: "${hotel.city}",
        searchQuery: "${hotel.searchQuery}",
        priority: "${hotel.priority}"
    }`).join(',\n');

            const updatedContent = beforeArray + '\n' + newHotelArray + '\n' + afterArray;
            fs.writeFileSync(this.hotelListPath, updatedContent);
        }
    }

    async removeHotelFromFile(index) {
        // Implementasi hapus hotel dari file
        const { hotelList } = require('./hotel-list');
        hotelList.splice(index, 1);

        // Rebuild file content
        let fileContent = fs.readFileSync(this.hotelListPath, 'utf8');
        const hotelArrayStart = fileContent.indexOf('const hotelList = [');
        const hotelArrayEnd = fileContent.indexOf('];', hotelArrayStart);

        if (hotelArrayStart !== -1 && hotelArrayEnd !== -1) {
            const beforeArray = fileContent.substring(0, hotelArrayStart + 'const hotelList = ['.length);
            const afterArray = fileContent.substring(hotelArrayEnd);

            const newHotelArray = hotelList.map(hotel => `    {
        name: "${hotel.name}",
        city: "${hotel.city}",
        searchQuery: "${hotel.searchQuery}",
        priority: "${hotel.priority}"
    }`).join(',\n');

            const updatedContent = beforeArray + '\n' + newHotelArray + '\n' + afterArray;
            fs.writeFileSync(this.hotelListPath, updatedContent);
        }
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

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    const manager = new HotelListManager();
    manager.start().catch(console.error);
}

module.exports = HotelListManager;
