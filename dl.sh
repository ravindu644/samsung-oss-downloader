#!/bin/bash

# Usage: ./dl.sh [BASE64_DATA] [FILENAME]
# Or:    ./dl.sh "COOKIE_STRING" "POST_DATA_STRING" [FILENAME]

# Function to parse JSON headers and output as header file for curl
build_headers_from_json() {
    local json_str="$1"
    local header_file="$2"
    
    # Check if jq is available
    if command -v jq >/dev/null 2>&1; then
        # Use jq to parse JSON and write headers
        echo "$json_str" | jq -r 'to_entries[] | "\(.key): \(.value)"' > "$header_file"
    elif command -v python3 >/dev/null 2>&1; then
        # Use Python to parse JSON
        echo "$json_str" | python3 <<'PYEOF' > "$header_file"
import json
import sys
try:
    json_str = sys.stdin.read()
    headers = json.loads(json_str)
    for key, value in headers.items():
        print(f"{key}: {value}")
except Exception as e:
    sys.stderr.write(f"Error parsing headers: {e}\n")
    sys.exit(1)
PYEOF
    else
        echo "Error: jq or python3 required to parse headers JSON" >&2
        return 1
    fi
}

# Check if first argument is base64 encoded
HEADERS_JSON=""
if [ $# -eq 1 ] || [ $# -eq 2 ]; then
    # Try to decode as base64
    DECODED=$(echo "$1" | base64 -d 2>/dev/null)
    if [ $? -eq 0 ] && echo "$DECODED" | grep -q "^COOKIE:" && echo "$DECODED" | grep -q "^PAYLOAD:"; then
        # Successfully decoded base64 format
        # Extract cookie (everything after "COOKIE: " until newline)
        COOKIE=$(echo "$DECODED" | awk '/^COOKIE:/ {sub(/^COOKIE: /, ""); print; exit}')
        # Extract payload (everything after "PAYLOAD: " until HEADERS line or end)
        PAYLOAD=$(echo "$DECODED" | awk '/^PAYLOAD:/ {found=1; sub(/^PAYLOAD: /, ""); print; next} found && /^HEADERS:/ {exit} found')
        # Extract headers JSON if present (everything after "HEADERS: " to end)
        if echo "$DECODED" | grep -q "^HEADERS:"; then
            HEADERS_JSON=$(echo "$DECODED" | awk '/^HEADERS:/ {found=1; sub(/^HEADERS: /, ""); print; next} found')
        fi
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
if [ -n "$HEADERS_JSON" ]; then
    echo "Headers: Loaded ($(echo "$HEADERS_JSON" | wc -c) bytes)"
else
    echo "Headers: Using defaults"
fi
echo "Saving:  $FILENAME"
echo "--------------------------------------"

# Build curl command with dynamic headers
CURL_CMD="curl --retry 10 --retry-delay 5 -X POST \"https://opensource.samsung.com/downSrcCode\""

if [ -n "$HEADERS_JSON" ]; then
    # Parse headers from JSON and add them to curl command
    HEADER_TMP=$(mktemp)
    trap "rm -f $HEADER_TMP" EXIT
    
    if build_headers_from_json "$HEADERS_JSON" "$HEADER_TMP"; then
        # Add headers from file
        while IFS= read -r header_line; do
            if [ -n "$header_line" ]; then
                CURL_CMD="$CURL_CMD -H \"$header_line\""
            fi
        done < "$HEADER_TMP"
        rm -f "$HEADER_TMP"
        
        # Add important headers that might be missing (Chrome restrictions)
        # Check if Accept-Encoding is missing
        if ! echo "$HEADERS_JSON" | grep -qi '"accept-encoding"'; then
            CURL_CMD="$CURL_CMD -H \"Accept-Encoding: gzip, deflate, br, zstd\""
        fi
        # Check if Accept-Language is missing
        if ! echo "$HEADERS_JSON" | grep -qi '"accept-language"'; then
            CURL_CMD="$CURL_CMD -H \"Accept-Language: en-US,en;q=0.6\""
        fi
        # Check if Origin is missing
        if ! echo "$HEADERS_JSON" | grep -qi '"origin"'; then
            CURL_CMD="$CURL_CMD -H \"Origin: https://opensource.samsung.com\""
        fi
        # Check if Referer is missing
        if ! echo "$HEADERS_JSON" | grep -qi '"referer"'; then
            CURL_CMD="$CURL_CMD -H \"Referer: https://opensource.samsung.com/\""
        fi
        # Check if Cache-Control is missing
        if ! echo "$HEADERS_JSON" | grep -qi '"cache-control"'; then
            CURL_CMD="$CURL_CMD -H \"Cache-Control: max-age=0\""
        fi
    else
        echo "Warning: Failed to parse headers, using defaults" >&2
        HEADERS_JSON=""  # Fall back to defaults
    fi
fi

# Add default headers if no headers were provided
if [ -z "$HEADERS_JSON" ]; then
    CURL_CMD="$CURL_CMD -H \"User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36\""
    CURL_CMD="$CURL_CMD -H \"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8\""
    CURL_CMD="$CURL_CMD -H \"Accept-Encoding: gzip, deflate, br, zstd\""
    CURL_CMD="$CURL_CMD -H \"Accept-Language: en-US,en;q=0.6\""
    CURL_CMD="$CURL_CMD -H \"Content-Type: application/x-www-form-urlencoded\""
    CURL_CMD="$CURL_CMD -H \"Origin: https://opensource.samsung.com\""
    CURL_CMD="$CURL_CMD -H \"Referer: https://opensource.samsung.com/\""
    CURL_CMD="$CURL_CMD -H \"Cache-Control: max-age=0\""
    CURL_CMD="$CURL_CMD -H \"sec-ch-ua: \\\"Brave\\\";v=\\\"141\\\", \\\"Not?A_Brand\\\";v=\\\"8\\\", \\\"Chromium\\\";v=\\\"141\\\"\""
    CURL_CMD="$CURL_CMD -H \"sec-ch-ua-mobile: ?1\""
    CURL_CMD="$CURL_CMD -H \"sec-ch-ua-platform: \\\"Android\\\"\""
    CURL_CMD="$CURL_CMD -H \"sec-fetch-dest: document\""
    CURL_CMD="$CURL_CMD -H \"sec-fetch-mode: navigate\""
    CURL_CMD="$CURL_CMD -H \"sec-fetch-site: same-origin\""
    CURL_CMD="$CURL_CMD -H \"sec-fetch-user: ?1\""
    CURL_CMD="$CURL_CMD -H \"sec-gpc: 1\""
    CURL_CMD="$CURL_CMD -H \"upgrade-insecure-requests: 1\""
    CURL_CMD="$CURL_CMD -H \"priority: u=0, i\""
fi

# Add cookie and final options
CURL_CMD="$CURL_CMD -H \"Cookie: $COOKIE\""
CURL_CMD="$CURL_CMD --compressed"
CURL_CMD="$CURL_CMD --data-raw \"$PAYLOAD\""
CURL_CMD="$CURL_CMD --output \"$FILENAME\""

# Run curl download with dynamic headers
echo "Starting download..."
echo ""
eval $CURL_CMD

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
