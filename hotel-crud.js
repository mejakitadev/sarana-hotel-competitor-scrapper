const chalk = require('chalk');
const readline = require('readline');
const DatabaseManager = require('./database');

class HotelCRUD {
    constructor() {
        this.db = new DatabaseManager();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log(chalk.blue('🏨 HOTEL CRUD MANAGEMENT SYSTEM'));
        console.log(chalk.blue('================================'));

        // Connect ke database
        const connected = await this.db.connect();
        if (!connected) {
            console.log(chalk.red('❌ Gagal koneksi ke database'));
            return;
        }

        await this.showMenu();
    }

    async showMenu() {
        console.log('\n📋 MENU UTAMA:');
        console.log('1. 📝 Tambah Hotel Baru');
        console.log('2. ✏️  Edit Hotel Existing');
        console.log('3. 🗑️  Hapus Hotel');
        console.log('4. 👀 Lihat List Hotel');
        console.log('5. 🔍 Cari Hotel');
        console.log('6. 📊 Statistik Hotel');
        console.log('7. 🚀 Bulk Insert Hotel');
        console.log('8. ❌ Keluar');

        const choice = await this.question('Pilih menu (1-8): ');

        switch (choice) {
            case '1':
                await this.addHotel();
                break;
            case '2':
                await this.editHotel();
                break;
            case '3':
                await this.deleteHotel();
                break;
            case '4':
                await this.listHotels();
                break;
            case '5':
                await this.searchHotel();
                break;
            case '6':
                await this.showStats();
                break;
            case '7':
                await this.bulkInsertHotels();
                break;
            case '8':
                console.log(chalk.blue('👋 Terima kasih!'));
                this.rl.close();
                await this.db.close();
                process.exit(0);
                break;
            default:
                console.log(chalk.red('❌ Pilihan tidak valid!'));
                await this.showMenu();
        }
    }

    async addHotel() {
        console.log(chalk.blue('\n📝 TAMBAH HOTEL BARU'));
        console.log(chalk.blue('===================='));

        const hotelName = await this.question('🏨 Nama Hotel: ');
        const searchKey = await this.question('🔍 Search Key (default: nama hotel): ');

        // Generate search_key jika tidak diisi
        const finalSearchKey = searchKey || hotelName;
        const defaultPrice = 0; // Harga default 0

        try {
            // Insert ke hotel_scraping_results
            const insertQuery = `
                INSERT INTO hotel_scraping_results 
                (search_key, hotel_name, room_price, status, error_message)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `;

            const values = [finalSearchKey, hotelName, defaultPrice, 'pending', 'Hotel ditambahkan manual'];
            const result = await this.db.pool.query(insertQuery, values);
            const scrapingId = result.rows[0].id;

            // Insert ke hotel_data
            const insertHotelDataQuery = `
                INSERT INTO hotel_data 
                (hotel_id, hotel_name, rate_harga)
                VALUES ($1, $2, $3)
                RETURNING hotel_id
            `;

            const hotelDataValues = [scrapingId, hotelName, defaultPrice];
            const hotelDataResult = await this.db.pool.query(insertHotelDataQuery, hotelDataValues);

            console.log(chalk.green('✅ Hotel berhasil ditambahkan!'));
            console.log(chalk.cyan(`   🆔 Scraping ID: ${scrapingId}`));
            console.log(chalk.cyan(`   🏨 Hotel Data ID: ${hotelDataResult.rows[0].hotel_id}`));
            console.log(chalk.cyan(`   🔍 Search Key: ${finalSearchKey}`));
            console.log(chalk.cyan(`   💰 Harga Default: Rp 0`));

        } catch (error) {
            console.log(chalk.red(`❌ Gagal menambahkan hotel: ${error.message}`));
        }

        await this.continueToMenu();
    }

    async editHotel() {
        console.log(chalk.blue('\n✏️  EDIT HOTEL EXISTING'));
        console.log(chalk.blue('========================'));

        // Tampilkan list hotel untuk dipilih
        const hotels = await this.db.getHotelData(50);
        if (hotels.length === 0) {
            console.log(chalk.yellow('⚠️  Tidak ada hotel di database'));
            await this.continueToMenu();
            return;
        }

        console.log(chalk.cyan('\n📋 Daftar Hotel:'));
        hotels.forEach((hotel, index) => {
            console.log(chalk.white(`${index + 1}. ${hotel.hotel_name} (${hotel.search_key}) - Rp ${hotel.rate_harga.toLocaleString('id-ID')}`));
        });

        const choice = await this.question('\nPilih nomor hotel yang akan diedit: ');
        const hotelIndex = parseInt(choice) - 1;

        if (hotelIndex < 0 || hotelIndex >= hotels.length) {
            console.log(chalk.red('❌ Pilihan tidak valid!'));
            await this.continueToMenu();
            return;
        }

        const selectedHotel = hotels[hotelIndex];
        console.log(chalk.blue(`\n✏️  Edit Hotel: ${selectedHotel.hotel_name}`));

        const newHotelName = await this.question(`Nama Hotel Baru (${selectedHotel.hotel_name}): `);
        const newSearchKey = await this.question(`Search Key Baru (${selectedHotel.search_key}): `);
        const newPrice = await this.question(`Harga Baru (Rp ${selectedHotel.rate_harga.toLocaleString('id-ID')}): `);

        try {
            // Update hotel_scraping_results
            const updateQuery = `
                UPDATE hotel_scraping_results 
                SET hotel_name = $1, search_key = $2, room_price = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
            `;

            const finalHotelName = newHotelName || selectedHotel.hotel_name;
            const finalSearchKey = newSearchKey || selectedHotel.search_key;
            const finalPrice = newPrice ? parseFloat(newPrice) : selectedHotel.rate_harga;

            await this.db.pool.query(updateQuery, [finalHotelName, finalSearchKey, finalPrice, selectedHotel.hotel_id]);

            // Update hotel_data
            const updateHotelDataQuery = `
                UPDATE hotel_data 
                SET hotel_name = $1, rate_harga = $2, updated_at = CURRENT_TIMESTAMP
                WHERE hotel_id = $3
            `;

            await this.db.pool.query(updateHotelDataQuery, [finalHotelName, finalPrice, selectedHotel.hotel_id]);

            console.log(chalk.green('✅ Hotel berhasil diupdate!'));
            console.log(chalk.cyan(`   🏨 Nama: ${finalHotelName}`));
            console.log(chalk.cyan(`   🔍 Search Key: ${finalSearchKey}`));
            console.log(chalk.cyan(`   💰 Harga: Rp ${finalPrice.toLocaleString('id-ID')}`));

        } catch (error) {
            console.log(chalk.red(`❌ Gagal mengupdate hotel: ${error.message}`));
        }

        await this.continueToMenu();
    }

    async deleteHotel() {
        console.log(chalk.blue('\n🗑️  HAPUS HOTEL'));
        console.log(chalk.blue('==============='));

        // Tampilkan list hotel untuk dipilih
        const hotels = await this.db.getHotelData(50);
        if (hotels.length === 0) {
            console.log(chalk.yellow('⚠️  Tidak ada hotel di database'));
            await this.continueToMenu();
            return;
        }

        console.log(chalk.cyan('\n📋 Daftar Hotel:'));
        hotels.forEach((hotel, index) => {
            console.log(chalk.white(`${index + 1}. ${hotel.hotel_name} (${hotel.search_key}) - Rp ${hotel.rate_harga.toLocaleString('id-ID')}`));
        });

        const choice = await this.question('\nPilih nomor hotel yang akan dihapus: ');
        const hotelIndex = parseInt(choice) - 1;

        if (hotelIndex < 0 || hotelIndex >= hotels.length) {
            console.log(chalk.red('❌ Pilihan tidak valid!'));
            await this.continueToMenu();
            return;
        }

        const selectedHotel = hotels[hotelIndex];
        const confirm = await this.question(`\n⚠️  Yakin ingin menghapus hotel "${selectedHotel.hotel_name}"? (y/N): `);

        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            try {
                // Hapus dari hotel_data (akan cascade ke hotel_scraping_results)
                const deleteQuery = `DELETE FROM hotel_data WHERE hotel_id = $1`;
                await this.db.pool.query(deleteQuery, [selectedHotel.hotel_id]);

                console.log(chalk.green(`✅ Hotel "${selectedHotel.hotel_name}" berhasil dihapus!`));
            } catch (error) {
                console.log(chalk.red(`❌ Gagal menghapus hotel: ${error.message}`));
            }
        } else {
            console.log(chalk.blue('❌ Penghapusan dibatalkan'));
        }

        await this.continueToMenu();
    }

    async listHotels() {
        console.log(chalk.blue('\n👀 LIST HOTEL'));
        console.log(chalk.blue('=============='));

        const hotels = await this.db.getHotelData(100);
        if (hotels.length === 0) {
            console.log(chalk.yellow('⚠️  Tidak ada hotel di database'));
            await this.continueToMenu();
            return;
        }

        console.log(chalk.cyan(`\n📊 Total Hotel: ${hotels.length}`));
        console.log(chalk.blue('='.repeat(80)));

        // Group by city
        const hotelsByCity = {};
        hotels.forEach(hotel => {
            const city = this.extractCityFromSearchKey(hotel.search_key);
            if (!hotelsByCity[city]) {
                hotelsByCity[city] = [];
            }
            hotelsByCity[city].push(hotel);
        });

        Object.keys(hotelsByCity).forEach(city => {
            console.log(chalk.yellow(`\n🌆 ${city} (${hotelsByCity[city].length} hotel):`));
            hotelsByCity[city].forEach(hotel => {
                const priceStatus = hotel.rate_harga > 0 ?
                    `Rp ${hotel.rate_harga.toLocaleString('id-ID')}` :
                    chalk.red('Rp 0 (Belum di-scrape)');

                console.log(chalk.white(`   🏨 ${hotel.hotel_name}`));
                console.log(chalk.cyan(`      🔍 ${hotel.search_key}`));
                console.log(chalk.cyan(`      💰 ${priceStatus}`));
                console.log(chalk.cyan(`      📅 ${new Date(hotel.updated_at).toLocaleString('id-ID')}`));
                console.log('');
            });
        });

        await this.continueToMenu();
    }

    async searchHotel() {
        console.log(chalk.blue('\n🔍 CARI HOTEL'));
        console.log(chalk.blue('=============='));

        const searchTerm = await this.question('🔍 Masukkan nama hotel atau kota: ');
        if (!searchTerm.trim()) {
            console.log(chalk.red('❌ Kata kunci pencarian tidak boleh kosong!'));
            await this.continueToMenu();
            return;
        }

        try {
            // Search by hotel name
            const hotelsByName = await this.db.getHotelDataByName(searchTerm, 20);

            // Search by city
            const hotelsByCity = await this.db.getHotelDataByCity(searchTerm, 20);

            // Combine and remove duplicates
            const allHotels = [...hotelsByName, ...hotelsByCity];
            const uniqueHotels = allHotels.filter((hotel, index, self) =>
                index === self.findIndex(h => h.hotel_id === hotel.hotel_id)
            );

            if (uniqueHotels.length === 0) {
                console.log(chalk.yellow(`⚠️  Tidak ada hotel yang cocok dengan "${searchTerm}"`));
                await this.continueToMenu();
                return;
            }

            console.log(chalk.cyan(`\n🔍 Hasil Pencarian untuk "${searchTerm}": ${uniqueHotels.length} hotel`));
            console.log(chalk.blue('='.repeat(60)));

            uniqueHotels.forEach((hotel, index) => {
                const priceStatus = hotel.rate_harga > 0 ?
                    `Rp ${hotel.rate_harga.toLocaleString('id-ID')}` :
                    chalk.red('Rp 0 (Belum di-scrape)');

                console.log(chalk.white(`${index + 1}. ${hotel.hotel_name}`));
                console.log(chalk.cyan(`   🔍 ${hotel.search_key}`));
                console.log(chalk.cyan(`   💰 ${priceStatus}`));
                console.log(chalk.cyan(`   📅 ${new Date(hotel.updated_at).toLocaleString('id-ID')}`));
                console.log('');
            });

        } catch (error) {
            console.log(chalk.red(`❌ Error saat mencari hotel: ${error.message}`));
        }

        await this.continueToMenu();
    }

    async showStats() {
        console.log(chalk.blue('\n📊 STATISTIK HOTEL'));
        console.log(chalk.blue('==================='));

        try {
            const hotels = await this.db.getHotelData(1000);

            if (hotels.length === 0) {
                console.log(chalk.yellow('⚠️  Tidak ada hotel di database'));
                await this.continueToMenu();
                return;
            }

            // Group by city
            const hotelsByCity = {};
            const priceStats = {
                total: 0,
                withPrice: 0,
                withoutPrice: 0,
                totalPrice: 0,
                minPrice: Infinity,
                maxPrice: 0
            };

            hotels.forEach(hotel => {
                const city = this.extractCityFromSearchKey(hotel.search_key);
                if (!hotelsByCity[city]) {
                    hotelsByCity[city] = 0;
                }
                hotelsByCity[city]++;

                priceStats.total++;
                if (hotel.rate_harga > 0) {
                    priceStats.withPrice++;
                    priceStats.totalPrice += hotel.rate_harga;
                    priceStats.minPrice = Math.min(priceStats.minPrice, hotel.rate_harga);
                    priceStats.maxPrice = Math.max(priceStats.maxPrice, hotel.rate_harga);
                } else {
                    priceStats.withoutPrice++;
                }
            });

            console.log(chalk.cyan(`\n🏨 Total Hotel: ${priceStats.total}`));
            console.log(chalk.green(`✅ Dengan Harga: ${priceStats.withPrice}`));
            console.log(chalk.red(`❌ Tanpa Harga: ${priceStats.withoutPrice}`));
            console.log(chalk.blue(`📊 Persentase Lengkap: ${((priceStats.withPrice / priceStats.total) * 100).toFixed(1)}%`));

            if (priceStats.withPrice > 0) {
                const avgPrice = priceStats.totalPrice / priceStats.withPrice;
                console.log(chalk.cyan(`\n💰 ANALISIS HARGA:`));
                console.log(chalk.cyan(`   💸 Harga Tertinggi: Rp ${priceStats.maxPrice.toLocaleString('id-ID')}`));
                console.log(chalk.cyan(`   🏆 Harga Terendah: Rp ${priceStats.minPrice.toLocaleString('id-ID')}`));
                console.log(chalk.cyan(`   📊 Rata-rata Harga: Rp ${avgPrice.toLocaleString('id-ID')}`));
            }

            console.log(chalk.cyan(`\n🌆 DISTRIBUSI PER KOTA:`));
            Object.keys(hotelsByCity).forEach(city => {
                const percentage = ((hotelsByCity[city] / priceStats.total) * 100).toFixed(1);
                console.log(chalk.white(`   ${city}: ${hotelsByCity[city]} hotel (${percentage}%)`));
            });

        } catch (error) {
            console.log(chalk.red(`❌ Error saat mengambil statistik: ${error.message}`));
        }

        await this.continueToMenu();
    }

    async bulkInsertHotels() {
        console.log(chalk.blue('\n🚀 BULK INSERT HOTEL'));
        console.log(chalk.blue('===================='));

        console.log(chalk.cyan('💡 Format: nama_hotel (satu baris = satu hotel)'));
        console.log(chalk.cyan('   Contoh:'));
        console.log(chalk.cyan('   Hotel Indonesia Kempinski Jakarta'));
        console.log(chalk.cyan('   Grand Hyatt Jakarta'));
        console.log(chalk.cyan('   Hotel Borobudur Jakarta'));
        console.log(chalk.cyan('   Ketik "DONE" untuk selesai'));

        const hotels = [];
        let lineNumber = 1;

        while (true) {
            const input = await this.question(`\n${lineNumber}. `);

            if (input.toLowerCase() === 'done') {
                break;
            }

            if (input.trim()) {
                hotels.push({
                    name: input.trim()
                });
                lineNumber++;
            }
        }

        if (hotels.length === 0) {
            console.log(chalk.yellow('⚠️  Tidak ada hotel yang akan ditambahkan'));
            await this.continueToMenu();
            return;
        }

        console.log(chalk.blue(`\n📝 Akan menambahkan ${hotels.length} hotel:`));
        hotels.forEach((hotel, index) => {
            console.log(chalk.white(`${index + 1}. ${hotel.name}`));
        });

        const confirm = await this.question('\n⚠️  Lanjutkan? (y/N): ');
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log(chalk.blue('❌ Bulk insert dibatalkan'));
            await this.continueToMenu();
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const hotel of hotels) {
            try {
                const searchKey = hotel.name;
                const defaultPrice = 0;

                // Insert ke hotel_scraping_results
                const insertQuery = `
                    INSERT INTO hotel_scraping_results 
                    (search_key, hotel_name, room_price, status, error_message)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                `;

                const values = [searchKey, hotel.name, defaultPrice, 'pending', 'Hotel ditambahkan manual via bulk insert'];
                const result = await this.db.pool.query(insertQuery, values);
                const scrapingId = result.rows[0].id;

                // Insert ke hotel_data
                const insertHotelDataQuery = `
                    INSERT INTO hotel_data 
                    (hotel_id, hotel_name, rate_harga)
                    VALUES ($1, $2, $3)
                    RETURNING hotel_id
                `;

                const hotelDataValues = [scrapingId, hotel.name, defaultPrice];
                await this.db.pool.query(insertHotelDataQuery, hotelDataValues);

                successCount++;
                console.log(chalk.green(`✅ ${hotel.name}`));

            } catch (error) {
                errorCount++;
                console.log(chalk.red(`❌ ${hotel.name}: ${error.message}`));
            }
        }

        console.log(chalk.blue('\n📊 HASIL BULK INSERT:'));
        console.log(chalk.green(`✅ Berhasil: ${successCount}`));
        console.log(chalk.red(`❌ Gagal: ${errorCount}`));

        await this.continueToMenu();
    }

    extractCityFromSearchKey(searchKey) {
        const cityPatterns = [
            'Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Malang', 'Batu', 'Bali',
            'Medan', 'Palembang', 'Semarang', 'Solo', 'Magelang', 'Salatiga'
        ];

        for (const city of cityPatterns) {
            if (searchKey.includes(city)) {
                return city;
            }
        }

        return 'Unknown';
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async continueToMenu() {
        await this.question('\n⏳ Tekan Enter untuk kembali ke menu...');
        await this.showMenu();
    }
}

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    const hotelCRUD = new HotelCRUD();
    hotelCRUD.start().catch(error => {
        console.error(chalk.red('❌ Error fatal:'), error);
        process.exit(1);
    });
}

module.exports = HotelCRUD;
