// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureArea') {
        captureAndProcessArea(message.rect, sender.tab);
    }
    if (message.action === 'processImage') {
        processImage(sender.tab);
    }
});

function captureAndProcessArea(rect, tab) {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
            console.error('Capture failed:', chrome.runtime.lastError);
            return;
        }

        // Create a temporary canvas to process the captured data
        const canvas = new OffscreenCanvas(rect.width, rect.height);
        const ctx = canvas.getContext('2d');
        
        // Create a blob from the data URL
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => createImageBitmap(blob))
            .then(bitmap => {
                // Draw the cropped portion
                ctx.drawImage(
                    bitmap,
                    rect.left, rect.top,
                    rect.width, rect.height,
                    0, 0, canvas.width, canvas.height
                );
                
                // Convert the canvas to blob
                return canvas.convertToBlob({ type: 'image/png' });
            })
            .then(blob => {
                // Convert blob to data URL
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            })
            .then(croppedDataUrl => {
                // Store the cropped image
                console.log('Cropped image URL:', croppedDataUrl);
                chrome.storage.local.set({ 
                    lastCapturedImage: croppedDataUrl,
                    captureComplete: true,  // Flag to indicate capture is complete
                    captureInProgress: false // Clear the in-progress flag
                }, () => {
                    // Open the popup after storage is updated
                    chrome.action.openPopup();
                    
                    // Automatically process the image
                    processImage();
                });
            })
            .catch(error => {
                console.error('Error processing image:', error);
            });
    });
}

function processImage(tab) {
    chrome.storage.local.get('lastCapturedImage', (result) => {
        const imageUrl = result.lastCapturedImage;
        console.log('Processing image:', imageUrl);

        // Convert base64 data URL to base64 string by removing the prefix
        const base64Image = imageUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

        // Prepare the request body
        const requestBody = {
            contents: [{
                parts: [
                    { text: "I want you to describe this image in detail. Be very specific and detailed. Because your output will become a context for a LLM to answer a question." },
                    {
                        inline_data: {
                            mime_type: "image/png",
                            data: base64Image
                        }
                    }
                ]
            }]
        };

        // Call Gemini API
        fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => response.json())
        .then(data => {
            // Extract just the text content from the response
            let textContent = '';
            if (data.candidates && data.candidates[0]?.content?.parts) {
                textContent = data.candidates[0].content.parts
                    .filter(part => part.text)
                    .map(part => part.text)
                    .join('\n');
            }
            
            // Store both raw data and extracted text
            chrome.storage.local.set({ 
                lastProcessedResult: {
                    raw: data,
                    text: textContent || 'No text content found in response'
                }
            });

            // Notify the popup that processing is complete
            chrome.runtime.sendMessage({
                action: 'processingComplete',
                success: true
            });
        })
        .catch(error => {
            console.error('Error calling Gemini API:', error);
            const errorMessage = error.toString();
            
            chrome.storage.local.set({ 
                lastProcessedResult: {
                    error: errorMessage,
                    context: `Error: ${errorMessage}`
                }
            });

            // Notify the popup about the error
            chrome.runtime.sendMessage({
                action: 'processingComplete',
                success: false,
                error: errorMessage
            });
        });
    });
}