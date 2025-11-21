#!/bin/bash

# Usage: ./dl.sh [BASE64_DATA] [FILENAME]
# Or:    ./dl.sh "COOKIE_STRING" "POST_DATA_STRING" [FILENAME]

# Check if first argument is base64 encoded
if [ $# -eq 1 ] || [ $# -eq 2 ]; then
    # Try to decode as base64
    DECODED=$(echo "$1" | base64 -d 2>/dev/null)
    if [ $? -eq 0 ] && echo "$DECODED" | grep -q "^COOKIE:" && echo "$DECODED" | grep -q "^PAYLOAD:"; then
        # Successfully decoded base64 format
        # Extract cookie (everything after "COOKIE: " until newline)
        COOKIE=$(echo "$DECODED" | grep "^COOKIE:" | sed 's/^COOKIE: //')
        # Extract payload (everything after "PAYLOAD: " to end)
        PAYLOAD=$(echo "$DECODED" | grep "^PAYLOAD:" | sed 's/^PAYLOAD: //')
        FILENAME=${2:-"toolchain.tar.gz"}
    else
        # Not base64 or invalid format, treat as legacy format
        if [ $# -ge 2 ]; then
            # Legacy format: cookie and payload as separate arguments
            COOKIE=$1
            PAYLOAD=$2
            FILENAME=${3:-"toolchain.tar.gz"}
        else
            echo "Error: Invalid base64 data or missing arguments."
            echo "Usage: ./dl.sh [BASE64_DATA] [FILENAME]"
            echo "   Or: ./dl.sh \"COOKIE_STRING\" \"POST_DATA_STRING\" [FILENAME]"
            exit 1
        fi
    fi
elif [ $# -ge 2 ]; then
    # Legacy format: cookie and payload as separate arguments
    COOKIE=$1
    PAYLOAD=$2
    FILENAME=${3:-"toolchain.tar.gz"}
else
    echo "Error: Missing arguments."
    echo "Usage: ./dl.sh [BASE64_DATA] [FILENAME]"
    echo "   Or: ./dl.sh \"COOKIE_STRING\" \"POST_DATA_STRING\" [FILENAME]"
    exit 1
fi

if [ -z "$COOKIE" ] || [ -z "$PAYLOAD" ]; then
    echo "Error: Missing cookie or payload data."
    echo "Usage: ./dl.sh [BASE64_DATA] [FILENAME]"
    echo "   Or: ./dl.sh \"COOKIE_STRING\" \"POST_DATA_STRING\" [FILENAME]"
    exit 1
fi

echo "--------------------------------------"
echo " Samsung Automated Downloader"
echo "--------------------------------------"
echo "Cookie:  Loaded"
echo "Payload: Loaded"
echo "Saving:  $FILENAME"
echo "--------------------------------------"

# Run curl download
echo "Starting download..."
echo ""
curl --retry 10 --retry-delay 5 \
     -X POST "https://opensource.samsung.com/downSrcCode" \
     -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Origin: https://opensource.samsung.com" \
     -H "Referer: https://opensource.samsung.com/" \
     -H "Cookie: $COOKIE" \
     --data-raw "$PAYLOAD" \
     --output "$FILENAME"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Download completed successfully!"
    ls -lh "$FILENAME"
else
    echo ""
    echo "❌ Download failed with exit code: $EXIT_CODE"
    echo "Possible issues:"
    echo "  - Cookie or token expired (try capturing again)"
    echo "  - Network timeout (try again)"
    echo "  - Server blocking request"
    exit $EXIT_CODE
fi
