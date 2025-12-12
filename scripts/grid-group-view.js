// grid-group-view.js - Handles grouped grid view display and functionality

// Import settings manager
import appSettings from './settings.js';
import { generateCarouselHTML, initializeCarousel } from './preview-carousel.js';

// Function to display models in grouped grid view
export function displayGroupedGridView(models, modelsContainer, openModelDetails, settings, groupBy) {
    modelsContainer.className = 'grouped-grid-view';

    if (models.length === 0) {
        modelsContainer.innerHTML = `
            <div class="placeholder-message">
                <p>No models match your search criteria.</p>
            </div>
        `;
        return;
    }

    // Clear the container
    modelsContainer.innerHTML = '';

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

    // Group models by the selected property
    const groupedModels = groupModelsByProperty(models, groupBy);

    // Sort the groups chronologically by date for Date grouping, alphabetically for others
    let sortedGroups;
    if (groupBy === 'Date') {
        // For Date grouping, parse the month and year and sort chronologically (newest first)
        sortedGroups = Object.keys(groupedModels).sort((a, b) => {
            // Extract month and year from the group name format "Month Year"
            const [monthA, yearA] = a.split(' ');
            const [monthB, yearB] = b.split(' ');

            // Compare years first
            const yearDiff = parseInt(yearB) - parseInt(yearA);
            if (yearDiff !== 0) return yearDiff;

            // If years are the same, compare months
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            return months.indexOf(monthB) - months.indexOf(monthA);
        });
    } else {
        // For other groupings, sort alphabetically
        sortedGroups = Object.keys(groupedModels).sort();
    }

    // Create a container for each group
    sortedGroups.forEach(groupName => {
        const groupModels = groupedModels[groupName];

        // Create group container
        const groupContainer = document.createElement('div');
        groupContainer.className = 'group-container';

        // Create group header
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.textContent = groupName;
        groupContainer.appendChild(groupHeader);

        // Create container for models in this group
        const groupModelsContainer = document.createElement('div');
        groupModelsContainer.className = 'group-models';

        // Add model cards to this group
        groupModels.forEach(model => {
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

            modelCard.addEventListener('click', () => openModelDetails(model));

            groupModelsContainer.appendChild(modelCard);

            // Initialize carousel if multiple images
            if (previewImages.length > 1) {
                initializeCarousel(modelCard, previewImages);
            }

            // Observe all lazy images for lazy loading (main image and thumbnails)
            const lazyImages = modelCard.querySelectorAll('.lazy-image');
            lazyImages.forEach(img => imageObserver.observe(img));
        });

        // Add models container to group container
        groupContainer.appendChild(groupModelsContainer);

        // Add group container to main container
        modelsContainer.appendChild(groupContainer);
    });
}

// Helper function to group models by a property
function groupModelsByProperty(models, property) {
    const groups = {};

    models.forEach(model => {
        let groupValue;

        // Determine the group value based on the property
        switch (property) {
            case 'Category':
                groupValue = model.category || 'Uncategorized';
                break;
            case 'Civitai Name':
                groupValue = model.json && model.json['author name'] ? model.json['author name'] : 'Unknown Author';
                break;
            case 'Base Model':
                groupValue = model.baseModel || 'Unknown';
                break;
            case 'Subcategory':
                groupValue = model.json && model.json['subcategory'] ? model.json['subcategory'] : 'Uncategorized';
                break;
            case 'Folder':
                groupValue = model.json && model.json['folder'] ? model.json['folder'] : 'Uncategorized';
                break;
            case 'Creator':
                groupValue = model.json && model.json['creator'] ? model.json['creator'] : 'Unknown Creator';
                break;
            case 'Tags':
                // If tags exist, use the first tag as the group, otherwise 'No Tags'
                groupValue = model.json && model.json['tags'] ?
                    (model.json['tags'].split(',')[0].trim() || 'No Tags') : 'No Tags';
                break;
            case 'NSFW':
                groupValue = model.json && model.json['nsfw'] === 'true' ? 'NSFW' : 'Safe';
                break;
            case 'Size':
                // Group by size ranges
                const sizeInMB = model.size / (1024 * 1024);
                if (sizeInMB < 10) groupValue = 'Less than 10MB';
                else if (sizeInMB < 50) groupValue = '10MB - 50MB';
                else if (sizeInMB < 100) groupValue = '50MB - 100MB';
                else groupValue = 'Over 100MB';
                break;
            case 'Date':
                // Group by month and year
                const date = new Date(model.dateModified * 1000);
                groupValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
                break;
            case 'Path':
                // Group by full directory path
                if (model.path) {
                    // Get the models directory from settings
                    const modelsDir = appSettings.getSetting('modelsDirectory').replace(/\\/g, '/');

                    // Convert path to forward slashes for consistency
                    const fullPath = model.path.replace(/\\/g, '/');

                    // Create relative path by removing the models directory prefix
                    let relativePath = fullPath;
                    if (modelsDir && fullPath.startsWith(modelsDir)) {
                        relativePath = fullPath.substring(modelsDir.length);
                        // Remove leading slash if present
                        if (relativePath.startsWith('/')) {
                            relativePath = relativePath.substring(1);
                        }
                    }

                    // Extract the directory path (excluding the filename)
                    const lastSlashIndex = relativePath.lastIndexOf('/');
                    if (lastSlashIndex !== -1) {
                        // Use the full directory path as the group value
                        groupValue = relativePath.substring(0, lastSlashIndex);
                    } else {
                        groupValue = 'Root';
                    }
                } else {
                    groupValue = 'Unknown Path';
                }
                break;
            default:
                groupValue = 'Ungrouped';
        }

        // Create the group if it doesn't exist
        if (!groups[groupValue]) {
            groups[groupValue] = [];
        }

        // Add the model to the group
        groups[groupValue].push(model);
    });

    return groups;
}