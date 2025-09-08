// Daftar hotel yang akan di-scrape secara berkala
const hotelList = [
    {
        name: "Hotel Indonesia Kempinski Jakarta",
        city: "Jakarta",
        searchQuery: "Hotel Indonesia Kempinski Jakarta",
        priority: "high"
    },
    {
        name: "Hotel Borobudur Jakarta",
        city: "Jakarta",
        searchQuery: "Hotel Borobudur Jakarta",
        priority: "high"
    },
    {
        name: "Hotel Grand Hyatt Jakarta",
        city: "Jakarta",
        searchQuery: "Grand Hyatt Jakarta",
        priority: "medium"
    },
    {
        name: "Hotel Bandung",
        city: "Bandung",
        searchQuery: "Hotel Bandung",
        priority: "medium"
    },
    {
        name: "Hotel Santika Premiere Bandung",
        city: "Bandung",
        searchQuery: "Santika Premiere Bandung",
        priority: "medium"
    },
    {
        name: "Hotel JW Marriott Surabaya",
        city: "Surabaya",
        searchQuery: "JW Marriott Surabaya",
        priority: "medium"
    },
    {
        name: "Hotel Sheraton Surabaya",
        city: "Surabaya",
        searchQuery: "Sheraton Surabaya",
        priority: "medium"
    },
    {
        name: "Hotel Hyatt Regency Yogyakarta",
        city: "Yogyakarta",
        searchQuery: "Hyatt Regency Yogyakarta",
        priority: "medium"
    },
    {
        name: "Hotel Melia Purosani Yogyakarta",
        city: "Yogyakarta",
        searchQuery: "Melia Purosani Yogyakarta",
        priority: "medium"
    }
];

// Konfigurasi scraping
const scrapingConfig = {
    // Interval scraping (dalam jam)
    intervalHours: 1,

    // Waktu mulai dan selesai scraping (24 jam format)
    startTime: "00:00",
    endTime: "23:59",

    // Jeda antar hotel (dalam detik)
    delayBetweenHotels: 30,

    // Jeda antar kota (dalam detik)
    delayBetweenCities: 60,

    // Maksimal retry jika gagal
    maxRetries: 3,

    // Timeout untuk setiap request (dalam detik)
    requestTimeout: 120,

    // Apakah menjalankan scraping di hari libur
    runOnWeekends: true,

    // Apakah menjalankan scraping di hari kerja
    runOnWeekdays: true
};

// Fungsi untuk mendapatkan daftar hotel berdasarkan prioritas
function getHotelsByPriority(priority = null) {
    if (priority) {
        return hotelList.filter(hotel => hotel.priority === priority);
    }
    return hotelList;
}

// Fungsi untuk mendapatkan daftar hotel berdasarkan kota
function getHotelsByCity(city) {
    return hotelList.filter(hotel => hotel.city === city);
}

// Fungsi untuk mendapatkan daftar kota unik
function getUniqueCities() {
    return [...new Set(hotelList.map(hotel => hotel.city))];
}

// Fungsi untuk mendapatkan daftar hotel yang aktif untuk scraping
function getActiveHotels() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    // Cek apakah waktu saat ini dalam range yang diizinkan
    if (currentTime < scrapingConfig.startTime || currentTime > scrapingConfig.endTime) {
        return [];
    }

    // Cek apakah hari ini diizinkan untuk scraping
    const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, dst
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend && !scrapingConfig.runOnWeekends) {
        return [];
    }

    if (!isWeekend && !scrapingConfig.runOnWeekdays) {
        return [];
    }

    return hotelList;
}

module.exports = {
    hotelList,
    scrapingConfig,
    getHotelsByPriority,
    getHotelsByCity,
    getUniqueCities,
    getActiveHotels
};
