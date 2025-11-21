// Headers to exclude (handled automatically by curl or not needed)
const EXCLUDED_HEADERS = [
    'content-length',
    'connection',
    'host',
    'cookie', // We capture cookies separately
    ':authority',
    ':method',
    ':path',
    ':scheme'
];

// Filter and normalize headers for curl
function filterHeaders(headers) {
    if (!headers) return {};
    
    const filtered = {};
    for (const header of headers) {
        const name = header.name.toLowerCase();
        // Skip excluded headers and Chrome internal headers
        if (!EXCLUDED_HEADERS.includes(name) && !name.startsWith(':')) {
            filtered[header.name] = header.value;
        }
    }
    return filtered;
}

// Listen to headers first (fires before onBeforeRequest)
// Note: In Manifest V3, onBeforeSendHeaders fires synchronously before onBeforeRequest
chrome.webRequest.onBeforeSendHeaders.addListener(
    async function(details) {
        if (details.method === "POST" && details.url.includes("downSrcCode")) {
            console.log("🔍 onBeforeSendHeaders fired for requestId:", details.requestId);
            console.log("🔍 URL:", details.url);
            console.log("🔍 Raw requestHeaders:", details.requestHeaders);
            console.log("🔍 Raw requestHeaders count:", details.requestHeaders ? details.requestHeaders.length : 0);
            
            if (!details.requestHeaders || details.requestHeaders.length === 0) {
                console.error("❌ requestHeaders is empty or undefined!");
                console.log("🔍 Full details object:", JSON.stringify(details, null, 2));
                return;
            }
            
            if (details.requestHeaders) {
                console.log("🔍 Sample headers:", details.requestHeaders.slice(0, 10).map(h => `${h.name}: ${h.value ? h.value.substring(0, 50) : '(empty)'}`));
            }
            
            const filteredHeaders = filterHeaders(details.requestHeaders);
            console.log("📋 Filtered headers count:", Object.keys(filteredHeaders).length);
            if (Object.keys(filteredHeaders).length > 0) {
                console.log("📋 Sample filtered headers:", Object.entries(filteredHeaders).slice(0, 5));
            } else {
                console.warn("⚠️ No headers after filtering!");
                console.warn("⚠️ Raw headers that were filtered:", details.requestHeaders.map(h => h.name));
            }
            
            // Store headers temporarily using requestId as key
            // Use storage.local since service workers can be terminated
            const storageKey = `req_headers_${details.requestId}`;
            try {
                await chrome.storage.local.set({
                    [storageKey]: {
                        headers: filteredHeaders,
                        timestamp: Date.now(),
                        requestId: details.requestId
                    }
                });
                console.log("💾 Stored headers with key:", storageKey);
                
                // Verify storage
                const verify = await chrome.storage.local.get(storageKey);
                console.log("✅ Storage verification:", verify[storageKey] ? "SUCCESS" : "FAILED");
                
                // Clean up after 30 seconds to prevent memory leak
                setTimeout(async () => {
                    await chrome.storage.local.remove(storageKey);
                }, 30000);
            } catch (error) {
                console.error("❌ Error storing headers:", error);
            }
        }
    },
    {
        urls: ["*://opensource.samsung.com/downSrcCode"]
    },
    ["requestHeaders"]
);

// Listen for POST requests to the download endpoint
chrome.webRequest.onBeforeRequest.addListener(
    async function(details) {
        if (details.method === "POST" && details.url.includes("downSrcCode")) {
            console.log("📥 Capturing download request...", details.url);
            let postDataString = "";
            
            // Handle different request body formats
            if (details.requestBody) {
                if (details.requestBody.formData) {
                    // Form data format
                    const formData = details.requestBody.formData;
                    const pairs = [];
                    for (const key in formData) {
                        const value = formData[key][0];
                        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                    }
                    postDataString = pairs.join('&');
                    console.log("✓ Captured formData:", postDataString.substring(0, 100) + "...");
                } else if (details.requestBody.raw) {
                    // Raw body format - decode from ArrayBuffer
                    try {
                        const decoder = new TextDecoder('utf-8');
                        const dataView = new DataView(details.requestBody.raw[0].bytes);
                        postDataString = decoder.decode(dataView);
                        console.log("✓ Captured raw body:", postDataString.substring(0, 100) + "...");
                    } catch (e) {
                        console.error("✗ Error decoding raw body:", e);
                    }
                }
            }
            
            if (!postDataString) {
                console.warn("⚠ No POST data captured!");
            }
            
            // Get headers for this request from storage
            const storageKey = `req_headers_${details.requestId}`;
            console.log("🔍 onBeforeRequest - Looking for headers with key:", storageKey);
            console.log("🔍 onBeforeRequest - requestId:", details.requestId);
            
            // Try multiple times with small delay in case of timing issues
            let headerData = await chrome.storage.local.get(storageKey);
            if (!headerData[storageKey]) {
                console.log("⏳ Headers not found immediately, waiting 50ms...");
                await new Promise(resolve => setTimeout(resolve, 50));
                headerData = await chrome.storage.local.get(storageKey);
            }
            
            console.log("🔍 Found header data:", headerData[storageKey] ? "yes" : "no");
            if (headerData[storageKey]) {
                console.log("🔍 Stored requestId:", headerData[storageKey].requestId);
            }
            
            const headers = headerData[storageKey]?.headers || {};
            
            // Clean up temporary header storage
            if (headerData[storageKey]) {
                await chrome.storage.local.remove(storageKey);
            }
            
            console.log("📋 Using headers:", Object.keys(headers).length, "headers");
            if (Object.keys(headers).length === 0) {
                console.warn("⚠️ No headers found!");
                // List all keys in storage for debugging
                const allKeys = await chrome.storage.local.get(null);
                const headerKeys = Object.keys(allKeys).filter(k => k.startsWith('req_headers_'));
                console.log("🔍 Available header keys in storage:", headerKeys);
            } else {
                console.log("✅ Headers successfully retrieved:", Object.keys(headers).slice(0, 5));
            }
            
            // Get cookies for the domain
            try {
                const cookies = await chrome.cookies.getAll({domain: "opensource.samsung.com"});
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                console.log("✓ Captured cookies:", cookieString.substring(0, 100) + "...");
                
                // Save to storage
                await chrome.storage.local.set({
                    lastRequest: {
                        cookie: cookieString,
                        payload: postDataString,
                        headers: headers,
                        timestamp: Date.now(),
                        url: details.url
                    }
                });
                
                console.log("✅ Request saved to storage!");
                
                // Notify popup if it's open
                chrome.runtime.sendMessage({
                    type: 'requestCaptured',
                    data: {
                        cookie: cookieString,
                        payload: postDataString,
                        headers: headers
                    }
                }).catch(() => {
                    // Ignore errors if popup is not open
                });
            } catch (error) {
                console.error("✗ Error capturing request:", error);
            }
        }
    },
    {
        urls: ["*://opensource.samsung.com/downSrcCode"]
    },
    ["requestBody"]
);
