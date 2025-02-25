// popup/popup.js
class PopupManager {
    constructor() {
      this.elements = {
        captureBtn: document.getElementById('capture-btn'),
        processBtn: document.getElementById('process-btn'),
        copyBtn: document.getElementById('copy-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        statusText: document.getElementById('status'),
        imagePreview: document.getElementById('image-preview'),
        previewContainer: document.getElementById('preview-container'),
        resultContainer: document.getElementById('result-container'),
        llmContext: document.getElementById('llm-context'),
        promptSelect: document.getElementById('prompt-select')
      };
      
      this.initialize();
    }
  
    initialize() {
      this.setupEventListeners();
      this.checkForExistingImage();
      
      // Add event listener for when popup is about to close
      window.addEventListener('beforeunload', () => this.resetOnClose());
      
      // Setup settings button
      this.setupSettingsButton();

      this.loadPromptTemplates();
    }
  
    setupEventListeners() {
      this.elements.captureBtn.addEventListener('click', () => this.startCapture());
      this.elements.processBtn.addEventListener('click', () => this.processImage());
      this.elements.copyBtn.addEventListener('click', () => this.copyResult());
    }
    
    // Reset everything when popup is closed
    resetOnClose() {
      // Only reset if we're not in the middle of a capture
      chrome.storage.local.get('captureInProgress', (result) => {
        if (!result.captureInProgress) {
          chrome.storage.local.remove(['lastCapturedImage', 'lastProcessedResult', 'captureComplete']);
        }
      });
    }
  
    async checkApiKey() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('geminiApiKey', (result) => {
                if (result.geminiApiKey) {
                    resolve(true);
                } else {
                    this.updateStatus('API key not found. Please configure in settings.', 'error', false, 0);
                    resolve(false);
                }
            });
        });
    }
  
    async checkForExistingImage() {
        // Check for API key first
        const hasApiKey = await this.checkApiKey();
        
        const result = await chrome.storage.local.get(['lastCapturedImage', 'lastProcessedResult', 'captureComplete', 'captureInProgress']);
        
        if (result.captureComplete) {
            // If capture was just completed, show preview and process
            if (result.lastCapturedImage) {
                this.showPreview(result.lastCapturedImage);
                // Clear the flag
                chrome.storage.local.remove('captureComplete');
                // Process the image
                setTimeout(() => this.processImage(), 300);
            }
        } else if (result.captureInProgress) {
            // If capture is in progress, do nothing and wait
            chrome.storage.local.remove('captureInProgress');
        } else if (hasApiKey) {
            // Only start a new capture if we have an API key
            setTimeout(() => this.startCapture(), 100);
        }
    
        // Show any existing results
        if (result.lastProcessedResult) {
            this.displayResult(result.lastProcessedResult);
        }
    }
    
    async startCapture() {
        // Check for API key first
        const hasApiKey = await this.checkApiKey();
        if (!hasApiKey) return;
        
        this.updateStatus('Select an area to capture...', 'info', false, 0);
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab?.id || tab.url?.startsWith('chrome://')) {
            this.updateStatus('Cannot capture this page', 'error');
            return;
        }

        // Set flag that capture is in progress
        chrome.storage.local.set({ captureInProgress: true });

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              document.dispatchEvent(new CustomEvent('start-screenshot-selection'));
            }
        });
        
        // Minimize the popup to get out of the way
        window.close();
    }
  
    showPreview(imageUrl) {
      this.elements.imagePreview.src = imageUrl;
      this.elements.previewContainer.classList.remove('hidden');
      this.elements.processBtn.disabled = false;
      this.updateStatus('Ready to process');
    }
  
    async processImage() {
        this.updateStatus('Processing image...', 'info', true, 0);
        this.elements.processBtn.disabled = true;

        try {
            const selectedPrompt = this.elements.promptSelect.value;
            
            // Send the image to the background script with the selected prompt
            chrome.runtime.sendMessage({
                action: 'processImage',
                prompt: selectedPrompt
            });

            // Wait for the processing to complete
            const result = await new Promise((resolve) => {
                const messageListener = (message) => {
                    if (message.action === 'processingComplete') {
                        chrome.runtime.onMessage.removeListener(messageListener);
                        resolve(message);
                    }
                };
                chrome.runtime.onMessage.addListener(messageListener);
            });

            // Get the processed result from storage
            const storage = await chrome.storage.local.get('lastProcessedResult');
            if (storage.lastProcessedResult) {
                this.displayResult(storage.lastProcessedResult);
                this.updateStatus('Processing complete', 'success');
            } else {
                this.updateStatus('No result received', 'error');
            }

            if (!result.success) {
                this.updateStatus(`Processing failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.updateStatus('Error processing image', 'error');
            console.error('Processing error:', error);
        }

        this.elements.processBtn.disabled = false;
    }
  
    displayResult(data) {
        // Handle different types of results
        let displayText = 'No content generated';
        
        if (data.error) {
            displayText = `Error: ${data.error}`;
        } else if (data.text) {
            displayText = data.text;
        }

        this.elements.llmContext.textContent = displayText;
        this.elements.resultContainer.classList.remove('hidden');
    }
  
    async copyResult() {
        try {
            const text = this.elements.llmContext.textContent.trim();
            if (!text) {
                this.updateStatus('No text to copy', 'error');
                return;
            }
            
            await navigator.clipboard.writeText(text);
            
            this.elements.copyBtn.textContent = '✅ Copied!';
            setTimeout(() => this.elements.copyBtn.textContent = 'Copy', 2000);
        } catch (error) {
            this.updateStatus('Failed to copy text', 'error');
        }
    }    
  
    updateStatus(message, type = 'info', showLoader = false, timeout = 3000) {
        this.elements.statusText.textContent = message;
        this.elements.statusText.className = `status-text ${type}`;
    
        if (showLoader) {
            this.elements.statusText.classList.add('loading');
        } else {
            this.elements.statusText.classList.remove('loading');
        }
    
        // Auto-clear message after timeout
        if (timeout) {
            setTimeout(() => {
                this.elements.statusText.textContent = '';
                this.elements.statusText.className = 'status-text';
            }, timeout);
        }
    }

    // Replace addSettingsButton with setupSettingsButton
    setupSettingsButton() {
      this.elements.settingsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'settings/settings.html' });
      });
    }

    loadPromptTemplates() {
      chrome.storage.sync.get('promptTemplates', (result) => {
        const prompts = result.promptTemplates || [];
        
        // Clear existing options
        this.elements.promptSelect.innerHTML = '';
        
        // Add options for each prompt
        prompts.forEach(prompt => {
          const option = document.createElement('option');
          option.value = prompt.text;
          option.textContent = prompt.name;
          option.selected = prompt.isDefault;
          this.elements.promptSelect.appendChild(option);
        });
        
        // If no prompts, add a default
        if (prompts.length === 0) {
          const option = document.createElement('option');
          option.value = "I want you to describe this image in detail. Be very specific and detailed. Because your output will become a context for a LLM to answer a question.";
          option.textContent = "Detailed Description";
          option.selected = true;
          this.elements.promptSelect.appendChild(option);
        }
      });
    }
}
  
// Initialize popup manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});