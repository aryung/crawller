#!/bin/bash

LOG_FILE="/Users/aryung/Downloads/Workshop/crawler/output/yahoo-us-sectors/scraping-log.txt"

while true; do
    clear
    echo "📊 Yahoo US Stock Scraping Monitor"
    echo "=================================="
    echo ""
    
    # Check if process is running
    if ps aux | grep -q "[n]ode.*scrape-yahoo-us-simple.js"; then
        echo "✅ Scraper Status: RUNNING"
    else
        echo "❌ Scraper Status: STOPPED"
    fi
    
    echo ""
    
    # Get latest progress
    if [ -f "$LOG_FILE" ]; then
        # Extract progress
        LAST_PAGE=$(grep "Processing..." "$LOG_FILE" | tail -1 | sed 's/.*\[\([0-9]*\)\/\([0-9]*\)\].*/\1/')
        TOTAL_PAGES=$(grep "Processing..." "$LOG_FILE" | tail -1 | sed 's/.*\[\([0-9]*\)\/\([0-9]*\)\].*/\2/')
        
        if [ ! -z "$LAST_PAGE" ] && [ ! -z "$TOTAL_PAGES" ]; then
            PROGRESS=$((LAST_PAGE * 100 / TOTAL_PAGES))
            echo "📈 Progress: Page $LAST_PAGE / $TOTAL_PAGES ($PROGRESS%)"
            
            # Progress bar
            BAR_LENGTH=50
            FILLED=$((PROGRESS * BAR_LENGTH / 100))
            EMPTY=$((BAR_LENGTH - FILLED))
            
            echo -n "["
            for i in $(seq 1 $FILLED); do echo -n "█"; done
            for i in $(seq 1 $EMPTY); do echo -n "░"; done
            echo "]"
        fi
        
        echo ""
        echo "📝 Latest Activity:"
        echo "------------------"
        tail -10 "$LOG_FILE" | grep -E "(✅|📄|❌)"
        
        # Check if complete
        if grep -q "Scraping Complete!" "$LOG_FILE"; then
            echo ""
            echo "🎉 SCRAPING COMPLETE!"
            echo ""
            grep "Total records:" "$LOG_FILE" | tail -1
            grep "Unique stocks:" "$LOG_FILE" | tail -1
            grep "Output saved to:" "$LOG_FILE" | tail -1
            break
        fi
    else
        echo "⚠️ Log file not found"
    fi
    
    echo ""
    echo "Press Ctrl+C to exit monitor"
    sleep 5
done