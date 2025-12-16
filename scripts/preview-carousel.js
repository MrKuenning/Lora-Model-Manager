// preview-carousel.js - Handles multi-image preview carousel functionality

/**
 * Initialize carousel for a model card with multiple preview images
 * @param {HTMLElement} cardElement - The model card element
 * @param {Array<string>} previewImages - Array of preview image URLs
 */
export function initializeCarousel(cardElement, previewImages) {
    if (!previewImages || previewImages.length <= 1) {
        return; // No carousel needed for single or no images
    }

    const prevArrow = cardElement.querySelector('.carousel-arrow-prev');
    const nextArrow = cardElement.querySelector('.carousel-arrow-next');
    const indicator = cardElement.querySelector('.carousel-indicator');

    if (!prevArrow || !nextArrow) return;

    // Add click handlers to arrows
    prevArrow.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click from triggering
        navigateCarousel(cardElement, -1, previewImages);
    });

    nextArrow.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click from triggering
        navigateCarousel(cardElement, 1, previewImages);
    });
}

/**
 * Navigate through carousel images
 * @param {HTMLElement} cardElement - The model card element
 * @param {number} direction - Direction to navigate (-1 for previous, 1 for next)
 * @param {Array<string>} previewImages - Array of preview image URLs
 */
function navigateCarousel(cardElement, direction, previewImages) {
    const mainImage = cardElement.querySelector('.preview-main-image');
    const indicator = cardElement.querySelector('.carousel-indicator');

    let currentIndex = parseInt(mainImage.dataset.index) || 0;
    let newIndex = currentIndex + direction;

    // Wrap around
    if (newIndex < 0) {
        newIndex = previewImages.length - 1;
    } else if (newIndex >= previewImages.length) {
        newIndex = 0;
    }

    switchToImage(cardElement, newIndex, previewImages);
}

/**
 * Switch the main image to the specified index
 * @param {HTMLElement} cardElement - The model card element
 * @param {number} index - Index of the image to display
 * @param {Array<string>} previewImages - Array of preview image URLs
 */
function switchToImage(cardElement, index, previewImages) {
    const mainImage = cardElement.querySelector('.preview-main-image');
    const indicator = cardElement.querySelector('.carousel-indicator');

    // Update main image - check if it's a lazy-loaded image
    const dataSrc = mainImage.getAttribute('data-src');
    if (dataSrc) {
        // Still lazy loading, update data-src
        mainImage.setAttribute('data-src', previewImages[index]);
    } else {
        // Already loaded, update src directly
        mainImage.src = previewImages[index];
    }
    mainImage.dataset.index = index;

    // Indicator now just shows total count, no need to update
}

/**
 * Generate HTML for preview carousel
 * @param {Array<string>} previewImages - Array of preview image URLs
 * @param {string} modelName - Name of the model for alt text
 * @returns {string} HTML string for the preview carousel
 */
export function generateCarouselHTML(previewImages, modelName) {
    if (!previewImages || previewImages.length === 0) {
        return `<img src="/assets/placeholder.png" data-src="/assets/placeholder.png" alt="${modelName}" class="lazy-image">`;
    }

    if (previewImages.length === 1) {
        // Single image - no carousel needed
        return `<img src="/assets/placeholder.png" data-src="${previewImages[0]}" alt="${modelName}" class="lazy-image preview-main-image">`;
    }

    // Multiple images - create carousel with side arrow navigation
    return `
        \u003cimg src=\"/assets/placeholder.png\" data-src=\"${previewImages[0]}\" alt=\"${modelName}\" class=\"lazy-image preview-main-image\" data-index=\"0\"\u003e
        \u003cbutton class=\"carousel-arrow carousel-arrow-prev\" title=\"Previous image\"\u003e
            \u003ci class=\"fas fa-chevron-left\"\u003e\u003c/i\u003e
        \u003c/button\u003e
        \u003cbutton class=\"carousel-arrow carousel-arrow-next\" title=\"Next image\"\u003e
            \u003ci class=\"fas fa-chevron-right\"\u003e\u003c/i\u003e
        \u003c/button\u003e
        \u003cspan class=\"carousel-indicator\"\u003e${previewImages.length}\u003c/span\u003e
    `;
}
