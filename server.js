const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./src/config/swagger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
    origin: true, // Allow all origins for development
    credentials: true // Allow cookies
}));
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Hotel API Documentation'
}));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/protected', require('./src/routes/protected'));
app.use('/api/hotels', require('./src/routes/hotels'));
app.use('/api/scraping', require('./src/routes/scraping'));
app.use('/api/hotel-data', require('./src/routes/hotel-data'));
app.use('/api/hotel-crud', require('./src/routes/hotel-crud'));
app.use('/api/hotel-hourly-data', require('./src/routes/hotel-hourly-data'));
app.use('/api/user-review-analytics', require('./src/routes/user-review-analytics'));
app.use('/api/instagram-data', require('./src/routes/instagram-data'));

// Health check endpoint (enhanced)
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'Hotel API Service',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            protected: '/api/protected',
            hotels: '/api/hotels',
            scraping: '/api/scraping',
            hotelData: '/api/hotel-data',
            hotelCrud: '/api/hotel-crud',
            hotelHourlyData: '/api/hotel-hourly-data',
            userReviewAnalytics: '/api/user-review-analytics',
            instagramData: '/api/instagram-data',
            swagger: '/api-docs'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Hotel API Service running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`🛡️ Protected API: http://localhost:${PORT}/api/protected`);
    console.log(`🏨 Hotels API: http://localhost:${PORT}/api/hotels`);
    console.log(`📈 Scraping API: http://localhost:${PORT}/api/scraping`);
    console.log(`📊 Hotel Data API: http://localhost:${PORT}/api/hotel-data`);
    console.log(`🔧 Hotel CRUD API: http://localhost:${PORT}/api/hotel-crud`);
    console.log(`⏰ Hotel Hourly Data API: http://localhost:${PORT}/api/hotel-hourly-data`);
    console.log(`📱 Instagram Data API: http://localhost:${PORT}/api/instagram-data`);
});
