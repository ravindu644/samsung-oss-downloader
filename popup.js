// Show status message
function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Copy text to clipboard
async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showStatus(`✓ ${label} copied to clipboard!`, 'success');
    } catch (err) {
        showStatus(`✗ Failed to copy ${label}`, 'error');
        console.error('Copy failed:', err);
    }
}

// Load and display captured data
function loadCapturedData() {
    chrome.storage.local.get(['lastRequest'], (result) => {
        const contentEl = document.getElementById('content');
        
        if (!result.lastRequest || !result.lastRequest.cookie || !result.lastRequest.payload) {
            contentEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⏳</div>
                    <p><strong>No request captured yet</strong><br>
                    Click download on the Samsung website first, then refresh this popup.</p>
                </div>
            `;
            return;
        }
        
        const { cookie, payload, headers, timestamp } = result.lastRequest;
        const timeAgo = timestamp ? `Captured ${Math.floor((Date.now() - timestamp) / 1000)}s ago` : '';
        
        // Format headers for display
        let headersDisplay = '';
        if (headers && Object.keys(headers).length > 0) {
            headersDisplay = Object.entries(headers)
                .map(([key, value]) => `<div style="margin: 2px 0;"><strong>${escapeHtml(key)}</strong>: ${escapeHtml(String(value))}</div>`)
                .join('');
        } else {
            headersDisplay = '<div style="color: #999; font-style: italic;">No headers captured (empty object)</div>';
        }
        
        contentEl.innerHTML = `
            <div class="data-section">
                <label>Cookie String</label>
                <div class="data-value">${escapeHtml(cookie)}</div>
                <div class="button-group">
                    <button id="copyCookie" class="success-btn">📋 Copy Cookie</button>
                </div>
            </div>
            
            <div class="data-section">
                <label>POST Data / Payload</label>
                <div class="data-value">${escapeHtml(payload)}</div>
                <div class="button-group">
                    <button id="copyPayload" class="success-btn">📋 Copy POST Data</button>
                </div>
            </div>
            
            <div class="data-section">
                <label>Request Headers <span style="font-size: 10px; color: #666;">(${headers ? Object.keys(headers).length : 0} headers)</span></label>
                <div class="data-value" style="max-height: 200px; overflow-y: auto; font-size: 11px; line-height: 1.4;">
                    ${headersDisplay}
                </div>
                <div class="button-group">
                    <button id="copyHeaders" class="secondary">📋 Copy Headers JSON</button>
                </div>
            </div>
            
            <div class="data-section">
                <label>Quick Actions</label>
                <div class="button-group">
                    <button id="copyBoth" class="secondary">📋 Copy Both</button>
                    <button id="copyForDlSh" class="success-btn">📦 Copy for ./dl.sh</button>
                </div>
            </div>
            
            <div class="data-section">
                <label>Debug Info</label>
                <div style="font-size: 10px; color: #666; padding: 5px;">
                    Payload length: ${payload.length} chars<br>
                    Cookie count: ${cookie.split(';').length} cookies<br>
                    Headers count: ${headers ? Object.keys(headers).length : 0}<br>
                    ${timeAgo}
                </div>
            </div>
        `;
        
        // Attach event listeners
        document.getElementById('copyCookie').addEventListener('click', () => {
            copyToClipboard(cookie, 'Cookie');
        });
        
        document.getElementById('copyPayload').addEventListener('click', () => {
            copyToClipboard(payload, 'POST Data');
        });
        
        const copyHeadersBtn = document.getElementById('copyHeaders');
        if (copyHeadersBtn) {
            copyHeadersBtn.addEventListener('click', () => {
                const headersJson = JSON.stringify(headers || {}, null, 2);
                copyToClipboard(headersJson, 'Headers JSON');
            });
        }
        
        document.getElementById('copyBoth').addEventListener('click', () => {
            const both = `Cookie: ${cookie}\n\nPOST Data: ${payload}`;
            copyToClipboard(both, 'Cookie and POST Data');
        });
        
        document.getElementById('copyForDlSh').addEventListener('click', () => {
            // Create base64 encoded string with cookie, payload, and headers
            // Format: COOKIE: <cookie>\nPAYLOAD: <payload>\nHEADERS: <json_headers>
            const headers = result.lastRequest.headers || {};
            const headersJson = JSON.stringify(headers);
            const dataString = `COOKIE: ${cookie}\nPAYLOAD: ${payload}\nHEADERS: ${headersJson}`;
            // Encode to base64 using btoa (works for ASCII/UTF-8)
            const base64Data = btoa(unescape(encodeURIComponent(dataString)));
            copyToClipboard(base64Data, 'Base64 data for ./dl.sh');
            showStatus('✓ Paste into: ./dl.sh "PASTE_HERE" [filename]', 'info');
        });
    });
}


// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'requestCaptured') {
        loadCapturedData();
        showStatus('✓ New request captured!', 'success');
    }
});

// Load data when popup opens
document.addEventListener('DOMContentLoaded', () => {
    loadCapturedData();
    
    // Add refresh button handler
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadCapturedData();
            showStatus('🔄 Refreshed!', 'info');
        });
    }
});

