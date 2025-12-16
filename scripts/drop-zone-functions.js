
// ===== Image Drop Zone Functions =====

// Initialize drag-and-drop for image upload
export function initializeImageDropZone(getCurrentModel, getRefreshModelData) {
    const dropZone = document.getElementById('image-drop-zone');
    const imageWrapper = document.querySelector('.preview-image-wrapper');

    if (!dropZone || !imageWrapper) {
        console.error('Drop zone elements not found - dropZone:', dropZone, 'imageWrapper:', imageWrapper);
        return;
    }

    // Use a counter to track drag depth and prevent flickering from child elements
    let dragCounter = 0;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        imageWrapper.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // Track dragenter to increment counter
    imageWrapper.addEventListener('dragenter', (e) => {
        dragCounter++;
        dropZone.classList.add('drag-over');
    }, false);

    // Only remove highlight when we've left all elements (counter = 0)
    imageWrapper.addEventListener('dragleave', (e) => {
        dragCounter--;
        if (dragCounter === 0) {
            dropZone.classList.remove('drag-over');
        }
    }, false);

    // Ensure dragover keeps the highlight active
    imageWrapper.addEventListener('dragover', (e) => {
        dropZone.classList.add('drag-over');
    }, false);

    // Handle dropped files
    imageWrapper.addEventListener('drop', (e) => {
        dragCounter = 0; // Reset counter on drop
        dropZone.classList.remove('drag-over');

        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            handleImageDrop(files[0], getCurrentModel(), getRefreshModelData);
        }
    }, false);
}

// Handle the dropped image file
export async function handleImageDrop(file, currentModel, refreshModelData) {
    if (!currentModel) {
        alert('No model selected');
        return;
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        alert('Please drop a valid image file (PNG or JPEG)');
        return;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert('Image file is too large. Maximum size is 10MB');
        return;
    }

    try {
        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('modelName', currentModel.name);
        formData.append('imageFile', file);

        // Show loading state
        const dropZone = document.getElementById('image-drop-zone');
        const originalContent = dropZone.innerHTML;
        dropZone.classList.add('drag-over');
        dropZone.querySelector('.drop-zone-content p').textContent = 'Uploading...';

        // Upload to server
        const response = await fetch('/upload-preview', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${errorText}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            // Success! Refresh the modal to show the new preview
            alert(`Successfully added thumbnail: ${data.filename}`);

            // Refresh model data to get updated preview list
            await refreshModelData();
        } else {
            throw new Error(data.message || 'Upload failed');
        }

        // Reset drop zone
        dropZone.innerHTML = originalContent;
        dropZone.classList.remove('drag-over');

    } catch (error) {
        console.error('Error uploading image:', error);
        alert(`Error uploading image: ${error.message}`);

        // Reset drop zone
        const dropZone = document.getElementById('image-drop-zone');
        dropZone.classList.remove('drag-over');
        location.reload(); // Simple way to reset the drop zone content
    }
}
