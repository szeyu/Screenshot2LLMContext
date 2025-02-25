document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const showKeyBtn = document.getElementById('show-key');
    const saveBtn = document.getElementById('save-btn');
    const testBtn = document.getElementById('test-btn');
    const statusText = document.getElementById('status');
    
    // Load existing API key if available
    chrome.storage.sync.get('geminiApiKey', (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            updateStatus('API key loaded from storage', 'success');
        }
    });
    
    // Toggle password visibility
    showKeyBtn.addEventListener('mousedown', () => {
        apiKeyInput.type = 'text';
        showKeyBtn.textContent = '🔒';
    });
    
    showKeyBtn.addEventListener('mouseup', () => {
        apiKeyInput.type = 'password';
        showKeyBtn.textContent = '👁️';
    });
    
    showKeyBtn.addEventListener('mouseleave', () => {
        apiKeyInput.type = 'password';
        showKeyBtn.textContent = '👁️';
    });
    
    // Save API key
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            updateStatus('Please enter a valid API key', 'error');
            return;
        }
        
        chrome.runtime.sendMessage(
            { action: 'saveApiKey', apiKey: apiKey },
            (response) => {
                if (response && response.success) {
                    updateStatus('API key saved successfully', 'success');
                } else {
                    updateStatus('Failed to save API key', 'error');
                }
            }
        );
    });
    
    // Test API key
    testBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            updateStatus('Please enter an API key to test', 'error');
            return;
        }
        
        updateStatus('Testing API key...', 'info');
        
        // Simple test request to Gemini API
        fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.models) {
                    updateStatus('API key is valid!', 'success');
                } else {
                    updateStatus('API key test returned unexpected data', 'error');
                }
            })
            .catch(error => {
                updateStatus(`API key test failed: ${error.message}`, 'error');
            });
    });
    
    function updateStatus(message, type = 'info') {
        statusText.textContent = message;
        statusText.className = `status-text ${type}`;
    }
}); 