// grid-group-view.js - Handles grouped grid view display and functionality

// Import settings manager
import appSettings from './settings.js';
import { generateCarouselHTML, generateSingleImageHTML, initializeCarousel } from './preview-carousel.js';
import { isBulkModeActive, addBulkCheckbox, toggleModelSelection } from './bulk-operations.js';
import { getFolderFromPath } from './model-utils.js';

/**
 * Get the display value for a given field key from a model
 */
function getFieldValue(model, fieldKey) {
    switch (fieldKey) {
        case 'none': return '';
        case 'filename': return model.name || '';
        case 'modelName': return model.json?.['name'] || '';
        case 'folder': return getFolderFromPath(model) || '';
        case 'category': return model.category || '';
        case 'subcategory': return model.json?.['subcategory'] || '';
        case 'baseModel': return model.baseModel || '';
        case 'modelVersion': return model.json?.['model version'] || '';
        case 'highLow': return model.json?.['high low'] || '';
        case 'triggerWords': return model.json?.['activation text'] || '';
        case 'creator': return model.json?.['creator'] || '';
        case 'tags': return model.json?.['tags'] || '';
        default: return '';
    }
}

/**
 * Build the subtitle string from subtitle settings
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

// Function to display models in grouped grid view
export function displayGroupedGridView(models, modelsContainer, openModelDetails, settings, groupBy) {
    modelsContainer.className = 'grouped-grid-view';
    const bulkMode = isBulkModeActive();

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

    // Helper function to sort folders hierarchically (subfolders appear after parent folders)
    function sortFoldersHierarchically(folders) {
        return folders.sort((a, b) => {
            // Split paths into segments
            const partsA = a.split('/');
            const partsB = b.split('/');

            // Compare segment by segment
            const minLength = Math.min(partsA.length, partsB.length);
            for (let i = 0; i < minLength; i++) {
                const compare = partsA[i].localeCompare(partsB[i], undefined, { sensitivity: 'base' });
                if (compare !== 0) return compare;
            }

            // If all compared segments are equal, shorter path (parent) comes first
            return partsA.length - partsB.length;
        });
    }

    // Sort the groups chronologically by date for Date grouping, hierarchically for folder/path, alphabetically for others
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
    } else if (groupBy === 'Folder' || groupBy === 'Path') {
        // For Folder and Path groupings, sort hierarchically so subfolders appear after parent folders
        sortedGroups = sortFoldersHierarchically(Object.keys(groupedModels));
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

            // Get grid card settings
            const gridCardSettings = settings?.gridCardSettings || appSettings.getSetting('gridCardSettings') || {
                imageMode: 'carousel',
                title: 'filename',
                subtitle1: 'folder',
                subtitle2: 'baseModel',
                subtitle3: 'none'
            };

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
            let title;
            if (gridCardSettings.title === 'modelName') {
                title = model.json?.['name'] || model.name;
            } else if (gridCardSettings.title === 'modelNameVersion') {
                const name = model.json?.['name'] || model.name;
                const version = model.json?.['model version'] || '';
                title = version ? `${name} ${version}` : name;
            } else {
                title = model.name;
            }

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
                    e.preventDefault();
                    e.stopPropagation();
                    toggleModelSelection(model.id);
                });
            } else {
                modelCard.addEventListener('click', () => openModelDetails(model));

                // Only initialize carousel in normal mode (not bulk mode) and if carousel mode
                if (gridCardSettings.imageMode === 'carousel' && previewImages.length > 1) {
                    initializeCarousel(modelCard, previewImages);
                }
            }

            groupModelsContainer.appendChild(modelCard);

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
                groupValue = getFolderFromPath(model) || 'Uncategorized';
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
            case 'Model Name':
                groupValue = model.json && model.json['name'] ? model.json['name'] : 'Unnamed';
                break;
            case 'Model Version':
                groupValue = model.json && model.json['model version'] ? model.json['model version'] : 'No Version';
                break;
            case 'High/Low':
                groupValue = model.json && model.json['high low'] ? model.json['high low'] : 'Not Set';
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