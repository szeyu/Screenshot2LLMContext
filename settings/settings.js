document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const showKeyBtn = document.getElementById('show-key');
    const saveBtn = document.getElementById('save-btn');
    const testBtn = document.getElementById('test-btn');
    const statusText = document.getElementById('status');
    const promptNameInput = document.getElementById('prompt-name');
    const promptTextInput = document.getElementById('prompt-text');
    const addPromptBtn = document.getElementById('add-prompt-btn');
    const promptsContainer = document.getElementById('prompts-container');
    
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
    
    // Default prompts
    const DEFAULT_PROMPTS = [
        {
            name: "Detailed Description",
            text: "I want you to describe this image in detail. Be very specific and detailed. Because your output will become a context for a LLM to answer a question.",
            isDefault: true
        },
        {
            name: "Simple Caption",
            text: "Provide a brief caption for this image.",
            isDefault: false
        }
    ];

    // Load existing prompts or set defaults
    loadPrompts();

    // Add prompt button handler
    addPromptBtn.addEventListener('click', () => {
        const name = promptNameInput.value.trim();
        const text = promptTextInput.value.trim();
        
        if (!name || !text) {
            updateStatus('Please enter both prompt name and text', 'error');
            return;
        }
        
        chrome.storage.sync.get('promptTemplates', (result) => {
            let prompts = result.promptTemplates || [];
            
            // Check for duplicate names
            if (prompts.some(p => p.name === name)) {
                updateStatus('A prompt with this name already exists', 'error');
                return;
            }
            
            prompts.push({
                name: name,
                text: text,
                isDefault: false
            });
            
            savePrompts(prompts);
            promptNameInput.value = '';
            promptTextInput.value = '';
            updateStatus('Prompt added successfully', 'success');
        });
    });

    function updateStatus(message, type = 'info') {
        statusText.textContent = message;
        statusText.className = `status-text ${type}`;
    }

    function loadPrompts() {
        chrome.storage.sync.get('promptTemplates', (result) => {
            let prompts = result.promptTemplates;
            
            // If no prompts exist, set defaults
            if (!prompts || prompts.length === 0) {
                prompts = DEFAULT_PROMPTS;
                savePrompts(prompts);
            }
            
            renderPrompts(prompts);
        });
    }

    function savePrompts(prompts) {
        chrome.storage.sync.set({ promptTemplates: prompts }, () => {
            renderPrompts(prompts);
        });
    }

    function renderPrompts(prompts) {
        promptsContainer.innerHTML = '';
        
        prompts.forEach((prompt, index) => {
            const promptElement = document.createElement('div');
            promptElement.className = 'prompt-item';
            
            const titleElement = document.createElement('h4');
            titleElement.textContent = prompt.name;
            if (prompt.isDefault) {
                const defaultBadge = document.createElement('span');
                defaultBadge.className = 'default-badge';
                defaultBadge.textContent = 'Default';
                titleElement.appendChild(defaultBadge);
            }
            
            const textElement = document.createElement('p');
            textElement.textContent = prompt.text;
            
            const actionsElement = document.createElement('div');
            actionsElement.className = 'prompt-actions';
            
            // Set as default button
            if (!prompt.isDefault) {
                const setDefaultBtn = document.createElement('button');
                setDefaultBtn.innerHTML = '⭐';
                setDefaultBtn.title = 'Set as default';
                setDefaultBtn.addEventListener('click', () => setDefaultPrompt(index));
                actionsElement.appendChild(setDefaultBtn);
            }
            
            // Delete button (don't allow deleting default prompts)
            if (!prompt.isDefault) {
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.title = 'Delete prompt';
                deleteBtn.addEventListener('click', () => deletePrompt(index));
                actionsElement.appendChild(deleteBtn);
            }
            
            promptElement.appendChild(titleElement);
            promptElement.appendChild(textElement);
            promptElement.appendChild(actionsElement);
            promptsContainer.appendChild(promptElement);
        });
    }

    function setDefaultPrompt(index) {
        chrome.storage.sync.get('promptTemplates', (result) => {
            let prompts = result.promptTemplates || [];
            
            // Reset all to non-default
            prompts = prompts.map(p => ({...p, isDefault: false}));
            
            // Set the selected one as default
            prompts[index].isDefault = true;
            
            savePrompts(prompts);
            updateStatus('Default prompt updated', 'success');
        });
    }

    function deletePrompt(index) {
        chrome.storage.sync.get('promptTemplates', (result) => {
            let prompts = result.promptTemplates || [];
            prompts.splice(index, 1);
            
            // If no prompts left, reset to defaults
            if (prompts.length === 0) {
                prompts = DEFAULT_PROMPTS;
            }
            
            // Ensure there's always a default
            if (!prompts.some(p => p.isDefault)) {
                prompts[0].isDefault = true;
            }
            
            savePrompts(prompts);
            updateStatus('Prompt deleted', 'success');
        });
    }
}); 