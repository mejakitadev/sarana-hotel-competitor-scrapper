const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readlineSync = require('readline-sync');
const DatabaseManager = require('../utils/database');

class InstagramAccountManager {
    constructor() {
        this.db = new DatabaseManager();
        this.accountsList = [];
    }

    log(message, type = 'info') {
        const colors = {
            info: chalk.blue,
            success: chalk.green,
            error: chalk.red,
            warning: chalk.yellow,
            debug: chalk.gray
        };
        const color = colors[type] || chalk.white;
        console.log(color(message));
    }

    async loadAccounts() {
        try {
            await this.db.connect();
            this.accountsList = await this.db.getAllSocmedAccounts();
            this.log(`📋 Loaded ${this.accountsList.length} social media accounts from database`, 'success');
        } catch (error) {
            this.log(`❌ Error loading accounts from database: ${error.message}`, 'error');
            this.accountsList = [];
        }
    }

    async saveAccounts() {
        // No need to save to file anymore, data is in database
        this.log('💾 Accounts are automatically saved to database', 'success');
    }

    displayAccounts() {
        console.log(chalk.blue('\n📋 INSTAGRAM ACCOUNTS LIST'));
        console.log(chalk.blue('='.repeat(60)));

        if (this.accountsList.length === 0) {
            this.log('📝 No accounts found. Add some accounts first!', 'warning');
            return;
        }

        this.accountsList.forEach((account, index) => {
            console.log(chalk.white(`${index + 1}. ${chalk.cyan(account.username)}`));
            console.log(chalk.gray(`   URL: ${account.account_url}`));
            console.log(chalk.gray(`   Created: ${new Date(account.created_at).toLocaleDateString('id-ID')}`));
            console.log('');
        });
    }

    async addAccount() {
        console.log(chalk.blue('\n➕ ADD NEW INSTAGRAM ACCOUNT'));
        console.log(chalk.blue('='.repeat(40)));

        const accountUrl = readlineSync.question('🔗 Enter Instagram account URL (e.g., https://www.instagram.com/username/): ');
        if (!accountUrl) {
            this.log('❌ Account URL cannot be empty!', 'error');
            return;
        }

        // Validate and extract username from URL
        let username = '';
        try {
            // Extract username from Instagram URL
            const urlMatch = accountUrl.match(/instagram\.com\/([^\/\?]+)/);
            if (!urlMatch) {
                this.log('❌ Invalid Instagram URL format! Please use: https://www.instagram.com/username/', 'error');
                return;
            }

            username = urlMatch[1];

            // Validate URL format
            if (!accountUrl.includes('instagram.com/') || !accountUrl.startsWith('http')) {
                this.log('❌ Please enter a valid Instagram URL starting with https://', 'error');
                return;
            }

            // Ensure URL ends with /
            const finalUrl = accountUrl.endsWith('/') ? accountUrl : accountUrl + '/';

            this.log(`📝 Extracted username: ${username}`, 'info');
            this.log(`🔗 Final URL: ${finalUrl}`, 'info');

        } catch (error) {
            this.log(`❌ Error parsing URL: ${error.message}`, 'error');
            return;
        }

        try {
            await this.db.addSocmedAccount(accountUrl, username);
            this.log(`✅ Account ${username} added successfully!`, 'success');
            this.log(`🔗 URL: ${accountUrl}`, 'info');

            // Reload accounts list
            await this.loadAccounts();
        } catch (error) {
            this.log(`❌ Error adding account ${username}: ${error.message}`, 'error');
        }
    }

    async editAccount() {
        if (this.accountsList.length === 0) {
            this.log('📝 No accounts to edit. Add some accounts first!', 'warning');
            return;
        }

        console.log(chalk.blue('\n✏️ EDIT INSTAGRAM ACCOUNT'));
        console.log(chalk.blue('='.repeat(35)));

        this.displayAccounts();

        const accountIndex = readlineSync.questionInt('🔢 Enter account number to edit: ') - 1;

        if (accountIndex < 0 || accountIndex >= this.accountsList.length) {
            this.log('❌ Invalid account number!', 'error');
            return;
        }

        const account = this.accountsList[accountIndex];
        console.log(chalk.blue(`\n📝 Editing account: ${account.username}`));

        const newAccountUrl = readlineSync.question(`🔗 Enter new Instagram URL (current: ${account.account_url}): `) || account.account_url;

        // Extract username from new URL
        let newUsername = account.username; // Default to current username
        if (newAccountUrl !== account.account_url) {
            try {
                const urlMatch = newAccountUrl.match(/instagram\.com\/([^\/\?]+)/);
                if (urlMatch) {
                    newUsername = urlMatch[1];
                    this.log(`📝 New username extracted: ${newUsername}`, 'info');
                }
            } catch (error) {
                this.log(`⚠️ Could not extract username from new URL, keeping current: ${account.username}`, 'warning');
            }
        }

        try {
            await this.db.updateSocmedAccount(account.id, newAccountUrl, newUsername);
            this.log(`✅ Account ${newUsername} updated successfully!`, 'success');

            // Reload accounts list
            await this.loadAccounts();
        } catch (error) {
            this.log(`❌ Error updating account: ${error.message}`, 'error');
        }
    }

    async deleteAccount() {
        if (this.accountsList.length === 0) {
            this.log('📝 No accounts to delete. Add some accounts first!', 'warning');
            return;
        }

        console.log(chalk.blue('\n🗑️ DELETE INSTAGRAM ACCOUNT'));
        console.log(chalk.blue('='.repeat(35)));

        this.displayAccounts();

        const accountIndex = readlineSync.questionInt('🔢 Enter account number to delete: ') - 1;

        if (accountIndex < 0 || accountIndex >= this.accountsList.length) {
            this.log('❌ Invalid account number!', 'error');
            return;
        }

        const account = this.accountsList[accountIndex];
        const confirm = readlineSync.keyInYNStrict(`⚠️ Are you sure you want to delete ${account.username}? (Y/n): `);

        if (confirm) {
            try {
                await this.db.deleteSocmedAccount(account.id);
                this.log(`✅ Account ${account.username} deleted successfully!`, 'success');

                // Reload accounts list
                await this.loadAccounts();
            } catch (error) {
                this.log(`❌ Error deleting account: ${error.message}`, 'error');
            }
        } else {
            this.log('❌ Account deletion cancelled.', 'warning');
        }
    }


    showMenu() {
        console.log(chalk.blue('\n🤖 SOCIAL MEDIA ACCOUNT MANAGER'));
        console.log(chalk.blue('='.repeat(50)));
        console.log(chalk.blue('💡 Manage social media accounts for scraping'));
        console.log(chalk.blue('='.repeat(50)));

        console.log(chalk.yellow('\n📋 Menu Options:'));
        console.log(chalk.white('1. View all accounts'));
        console.log(chalk.white('2. Add new account'));
        console.log(chalk.white('3. Edit account'));
        console.log(chalk.white('4. Delete account'));
        console.log(chalk.white('5. Show statistics'));
        console.log(chalk.white('6. Exit'));
    }

    async main() {
        await this.loadAccounts();

        while (true) {
            this.showMenu();
            const choice = readlineSync.questionInt('\n🎯 Choose an option (1-6): ');

            switch (choice) {
                case 1:
                    this.displayAccounts();
                    break;
                case 2:
                    await this.addAccount();
                    break;
                case 3:
                    await this.editAccount();
                    break;
                case 4:
                    await this.deleteAccount();
                    break;
                case 5:
                    // Show statistics
                    try {
                        const stats = await this.db.getSocmedScrapingStats();
                        console.log(chalk.blue('\n📊 SOCIAL MEDIA SCRAPING STATISTICS'));
                        console.log(chalk.blue('='.repeat(40)));
                        console.log(chalk.white(`Total Accounts: ${stats.total_accounts}`));
                        console.log(chalk.white(`Total Scraping Logs: ${stats.total_scraping_logs}`));
                        console.log(chalk.green(`Successful Scrapes: ${stats.successful_scrapes}`));
                        console.log(chalk.red(`Failed Scrapes: ${stats.failed_scrapes}`));
                        console.log(chalk.yellow(`In Progress: ${stats.in_progress_scrapes}`));
                        console.log(chalk.white(`Last Scraping: ${stats.last_scraping_time ? new Date(stats.last_scraping_time).toLocaleString('id-ID') : 'Never'}`));
                    } catch (error) {
                        this.log(`❌ Error getting statistics: ${error.message}`, 'error');
                    }
                    break;
                case 6:
                    this.log('👋 Goodbye!', 'success');
                    return;
                default:
                    this.log('❌ Invalid choice! Please choose 1-6.', 'error');
            }

            // Wait for user to press enter before showing menu again
            readlineSync.question('\n⏳ Press Enter to continue...');
        }
    }
}

// Main execution
if (require.main === module) {
    const manager = new InstagramAccountManager();
    manager.main().catch(console.error);
}

module.exports = InstagramAccountManager;
