// popup/popup.js
class PopupManager {
    constructor() {
      this.elements = {
        captureBtn: document.getElementById('capture-btn'),
        processBtn: document.getElementById('process-btn'),
        copyBtn: document.getElementById('copy-btn'),
        statusText: document.getElementById('status'),
        imagePreview: document.getElementById('image-preview'),
        previewContainer: document.getElementById('preview-container'),
        resultContainer: document.getElementById('result-container'),
        llmContext: document.getElementById('llm-context')
      };
      
      this.initialize();
    }
  
    initialize() {
      this.setupEventListeners();
      this.checkForExistingImage();
    }
  
    setupEventListeners() {
      this.elements.captureBtn.addEventListener('click', () => this.startCapture());
      this.elements.processBtn.addEventListener('click', () => this.processImage());
      this.elements.copyBtn.addEventListener('click', () => this.copyResult());
    }
  
    async checkForExistingImage() {
        const result = await chrome.storage.local.get(['lastCapturedImage', 'lastProcessedResult']);
        
        if (result.lastCapturedImage) {
            this.showPreview(result.lastCapturedImage);
        }
    
        if (result.lastProcessedResult) {
            this.displayResult(result.lastProcessedResult);
        }
    }
    
  
    async startCapture() {
        this.updateStatus('Select an area to capture...');
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab?.id || tab.url?.startsWith('chrome://')) {
            this.updateStatus('Cannot capture this page', 'error');
            return;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
            document.dispatchEvent(new CustomEvent('start-screenshot-selection'));
            }
        });
    }
  
    showPreview(imageUrl) {
      this.elements.imagePreview.src = imageUrl;
      this.elements.previewContainer.classList.remove('hidden');
      this.elements.processBtn.disabled = false;
      this.updateStatus('Ready to process');
    }
  
    async processImage() {
        this.updateStatus('Processing image...', 'info', true);
        this.elements.processBtn.disabled = true;

        try {
            // Send the image to the background script
            chrome.runtime.sendMessage({
                action: 'processImage'
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
    
  }
  
// Initialize popup manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});