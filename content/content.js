// content.js

class SelectionOverlay {
    constructor() {
        this.overlay = null;
        this.startX = 0;
        this.startY = 0;
        this.isSelecting = false;
        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
    }

    initialize() {
        this.createOverlay();
        this.setupEventListeners();
        this.disableTextSelection();
        this.setCrosshairCursor();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed',
            border: '2px dashed #007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            zIndex: 2147483647,
            display: 'none',
            pointerEvents: 'none'
        });
        document.body.appendChild(this.overlay);
    }

    disableTextSelection() {
        document.body.style.userSelect = 'none';
    }

    setCrosshairCursor() {
        document.body.style.cursor = 'crosshair';
    }

    setupEventListeners() {
        document.addEventListener('mousedown', this.boundMouseDown);
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
    }

    removeEventListeners() {
        document.removeEventListener('mousedown', this.boundMouseDown);
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
    }

    cleanup() {
        this.resetCursorAndSelection();
        this.removeEventListeners();
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
    }

    onMouseDown(e) {
        if (e.button !== 0) return; // Only respond to left-click
        this.isSelecting = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.overlay.style.left = `${this.startX}px`;
        this.overlay.style.top = `${this.startY}px`;
        this.overlay.style.width = '0px';
        this.overlay.style.height = '0px';
        this.overlay.style.display = 'block';
    }

    onMouseMove(e) {
        if (!this.isSelecting) return;
        const currentX = e.clientX;
        const currentY = e.clientY;
        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);
        this.overlay.style.width = `${width}px`;
        this.overlay.style.height = `${height}px`;
        this.overlay.style.left = `${Math.min(this.startX, currentX)}px`;
        this.overlay.style.top = `${Math.min(this.startY, currentY)}px`;
    }

    onMouseUp(e) {
        if (!this.isSelecting) return;
        this.isSelecting = false;
        const rect = this.overlay.getBoundingClientRect();
        this.overlay.style.display = 'none';

        // Send the selection rectangle to the background script
        chrome.runtime.sendMessage({
            action: 'captureArea',
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            }
        });

        // Clean up after capturing
        this.cleanup();
    }

    resetCursorAndSelection() {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }
}

// Initialize the selection overlay when the content script is loaded
document.addEventListener('start-screenshot-selection', () => {
    new SelectionOverlay().initialize();
});
