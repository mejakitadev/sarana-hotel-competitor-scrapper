const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hotel API Service',
            version: '1.0.0',
            description: 'API service untuk mengakses data hotel dari Traveloka scraper bot',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server'
            }
        ],
        components: {
            schemas: {
                Hotel: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Hotel ID'
                        },
                        name: {
                            type: 'string',
                            description: 'Nama hotel'
                        },
                        location: {
                            type: 'string',
                            description: 'Lokasi hotel'
                        },
                        price: {
                            type: 'integer',
                            description: 'Harga hotel'
                        },
                        last_updated: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Waktu terakhir update'
                        }
                    }
                },
                HotelData: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Nama hotel'
                        },
                        price: {
                            type: 'integer',
                            description: 'Harga hotel'
                        }
                    }
                },
                HotelFull: {
                    type: 'object',
                    properties: {
                        hotel_id: {
                            type: 'integer',
                            description: 'Hotel ID'
                        },
                        hotel_name: {
                            type: 'string',
                            description: 'Nama hotel'
                        },
                        rate_harga: {
                            type: 'integer',
                            description: 'Harga hotel'
                        },
                        location: {
                            type: 'string',
                            description: 'Lokasi hotel'
                        },
                        description: {
                            type: 'string',
                            description: 'Deskripsi hotel'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Waktu dibuat'
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Waktu terakhir update'
                        }
                    }
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Status response'
                        },
                        count: {
                            type: 'integer',
                            description: 'Jumlah data yang dikembalikan'
                        },
                        data: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/Hotel'
                            }
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            description: 'Pesan error'
                        }
                    }
                },
                InstagramAccount: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Account ID'
                        },
                        username: {
                            type: 'string',
                            description: 'Username Instagram'
                        },
                        account_url: {
                            type: 'string',
                            description: 'URL akun Instagram'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Waktu akun dibuat'
                        },
                        total_posts: {
                            type: 'integer',
                            description: 'Total postingan yang di-scrape'
                        },
                        latest_post_date: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Tanggal postingan terbaru'
                        }
                    }
                },
                InstagramPost: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Post ID'
                        },
                        post_url: {
                            type: 'string',
                            description: 'URL postingan Instagram'
                        },
                        caption: {
                            type: 'string',
                            description: 'Caption postingan'
                        },
                        post_date: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Tanggal postingan'
                        },
                        type: {
                            type: 'string',
                            enum: ['post', 'reel'],
                            description: 'Jenis postingan'
                        }
                    }
                },
                InstagramAccountWithPosts: {
                    type: 'object',
                    properties: {
                        account_id: {
                            type: 'integer',
                            description: 'Account ID'
                        },
                        username: {
                            type: 'string',
                            description: 'Username Instagram'
                        },
                        account_url: {
                            type: 'string',
                            description: 'URL akun Instagram'
                        },
                        posts: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/InstagramPost'
                            },
                            description: 'Daftar postingan terbaru'
                        }
                    }
                },
                InstagramStats: {
                    type: 'object',
                    properties: {
                        total_accounts: {
                            type: 'integer',
                            description: 'Total akun Instagram yang di-scrape'
                        },
                        total_posts: {
                            type: 'integer',
                            description: 'Total postingan yang di-scrape'
                        },
                        posts_today: {
                            type: 'integer',
                            description: 'Postingan yang di-scrape hari ini'
                        },
                        posts_this_week: {
                            type: 'integer',
                            description: 'Postingan yang di-scrape minggu ini'
                        },
                        latest_post_date: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Tanggal postingan terbaru'
                        },
                        earliest_post_date: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Tanggal postingan terlama'
                        }
                    }
                }
            }
        }
    },
    apis: ['./src/routes/*.js'] // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs;
