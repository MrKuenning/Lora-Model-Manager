
// ===== Image Drop Zone Functions =====

// Initialize drag-and-drop for image upload
function initializeImageDropZone() {
    const dropZone = document.getElementById('image-drop-zone');
    const previewContainer = document.getElementById('model-preview-container');

    if (!dropZone || !previewContainer) {
        console.error('Drop zone elements not found');
        return;
    }

    // Prevent default drag behaviors on the container
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        previewContainer.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        previewContainer.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        previewContainer.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });

    // Handle dropped files
    previewContainer.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            handleImageDrop(files[0]);
        }
    }
}

// Handle the dropped image file
async function handleImageDrop(file) {
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
