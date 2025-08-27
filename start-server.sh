#!/bin/bash

if [ "$WORKER_TYPE" = "hotel_scrapper" ]; then
    echo "Running in consumer-only mode..."
    node src/scripts/hourly-scheduler.js
elif [ "$WORKER_TYPE" = "user_review_scrapper" ]; then
    echo "Running in user review scrapper mode..."
    node src/scripts/user-review-hourly-scheduler.js
elif [ "$WORKER_TYPE" = "server_api" ]; then
    echo "Running in server api mode..."
    node server.js
else
    echo "Running nothing. Only eternity."
fi
