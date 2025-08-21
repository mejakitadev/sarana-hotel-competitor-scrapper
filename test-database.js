const DatabaseManager = require('./database');
const chalk = require('chalk');

// Load environment variables
require('dotenv').config();

async function testDatabase() {
    console.log(chalk.blue('🧪 TESTING DATABASE CONNECTION'));
    console.log(chalk.blue('='.repeat(50)));

    const db = new DatabaseManager();

    try {
        // Test koneksi
        console.log(chalk.yellow('🔌 Testing database connection...'));
        const connected = await db.connect();

        if (!connected) {
            console.log(chalk.red('❌ Database connection failed!'));
            return;
        }

        console.log(chalk.green('✅ Database connection successful!'));

        // Test insert data
        console.log(chalk.yellow('\n📝 Testing data insertion...'));
        const testData = [
            {
                searchKey: 'Test Hotel 1',
                hotelName: 'Test Hotel Jakarta',
                roomPrice: 500000,
                screenshotPath: 'test-screenshot-1.png',
                status: 'success'
            },
            {
                searchKey: 'Test Hotel 2',
                hotelName: 'Test Hotel Bandung',
                roomPrice: 350000,
                screenshotPath: 'test-screenshot-2.png',
                status: 'success'
            },
            {
                searchKey: 'Test Hotel 3',
                hotelName: 'Test Hotel Surabaya',
                roomPrice: null,
                screenshotPath: null,
                status: 'failed',
                errorMessage: 'Hotel tidak ditemukan'
            }
        ];

        for (const data of testData) {
            const id = await db.saveScrapingResult(
                data.searchKey,
                data.hotelName,
                data.roomPrice,
                data.screenshotPath,
                data.status,
                data.errorMessage
            );

            if (id) {
                console.log(chalk.green(`✅ Inserted record with ID: ${id}`));
            } else {
                console.log(chalk.red(`❌ Failed to insert record for: ${data.searchKey}`));
            }
        }

        // Test query data
        console.log(chalk.yellow('\n🔍 Testing data retrieval...'));

        const history = await db.getScrapingHistory(10);
        console.log(chalk.blue(`📊 Retrieved ${history.length} records from history`));

        if (history.length > 0) {
            console.log(chalk.green('📋 Sample records:'));
            history.slice(0, 3).forEach((record, index) => {
                console.log(chalk.white(`   ${index + 1}. ${record.hotel_name} - ${record.room_price || 'N/A'}`));
            });
        }

        // Test stats
        console.log(chalk.yellow('\n📈 Testing statistics...'));
        const stats = await db.getSearchStats();

        if (stats) {
            console.log(chalk.green('📊 Statistics:'));
            console.log(chalk.white(`   Total searches: ${stats.total_searches}`));
            console.log(chalk.white(`   Successful: ${stats.successful_searches}`));
            console.log(chalk.white(`   Failed: ${stats.failed_searches}`));
            if (stats.average_price) {
                console.log(chalk.white(`   Average price: Rp ${stats.average_price.toLocaleString('id-ID')}`));
            }
        }

        // Test hotel price history
        console.log(chalk.yellow('\n🏨 Testing hotel price history...'));
        const priceHistory = await db.getHotelPriceHistory('Test Hotel Jakarta', 7);
        console.log(chalk.blue(`📊 Found ${priceHistory.length} price records for Test Hotel Jakarta`));

        // Test new tables
        console.log(chalk.yellow('\n🏙️ Testing new tables...'));

        // Test hotel_data table
        const hotelData = await db.pool.query('SELECT COUNT(*) as count FROM hotel_data');
        console.log(chalk.blue(`📊 Hotel data table: ${hotelData.rows[0].count} records`));

        console.log(chalk.green('\n🎉 All database tests completed successfully!'));

    } catch (error) {
        console.log(chalk.red(`❌ Database test failed: ${error.message}`));
        console.log(chalk.red(`Stack trace: ${error.stack}`));
    } finally {
        // Cleanup
        await db.close();
        console.log(chalk.blue('\n🔌 Database connection closed'));
    }
}

// Jalankan test jika file ini dijalankan langsung
if (require.main === module) {
    testDatabase().then(() => {
        console.log(chalk.blue('\n👋 Test completed!'));
        process.exit(0);
    }).catch((error) => {
        console.log(chalk.red(`\n💥 Test failed with error: ${error.message}`));
        process.exit(1);
    });
}

module.exports = testDatabase;
