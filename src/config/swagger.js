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
                }
            }
        }
    },
    apis: ['./src/routes/*.js'] // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs;
