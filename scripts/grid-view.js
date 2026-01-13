// grid-view.js - Handles grid view display and functionality

import { generateCarouselHTML, initializeCarousel } from './preview-carousel.js';
import { isBulkModeActive, addBulkCheckbox, toggleModelSelection } from './bulk-operations.js';

// Function to display models in grid view
export function displayGridView(models, modelsContainer, openModelDetails, settings) {
    modelsContainer.className = 'grid-view';
    const bulkMode = isBulkModeActive();

    if (models.length === 0) {
        modelsContainer.innerHTML = `
            <div class="placeholder-message">
                <p>No models match your search criteria.</p>
            </div>
        `;
        return;
    }

    // Create and setup Intersection Observer for lazy loading
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const dataSrc = img.getAttribute('data-src');
                if (dataSrc) {
                    img.src = dataSrc;
                    img.removeAttribute('data-src');
                    img.classList.remove('lazy-image');
                    img.classList.add('loaded');
                }
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '100px 0px', // Start loading images when they're 100px from viewport
        threshold: 0.1
    });

    models.forEach(model => {
        const modelCard = document.createElement('div');
        modelCard.className = 'model-card';
        modelCard.dataset.id = model.id;

        // Use previewImages array if available, fallback to single previewUrl
        const previewImages = model.previewImages || (model.previewUrl ? [model.previewUrl] : []);
        const carouselHTML = generateCarouselHTML(previewImages, model.name);

        modelCard.innerHTML = `
            <div class="model-preview">
                ${carouselHTML}
            </div>
            <div class="model-info">
                <div class="model-name">${model.name}</div>
                <div class="model-meta">${model.category} | ${model.baseModel}</div>
            </div>
        `;

        // In bulk mode, add checkbox and make entire card toggle selection
        if (bulkMode) {
            addBulkCheckbox(modelCard, model.id);
            // Make entire card clickable to toggle selection
            modelCard.addEventListener('click', (e) => {
                // Prevent default click behaviors
                e.preventDefault();
                e.stopPropagation();
                toggleModelSelection(model.id);
            });
        } else {
            modelCard.addEventListener('click', () => openModelDetails(model));

            // Only initialize carousel in normal mode (not bulk mode)
            if (previewImages.length > 1) {
                initializeCarousel(modelCard, previewImages);
            }
        }

        modelsContainer.appendChild(modelCard);

        // Observe all lazy images for lazy loading (main image and thumbnails)
        const lazyImages = modelCard.querySelectorAll('.lazy-image');
        lazyImages.forEach(img => imageObserver.observe(img));
    });
}
