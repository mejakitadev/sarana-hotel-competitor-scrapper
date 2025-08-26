#!/bin/bash

if [ "$IS_CONSUMER_SERVER" = "True" ]; then
    echo "Running in consumer-only mode..."
    # Run consumer in foreground
    node hourly-scheduler.js
else
    echo "Running server only..."
    node server.js
fi
