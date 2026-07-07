// table-view.js - Handles table view display and functionality

// Import settings manager
import appSettings from './settings.js';
import { isBulkModeActive, toggleModelSelection, getSelectedModels } from './bulk-operations.js';
import { getFolderFromPath } from './model-utils.js';

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
                valueA = (a.json?.web_civitai_data?.['civitai name'] || a.json?.['civitai name'] || '').toLowerCase();
                valueB = (b.json?.web_civitai_data?.['civitai name'] || b.json?.['civitai name'] || '').toLowerCase();
                break;
            case 'Base Model':
                valueA = (a.baseModel || 'Unknown').toLowerCase();
                valueB = (b.baseModel || 'Unknown').toLowerCase();
                break;
            case 'SD Version':
                valueA = (a.json && a.json['sd version'] || 'Unknown').toLowerCase();
                valueB = (b.json && b.json['sd version'] || 'Unknown').toLowerCase();
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
                valueA = (a.json?.web_civitai_data?.['civitai text'] || a.json?.['civitai text'] || '').toLowerCase();
                valueB = (b.json?.web_civitai_data?.['civitai text'] || b.json?.['civitai text'] || '').toLowerCase();
                break;
            case 'Description':
                valueA = (a.json && a.json['description'] || '').toLowerCase();
                valueB = (b.json && b.json['description'] || '').toLowerCase();
                break;
            case 'Folder':
                valueA = getFolderFromPath(a).toLowerCase();
                valueB = getFolderFromPath(b).toLowerCase();
                break;
            case 'Subcategory':
                valueA = (a.json && a.json['subcategory'] || '').toLowerCase();
                valueB = (b.json && b.json['subcategory'] || '').toLowerCase();
                break;
            case 'Creator':
                valueA = (a.json && (a.json?.web_civitai_data?.['creator'] || a.json['creator']) || '').toLowerCase();
                valueB = (b.json && (b.json?.web_civitai_data?.['creator'] || b.json['creator']) || '').toLowerCase();
                break;
            case 'Example Prompt':
                valueA = (a.json && (a.json['example prompt 1'] || a.json['example prompt']) || '').toLowerCase();
                valueB = (b.json && (b.json['example prompt 1'] || b.json['example prompt']) || '').toLowerCase();
                break;
            case 'Tags':
                valueA = (a.json && a.json['tags'] || '').toLowerCase();
                valueB = (b.json && b.json['tags'] || '').toLowerCase();
                break;
            case 'Notes':
                valueA = (a.json && a.json['notes'] || '').toLowerCase();
                valueB = (b.json && b.json['notes'] || '').toLowerCase();
                break;
            case 'Model Name':
                valueA = (a.json && a.json['name'] || '').toLowerCase();
                valueB = (b.json && b.json['name'] || '').toLowerCase();
                break;
            case 'Model Version':
                valueA = (a.json && a.json['model version'] || '').toLowerCase();
                valueB = (b.json && b.json['model version'] || '').toLowerCase();
                break;
            case 'High/Low':
                valueA = (a.json && a.json['high low'] || '').toLowerCase();
                valueB = (b.json && b.json['high low'] || '').toLowerCase();
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

// Helper function to group models by a property (shared logic with grid-group-view)
function groupModelsByProperty(models, property) {
    const groups = {};

    models.forEach(model => {
        let groupValue;

        switch (property) {
            case 'Category':
                groupValue = model.category || 'Uncategorized';
                break;
            case 'Civitai Name':
                groupValue = model.json?.web_civitai_data?.['civitai name'] || model.json?.['civitai name'] || model.json?.['author name'] || 'Unknown Author';
                break;
            case 'Base Model':
                groupValue = model.baseModel || 'Unknown';
                break;
            case 'SD Version':
                groupValue = (model.json && model.json['sd version']) || 'Unknown';
                break;
            case 'Subcategory':
                groupValue = model.json && model.json['subcategory'] ? model.json['subcategory'] : 'Uncategorized';
                break;
            case 'Folder':
                groupValue = getFolderFromPath(model) || 'Uncategorized';
                break;
            case 'Creator':
                const modelCreator = model.json?.web_civitai_data?.['creator'] || model.json?.['creator'];
                groupValue = modelCreator ? modelCreator : 'Unknown Creator';
                break;
            case 'Tags':
                groupValue = model.json && model.json['tags'] ?
                    (model.json['tags'].split(',')[0].trim() || 'No Tags') : 'No Tags';
                break;
            case 'NSFW':
                groupValue = model.json && model.json['nsfw'] === 'true' ? 'NSFW' : 'Safe';
                break;
            case 'Size':
                const sizeInMB = model.size / (1024 * 1024);
                if (sizeInMB < 10) groupValue = 'Less than 10MB';
                else if (sizeInMB < 50) groupValue = '10MB - 50MB';
                else if (sizeInMB < 100) groupValue = '50MB - 100MB';
                else groupValue = 'Over 100MB';
                break;
            case 'Date':
                const date = new Date(model.dateModified * 1000);
                groupValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
                break;
            case 'Path':
                if (model.path) {
                    const modelsDir = appSettings.getSetting('modelsDirectory').replace(/\\/g, '/');
                    const fullPath = model.path.replace(/\\/g, '/');
                    let relativePath = fullPath;
                    if (modelsDir && fullPath.startsWith(modelsDir)) {
                        relativePath = fullPath.substring(modelsDir.length);
                        if (relativePath.startsWith('/')) {
                            relativePath = relativePath.substring(1);
                        }
                    }
                    const lastSlashIndex = relativePath.lastIndexOf('/');
                    if (lastSlashIndex !== -1) {
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

        if (!groups[groupValue]) {
            groups[groupValue] = [];
        }
        groups[groupValue].push(model);
    });

    return groups;
}

export function displayTableView(models, container, openModelDetails, settings, groupBy = 'none') {
    if (!container) {
        console.error('Container element is required for table view');
        return;
    }
    container.className = 'table-view-container';
    const bulkMode = isBulkModeActive();

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
        'SD Version': 'sdVersion',
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
        'Notes': 'notes',
        'Model Name': 'modelName',
        'Model Version': 'modelVersion',
        'High/Low': 'highLow'
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

    // In bulk mode, add checkbox column at the beginning
    if (bulkMode) {
        const checkboxTh = document.createElement('th');
        checkboxTh.textContent = '✓';
        checkboxTh.style.width = '40px';
        checkboxTh.style.textAlign = 'center';
        headerRow.appendChild(checkboxTh);
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

    // Initial table body (with grouping support)
    displayTableBody(models, table, openModelDetails, columns, bulkMode, groupBy);
    container.appendChild(table);
}

function displayTableBody(models, table, openModelDetails, columns, bulkMode = false, groupBy = 'none') {
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
        rootMargin: '100px 0px',
        threshold: 0.1
    });

    // Calculate total columns for group header colspan
    const totalColumns = columns.length + (bulkMode ? 1 : 0);

    // Helper function to create a table row for a model
    function createModelRow(model) {
        const row = document.createElement('tr');
        row.dataset.id = model.id;

        // In bulk mode, add checkbox cell at the beginning
        if (bulkMode) {
            const checkboxCell = document.createElement('td');
            checkboxCell.style.textAlign = 'center';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-table-checkbox';
            checkbox.checked = getSelectedModels().some(m => m.id === model.id);
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleModelSelection(model.id);
            });
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);
        }

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
                    imageObserver.observe(img);
                    break;
                case 'Filename':
                    cell.textContent = model.filename.replace(/\.safetensors$/i, '');
                    break;
                case 'Civitai Name':
                    cell.textContent = model.json?.web_civitai_data?.['civitai name'] || model.json?.['civitai name'] || '';
                    break;
                case 'Base Model':
                    cell.textContent = model.baseModel || 'Unknown';
                    break;
                case 'SD Version':
                    cell.textContent = (model.json && model.json['sd version']) || '';
                    break;
                case 'Category':
                    cell.textContent = model.category || 'Uncategorized';
                    break;
                case 'Path':
                    const fullPath = model.path.replace(/\\/g, '/');
                    const pathDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
                    const modelsDir = appSettings.getSetting('modelsDirectory').replace(/\\/g, '/');
                    let relativePath = pathDir;
                    if (modelsDir && pathDir.startsWith(modelsDir)) {
                        relativePath = pathDir.substring(modelsDir.length);
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
                    const modelUrl = model.civitaiInfo?.modelUrl || model.json?.url || '';
                    if (modelUrl) {
                        const link = document.createElement('a');
                        link.href = modelUrl;
                        link.target = '_blank';
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
                    cell.textContent = model.json?.web_civitai_data?.['civitai text'] || model.json?.['civitai text'] || '';
                    break;
                case 'Description':
                    const desc = model.json?.['description'] || '';
                    cell.textContent = desc.length > 50 ? `${desc.substring(0, 50)}...` : desc;
                    break;
                case 'Folder':
                    cell.textContent = getFolderFromPath(model);
                    break;
                case 'Subcategory':
                    cell.textContent = model.json?.['subcategory'] || '';
                    break;
                case 'Creator':
                    cell.textContent = model.json?.web_civitai_data?.['creator'] || model.json?.['creator'] || '';
                    break;
                case 'Example Prompt':
                    const prompt = model.json?.['example prompt 1'] || model.json?.['example prompt'] || '';
                    cell.textContent = prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt;
                    break;
                case 'Tags':
                    cell.textContent = model.json?.['tags'] || '';
                    break;
                case 'Notes':
                    const notes = model.json?.['notes'] || '';
                    cell.textContent = notes.length > 50 ? `${notes.substring(0, 50)}...` : notes;
                    break;
                case 'Model Name':
                    cell.textContent = model.json?.['name'] || '';
                    break;
                case 'Model Version':
                    cell.textContent = model.json?.['model version'] || '';
                    break;
                case 'High/Low':
                    cell.textContent = model.json?.['high low'] || '';
                    break;
            }

            row.appendChild(cell);
        });

        // In bulk mode, clicking row toggles selection; otherwise opens details
        if (bulkMode) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                toggleModelSelection(model.id);
                const checkbox = row.querySelector('.bulk-table-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
            });
        } else {
            row.addEventListener('click', () => openModelDetails(model));
        }

        return row;
    }

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

    // If grouping is enabled, render with group headers
    if (groupBy && groupBy !== 'none') {
        const groupedModels = groupModelsByProperty(models, groupBy);

        // Sort the groups (hierarchically for folder/path, chronologically for Date, alphabetically for others)
        let sortedGroups;
        if (groupBy === 'Date') {
            sortedGroups = Object.keys(groupedModels).sort((a, b) => {
                const [monthA, yearA] = a.split(' ');
                const [monthB, yearB] = b.split(' ');
                const yearDiff = parseInt(yearB) - parseInt(yearA);
                if (yearDiff !== 0) return yearDiff;
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                return months.indexOf(monthB) - months.indexOf(monthA);
            });
        } else if (groupBy === 'Folder' || groupBy === 'Path') {
            // For Folder and Path groupings, sort hierarchically so subfolders appear after parent folders
            sortedGroups = sortFoldersHierarchically(Object.keys(groupedModels));
        } else {
            sortedGroups = Object.keys(groupedModels).sort();
        }

        // Render each group with a header row
        sortedGroups.forEach(groupName => {
            // Create group header row
            const headerRow = document.createElement('tr');
            headerRow.className = 'table-group-header';
            const headerCell = document.createElement('td');
            headerCell.colSpan = totalColumns;
            headerCell.innerHTML = `<strong>${groupName}</strong> <span class="group-count">(${groupedModels[groupName].length})</span>`;
            headerRow.appendChild(headerCell);
            tbody.appendChild(headerRow);

            // Add model rows for this group
            groupedModels[groupName].forEach(model => {
                tbody.appendChild(createModelRow(model));
            });
        });
    } else {
        // No grouping - render all models normally
        models.forEach(model => {
            tbody.appendChild(createModelRow(model));
        });
    }

    table.appendChild(tbody);
}
