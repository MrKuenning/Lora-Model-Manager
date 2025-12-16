// script.js (Browser Version with Python Server)

// Import modules
import appSettings, { Settings } from './settings.js';
import { displayGridView } from './grid-view.js';
import { displayTableView } from './table-view.js';
import { displayGroupedGridView } from './grid-group-view.js';
import { filterModelsByQuery } from './search-parser.js';
import { initializeImageDropZone, handleImageDrop } from './drop-zone-functions.js';
import { showLoadingOverlay, hideLoadingOverlay } from './ui-utils.js';
import * as ModelOps from './model-operations.js';
import * as CivitaiAPI from './civitai-api.js';

// DOM Elements
const modelsContainer = document.getElementById('models-container');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const groupSelect = document.getElementById('group-select');
const modelFilterSelect = document.getElementById('model-filter-select');
const gridViewBtn = document.getElementById('grid-view-btn');
const tableViewBtn = document.getElementById('table-view-btn');
const refreshBtn = document.getElementById('refresh-btn');
const modelModal = document.getElementById('model-modal');
const closeModal = document.querySelector('.close-modal');
const settingsBtn = document.getElementById('settingsButton');
const civitaiScanBtn = document.getElementById('civitaiScanButton');
const settingsModal = document.getElementById('settingsModal');
const safemodeToggle = document.getElementById('safemodeToggle');
const modelsDirectoryInput = document.getElementById('modelsDirectoryInput');
const browseDirectoryBtn = document.getElementById('browse-directory');
const saveSettingsBtn = document.getElementById('save-settings');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalPreview = document.getElementById('modal-preview');
const modelFilename = document.getElementById('model-filename');
const modelPath = document.getElementById('model-path');
const modelSize = document.getElementById('model-size');
const modelDate = document.getElementById('model-date');
const editFilenameBtn = document.getElementById('edit-filename-btn');
const saveFilenameBtn = document.getElementById('save-filename-btn');
const jsonEditor = document.getElementById('json-editor');
const saveJsonBtn = document.getElementById('save-json-btn');
const refreshJsonBtn = document.getElementById('refresh-json-btn');
const modelJsonBtn = document.getElementById('model-json-btn');
const civitaiJsonBtn = document.getElementById('civitai-json-btn');
const preferredWeightSlider = document.getElementById('model-preferred-weight');
const preferredWeightValue = document.getElementById('preferred-weight-value');

// Application State
let models = [];
export let currentModel = null;
let currentView = appSettings.getSetting('defaultView');
let currentSort = appSettings.getSetting('defaultSort');
let currentGroupBy = 'none'; // Default to no grouping
let currentModelFilter = 'all'; // Default to show all models
let searchTerm = '';
let currentJsonType = 'model'; // 'model' or 'civitai'
let selectedThumbnailIndex = 0; // Currently selected thumbnail (0-based for preview-thumb elements)

// Initialize settings
const settingsManager = appSettings;


// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
searchInput.addEventListener('input', handleSearch);
sortSelect.addEventListener('change', handleSort);
groupSelect.addEventListener('change', handleGroupChange);
modelFilterSelect.addEventListener('change', handleModelFilterChange);
gridViewBtn.addEventListener('click', () => switchView('grid'));
tableViewBtn.addEventListener('click', () => switchView('table'));
refreshBtn.addEventListener('click', refreshModels);
closeModal.addEventListener('click', closeModelModal);

// Refresh button in modal
document.addEventListener('DOMContentLoaded', () => {
    const refreshModelBtn = document.getElementById('refresh-model-btn');
    if (refreshModelBtn) {
        refreshModelBtn.addEventListener('click', refreshModelData);
    }
});

// Add event listener to close modal when clicking outside of it
modelModal.addEventListener('click', function (event) {
    // Check if the click is directly on the modal background (not on modal content)
    if (event.target === modelModal) {
        closeModelModal();
    }
});
// No need for edit filename button event listener as the button no longer exists
saveFilenameBtn.addEventListener('click', saveFilename);
saveJsonBtn.addEventListener('click', saveJsonMetadata);
refreshJsonBtn.addEventListener('click', refreshModelData);
modelJsonBtn.addEventListener('click', () => switchJsonType('model'));
civitaiJsonBtn.addEventListener('click', () => switchJsonType('civitai'));

// Toggle JSON editor collapse/expand
document.getElementById('toggle-json-editor').addEventListener('click', () => {
    const jsonEditorContent = document.getElementById('json-editor-content');
    const toggleBtn = document.getElementById('toggle-json-editor');
    const isCollapsed = jsonEditorContent.style.display === 'none';

    jsonEditorContent.style.display = isCollapsed ? 'block' : 'none';

    // Rotate the chevron icon
    const icon = toggleBtn.querySelector('i');
    if (isCollapsed) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
});

// Preferred Weight slider event listener to update display value
preferredWeightSlider.addEventListener('input', function () {
    preferredWeightValue.textContent = parseFloat(this.value).toFixed(1);
});

// No need for edit button event listeners as fields are always editable

// Add event listeners for save buttons
document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
        const infoRow = this.closest('.info-row');
        const field = infoRow.querySelector('.editable-field');
        const fieldId = field.id;

        // Get the field value
        const value = field.type === 'checkbox' ? field.checked : field.value;

        // Update the model object based on field ID
        switch (fieldId) {
            case 'model-author':
                currentModel.json['civitai name'] = value;
                break;
            case 'model-basemodel':
                currentModel.baseModel = value;
                break;
            case 'model-category':
                currentModel.category = value;
                currentModel.json['category'] = value;
                break;
            case 'model-nsfw':
                currentModel.json['nsfw'] = value.toString();
                break;
            case 'model-positive':
                currentModel.json['activation text'] = value;
                break;
            case 'model-negative':
                currentModel.json['negative text'] = value;
                break;
            case 'model-authors':
                currentModel.json['civitai text'] = value;
                break;
            case 'model-description':
                currentModel.json['description'] = value;
                break;
            case 'model-notes':
                currentModel.json['notes'] = value;
                break;
            case 'model-folder':
                currentModel.json['folder'] = value;
                break;
            case 'model-subcategory':
                currentModel.json['subcategory'] = value;
                break;
            case 'model-creator':
                currentModel.json['creator'] = value;
                break;
            case 'model-example-prompt':
                currentModel.json['example prompt'] = value;
                break;
            case 'model-tags':
                currentModel.json['tags'] = value;
                break;
        }

        try {
            // Save changes to server
            const response = await fetch('/save-model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentModel)
            });

            if (!response.ok) {
                throw new Error('Failed to save changes');
            }

            // Fields remain editable - no need to disable them

            // Refresh the display
            refreshModels();

        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Failed to save changes. Please try again.');
        }
    });
});

// Settings button event listener
settingsBtn.addEventListener('click', openSettingsModal);

// Civitai Scan button event listener
civitaiScanBtn.addEventListener('click', () => {
    window.location.href = 'civitai-scan.html';
});

// Close settings modal when clicking the X
settingsModal.querySelector('.close-modal').addEventListener('click', closeSettingsModal);

// Add event listener to close settings modal when clicking outside of it
settingsModal.addEventListener('click', function (event) {
    // Check if the click is directly on the modal background (not on modal content)
    if (event.target === settingsModal) {
        closeSettingsModal();
    }
});

// Save settings button
saveSettingsBtn.addEventListener('click', saveSettings);

// Cancel settings button
cancelSettingsBtn.addEventListener('click', closeSettingsModal);

// SafeMode toggle event listener
safemodeToggle.addEventListener('change', async function () {
    const isEnabled = this.checked;

    // Update the hideNSFW setting
    settingsManager.setSetting('hideNSFW', isEnabled);

    // Save settings to server
    await settingsManager.saveSettings();

    // Reload the page to apply the filter
    window.location.reload();
});


async function openSettingsModal() {
    console.log("Open Settings Modal");

    // Fetch the latest settings from the server before opening the modal
    try {
        const response = await fetch('/load-settings');
        if (response.ok) {
            const serverSettings = await response.json();
            // Update the settings manager with server settings
            settingsManager.settings = serverSettings;
            console.log('Settings loaded from server for modal:', serverSettings);
        }
    } catch (error) {
        console.error('Error loading settings from server for modal:', error);
    }

    settingsModal.style.display = 'block'; // Show the modal

    // Populate all settings fields with the latest settings
    const settings = settingsManager.getAllSettings();

    // Initialize column order if it doesn't exist
    if (!settings.columnOrder) {
        settings.columnOrder = [
            'thumbnail', 'filename', 'civitaiName', 'baseModel', 'category',
            'folder', 'subcategory', 'creator', 'examplePrompt', 'tags',
            'path', 'size', 'date', 'url', 'nsfw', 'positiveWords',
            'negativeWords', 'authorsWords', 'description', 'notes'
        ];
    }

    // Reorder the column list based on saved order
    const columnList = document.getElementById('sortable-columns');
    const columnItems = Array.from(columnList.children);

    // Sort the column items based on the saved order
    columnItems.sort((a, b) => {
        const aIndex = settings.columnOrder.indexOf(a.dataset.columnKey);
        const bIndex = settings.columnOrder.indexOf(b.dataset.columnKey);
        // If not found in the order array, put at the end
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    // Remove all items and add them back in the correct order
    columnItems.forEach(item => columnList.removeChild(item));
    columnItems.forEach(item => columnList.appendChild(item));

    // Initialize drag and drop functionality
    initDragAndDrop();

    // Models directory
    modelsDirectoryInput.value = settings.modelsDirectory || '';

    // Theme
    document.getElementById('theme-' + (settings.theme || 'dark')).checked = true;

    // Default view
    document.getElementById('default-view-' + (settings.defaultView || 'grid')).checked = true;

    // Default sort
    document.getElementById('default-sort-select').value = settings.defaultSort || 'name-asc';

    // Hide NSFW
    document.getElementById('hideNSFW').checked = settings.hideNSFW || false;

    // Visible columns
    const columns = settings.visibleColumns || {};
    document.getElementById('col-thumbnail').checked = columns.thumbnail !== false;
    document.getElementById('col-filename').checked = columns.filename !== false;
    document.getElementById('col-author').checked = columns.civitaiName !== false;
    document.getElementById('col-basemodel').checked = columns.baseModel !== false;
    document.getElementById('col-category').checked = columns.category !== false;
    document.getElementById('col-folder').checked = columns.folder !== false;
    document.getElementById('col-subcategory').checked = columns.subcategory !== false;
    document.getElementById('col-creator').checked = columns.creator !== false;
    document.getElementById('col-examplePrompt').checked = columns.examplePrompt !== false;
    document.getElementById('col-tags').checked = columns.tags !== false;
    document.getElementById('col-path').checked = columns.path !== false;
    document.getElementById('col-size').checked = columns.size !== false;
    document.getElementById('col-date').checked = columns.date !== false;
    document.getElementById('col-url').checked = columns.url !== false;
    document.getElementById('col-nsfw').checked = columns.nsfw !== false;
    document.getElementById('col-positive').checked = columns.positiveWords !== false;
    document.getElementById('col-negative').checked = columns.negativeWords !== false;
    document.getElementById('col-authors').checked = columns.authorsWords !== false;
    document.getElementById('col-description').checked = columns.description !== false;
}

function closeSettingsModal() {
    console.log("Close Settings Modal");
    settingsModal.style.display = 'none'; // Hide the modal
}

// Initialize drag and drop for column ordering
function initDragAndDrop() {
    const columnList = document.getElementById('sortable-columns');
    const items = columnList.querySelectorAll('li');

    let draggedItem = null;

    items.forEach(item => {
        // Handle drag start
        item.addEventListener('dragstart', function () {
            draggedItem = this;
            setTimeout(() => {
                this.classList.add('dragging');
            }, 0);
        });

        // Handle drag end
        item.addEventListener('dragend', function () {
            this.classList.remove('dragging');
            draggedItem = null;
        });

        // Make items draggable
        item.setAttribute('draggable', 'true');

        // Make the grip icon also trigger dragging
        const gripIcon = item.querySelector('i');
        if (gripIcon) {
            gripIcon.addEventListener('mousedown', function (e) {
                // Prevent default to avoid text selection
                e.preventDefault();
                // Trigger dragstart on the parent li
                const dragEvent = new MouseEvent('dragstart');
                item.dispatchEvent(dragEvent);
            });
        }

        // Handle drag over
        item.addEventListener('dragover', function (e) {
            e.preventDefault();
            if (draggedItem === this) return;

            const rect = this.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const height = rect.height;

            if (y < height / 2) {
                columnList.insertBefore(draggedItem, this);
            } else {
                columnList.insertBefore(draggedItem, this.nextSibling);
            }
        });
    });
}


// Initialize the application
async function initApp() {
    // Show loading overlay
    showLoadingOverlay();

    // Wait for settings to be fully loaded from server
    await ensureSettingsInitialized();

    // Update current view and sort from settings after they're loaded
    currentView = settingsManager.getSetting('defaultView');
    currentSort = settingsManager.getSetting('defaultSort');

    // Apply saved view preference
    switchView(currentView, false);

    // Set sort select value from settings
    sortSelect.value = currentSort;

    // Sync SafeMode toggle with hideNSFW setting
    const hideNSFW = settingsManager.getSetting('hideNSFW');
    safemodeToggle.checked = hideNSFW || false;

    closeSettingsModal();

    // Check if we have a saved directory path and load models
    const savedDirPath = settingsManager.getSetting('modelsDirectory');
    if (savedDirPath) {
        await loadModelsFromDirectory(savedDirPath);
    } else {
        // Hide loading overlay if no directory is set
        hideLoadingOverlay();
    }
}

// Ensure settings are properly initialized
async function ensureSettingsInitialized() {
    // Make sure the settings are loaded from server first
    try {
        // Force a fresh load from the server
        await settingsManager.loadSettings();
        const currentSettings = settingsManager.getAllSettings();
        console.log('Settings initialized from server:', currentSettings);
    } catch (error) {
        console.error('Error initializing settings:', error);
        // Fall back to whatever settings we have
        const currentSettings = settingsManager.getAllSettings();
        console.log('Settings initialized from fallback:', currentSettings);
    }
}

// Load models from the specified directory (wrapper for ModelOps)
async function loadModelsFromDirectory(dirPath) {
    try {
        models = await ModelOps.loadModelsFromDirectory(dirPath, modelsContainer);
        displayModels();
    } catch (error) {
        // Error already handled in  ModelOps
    }
}
// Refresh models (wrapper for ModelOps)
async function refreshModels() {
    await ModelOps.refreshModels(settingsManager, loadModelsFromDirectory, openSettingsModal);
}

// Display models based on current view, sort, and search
function displayModels() {
    // Clear the container
    modelsContainer.innerHTML = '';

    // If no models, show placeholder message
    if (models.length === 0) {
        modelsContainer.innerHTML = `
            <div class="placeholder-message">
                <p>No models loaded. Set your models directory in Settings to get started.</p>
            </div>
        `;
        return;
    }

    // Filter models based on search term and NSFW setting
    let filteredModels = models;

    // Apply NSFW filter if hideNSFW is enabled
    const hideNSFW = settingsManager.getSetting('hideNSFW');
    if (hideNSFW) {
        filteredModels = filteredModels.filter(model =>
            !(model.json && model.json['nsfw'] === 'true')
        );
    }

    // Apply search filter
    if (searchTerm) {
        // Check if the search term contains any of our special operators
        const hasAdvancedSyntax = /["!|<>]/.test(searchTerm);

        if (hasAdvancedSyntax) {
            // Use advanced search parser
            filteredModels = filterModelsByQuery(filteredModels, searchTerm);
        } else {
            // Use simple search for better performance when no special operators are used
            const searchLower = searchTerm.toLowerCase();
            filteredModels = filteredModels.filter(model =>
                model.name.toLowerCase().includes(searchLower) ||
                model.filename.toLowerCase().includes(searchLower) ||
                model.category.toLowerCase().includes(searchLower)
            );
        }
    }

    // Apply base model filter
    if (currentModelFilter !== 'all') {
        filteredModels = filteredModels.filter(model =>
            model.baseModel === currentModelFilter
        );
    }

    // Populate the model filter dropdown with unique base models
    populateModelFilter();

    // Sort models
    filteredModels = sortModels(filteredModels, currentSort);

    // Display models based on current view using imported modules
    if (currentView === 'grid') {
        // If grouping is enabled, use grouped grid view
        if (currentGroupBy !== 'none') {
            displayGroupedGridView(filteredModels, modelsContainer, openModelDetails, settingsManager.getAllSettings(), currentGroupBy);
        } else {
            displayGridView(filteredModels, modelsContainer, openModelDetails, settingsManager.getAllSettings());
        }
    } else {
        displayTableView(filteredModels, modelsContainer, openModelDetails, settingsManager.getAllSettings());
    }
}

// Sort models based on sort option
function sortModels(models, sortOption) {
    const sortedModels = [...models];

    // Handle table column sorting options
    if (sortOption.includes('column:')) {
        const [_, column, direction] = sortOption.split(':');
        // Use the table-view sorting logic
        return sortModelsByColumn(sortedModels, column, direction);
    }

    // Handle standard sort options
    switch (sortOption) {
        case 'name-asc':
            sortedModels.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            sortedModels.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'date-newest':
            sortedModels.sort((a, b) => b.dateModified - a.dateModified);
            break;
        case 'date-oldest':
            sortedModels.sort((a, b) => a.dateModified - b.dateModified);
            break;
        default:
            // Default to name ascending
            sortedModels.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortedModels;
}

// Sort models by column (using table-view logic)
function sortModelsByColumn(models, column, direction) {
    const sortDirection = direction || 'asc';

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
                valueA = (a.json && a.json['author name'] || '').toLowerCase();
                valueB = (b.json && b.json['author name'] || '').toLowerCase();
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
                return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
            case 'Date':
                valueA = a.dateModified;
                valueB = b.dateModified;
                return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
            case 'NSFW':
                valueA = (a.json && a.json['nsfw'] === 'true') ? 1 : 0;
                valueB = (b.json && b.json['nsfw'] === 'true') ? 1 : 0;
                return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
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
            default:
                return 0;
        }

        if (sortDirection === 'asc') {
            return valueA.localeCompare(valueB);
        } else {
            return valueB.localeCompare(valueA);
        }
    });
}

// Handle search input
function handleSearch(e) {
    searchTerm = e.target.value.trim();
    displayModels();
}

// Handle sort select change
function handleSort(e) {
    currentSort = e.target.value;
    settingsManager.setSetting('defaultSort', currentSort);
    displayModels();
}

// Handle group selection
function handleGroupChange(e) {
    currentGroupBy = e.target.value;
    displayModels();
}

// Handle model filter selection
function handleModelFilterChange(e) {
    currentModelFilter = e.target.value;
    displayModels();
}

// Populate model filter dropdown with unique base models
function populateModelFilter() {
    // Extract unique base models from the models array
    const baseModels = new Set();
    models.forEach(model => {
        const baseModel = model.baseModel || 'Unknown';
        baseModels.add(baseModel);
    });

    // Convert to array and sort alphabetically
    const sortedBaseModels = Array.from(baseModels).sort((a, b) => {
        // Put "Unknown" at the end
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return a.localeCompare(b);
    });

    // Save current selection
    const currentSelection = currentModelFilter;

    // Clear existing options except "All Models"
    modelFilterSelect.innerHTML = '<option value="all">All Models</option>';

    // Add options for each unique base model
    sortedBaseModels.forEach(baseModel => {
        const option = document.createElement('option');
        option.value = baseModel;
        option.textContent = baseModel;
        modelFilterSelect.appendChild(option);
    });

    // Restore selection if it still exists in the new list
    if (currentSelection !== 'all' && sortedBaseModels.includes(currentSelection)) {
        modelFilterSelect.value = currentSelection;
    } else if (currentSelection !== 'all') {
        // If the previously selected model no longer exists, reset to "all"
        currentModelFilter = 'all';
        modelFilterSelect.value = 'all';
    }
}


// Switch between grid and table view
function switchView(view, savePreference = true) {
    currentView = view;

    // Update button states
    if (view === 'grid') {
        gridViewBtn.classList.add('active');
        tableViewBtn.classList.remove('active');
    } else {
        tableViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    }

    // Save view preference if needed
    if (savePreference) {
        settingsManager.setSetting('defaultView', view);
    }

    // Display models with new view
    displayModels();
}

// Save settings (new implementation)
async function saveSettings() {
    // Get all settings from form
    const newSettings = {
        modelsDirectory: modelsDirectoryInput.value,
        theme: document.querySelector('input[name="theme"]:checked').value,
        defaultView: document.querySelector('input[name="defaultView"]:checked').value,
        defaultSort: document.getElementById('default-sort-select').value,
        hideNSFW: document.getElementById('hideNSFW').checked,
        visibleColumns: {
            thumbnail: document.getElementById('col-thumbnail').checked,
            filename: document.getElementById('col-filename').checked,
            civitaiName: document.getElementById('col-author').checked,
            baseModel: document.getElementById('col-basemodel').checked,
            category: document.getElementById('col-category').checked,
            folder: document.getElementById('col-folder').checked,
            subcategory: document.getElementById('col-subcategory').checked,
            creator: document.getElementById('col-creator').checked,
            examplePrompt: document.getElementById('col-examplePrompt').checked,
            tags: document.getElementById('col-tags').checked,
            path: document.getElementById('col-path').checked,
            size: document.getElementById('col-size').checked,
            date: document.getElementById('col-date').checked,
            url: document.getElementById('col-url').checked,
            nsfw: document.getElementById('col-nsfw').checked,
            positiveWords: document.getElementById('col-positive').checked,
            negativeWords: document.getElementById('col-negative').checked,
            authorsWords: document.getElementById('col-authors').checked,
            description: document.getElementById('col-description').checked,
            notes: document.getElementById('col-notes')?.checked || false
        },
        // Get column order from the sortable list
        columnOrder: Array.from(document.querySelectorAll('#sortable-columns li')).map(li => li.dataset.columnKey)
    }

    // Update all settings at once
    for (const key in newSettings) {
        settingsManager.settings[key] = newSettings[key];
    }

    // Save all settings
    const saveResult = await settingsManager.saveSettings();
    if (saveResult) {
        console.log('Settings saved successfully');
        closeSettingsModal();

        // Apply theme
        document.body.className = newSettings.theme;

        // Apply view
        switchView(newSettings.defaultView, false);

        // Apply sort
        currentSort = newSettings.defaultSort;
        sortSelect.value = currentSort;

        // Reload models if directory changed
        if (newSettings.modelsDirectory) {
            loadModelsFromDirectory(newSettings.modelsDirectory);
        }
    } else {
        console.log('Error saving settings');
    }
}

// Model Details Functions
function openModelDetails(model) {
    console.log('Open model details:', model);
    currentModel = model;

    // Get preview images array
    const previewImages = model.previewImages || (model.previewUrl ? [model.previewUrl] : []);

    // Generate carousel HTML for modal preview
    let modalPreviewHTML;
    if (previewImages.length > 1) {
        // Multiple images - create carousel
        const thumbnailsHTML = previewImages.map((url, index) =>
            `<img src="${url}" alt="${model.name} preview ${index + 1}" class="preview-thumb ${index === 0 ? 'active' : ''}" data-index="${index}">`
        ).join('');

        modalPreviewHTML = `
            <div class="preview-image-wrapper">
                <img id="model-preview-image" src="${previewImages[0]}" alt="${model.name}" class="preview-main-image" data-index="0">
                <div class="drop-target-indicator">
                    <i class="fas fa-upload"></i>
                    <span>Drop image to add</span>
                </div>
                <div class="image-drop-zone" id="image-drop-zone">
                    <div class="drop-zone-content">
                        <i class="fas fa-image"></i>
                        <p>Drop image here to add thumbnail</p>
                    </div>
                </div>
            </div>
            <div class="preview-thumbnails">
                ${thumbnailsHTML}
            </div>
            <div class="preview-management-buttons">
                <button id="set-default-preview-btn" class="preview-mgmt-btn star-btn" title="Set current image as default" disabled>
                    <i class="fas fa-star"></i> Set as Default
                </button>
                <button id="delete-preview-btn" class="preview-mgmt-btn delete-btn" title="Delete current image">
                    <i class="fas fa-times"></i> Delete
                </button>
            </div>
        `;
    } else {
        // Single or no image - simple display
        modalPreviewHTML = `
            <div class="preview-image-wrapper">
                <img id="model-preview-image" src="${previewImages[0] || '/assets/placeholder.png'}" alt="${model.name}">
                <div class="drop-target-indicator">
                    <i class="fas fa-upload"></i>
                    <span>Drop image to add</span>
                </div>
                <div class="image-drop-zone" id="image-drop-zone">
                    <div class="drop-zone-content">
                        <i class="fas fa-image"></i>
                        <p>Drop image here to add thumbnail</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Update only the preview section
    document.querySelector('#model-modal .model-preview').innerHTML = modalPreviewHTML;

    // Set modal title and subtitle
    modalTitle.textContent = model.name;

    // Create subtitle with Creator and Base Model
    const creator = model.json?.['creator'] || '';
    const baseModel = model.baseModel || 'Unknown';
    const subtitleParts = [];

    if (creator) {
        subtitleParts.push(creator);
    }
    if (baseModel && baseModel !== 'Unknown') {
        subtitleParts.push(baseModel);
    }

    modalSubtitle.textContent = subtitleParts.length > 0 ? subtitleParts.join(' • ') : '';

    // Set model info
    // Remove the extension from the filename for the editable field
    modelFilename.value = model.filename.replace(/\.safetensors$/, '');
    // Hide filename from path by getting directory path only
    const pathWithoutFilename = model.path.substring(0, model.path.lastIndexOf('\\'));

    // Get the models directory from settings
    const modelsDir = settingsManager.getSetting('modelsDirectory').replace(/\\/g, '/');

    // Convert path to forward slashes for consistency
    const fullPath = pathWithoutFilename.replace(/\\/g, '/');

    // Create relative path by removing the models directory prefix
    let relativePath = fullPath;
    if (modelsDir && fullPath.startsWith(modelsDir)) {
        relativePath = fullPath.substring(modelsDir.length);
        // Remove leading slash if present
        if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
        }
    }

    modelPath.textContent = relativePath || 'Root';
    modelSize.textContent = formatFileSize(model.size);
    modelDate.textContent = new Date(model.dateModified * 1000).toLocaleString();

    // Set URL in the non-editable section
    const modelUrl = model.json?.['url'] || '';
    const urlLink = document.getElementById('model-url-link');
    urlLink.href = modelUrl;
    urlLink.textContent = modelUrl;

    // Set associated files in the non-editable section
    const associatedFilesElement = document.getElementById('model-associated-files');
    if (model.associatedFiles && model.associatedFiles.length > 0) {
        associatedFilesElement.innerHTML = model.associatedFiles.map(file => `<li>${file}</li>`).join('');
    } else {
        associatedFilesElement.innerHTML = '<li>None</li>';
    }

    // Set author and base model in static info section
    document.getElementById('model-author-static').textContent = model.json?.['civitai name'] || '';
    document.getElementById('model-basemodel-static').textContent = model.baseModel || '';

    // Set editable fields
    document.getElementById('model-category').value = model.category || '';
    document.getElementById('model-nsfw').checked = model.json?.['nsfw'] === 'true';
    document.getElementById('model-positive').value = model.json?.['activation text'] || '';
    document.getElementById('model-negative').value = model.json?.['negative text'] || '';
    document.getElementById('model-authors').value = model.json?.['civitai text'] || '';
    document.getElementById('model-description').value = model.json?.['description'] || '';
    document.getElementById('model-notes').value = model.json?.['notes'] || '';
    document.getElementById('model-subcategory').value = model.json?.['subcategory'] || '';
    document.getElementById('model-creator').value = model.json?.['creator'] || '';
    document.getElementById('model-example-prompt').value = model.json?.['example prompt'] || '';
    document.getElementById('model-tags').value = model.json?.['tags'] || '';

    // Set preferred weight slider
    const preferredWeight = parseFloat(model.json?.['preferred weight']) || 0;
    preferredWeightSlider.value = preferredWeight;
    preferredWeightValue.textContent = preferredWeight.toFixed(1);

    // Populate file location dropdown
    populateFileLocationDropdown(relativePath || '');

    // All fields are editable by default, no need to disable them
    // Show save buttons
    document.querySelectorAll('.save-btn').forEach(btn => btn.classList.remove('hidden'));

    // Filename is always editable
    saveFilenameBtn.classList.remove('hidden');

    // Load JSON data
    switchJsonType(currentJsonType);

    // No need to attach event listeners to edit buttons as they no longer exist

    // Attach event listeners to save buttons in the modal
    modelModal.querySelectorAll('.save-btn').forEach(btn => {
        // Remove existing event listeners to prevent duplicates
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async function () {
            // Try to find the field in different container types
            const infoRow = this.closest('.info-row');
            const nsfwContainer = this.closest('.nsfw-checkbox-container');
            const preferredWeightContainer = this.closest('.preferred-weight-container');

            let field;
            if (infoRow) {
                field = infoRow.querySelector('.editable-field');
            } else if (nsfwContainer) {
                field = nsfwContainer.querySelector('.editable-field');
            } else if (preferredWeightContainer) {
                field = preferredWeightContainer.querySelector('.editable-field');
            }

            if (!field) {
                console.error('Could not find editable field');
                return;
            }

            const fieldId = field.id;

            // Get the field value
            const value = field.type === 'checkbox' ? field.checked : field.value;

            // Update the model object based on field ID
            switch (fieldId) {
                case 'model-author':
                    currentModel.json['author name'] = value;
                    break;
                case 'model-basemodel':
                    currentModel.baseModel = value;
                    break;
                case 'model-category':
                    currentModel.category = value;
                    currentModel.json['category'] = value;
                    break;
                case 'model-nsfw':
                    currentModel.json['nsfw'] = value.toString();
                    break;
                case 'model-positive':
                    currentModel.json['activation text'] = value;
                    break;
                case 'model-negative':
                    currentModel.json['negative text'] = value;
                    break;
                case 'model-authors':
                    currentModel.json['civitai text'] = value;
                    break;
                case 'model-description':
                    currentModel.json['description'] = value;
                    break;
                case 'model-notes':
                    currentModel.json['notes'] = value;
                    break;
                case 'model-subcategory':
                    currentModel.json['subcategory'] = value;
                    break;
                case 'model-creator':
                    currentModel.json['creator'] = value;
                    break;
                case 'model-example-prompt':
                    currentModel.json['example prompt'] = value;
                    break;
                case 'model-tags':
                    currentModel.json['tags'] = value;
                    break;
                case 'model-preferred-weight':
                    currentModel.json['preferred weight'] = parseFloat(value);
                    break;
            }

            try {
                // Save changes to server
                const response = await fetch('/save-model', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(currentModel)
                });

                if (!response.ok) {
                    throw new Error('Failed to save changes');
                }

                // Fields remain editable - no need to disable them

                // Refresh the display
                refreshModels();

            } catch (error) {
                console.error('Error saving changes:', error);
                alert('Failed to save changes. Please try again.');
            }
        });
    });

    // Show the modal
    modelModal.style.display = 'block';

    // Initialize carousel handlers for modal if multiple images
    if (previewImages.length > 1) {
        console.log('Multiple images detected, setting up handlers...');
        const modalMainImage = document.querySelector('#model-modal .preview-main-image');
        const modalThumbnails = document.querySelectorAll('#model-modal .preview-thumb');
        const setDefaultBtn = document.getElementById('set-default-preview-btn');
        const deleteBtn = document.getElementById('delete-preview-btn');

        console.log('Modal main image:', modalMainImage);
        console.log('Modal thumbnails:', modalThumbnails.length);
        console.log('Set default button:', setDefaultBtn);
        console.log('Delete button:', deleteBtn);

        // Mouseover to update preview
        modalThumbnails.forEach((thumb, index) => {
            console.log(`Setting up mouseover for thumbnail ${index}`, thumb);

            // Try both mouseover and mouseenter in case one is blocked
            const updatePreview = () => {
                console.log(`Mouseover thumbnail ${index}`);

                // Update main image
                modalMainImage.src = previewImages[index];
                modalMainImage.dataset.index = index;

                console.log(`Updated data-index to: ${index}`);
                console.log(`Is index 0?`, index === 0);

                // Update star button state
                if (setDefaultBtn) {
                    const shouldDisable = (index === 0);
                    console.log(`Setting star button disabled to: ${shouldDisable}`);
                    setDefaultBtn.disabled = shouldDisable;
                }

                // Update active thumbnail
                modalThumbnails.forEach((t, i) => {
                    if (i === index) {
                        t.classList.add('active');
                    } else {
                        t.classList.remove('active');
                    }
                });
            };

            thumb.addEventListener('mouseover', updatePreview);
            thumb.addEventListener('mouseenter', updatePreview);
            thumb.addEventListener('click', () => console.log(`Click on thumbnail ${index}`));
        });

        // Delete button handler
        if (deleteBtn) {
            console.log('Attaching delete button handler...');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent drop zone from capturing this
                console.log('Delete button clicked!');
                const currentIndex = parseInt(modalMainImage.dataset.index) || 0;
                const thumbnailNumber = currentIndex + 1;

                if (!confirm(`Delete this thumbnail? This cannot be undone.`)) return;

                try {
                    const response = await fetch('/delete-thumbnail', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            modelName: currentModel.name,
                            thumbnailIndex: thumbnailNumber
                        })
                    });

                    if (!response.ok) throw new Error('Failed to delete thumbnail');

                    await refreshModels();
                    const updatedModel = models.find(m => m.name === currentModel.name);
                    if (updatedModel) {
                        openModelDetails(updatedModel);
                    }
                } catch (error) {
                    console.error('Error deleting thumbnail:', error);
                    alert('Failed to delete thumbnail');
                }
            });
        }

        // Set as default button handler
        if (setDefaultBtn) {
            console.log('Attaching set default button handler...');
            setDefaultBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent drop zone from capturing this
                console.log('Set default button clicked!');
                const currentIndex = parseInt(modalMainImage.dataset.index) || 0;
                if (currentIndex === 0) return; // Already default

                const thumbnailNumber = currentIndex + 1;

                if (!confirm(`Set this as the default thumbnail?`)) return;

                try {
                    const currentPreviewCount = currentModel.previewImages?.length || 0;
                    const newOrder = [thumbnailNumber];

                    for (let i = 1; i <= currentPreviewCount; i++) {
                        if (i !== thumbnailNumber) {
                            newOrder.push(i);
                        }
                    }

                    const response = await fetch('/reorder-thumbnails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            modelName: currentModel.name,
                            newOrder: newOrder
                        })
                    });

                    if (!response.ok) throw new Error('Failed to reorder thumbnails');

                    await refreshModels();
                    const updatedModel = models.find(m => m.name === currentModel.name);
                    if (updatedModel) {
                        openModelDetails(updatedModel);
                    }
                } catch (error) {
                    console.error('Error reordering thumbnails:', error);
                    alert('Failed to set thumbnail as default');
                }
            });
        }
    }

    // Initialize image drop zone functionality
    initializeImageDropZone(() => currentModel, refreshModelData);
}

function closeModelModal() {
    modelModal.style.display = 'none';
    currentModel = null;
}

// No need for enableFilenameEdit function as filename is always editable

async function saveFilename() {
    if (!currentModel) return;

    const newName = modelFilename.value.trim();

    try {
        currentModel = await ModelOps.saveFilename(currentModel, newName, refreshModels);

        // Update UI
        modalTitle.textContent = newName;

    } catch (error) {
        alert(error.message);
    }
}

async function saveJsonMetadata() {
    if (!currentModel) return;

    try {
        const jsonContent = jsonEditor.value;
        await ModelOps.saveJsonMetadata(currentModel, jsonContent, currentJsonType);
        alert('JSON metadata saved successfully!');
    } catch (error) {
        alert(error.message || 'Error saving JSON metadata. Please try again.');
    }
}

function switchJsonType(type) {
    currentJsonType = type;

    // Update button states
    if (type === 'model') {
        modelJsonBtn.classList.add('active');
        civitaiJsonBtn.classList.remove('active');
        jsonEditor.value = currentModel && currentModel.json ?
            JSON.stringify(currentModel.json, null, 2) : '{}';
    } else {
        civitaiJsonBtn.classList.add('active');
        modelJsonBtn.classList.remove('active');
        jsonEditor.value = currentModel && currentModel.civitaiInfo ?
            JSON.stringify(currentModel.civitaiInfo, null, 2) : '{}';
    }
}

// Function to refresh the current model data
export async function refreshModelData() {
    if (!currentModel) return;

    try {
        const result = await ModelOps.refreshModelData(
            currentModel,
            models,
            (model) => {
                currentModel = model;
                openModelDetails(currentModel);
            }
        );

        // Update models array with fresh data
        if (result && result.updatedModels) {
            models = result.updatedModels;
        }
    } catch (error) {
        alert(error.message || 'Error refreshing model data. Please try again.');
    }
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== Civitai Actions for Single Model =====

// DOM Elements for Civitai Actions
const getCivitaiDataBtn = document.getElementById('get-civitai-data-btn');
const createJsonBtn = document.getElementById('create-json-btn');
const downloadThumbnailBtn = document.getElementById('download-thumbnail-btn');
const fixThumbnailBtn = document.getElementById('fix-thumbnail-btn');

// Event Listeners (using CivitaiAPI module)
getCivitaiDataBtn?.addEventListener('click', () => CivitaiAPI.getCivitaiData(currentModel, refreshModelData));
createJsonBtn?.addEventListener('click', () => CivitaiAPI.convertCivitaiToJson(currentModel, refreshModelData));
downloadThumbnailBtn?.addEventListener('click', () => CivitaiAPI.downloadCivitaiThumbnail(currentModel, refreshModelData));
fixThumbnailBtn?.addEventListener('click', () => CivitaiAPI.fixThumbnailName(currentModel, refreshModelData));


// ===== Filename Helper Buttons =====

// DOM Elements for Filename Helper Buttons
const useCivitaiNameBtn = document.getElementById('use-civitai-name-btn');
const cleanFilenameBtn = document.getElementById('clean-filename-btn');
const wanHighLowBtn = document.getElementById('wan-high-low-btn');
const appendPrefixBtn = document.getElementById('append-prefix-btn');
const appendSuffixBtn = document.getElementById('append-suffix-btn');

// Event listener for Use Civitai Name button
useCivitaiNameBtn?.addEventListener('click', handleUseCivitaiName);

// Function to populate filename with Civitai Name
function handleUseCivitaiName() {
    if (!currentModel) return;

    // Get the Civitai name from the model's civitai info
    const civitaiName = currentModel.civitaiInfo?.model?.name ||
        currentModel.json?.['civitai name'] ||
        '';

    if (civitaiName) {
        // Populate the filename field (without extension)
        modelFilename.value = civitaiName;
        console.log(`Populated filename with Civitai name: ${civitaiName}`);
    } else {
        alert('No Civitai name available for this model');
    }
}

// Placeholder functions for future implementation
cleanFilenameBtn?.addEventListener('click', handleCleanFilename);

// Function to clean and format filename
function handleCleanFilename() {
    if (!currentModel) return;

    let filename = modelFilename.value;

    // 1. Replace underscores with spaces
    filename = filename.replace(/_/g, ' ');

    // 2. Add leading and trailing space to dashes/hyphens
    filename = filename.replace(/-/g, ' - ');

    // 3. Replace multiple spaces with single space
    filename = filename.replace(/\s+/g, ' ');

    // 4. Replace multiple dashes with single dash
    filename = filename.replace(/-+/g, '-');

    // 5. Remove leading and trailing spaces
    filename = filename.trim();

    // 6. Capitalize first letter of each word
    filename = filename.replace(/\b\w/g, char => char.toUpperCase());

    // Update the filename field
    modelFilename.value = filename;

    console.log('Cleaned filename:', filename);
}

wanHighLowBtn?.addEventListener('click', handleWanHighLow);

// Function to swap High/Low in filename
function handleWanHighLow() {
    if (!currentModel) return;

    const currentFilename = modelFilename.value;
    let newFilename = currentFilename;

    // Check if filename contains "High" or "Low" (case-insensitive search)
    if (/\bhigh\b/i.test(currentFilename)) {
        // Replace "High" with "Low" (case-insensitive, but replace with capitalized "Low")
        newFilename = currentFilename.replace(/\bhigh\b/i, 'Low');
    } else if (/\blow\b/i.test(currentFilename)) {
        // Replace "Low" with "High" (case-insensitive, but replace with capitalized "High")
        newFilename = currentFilename.replace(/\blow\b/i, 'High');
    } else {
        alert('Filename does not contain "High" or "Low" to swap');
        return;
    }

    // Update the filename field
    modelFilename.value = newFilename;
    console.log(`Swapped High/Low in filename: ${currentFilename} -> ${newFilename}`);
}

appendPrefixBtn?.addEventListener('click', handleAppendPrefix);

// Function to append prefix based on base model
function handleAppendPrefix() {
    if (!currentModel) return;

    const baseModel = currentModel.baseModel || '';
    const currentFilename = modelFilename.value;

    // Map base models to their prefixes
    const prefixMap = {
        'Pony': '[P]',
        'SDXL 1.0': '[X]',
        'Illustrious': '[I]',
        'ZImageTurbo': '[Z]'
    };

    // Find matching prefix
    const prefix = prefixMap[baseModel];

    if (!prefix) {
        alert(`No prefix mapping found for base model: "${baseModel}"

Supported models:
- Pony ? [P]
- SDXL 1.0 ? [X]
- Illustrious ? [I]
- ZImageTurbo ? [Z]`);
        return;
    }

    // Check if prefix already exists at the start
    if (currentFilename.startsWith(prefix)) {
        alert(`Prefix "${prefix}" already exists at the beginning of the filename`);
        return;
    }

    // Append prefix to the beginning of the filename
    const newFilename = `${prefix} ${currentFilename}`;
    modelFilename.value = newFilename;

    console.log(`Appended prefix to filename: ${currentFilename} -> ${newFilename}`);
}
// Event listener for Append Suffix button
appendSuffixBtn?.addEventListener('click', handleAppendSuffix);

// Function to append suffix based on base model
function handleAppendSuffix() {
    if (!currentModel) return;

    const baseModel = currentModel.baseModel || '';
    let currentFilename = modelFilename.value;

    // Map base models to their suffixes
    const suffixMap = {
        'Wan Video 2.2 I2V-A14B': '- High I2v - Wan22 14b',
        'Wan Video 2.2 T2V-A14B': '- High T2v - Wan22 14b',
        'Wan Video 14B t2v': '- T2V - Wan21 14B',
        'Wan Video 14B i2v 720p': '- I2v 720p - Wan21 14b',
        'Wan Video': '- Wan21 14B'
    };

    // Find matching suffix
    const suffix = suffixMap[baseModel];

    if (!suffix) {
        alert(`No suffix mapping found for base model: "${baseModel}"

Supported models:
- Wan Video 2.2 I2V-A14B
- Wan Video 2.2 T2V-A14B
- Wan Video 14B t2v
- Wan Video 14B i2v 720p
- Wan Video`);
        return;
    }

    // Check if a suffix already exists and remove it
    // Look for patterns like ' - <text> - Wan<number>'
    currentFilename = currentFilename.replace(/\s+-\s+.*?\s+-\s+Wan\d+\s+\d+[bB]$/, '');

    // Append suffix to the end of the filename
    const newFilename = `${currentFilename} ${suffix}`;
    modelFilename.value = newFilename;

    console.log(`Appended suffix to filename: ${currentFilename} -> ${newFilename}`);
}

// ===== File Location Dropdown Functions =====

// Populate file location dropdown with available folders
async function populateFileLocationDropdown(currentLocation) {
    const fileLocationSelect = document.getElementById('model-file-location');

    if (!fileLocationSelect) {
        console.error('File location dropdown not found');
        return;
    }

    try {
        // Fetch available folders from server
        const response = await fetch('/get-folders');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const folders = data.folders || [];

        // Clear existing options
        fileLocationSelect.innerHTML = '';

        // Populate dropdown with folders
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.path;
            option.textContent = folder.name;

            // Select the current location
            if (folder.path === currentLocation ||
                (folder.path === '' && currentLocation === '')) {
                option.selected = true;
            }

            fileLocationSelect.appendChild(option);
        });

        // Attach move button handler if not already attached
        attachMoveButtonHandler();

    } catch (error) {
        console.error('Error fetching folders:', error);
        fileLocationSelect.innerHTML = '<option value="">Error loading folders</option>';
    }
}

// Attach event handler to the Move button
function attachMoveButtonHandler() {
    const moveButton = document.getElementById('move-file-location-btn');

    if (!moveButton) {
        console.error('Move button not found');
        return;
    }

    // Remove existing click handlers to prevent duplicates
    const newButton = moveButton.cloneNode(true);
    moveButton.parentNode.replaceChild(newButton, moveButton);

    // Add new click handler
    newButton.addEventListener('click', handleMoveModel);
}

// Handle move model operation
async function handleMoveModel() {
    if (!currentModel) return;

    const fileLocationSelect = document.getElementById('model-file-location');
    const targetFolder = fileLocationSelect.value;

    // Get current location from model path
    const modelPath = currentModel.path || '';
    const pathWithoutFilename = modelPath.substring(0, modelPath.lastIndexOf('\\'));
    const modelsDir = settingsManager.getSetting('modelsDirectory').replace(/\\/g, '/');
    const fullPath = pathWithoutFilename.replace(/\\/g, '/');

    let currentFolder = fullPath;
    if (modelsDir && fullPath.startsWith(modelsDir)) {
        currentFolder = fullPath.substring(modelsDir.length);
        if (currentFolder.startsWith('/')) {
            currentFolder = currentFolder.substring(1);
        }
    }

    // Check if target is different from current location
    if (targetFolder === currentFolder ||
        (targetFolder === '' && currentFolder === '')) {
        alert('Model is already in the selected location');
        return;
    }

    // Get display names for confirmation
    const currentLocationDisplay = currentFolder || 'Root';
    const targetLocationDisplay = targetFolder || 'Root';

    // Confirm with user
    const confirmMessage = `Move "${currentModel.name}" and all associated files?\n\nFrom: ${currentLocationDisplay}\nTo: ${targetLocationDisplay}`;

    if (!confirm(confirmMessage)) {
        return;
    }

    // Disable button during operation
    const moveButton = document.getElementById('move-file-location-btn');
    moveButton.disabled = true;
    moveButton.textContent = 'Moving...';

    try {
        // Send move request to server
        const response = await fetch('/move-model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                modelName: currentModel.name,
                targetFolder: targetFolder
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            alert(`Success! Moved ${data.filesMoved} file(s) to ${targetLocationDisplay}`);

            // Close modal
            closeModelModal();

            // Refresh model list to show updated locations
            await refreshModels();
        } else {
            throw new Error(data.message || 'Move operation failed');
        }

    } catch (error) {
        console.error('Error moving model:', error);
        alert(`Error moving model: ${error.message}`);
    } finally {
        // Re-enable button
        moveButton.disabled = false;
        moveButton.textContent = 'Move';
    }
}
