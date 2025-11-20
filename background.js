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
                        payload: postDataString
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

// Also listen to headers to capture additional info
chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        if (details.method === "POST" && details.url.includes("downSrcCode")) {
            console.log("📋 Request headers:", details.requestHeaders);
        }
    },
    {
        urls: ["*://opensource.samsung.com/downSrcCode"]
    },
    ["requestHeaders"]
);
