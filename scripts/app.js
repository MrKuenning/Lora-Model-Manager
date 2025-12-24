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
import { initializeCopyButtons } from './clipboard-utils.js';

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

// Clear search button functionality
const clearSearchBtn = document.getElementById('clear-search-btn');
if (clearSearchBtn) {
    // Show/hide clear button based on input
    searchInput.addEventListener('input', () => {
        clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none';
    });

    // Clear search on button click
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        searchTerm = '';
        displayModels();
    });
}

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

    // Initialize copy buttons
    initializeCopyButtons();
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

// File Management Progressive Disclosure Event Listeners
document.getElementById('modify-name-btn')?.addEventListener('click', enterFilenameEditMode);
document.getElementById('cancel-filename-btn')?.addEventListener('click', () => exitFilenameEditMode(true));
document.getElementById('move-model-btn')?.addEventListener('click', enterLocationEditMode);
document.getElementById('execute-move-btn')?.addEventListener('click', handleMoveModel);
document.getElementById('cancel-move-btn')?.addEventListener('click', exitLocationEditMode);

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
            'negativeWords', 'authorsWords', 'description', 'notes',
            'modelName', 'modelVersion', 'highLow'
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
    document.getElementById('col-notes').checked = columns.notes !== false;
    document.getElementById('col-modelName').checked = columns.modelName === true;
    document.getElementById('col-modelVersion').checked = columns.modelVersion === true;
    document.getElementById('col-highLow').checked = columns.highLow === true;
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

// ===== Static Field Edit Functionality =====
// Helper function to setup edit/save/cancel for static fields
function setupStaticFieldEdit(fieldName) {
    const editBtn = document.getElementById(`edit-${fieldName}-btn`);
    const saveBtn = document.getElementById(`save-${fieldName}-btn`);
    const cancelBtn = document.getElementById(`cancel-${fieldName}-btn`);
    const staticDisplay = document.getElementById(`model-${fieldName}-static`);
    const editInput = document.getElementById(`model-${fieldName}-input`);

    if (!editBtn || !saveBtn || !cancelBtn || !staticDisplay || !editInput) {
        console.warn(`Static field elements not found for: ${fieldName}`);
        console.log('Looking for:', {
            editBtn: `edit-${fieldName}-btn`,
            saveBtn: `save-${fieldName}-btn`,
            cancelBtn: `cancel-${fieldName}-btn`,
            staticDisplay: `model-${fieldName}-static`,
            editInput: `model-${fieldName}-input`
        });
        return;
    }

    // Remove old event listeners by cloning and replacing
    const newEditBtn = editBtn.cloneNode(true);
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);

    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Enter edit mode
    newEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log(`Edit button clicked for ${fieldName}`);

        // Get current value
        let currentValue = '';
        if (fieldName === 'url') {
            const urlLink = document.getElementById('model-url-link');
            currentValue = urlLink.href === window.location.href + '#' ? '' : urlLink.href;
        } else if (fieldName === 'nsfw') {
            // For checkbox, set the checked state
            const isNsfw = staticDisplay.textContent.trim() === 'Yes';
            editInput.checked = isNsfw;
        } else {
            currentValue = staticDisplay.textContent.trim();
        }

        if (fieldName !== 'nsfw') {
            editInput.value = currentValue;
        }

        // Toggle visibility
        staticDisplay.style.display = 'none';
        if (fieldName === 'nsfw') {
            editInput.parentElement.style.display = 'block';
        } else {
            editInput.style.display = 'block';
        }
        newEditBtn.style.display = 'none';
        newSaveBtn.style.display = 'inline-block';
        newCancelBtn.style.display = 'inline-block';

        // Focus the input (not for checkboxes)
        if (fieldName !== 'nsfw') {
            setTimeout(() => editInput.focus(), 50);
        }
    });

    // Cancel edit mode
    newCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Reset visibility
        staticDisplay.style.display = 'inline';
        if (fieldName === 'nsfw') {
            editInput.parentElement.style.display = 'none';
        } else {
            editInput.style.display = 'none';
        }
        newEditBtn.style.display = 'inline-block';
        newSaveBtn.style.display = 'none';
        newCancelBtn.style.display = 'none';
    });

    // Save the edited value
    newSaveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentModel) {
            alert('No model selected');
            return;
        }
        let newValue;
        if (fieldName === 'nsfw') {
            newValue = editInput.checked;
        } else {
            newValue = editInput.value.trim();
        }

        try {
            // Update the model object based on field
            if (fieldName === 'url') {
                currentModel.json['url'] = newValue;
            } else if (fieldName === 'author') {
                currentModel.json['civitai name'] = newValue;
            } else if (fieldName === 'basemodel') {
                currentModel.baseModel = newValue;
                currentModel.json['base model'] = newValue;
            } else if (fieldName === 'creator') {
                currentModel.json['creator'] = newValue;
            } else if (fieldName === 'nsfw') {
                currentModel.json['nsfw'] = newValue.toString();
            } else if (fieldName === 'version') {
                currentModel.json['model version'] = newValue;
            }

            // Save to server
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

            // Update the display
            if (fieldName === 'url') {
                const urlLink = document.getElementById('model-url-link');
                urlLink.href = newValue || '#';
                urlLink.textContent = newValue || 'No URL';
            } else if (fieldName === 'nsfw') {
                staticDisplay.textContent = newValue ? 'Yes' : 'No';
            } else {
                staticDisplay.textContent = newValue;
            }

            // Toggle back to view mode
            staticDisplay.style.display = 'inline';
            if (fieldName === 'nsfw') {
                editInput.parentElement.style.display = 'none';
            } else {
                editInput.style.display = 'none';
            }
            newEditBtn.style.display = 'inline-block';
            newSaveBtn.style.display = 'none';
            newCancelBtn.style.display = 'none';

            // No need to refresh entire model list - we already updated currentModel

        } catch (error) {
            console.error('Error saving field:', error);
            alert('Failed to save changes. Please try again.');
        }
    });
}

// ===== Generic Field Edit Functionality =====
/**
 * Setup edit/save/cancel functionality for any field type
 * @param {string} fieldId - The ID of the field (without -display or -input suffix)
 * @param {string} fieldType - Type: 'text', 'textarea', 'checkbox', 'range'
 * @param {Function} saveCallback - Function to save the value: (newValue) => void
 */
function setupGenericFieldEdit(fieldId, fieldType, saveCallback) {
    console.log(`Setting up generic field edit for: ${fieldId}`);

    const editBtn = document.querySelector(`[data-field="${fieldId}"].field-edit-btn`);
    const saveBtn = document.querySelector(`[data-field="${fieldId}"].field-save-btn`);
    const cancelBtn = document.querySelector(`[data-field="${fieldId}"].field-cancel-btn`);
    const display = document.getElementById(`${fieldId}-display`);
    const input = document.getElementById(fieldId);

    console.log(`Elements found - editBtn: ${!!editBtn}, saveBtn: ${!!saveBtn}, cancelBtn: ${!!cancelBtn}, display: ${!!display}, input: ${!!input}`);

    if (!editBtn || !saveBtn || !cancelBtn || !display || !input) {
        console.warn(`Generic field elements not found for: ${fieldId}`);
        return;
    }

    // Remove old listeners by cloning
    const newEditBtn = editBtn.cloneNode(true);
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);

    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Make display clickable to enter edit mode
    display.style.cursor = 'pointer';
    display.title = 'Click to edit';
    display.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Trigger the edit button click
        newEditBtn.click();
    });

    // Enter edit mode
    newEditBtn.addEventListener('click', (e) => {
        console.log(`Edit button clicked for ${fieldId}`);
        e.preventDefault();
        e.stopPropagation();

        // Get and set current value based on field type
        if (fieldType === 'checkbox') {
            // Checkbox: input is already set, just show it
            display.style.display = 'none';
            input.parentElement.style.display = 'flex';
        } else if (fieldType === 'range') {
            // Range slider: hide visual bar, show interactive slider
            display.style.display = 'none';
            document.getElementById('weight-visual-bar').style.display = 'none';
            document.getElementById('weight-slider-container').style.display = 'block';
        } else {
            // Text or textarea
            input.value = display.textContent.trim();
            if (input.value === '(empty)') input.value = '';
            display.style.display = 'none';
            input.style.display = 'block';
        }

        // Toggle buttons
        newEditBtn.style.display = 'none';
        newSaveBtn.style.display = 'inline-block';
        newCancelBtn.style.display = 'inline-block';

        // Focus if not checkbox/range
        if (fieldType !== 'checkbox' && fieldType !== 'range') {
            setTimeout(() => input.focus(), 50);
        }
    });

    // Cancel edit mode
    newCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Hide input, show display
        if (fieldType === 'checkbox') {
            input.parentElement.style.display = 'none';
            display.style.display = 'inline';
        } else if (fieldType === 'range') {
            // Range slider: show visual bar, hide interactive slider
            document.getElementById('weight-slider-container').style.display = 'none';
            document.getElementById('weight-visual-bar').style.display = 'block';
            display.style.display = 'inline';
        } else {
            input.style.display = 'none';
            display.style.display = 'block';
        }

        // Reset buttons
        newEditBtn.style.display = 'inline-block';
        newSaveBtn.style.display = 'none';
        newCancelBtn.style.display = 'none';
    });

    // Save changes
    newSaveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            // Get new value based on field type
            let newValue;
            if (fieldType === 'checkbox') {
                newValue = input.checked;
            } else if (fieldType === 'range') {
                newValue = parseFloat(input.value);
            } else {
                newValue = input.value.trim();
            }

            // Call the save callback
            await saveCallback(newValue);

            // Update display
            if (fieldType === 'checkbox') {
                display.textContent = newValue ? 'Yes' : 'No';
                input.parentElement.style.display = 'none';
                display.style.display = 'inline';
            } else if (fieldType === 'range') {
                display.textContent = newValue.toFixed(1);
                document.getElementById('weight-slider-container').style.display = 'none';
                document.getElementById('weight-visual-bar').style.display = 'block';
                display.style.display = 'inline';
                // Update visual indicator position
                updateWeightIndicator(newValue);
            } else {
                display.textContent = newValue || '';
                input.style.display = 'none';
                display.style.display = 'block';
            }

            // Reset buttons
            newEditBtn.style.display = 'inline-block';
            newSaveBtn.style.display = 'none';
            newCancelBtn.style.display = 'none';

            // No need to refresh entire model list - we already updated currentModel

        } catch (error) {
            console.error('Error saving field:', error);
            alert('Failed to save changes. Please try again.');
        }
    });
}

// Helper function to save current model to server
async function saveModel() {
    if (!currentModel) {
        throw new Error('No model selected');
    }

    // Sort the json object keys alphabetically for cleaner JSON files
    if (currentModel.json) {
        const sortedJson = {};
        Object.keys(currentModel.json).sort().forEach(key => {
            sortedJson[key] = currentModel.json[key];
        });
        currentModel.json = sortedJson;
    }

    const response = await fetch('/save-model', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentModel)
    });

    if (!response.ok) {
        throw new Error('Failed to save model');
    }
}

// Helper function to update weight indicator position
function updateWeightIndicator(weight) {
    const indicator = document.getElementById('weight-indicator');
    if (!indicator) return;

    // Convert weight (-4 to +4) to percentage (0% to 100%)
    const percentage = ((weight + 4) / 8) * 100;
    indicator.style.left = `${percentage}%`;
}


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
            notes: document.getElementById('col-notes')?.checked || false,
            modelName: document.getElementById('col-modelName')?.checked || false,
            modelVersion: document.getElementById('col-modelVersion')?.checked || false,
            highLow: document.getElementById('col-highLow')?.checked || false
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
                <img id="model-preview-image" src="${previewImages[0] || '/assets/placeholder.png'}" alt="${model.name}" class="preview-main-image">
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

    // Update read-only filename display
    const filenameDisplay = document.getElementById('filename-display-text');
    if (filenameDisplay) {
        filenameDisplay.textContent = model.filename.replace(/\.safetensors$/, '');
    }

    // Reset File Management UI to default state
    exitFilenameEditMode(false);
    exitLocationEditMode();

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

    // Show full directory path without filename
    modelPath.textContent = pathWithoutFilename;
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

    // Set author, base model, creator in static info section
    document.getElementById('model-author-static').textContent = model.json?.['civitai name'] || '';
    document.getElementById('model-basemodel-static').textContent = model.baseModel || '';
    document.getElementById('model-creator-static').textContent = model.json?.['creator'] || '';

    // Set editable fields - Populate both inputs and displays

    // Category
    const categoryField = model.category || '';
    document.getElementById('model-category').value = categoryField;
    document.getElementById('model-category-display').textContent = categoryField || '';

    // Positive Words
    const positiveTextField = model.json?.['activation text'] || '';
    document.getElementById('model-positive').value = positiveTextField;
    document.getElementById('model-positive-display').textContent = positiveTextField || '';

    // Negative Words
    const negativeTextField = model.json?.['negative text'] || '';
    document.getElementById('model-negative').value = negativeTextField;
    document.getElementById('model-negative-display').textContent = negativeTextField || '';

    // Civitai Words (Authors)
    const civitaiTextField = model.json?.['civitai text'] || '';
    document.getElementById('model-authors').value = civitaiTextField;
    document.getElementById('model-authors-display').textContent = civitaiTextField || '';

    // Description
    const descriptionField = model.json?.['description'] || '';
    document.getElementById('model-description').value = descriptionField;
    document.getElementById('model-description-display').textContent = descriptionField || '';

    // Notes
    const notesField = model.json?.['notes'] || '';
    document.getElementById('model-notes').value = notesField;
    document.getElementById('model-notes-display').textContent = notesField || '';

    // Subcategory
    const subcategoryField = model.json?.['subcategory'] || '';
    document.getElementById('model-subcategory').value = subcategoryField;
    document.getElementById('model-subcategory-display').textContent = subcategoryField || '';

    // Example Prompt
    const examplePromptField = model.json?.['example prompt'] || '';
    document.getElementById('model-example-prompt').value = examplePromptField;
    document.getElementById('model-example-prompt-display').textContent = examplePromptField || '';

    // Example Prompt 2
    const examplePrompt2Field = model.json?.['example prompt 2'] || '';
    document.getElementById('model-example-prompt-2').value = examplePrompt2Field;
    document.getElementById('model-example-prompt-2-display').textContent = examplePrompt2Field || '';

    // Tags
    const tagsField = model.json?.['tags'] || '';
    document.getElementById('model-tags').value = tagsField;
    document.getElementById('model-tags-display').textContent = tagsField || '';

    // Model Name - initially from json['name'] or Civitai name as fallback
    const modelNameField = model.json?.['name'] || model.json?.['civitai name'] || '';
    document.getElementById('model-name').value = modelNameField;
    document.getElementById('model-name-display').textContent = modelNameField || '';

    // Model Version
    const modelVersionField = model.json?.['model version'] || '';
    document.getElementById('model-version').value = modelVersionField;
    document.getElementById('model-version-display').textContent = modelVersionField || '';

    // High/Low toggle state
    const highLowValue = model.json?.['high low'] || '';
    const toggleBtn = document.getElementById('high-low-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('data-value', highLowValue);
        const label = highLowValue || 'None';
        toggleBtn.querySelector('.toggle-label').textContent = label;
    }

    // NSFW toggle state
    const nsfwValue = model.json?.['nsfw'] === 'true' || model.json?.['nsfw'] === true;
    const nsfwToggleBtn = document.getElementById('nsfw-toggle');
    if (nsfwToggleBtn) {
        nsfwToggleBtn.setAttribute('data-value', nsfwValue.toString());
        const nsfwLabel = nsfwValue ? 'Yes' : 'No';
        nsfwToggleBtn.querySelector('.toggle-label').textContent = nsfwLabel;
    }

    // Set preferred weight slider
    const preferredWeightField = parseFloat(model.json?.['preferred weight']) || 0;
    document.getElementById('model-preferred-weight').value = preferredWeightField;
    document.getElementById('model-preferred-weight-display').textContent = preferredWeightField.toFixed(1);
    updateWeightIndicator(preferredWeightField);

    // Populate file location dropdown
    populateFileLocationDropdown(relativePath || '');

    // Load JSON data
    switchJsonType(currentJsonType);

    // Initialize static field edit functionality
    setupStaticFieldEdit('url');
    setupStaticFieldEdit('author');
    setupStaticFieldEdit('basemodel');
    setupStaticFieldEdit('creator');

    // Initialize generic field edit handlers for all converted fields
    setupGenericFieldEdit('model-category', 'text', async (val) => {
        currentModel.category = val;
        currentModel.json['category'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-subcategory', 'text', async (val) => {
        currentModel.json['subcategory'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-tags', 'text', async (val) => {
        currentModel.json['tags'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-name', 'text', async (val) => {
        currentModel.json['name'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-version', 'text', async (val) => {
        currentModel.json['model version'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-positive', 'textarea', async (val) => {
        currentModel.json['activation text'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-negative', 'textarea', async (val) => {
        currentModel.json['negative text'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-authors', 'textarea', async (val) => {
        currentModel.json['civitai text'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-description', 'textarea', async (val) => {
        currentModel.json['description'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-notes', 'textarea', async (val) => {
        currentModel.json['notes'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-example-prompt', 'textarea', async (val) => {
        currentModel.json['example prompt'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-example-prompt-2', 'textarea', async (val) => {
        currentModel.json['example prompt 2'] = val;
        await saveModel();
    });

    setupGenericFieldEdit('model-preferred-weight', 'range', async (val) => {
        currentModel.json['preferred weight'] = val;
        await saveModel();
    });

    // Initialize High/Low toggle handler
    initHighLowToggle();

    // Initialize NSFW toggle handler
    initNSFWToggle();

    // Old save button event listeners are no longer needed

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
                case 'model-name':
                    currentModel.json['name'] = value;
                    break;
                case 'model-version':
                    currentModel.json['model version'] = value;
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

        // Exit filename edit mode and update display
        exitFilenameEditMode(false);

    } catch (error) {
        alert(error.message);
    }
}

// ===== File Management Progressive Disclosure Functions =====

function enterFilenameEditMode() {
    // Hide read-only display
    document.getElementById('filename-display-container').style.display = 'none';

    // Show edit container
    document.getElementById('filename-edit-container').style.display = 'block';

    // Hide "Modify Name" button
    document.getElementById('file-mgmt-actions-default').style.display = 'none';
    document.getElementById('file-mgmt-actions-edit').style.display = 'flex';

    // Ensure location section is hidden (mutually exclusive)
    exitLocationEditMode();

    // Focus on the filename input
    document.getElementById('model-filename').focus();
}

function exitFilenameEditMode(cancelled = false) {
    // If cancelled, restore original value
    if (cancelled && currentModel) {
        modelFilename.value = currentModel.filename.replace(/\.safetensors$/, '');
    }

    // Update read-only display
    const filenameDisplay = document.getElementById('filename-display-text');
    if (filenameDisplay && currentModel) {
        filenameDisplay.textContent = currentModel.filename.replace(/\.safetensors$/, '');
    }

    // Show read-only display
    document.getElementById('filename-display-container').style.display = 'block';

    // Hide edit container
    document.getElementById('filename-edit-container').style.display = 'none';

    // Show default action buttons, hide edit action buttons
    document.getElementById('file-mgmt-actions-default').style.display = 'flex';
    document.getElementById('file-mgmt-actions-edit').style.display = 'none';
}

function enterLocationEditMode() {
    // Show location edit container
    document.getElementById('location-edit-container').style.display = 'block';

    // Hide default action buttons, show move action buttons
    document.getElementById('file-mgmt-actions-default').style.display = 'none';
    document.getElementById('file-mgmt-actions-move').style.display = 'flex';

    // Ensure filename section is hidden (mutually exclusive)
    if (document.getElementById('filename-edit-container').style.display === 'block') {
        exitFilenameEditMode(true);
    }
}

function exitLocationEditMode() {
    // Hide location edit container
    document.getElementById('location-edit-container').style.display = 'none';

    // Only show default action buttons if not in filename edit mode
    const isInFilenameEditMode = document.getElementById('filename-edit-container').style.display === 'block';
    if (!isInFilenameEditMode) {
        document.getElementById('file-mgmt-actions-default').style.display = 'flex';
    }
    document.getElementById('file-mgmt-actions-move').style.display = 'none';
}


// ===== High/Low Toggle Handler =====

function initHighLowToggle() {
    const toggleBtn = document.getElementById('high-low-toggle');
    if (!toggleBtn) return;

    // Remove existing listener to prevent duplicates
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

    newToggleBtn.addEventListener('click', async () => {
        const currentValue = newToggleBtn.getAttribute('data-value') || '';
        let newValue = '';
        let label = 'None';

        // Cycle through states: '' -> 'High' -> 'Low' -> ''
        if (currentValue === '') {
            newValue = 'High';
            label = 'High';
        } else if (currentValue === 'High') {
            newValue = 'Low';
            label = 'Low';
        } else if (currentValue === 'Low') {
            newValue = '';
            label = 'None';
        }

        // Update button
        newToggleBtn.setAttribute('data-value', newValue);
        newToggleBtn.querySelector('.toggle-label').textContent = label;

        // Save to JSON
        if (!currentModel) return;
        if (!currentModel.json) currentModel.json = {};
        currentModel.json['high low'] = newValue;
        await saveModel();
    });
}

// ===== NSFW Toggle Handler =====

function initNSFWToggle() {
    const toggleBtn = document.getElementById('nsfw-toggle');
    if (!toggleBtn) return;

    // Remove existing listener to prevent duplicates
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

    newToggleBtn.addEventListener('click', async () => {
        const currentValue = newToggleBtn.getAttribute('data-value') === 'true';
        const newValue = !currentValue;
        const label = newValue ? 'Yes' : 'No';

        // Update button
        newToggleBtn.setAttribute('data-value', newValue.toString());
        newToggleBtn.querySelector('.toggle-label').textContent = label;

        // Save to JSON
        if (!currentModel) return;
        if (!currentModel.json) currentModel.json = {};
        currentModel.json['nsfw'] = newValue.toString();
        await saveModel();
    });
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

    // 1. Replace forward slashes with dashes
    filename = filename.replace(/\//g, ' - ');

    // 2. Remove characters not allowed in filenames: \ : * ? " < > |
    filename = filename.replace(/[\\:*?"<>|]/g, '');

    // 3. Replace underscores with spaces
    filename = filename.replace(/_/g, ' ');

    // 4. Add leading and trailing space to dashes/hyphens (normalize spacing)
    filename = filename.replace(/-/g, ' - ');

    // 5. Replace multiple spaces with single space
    filename = filename.replace(/\s+/g, ' ');

    // 6. Replace multiple dashes with single dash
    filename = filename.replace(/-+/g, '-');

    // 7. Remove leading and trailing spaces
    filename = filename.trim();

    // 8. Convert ALL CAPS words to Title Case, while preserving mixed case
    filename = filename.replace(/\b([A-Z]{2,})\b/g, (match) => {
        // Convert ALL CAPS to Title Case (first letter upper, rest lower)
        return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });

    // 9. Capitalize first letter of each word (for lowercase words)
    filename = filename.replace(/\b[a-z]/g, char => char.toUpperCase());

    // 10. Clean up any resulting issues
    filename = filename.replace(/\s*-\s*-\s*/g, ' - '); // Fix double dashes
    filename = filename.replace(/^\s*-\s*/, ''); // Remove leading dash
    filename = filename.replace(/\s*-\s*$/, ''); // Remove trailing dash
    filename = filename.trim();

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
    const moveButton = document.getElementById('execute-move-btn');

    if (!moveButton) {
        // Button may not exist yet - this is normal
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
    const moveButton = document.getElementById('execute-move-btn');
    if (moveButton) {
        moveButton.disabled = true;
        moveButton.textContent = 'Moving...';
    }

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

            // Exit location edit mode
            exitLocationEditMode();

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
        if (moveButton) {
            moveButton.disabled = false;
            moveButton.textContent = 'Move';
        }
    }
}

// ===== New Filename Helper Buttons =====

// DOM Elements for new filename helper buttons
const useModelNameBtn = document.getElementById('use-model-name-btn');
const recommendedFilenameBtn = document.getElementById('recommended-filename-btn');

// Event listener for Use Model Name button
useModelNameBtn?.addEventListener('click', handleUseModelName);

// Function to populate filename with Model Name field value
function handleUseModelName() {
    if (!currentModel) return;

    // Get the model name from the model name field or json
    const modelNameField = document.getElementById('model-name');
    const modelName = modelNameField?.value ||
        currentModel.json?.['name'] ||
        currentModel.name ||
        '';

    if (modelName) {
        // Populate the filename field (without extension)
        modelFilename.value = modelName;
        console.log(`Populated filename with Model Name: ${modelName}`);
    } else {
        alert('No Model Name available');
    }
}

// Event listener for Recommended Filename button
recommendedFilenameBtn?.addEventListener('click', handleRecommendedFilename);

// Function to generate recommended filename based on model type
function handleRecommendedFilename() {
    if (!currentModel) return;

    // Get model name and version
    const modelNameField = document.getElementById('model-name');
    const modelVersionField = document.getElementById('model-version');

    const modelName = modelNameField?.value ||
        currentModel.json?.['name'] ||
        currentModel.name ||
        '';

    const version = modelVersionField?.value ||
        currentModel.json?.['model version'] ||
        '';

    if (!modelName) {
        alert('Model Name is required to generate a recommended filename');
        return;
    }

    const baseModel = currentModel.baseModel || '';
    let recommendedName = '';

    // Get High/Low toggle value for Wan 2.2 models
    const highLowToggle = document.getElementById('high-low-toggle');
    const highLowValue = highLowToggle?.getAttribute('data-value') || '';

    // Build base name: [Model Name] [version]
    const baseName = version ? `${modelName} ${version}` : modelName;

    // Check for Prefix models (Pony, SDXL, Illustrious, ZImageTurbo)
    const prefixMap = {
        'Pony': '[P]',
        'SDXL 1.0': '[X]',
        'Illustrious': '[I]',
        'ZImageTurbo': '[Z]'
    };

    // Check for Wan Video models with suffixes
    const wanSuffixMap = {
        'Wan Video 14B t2v': '- T2V - Wan21 14B',
        'Wan Video 14B i2v 720p': '- I2v 720p - Wan21 14b',
        'Wan Video': '- Wan21 14B'
    };

    // Check for Wan 2.2 models (need High/Low toggle)
    const wan22Models = {
        'Wan Video 2.2 I2V-A14B': { high: '- High I2v - Wan22 14b', low: '- Low I2v - Wan22 14b' },
        'Wan Video 2.2 T2V-A14B': { high: '- High T2v - Wan22 14b', low: '- Low T2v - Wan22 14b' }
    };

    // Determine the filename based on base model type
    if (prefixMap[baseModel]) {
        // Prefix models: [Prefix] [Model Name] [version]
        recommendedName = `${prefixMap[baseModel]} ${baseName}`;
    } else if (wan22Models[baseModel]) {
        // Wan 2.2 models: check High/Low toggle
        if (highLowValue === 'High') {
            recommendedName = `${baseName} ${wan22Models[baseModel].high}`;
        } else if (highLowValue === 'Low') {
            recommendedName = `${baseName} ${wan22Models[baseModel].low}`;
        } else {
            // If no High/Low selected, prompt user
            alert('Please set the High/Low toggle for Wan 2.2 models before generating a recommended filename.');
            return;
        }
    } else if (wanSuffixMap[baseModel]) {
        // Other Wan Video models: [Model Name] [version] - suffix
        recommendedName = `${baseName} ${wanSuffixMap[baseModel]}`;
    } else {
        // Default: [Model Name] [version]
        recommendedName = baseName;
    }

    // Set the filename
    modelFilename.value = recommendedName;
    console.log(`Generated recommended filename: ${recommendedName}`);
}

// ===== Model Name Helper Buttons =====

// DOM Elements for Model Name helper buttons
const modelNameCivitaiBtn = document.getElementById('model-name-civitai-btn');
const modelNameCleanBtn = document.getElementById('model-name-clean-btn');

// Event listener for Model Name Civitai button
modelNameCivitaiBtn?.addEventListener('click', handleModelNameCivitai);

// Function to populate Model Name with Civitai Name
function handleModelNameCivitai() {
    if (!currentModel) return;

    // Get the Civitai name from the model's civitai info
    const civitaiName = currentModel.civitaiInfo?.model?.name ||
        currentModel.json?.['civitai name'] ||
        '';

    if (civitaiName) {
        // Populate the model name field
        const modelNameField = document.getElementById('model-name');
        if (modelNameField) {
            modelNameField.value = civitaiName;
            console.log(`Populated Model Name with Civitai name: ${civitaiName}`);
        }
    } else {
        alert('No Civitai name available for this model');
    }
}

// Event listener for Model Name Clean button
modelNameCleanBtn?.addEventListener('click', handleModelNameClean);

// Function to clean and format Model Name
function handleModelNameClean() {
    if (!currentModel) return;

    const modelNameField = document.getElementById('model-name');
    if (!modelNameField) return;

    let modelName = modelNameField.value;

    // Apply same cleaning logic as filename clean
    // 1. Replace underscores with spaces
    modelName = modelName.replace(/_/g, ' ');

    // 2. Add leading and trailing space to dashes/hyphens
    modelName = modelName.replace(/-/g, ' - ');

    // 3. Replace multiple spaces with single space
    modelName = modelName.replace(/\s+/g, ' ');

    // 4. Replace multiple dashes with single dash
    modelName = modelName.replace(/-+/g, '-');

    // 5. Remove leading and trailing spaces
    modelName = modelName.trim();

    // 6. Capitalize first letter of each word
    modelName = modelName.replace(/\b\w/g, char => char.toUpperCase());

    // Update the model name field
    modelNameField.value = modelName;

    console.log('Cleaned Model Name:', modelName);
}

// ===== Model Name Helper Buttons Visibility =====

// Show/hide model name helper buttons when entering/exiting edit mode
function setupModelNameHelperButtons() {
    const helperButtonsContainer = document.querySelector('.model-name-helper-buttons');
    if (!helperButtonsContainer) return;

    // Watch for changes to the model-name input display
    const modelNameInput = document.getElementById('model-name');
    const modelNameDisplay = document.getElementById('model-name-display');

    if (!modelNameInput || !modelNameDisplay) return;

    // Create a MutationObserver to watch for display changes on the input
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                const inputVisible = modelNameInput.style.display === 'block';
                helperButtonsContainer.style.display = inputVisible ? 'flex' : 'none';
            }
        });
    });

    // Observe changes to the input's style attribute
    observer.observe(modelNameInput, { attributes: true });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay to ensure other setup has completed
    setTimeout(setupModelNameHelperButtons, 100);
});

// ===== Trim Name Button (Placeholder) =====
const modelNameTrimBtn = document.getElementById('model-name-trim-btn');
modelNameTrimBtn?.addEventListener('click', handleModelNameTrim);

function handleModelNameTrim() {
    if (!currentModel) return;

    const modelNameField = document.getElementById('model-name');
    if (!modelNameField) return;

    let modelName = modelNameField.value;
    const originalName = modelName;

    // List of base model names/prefixes to remove (case-insensitive)
    // Includes full names, abbreviations, and bracket notations
    const baseModelPrefixes = [
        // Pony variants
        'Pony', 'PXL', '[P]', '[Pony]', '[PXL]',
        // SDXL variants
        'SDXL', 'SDXL 1.0', 'SDXL1.0', '[X]', '[SDXL]',
        // SD 1.x variants
        'SD', 'SD 1.5', 'SD1.5', 'SD 1.4', 'SD1.4', 'SD1', '[SD]',
        // SD 2.x variants
        'SD 2.0', 'SD2.0', 'SD 2.1', 'SD2.1', 'SD2',
        // Illustrious variants
        'Illustrious', 'Ill', '[I]', '[Ill]', '[Illustrious]',
        // NoobAI variants
        'Noob', 'NoobAI', 'Noob AI', '[Noob]', '[N]',
        // ZImageTurbo variants
        'ZImageTurbo', 'Zit', 'ZIT', '[Z]', '[Zit]', '[ZIT]', 'Z Turbo', 'Z-Image', 'ZImage',
        // Flux variants
        'Flux', 'Flux.1', 'Flux 1', '[Flux]', '[F]',
        // Wan Video variants
        'Wan', 'Wan21', 'Wan 2.1', 'Wan2.1', 'Wan22', 'Wan 2.2', 'Wan2.2',
        'Wan Video', 'Wan Video 14B', 'WanVideo', '[Wan]', '[W]',
        'T2V', 'I2V', 'I2v', 'T2v', '14B', '14b', '[WAN 2.2 I2V]',
        // Hunyuan variants
        'Hunyuan', 'HunyuanVideo', 'Hunyuan Video', '[Hunyuan]', '[H]',
        // CogVideo variants
        'CogVideo', 'Cog', 'CogVideoX', '[Cog]', '[CogVideo]',
        // Mochi variants
        'Mochi', '[Mochi]', '[M]',
        // LTX variants
        'LTX', 'LTX Video', 'LTXVideo', '[LTX]', '[L]',
        // Common model type indicators
        'LoRA', 'Lora', 'lora', 'LORA',
        'Checkpoint', 'checkpoint', 'ckpt', 'CKPT',
        'Embedding', 'embedding', 'TI', 'Textual Inversion',
        // Quality/resolution indicators often in names
        'High', 'Low', '720p', '1080p', '4K',
        // Other common terms to trim
        'XL', 'Turbo', 'Lightning', 'LCM', 'Hyper', 'for'
    ];

    // Helper function to escape special regex characters
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create regex patterns for each prefix (as whole words, at start or anywhere)
    baseModelPrefixes.forEach(prefix => {
        const escapedPrefix = escapeRegex(prefix);

        // Remove prefix at the start of the string
        const startPattern = new RegExp(`^${escapedPrefix}\\s*[-_]?\\s*`, 'i');
        modelName = modelName.replace(startPattern, '');

        // Remove prefix at the end of the string
        const endPattern = new RegExp(`\\s*[-_]?\\s*${escapedPrefix}$`, 'i');
        modelName = modelName.replace(endPattern, '');

        // Remove prefix surrounded by spaces/dashes
        const middlePattern = new RegExp(`\\s+${escapedPrefix}\\s+`, 'gi');
        modelName = modelName.replace(middlePattern, ' ');
    });

    // Remove version patterns like v1, v2, V1.0, version 3, etc.
    // At the end of the string
    modelName = modelName.replace(/\s*[-_]?\s*v(?:ersion)?\s*[\d.]+\s*$/i, '');
    // In the middle (with surrounding separators)
    modelName = modelName.replace(/\s*[-_]\s*v(?:ersion)?\s*[\d.]+\s*[-_]\s*/gi, ' - ');

    // Remove common suffixes like LoRA, Lora, checkpoint, etc.
    const commonSuffixes = ['LoRA', 'Lora', 'lora', 'Checkpoint', 'checkpoint', 'ckpt'];
    commonSuffixes.forEach(suffix => {
        const suffixPattern = new RegExp(`\\s*[-_]?\\s*${suffix}\\s*$`, 'i');
        modelName = modelName.replace(suffixPattern, '');
    });

    // Remove bracket prefixes like [P], [X], [I], etc.
    modelName = modelName.replace(/^\[[A-Z]\]\s*/i, '');

    // Clean up multiple spaces and dashes
    modelName = modelName.replace(/\s+/g, ' ');
    modelName = modelName.replace(/\s*-\s*-\s*/g, ' - ');
    modelName = modelName.replace(/^\s*[-_]\s*/, '');
    modelName = modelName.replace(/\s*[-_]\s*$/, '');
    modelName = modelName.trim();

    // Update the field
    if (modelName !== originalName) {
        modelNameField.value = modelName;
        console.log(`Trimmed model name: "${originalName}" -> "${modelName}"`);
    } else {
        console.log('No changes made to model name');
    }
}

// ===== Creator Suffix Button (Placeholder) =====
const creatorSuffixBtn = document.getElementById('creator-suffix-btn');
creatorSuffixBtn?.addEventListener('click', handleCreatorSuffix);

function handleCreatorSuffix() {
    if (!currentModel) return;

    // Get the creator name from the model
    const creatorName = currentModel.json?.['creator'] ||
        currentModel.civitaiInfo?.creator?.username ||
        '';

    if (!creatorName) {
        alert('No creator name available for this model');
        return;
    }

    // Get current filename
    const currentFilename = modelFilename.value;

    // Check if the creator suffix already exists
    const suffixPattern = new RegExp(`\\s*-\\s*${creatorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (suffixPattern.test(currentFilename)) {
        alert(`Creator suffix "- ${creatorName}" already exists in the filename`);
        return;
    }

    // Append the creator suffix
    const newFilename = `${currentFilename} - ${creatorName}`;
    modelFilename.value = newFilename;
    console.log(`Added creator suffix: ${currentFilename} -> ${newFilename}`);
}

// ===== Use Recommended Button =====
const useRecommendedBtn = document.getElementById('use-recommended-btn');
useRecommendedBtn?.addEventListener('click', handleUseRecommended);

function handleUseRecommended() {
    if (!currentModel) return;

    // Generate the recommended filename
    handleRecommendedFilename();

    // Only enter edit mode if handleRecommendedFilename didn't show an alert (meaning it succeeded)
    // Check if the filename field was actually updated
    const currentValue = modelFilename.value;
    if (currentValue && currentValue !== '' && !currentValue.includes('Placeholder')) {
        // Enter filename edit mode with the recommended name ready to save
        enterFilenameEditMode();
    }
}
