// table-view.js - Handles table view display and functionality

// Import settings manager
import appSettings from './settings.js';

// Function to display models in table view

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

let currentSortColumn = null;
let currentSortDirection = 'asc';

function sortModels(models, column) {
    return [...models].sort((a, b) => {
        let valueA, valueB;

        switch (column) {
            case 'Preview':
                return 0; // Don't sort by preview
            case 'Filename':
                valueA = a.filename.replace(/\.safetensors$/i, '').toLowerCase();
                valueB = b.filename.replace(/\.safetensors$/i, '').toLowerCase();
                break;
            case 'Civitai Name':
                valueA = (a.json && a.json['civitai name'] || '').toLowerCase();
                valueB = (b.json && b.json['civitai name'] || '').toLowerCase();
                break;
            case 'Base Model':
                valueA = (a.baseModel || 'Unknown').toLowerCase();
                valueB = (b.baseModel || 'Unknown').toLowerCase();
                break;
            case 'Category':
                valueA = (a.category || 'Uncategorized').toLowerCase();
                valueB = (b.category || 'Uncategorized').toLowerCase();
                break;
            case 'Path':
                valueA = a.path.toLowerCase();
                valueB = b.path.toLowerCase();
                break;
            case 'Size':
                valueA = a.size;
                valueB = b.size;
                return currentSortDirection === 'asc' ? valueA - valueB : valueB - valueA;
            case 'Date':
                valueA = a.dateModified;
                valueB = b.dateModified;
                return currentSortDirection === 'asc' ? valueA - valueB : valueB - valueA;
            case 'NSFW':
                valueA = (a.json && a.json['nsfw'] === 'true') ? 1 : 0;
                valueB = (b.json && b.json['nsfw'] === 'true') ? 1 : 0;
                return currentSortDirection === 'asc' ? valueA - valueB : valueB - valueA;
            case 'Positive Words':
                valueA = (a.json && a.json['activation text'] || '').toLowerCase();
                valueB = (b.json && b.json['activation text'] || '').toLowerCase();
                break;
            case 'Negative Words':
                valueA = (a.json && a.json['negative text'] || '').toLowerCase();
                valueB = (b.json && b.json['negative text'] || '').toLowerCase();
                break;
            case "Civitai Words":
                valueA = (a.json && a.json['civitai text'] || '').toLowerCase();
                valueB = (b.json && b.json['civitai text'] || '').toLowerCase();
                break;
            case 'Description':
                valueA = (a.json && a.json['description'] || '').toLowerCase();
                valueB = (b.json && b.json['description'] || '').toLowerCase();
                break;
            case 'Folder':
                valueA = (a.json && a.json['folder'] || '').toLowerCase();
                valueB = (b.json && b.json['folder'] || '').toLowerCase();
                break;
            case 'Subcategory':
                valueA = (a.json && a.json['subcategory'] || '').toLowerCase();
                valueB = (b.json && b.json['subcategory'] || '').toLowerCase();
                break;
            case 'Creator':
                valueA = (a.json && a.json['creator'] || '').toLowerCase();
                valueB = (b.json && b.json['creator'] || '').toLowerCase();
                break;
            case 'Example Prompt':
                valueA = (a.json && a.json['example prompt'] || '').toLowerCase();
                valueB = (b.json && b.json['example prompt'] || '').toLowerCase();
                break;
            case 'Tags':
                valueA = (a.json && a.json['tags'] || '').toLowerCase();
                valueB = (b.json && b.json['tags'] || '').toLowerCase();
                break;
            case 'Notes':
                valueA = (a.json && a.json['notes'] || '').toLowerCase();
                valueB = (b.json && b.json['notes'] || '').toLowerCase();
                break;
            default:
                return 0;
        }

        if (currentSortDirection === 'asc') {
            return valueA.localeCompare(valueB);
        } else {
            return valueB.localeCompare(valueA);
        }
    });
}

export function displayTableView(models, container, openModelDetails, settings) {
    if (!container) {
        console.error('Container element is required for table view');
        return;
    }
    container.className = 'table-view-container';

    if (!Array.isArray(models)) {
        console.error('Models must be an array');
        return;
    }

    if (models.length === 0) {
        container.innerHTML = `
            <div class="placeholder-message">
                <p>No models match your search criteria.</p>
            </div>
        `;
        return;
    }

    // Calculate statistics for info box
    const totalSize = models.reduce((sum, model) => sum + (model.size || 0), 0);
    const totalCount = models.length;

    // Get visible columns from settings with proper error checking
    const visibleColumns = settings?.visibleColumns || {};
    const columnMappings = {
        'Preview': 'thumbnail',
        'Filename': 'filename',
        'Civitai Name': 'civitaiName',
        'Base Model': 'baseModel',
        'Category': 'category',
        'Subcategory': 'subcategory',
        'Folder': 'folder',
        'Path': 'path',
        'Creator': 'creator',
        'Size': 'size',
        'Date': 'date',
        'URL': 'url',
        'Tags': 'tags',
        'NSFW': 'nsfw',
        'Positive Words': 'positiveWords',
        'Negative Words': 'negativeWords',
        "Civitai Words": 'civitaiWords',
        'Example Prompt': 'examplePrompt',
        'Description': 'description',
        'Notes': 'notes'
    };

    const table = document.createElement('table');
    table.className = 'table-view';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Filter and order columns based on visibility settings and column order
    let columns = [];

    // Use column order from settings if available
    if (settings.columnOrder && Array.isArray(settings.columnOrder)) {
        // Create a reverse mapping from setting key to column name
        const reverseMapping = {};
        Object.entries(columnMappings).forEach(([column, settingKey]) => {
            reverseMapping[settingKey] = column;
        });

        // Filter and order columns based on the saved order
        columns = settings.columnOrder
            .filter(settingKey => visibleColumns[settingKey] === true)
            .map(settingKey => reverseMapping[settingKey])
            .filter(column => column); // Remove any undefined values
    } else {
        // Fallback to the old method if no column order is available
        columns = Object.entries(columnMappings)
            .filter(([_, settingKey]) => visibleColumns[settingKey] === true)
            .map(([column]) => column);
    }

    if (columns.length === 0) {
        console.warn('No visible columns configured');
        container.innerHTML = `
            <div class="placeholder-message">
                <p>No columns are configured to be visible. Please check your settings.</p>
            </div>
        `;
        return;
    }

    columns.forEach(column => {
        const th = document.createElement('th');
        th.innerHTML = `${column} <span class="sort-indicator"></span>`;
        th.addEventListener('click', () => {
            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'asc';
            }

            // Update sort indicators
            document.querySelectorAll('.table-view th').forEach(header => {
                header.querySelector('.sort-indicator').textContent = '';
            });
            th.querySelector('.sort-indicator').textContent = currentSortDirection === 'asc' ? ' ↑' : ' ↓';

            // Create a sort option string for the global sort dropdown
            const sortOption = `column:${column}:${currentSortDirection}`;

            // Update the global sort dropdown if it exists
            const sortSelect = document.getElementById('sort-select');
            if (sortSelect) {
                // Check if we already have this option
                let optionExists = false;
                for (let i = 0; i < sortSelect.options.length; i++) {
                    if (sortSelect.options[i].value === sortOption) {
                        sortSelect.selectedIndex = i;
                        optionExists = true;
                        break;
                    }
                }

                // If the option doesn't exist, add it temporarily
                if (!optionExists) {
                    const newOption = document.createElement('option');
                    newOption.value = sortOption;
                    newOption.text = `${column} (${currentSortDirection === 'asc' ? 'A-Z' : 'Z-A'})`;
                    sortSelect.add(newOption);
                    sortSelect.value = sortOption;
                }

                // Trigger the change event to update the global sort
                const event = new Event('change');
                sortSelect.dispatchEvent(event);
            } else {
                // If no global sort dropdown, just sort and redisplay
                const sortedModels = sortModels(models, column);
                displayTableBody(sortedModels, table, openModelDetails, columns);
            }
        });
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create and add info box at the top
    const infoBox = document.createElement('div');
    infoBox.className = 'table-info-box';
    infoBox.innerHTML = `
        <div class="info-item">
            <span class="info-label">Total Models:</span>
            <span class="info-value">${totalCount}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Total Size:</span>
            <span class="info-value">${formatFileSize(totalSize)}</span>
        </div>
    `;
    container.appendChild(infoBox);

    // Initial table body
    displayTableBody(models, table, openModelDetails, columns);
    container.appendChild(table);
}

function displayTableBody(models, table, openModelDetails, columns) {
    // Remove existing tbody if it exists
    const existingTbody = table.querySelector('tbody');
    if (existingTbody) {
        existingTbody.remove();
    }

    // Create new tbody
    const tbody = document.createElement('tbody');

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
        const row = document.createElement('tr');
        row.dataset.id = model.id;

        // Add cells based on visible columns
        columns.forEach(column => {
            const cell = document.createElement('td');

            switch (column) {
                case 'Preview':
                    const thumbnail = document.createElement('div');
                    thumbnail.className = 'thumbnail';
                    const img = document.createElement('img');
                    img.src = '/assets/placeholder.png';
                    img.setAttribute('data-src', model.previewUrl || '/assets/placeholder.png');
                    img.alt = model.filename;
                    img.className = 'lazy-image';
                    thumbnail.appendChild(img);
                    cell.appendChild(thumbnail);
                    // Observe the image for lazy loading
                    imageObserver.observe(img);
                    break;
                case 'Filename':
                    cell.textContent = model.filename.replace(/\.safetensors$/i, '');
                    break;
                case 'Civitai Name':
                    cell.textContent = model.json?.['civitai name'] || '';
                    break;
                case 'Base Model':
                    cell.textContent = model.baseModel || 'Unknown';
                    break;
                case 'Category':
                    cell.textContent = model.category || 'Uncategorized';
                    break;
                case 'Path':
                    // Simplify path display to show just the folder structure
                    const fullPath = model.path.replace(/\\/g, '/');
                    // Get the directory part of the path (remove filename)
                    const pathDir = fullPath.substring(0, fullPath.lastIndexOf('/'));

                    // Get the models directory from settings
                    const modelsDir = appSettings.getSetting('modelsDirectory').replace(/\\/g, '/');

                    // Create relative path by removing the models directory prefix
                    let relativePath = pathDir;
                    if (modelsDir && pathDir.startsWith(modelsDir)) {
                        relativePath = pathDir.substring(modelsDir.length);
                        // Remove leading slash if present
                        if (relativePath.startsWith('/')) {
                            relativePath = relativePath.substring(1);
                        }
                    }

                    cell.textContent = relativePath || 'Root';
                    break;
                case 'Size':
                    cell.textContent = formatFileSize(model.size);
                    break;
                case 'Date':
                    cell.textContent = new Date(model.dateModified * 1000).toLocaleDateString();
                    break;
                case 'URL':
                    cell.className = 'url-cell';
                    // Check for URL in civitaiInfo first, then in model.json
                    const modelUrl = model.civitaiInfo?.modelUrl || model.json?.url || '';
                    if (modelUrl) {
                        const link = document.createElement('a');
                        link.href = modelUrl;
                        link.target = '_blank';
                        // Add both icon and text for better visibility
                        const icon = document.createElement('i');
                        icon.className = 'fas fa-external-link-alt';
                        icon.title = 'View on Civitai';
                        link.appendChild(icon);
                        link.appendChild(document.createTextNode(' Civitai'));
                        cell.appendChild(link);
                    }
                    break;
                case 'NSFW':
                    cell.textContent = model.json?.['nsfw'] === 'true' ? 'Yes' : 'No';
                    break;
                case 'Positive Words':
                    cell.textContent = model.json?.['activation text'] || '';
                    break;
                case 'Negative Words':
                    cell.textContent = model.json?.['negative text'] || '';
                    break;
                case "Civitai Words":
                    cell.textContent = model.json?.['civitai text'] || '';
                    break;
                case 'Description':
                    const desc = model.json?.['description'] || '';
                    cell.textContent = desc.length > 50 ? `${desc.substring(0, 50)}...` : desc;
                    break;
                case 'Folder':
                    cell.textContent = model.json?.['folder'] || '';
                    break;
                case 'Subcategory':
                    cell.textContent = model.json?.['subcategory'] || '';
                    break;
                case 'Creator':
                    cell.textContent = model.json?.['creator'] || '';
                    break;
                case 'Example Prompt':
                    const prompt = model.json?.['example prompt'] || '';
                    cell.textContent = prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt;
                    break;
                case 'Tags':
                    cell.textContent = model.json?.['tags'] || '';
                    break;
                case 'Notes':
                    const notes = model.json?.['notes'] || '';
                    cell.textContent = notes.length > 50 ? `${notes.substring(0, 50)}...` : notes;
                    break;
            }

            row.appendChild(cell);
        });

        row.addEventListener('click', () => openModelDetails(model));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
}
