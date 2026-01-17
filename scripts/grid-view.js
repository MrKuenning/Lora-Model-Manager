// grid-view.js - Handles grid view display and functionality

import { generateCarouselHTML, generateSingleImageHTML, initializeCarousel } from './preview-carousel.js';
import { isBulkModeActive, addBulkCheckbox, toggleModelSelection } from './bulk-operations.js';
import { getFolderFromPath } from './model-utils.js';
import appSettings from './settings.js';

/**
 * Get the display value for a given field key from a model
 * @param {Object} model - The model object
 * @param {string} fieldKey - The field key (e.g., 'folder', 'baseModel', 'category')
 * @returns {string} The display value, or empty string if not available
 */
function getFieldValue(model, fieldKey) {
    switch (fieldKey) {
        case 'none':
            return '';
        case 'filename':
            return model.name || '';
        case 'modelName':
            return model.json?.['name'] || '';
        case 'folder':
            return getFolderFromPath(model) || '';
        case 'category':
            return model.category || '';
        case 'subcategory':
            return model.json?.['subcategory'] || '';
        case 'baseModel':
            return model.baseModel || '';
        case 'modelVersion':
            return model.json?.['model version'] || '';
        case 'highLow':
            return model.json?.['high low'] || '';
        case 'triggerWords':
            return model.json?.['activation text'] || '';
        case 'creator':
            return model.json?.['creator'] || '';
        case 'tags':
            return model.json?.['tags'] || '';
        default:
            return '';
    }
}

/**
 * Build the subtitle string from subtitle settings
 * @param {Object} model - The model object
 * @param {Object} gridCardSettings - The grid card settings
 * @returns {string} The formatted subtitle string
 */
function buildSubtitle(model, gridCardSettings) {
    const parts = [];

    const sub1 = getFieldValue(model, gridCardSettings.subtitle1 || 'folder');
    const sub2 = getFieldValue(model, gridCardSettings.subtitle2 || 'baseModel');
    const sub3 = getFieldValue(model, gridCardSettings.subtitle3 || 'none');

    if (sub1) parts.push(sub1);
    if (sub2) parts.push(sub2);
    if (sub3) parts.push(sub3);

    return parts.join(' | ');
}

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

    // Get grid card settings
    const gridCardSettings = settings?.gridCardSettings || appSettings.getSetting('gridCardSettings') || {
        imageMode: 'carousel',
        title: 'filename',
        subtitle1: 'folder',
        subtitle2: 'baseModel',
        subtitle3: 'none'
    };

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

        // Determine image HTML based on settings
        let imageHTML;
        if (gridCardSettings.imageMode === 'single' || previewImages.length <= 1) {
            imageHTML = generateSingleImageHTML(previewImages, model.name);
        } else {
            imageHTML = generateCarouselHTML(previewImages, model.name);
        }

        // Determine title based on settings
        const title = gridCardSettings.title === 'modelName'
            ? (model.json?.['name'] || model.name)
            : model.name;

        // Build subtitle from settings
        const subtitle = buildSubtitle(model, gridCardSettings);

        modelCard.innerHTML = `
            <div class="model-preview">
                ${imageHTML}
            </div>
            <div class="model-info">
                <div class="model-name">${title}</div>
                ${subtitle ? `<div class="model-meta">${subtitle}</div>` : ''}
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

            // Only initialize carousel in normal mode (not bulk mode) and if carousel mode is enabled
            if (gridCardSettings.imageMode === 'carousel' && previewImages.length > 1) {
                initializeCarousel(modelCard, previewImages);
            }
        }

        modelsContainer.appendChild(modelCard);

        // Observe all lazy images for lazy loading (main image and thumbnails)
        const lazyImages = modelCard.querySelectorAll('.lazy-image');
        lazyImages.forEach(img => imageObserver.observe(img));
    });
}
