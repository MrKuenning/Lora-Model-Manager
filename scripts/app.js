// script.js (Browser Version with Python Server)

// Import modules
import appSettings, { Settings } from './settings.js';
import { displayGridView } from './grid-view.js';
import { displayTableView } from './table-view.js';
import { displayGroupedGridView } from './grid-group-view.js';
import { filterModelsByQuery } from './search-parser.js';
import { initializeImageDropZone, handleImageDrop } from './drop-zone-functions.js';
import { showLoadingOverlay, hideLoadingOverlay } from './ui-utils.js';
import { showToast } from './toast.js';
import * as ModelOps from './model-operations.js';
import * as CivitaiAPI from './civitai-api.js';
import { initializeCopyButtons } from './clipboard-utils.js';
import { TagInput } from './tag-input.js';
import * as BulkOps from './bulk-operations.js';
import { getFolderFromPath } from './model-utils.js';

// DOM Elements
const modelsContainer = document.getElementById('models-container');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const groupSelect = document.getElementById('group-select');
const modelFilterBtn = document.getElementById('model-filter-btn');
const modelFilterDropdown = document.getElementById('model-filter-dropdown');
const modelFilterText = document.getElementById('model-filter-text');
const gridViewBtn = document.getElementById('grid-view-btn');
const tableViewBtn = document.getElementById('table-view-btn');
const refreshBtn = document.getElementById('refresh-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const folderSidebar = document.getElementById('folder-sidebar');
const folderContainer = document.getElementById('folder-container');
const folderViewToggleBtn = document.getElementById('folder-view-toggle');
const folderDensityToggleBtn = document.getElementById('folder-density-toggle');
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
const modelSha256 = document.getElementById('model-sha256');
const editFilenameBtn = document.getElementById('edit-filename-btn');
const saveFilenameBtn = document.getElementById('save-filename-btn');
const jsonEditor = document.getElementById('json-editor');
const saveJsonBtn = document.getElementById('save-json-btn');
const refreshJsonBtn = document.getElementById('refresh-json-btn');
const modelJsonBtn = document.getElementById('model-json-btn');
const civitaiJsonBtn = document.getElementById('civitai-json-btn');
const preferredWeightSlider = document.getElementById('model-preferred-weight');
const preferredWeightValue = document.getElementById('model-preferred-weight-display');

// Application State
let models = [];
export let currentModel = null;
let currentView = appSettings.getSetting('defaultView');
let currentSort = appSettings.getSetting('defaultSort');
let currentGroupBy = 'none'; // Default to no grouping
let currentModelFilters = []; // empty array means show all models
let currentFolderFilter = null; // Default to no folder filter
let showSidebar = localStorage.getItem('showSidebar') === 'true'; // Default sidebar visibility
let folderViewMode = localStorage.getItem('folderViewMode') || 'list'; // 'list' or 'tree'
let folderDensityMode = localStorage.getItem('folderDensityMode') || 'comfy'; // 'comfy' or 'compact'
let searchTerm = '';
let currentJsonType = 'model'; // 'model' or 'civitai'
let selectedThumbnailIndex = 0; // Currently selected thumbnail (0-based for preview-thumb elements)
let currentLocation = 'loras'; // 'loras' or 'checkpoints'
let currentFilteredModels = []; // Track filtered models for modal navigation
let currentModelIndex = -1; // Track current model index in filtered list
let tagsInput = null; // TagInput component instance

// Helper function to get location from URL
function getLocationFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('location') || 'loras';
}

// Initialize settings
const settingsManager = appSettings;


// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
searchInput.addEventListener('input', handleSearch);

// Helper function to get relative folder path, avoiding consolidating the same-named subfolders under different parents
function getRelativeFolderPath(model) {
    if (!model || !model.path) return '';
    const rootPath = currentLocation === 'checkpoints'
        ? settingsManager.getSetting('checkpointsDirectory')
        : settingsManager.getSetting('modelsDirectory');

    if (!rootPath) return '';

    const mPath = model.path.replace(/\\/g, '/');
    let rPath = rootPath.replace(/\\/g, '/');
    if (!rPath.endsWith('/')) rPath += '/';

    if (mPath.toLowerCase().startsWith(rPath.toLowerCase())) {
        let rel = mPath.substring(rPath.length);
        const lastSlash = rel.lastIndexOf('/');
        if (lastSlash === -1 || lastSlash === 0) return '';
        return rel.substring(0, lastSlash).replace(/\//g, '\\');
    }
    return '';
}

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
gridViewBtn.addEventListener('click', (e) => { e.preventDefault(); switchView('grid'); });
tableViewBtn.addEventListener('click', (e) => { e.preventDefault(); switchView('table'); });
refreshBtn.addEventListener('click', refreshModels);

sidebarToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showSidebar = !showSidebar;
    localStorage.setItem('showSidebar', showSidebar);
    folderSidebar.style.display = showSidebar ? 'block' : 'none';
    if (showSidebar) {
        sidebarToggleBtn.classList.add('active');
        renderFolderSidebar();
    } else {
        sidebarToggleBtn.classList.remove('active');
    }
});

folderViewToggleBtn?.addEventListener('click', () => {
    folderViewMode = folderViewMode === 'list' ? 'tree' : 'list';
    localStorage.setItem('folderViewMode', folderViewMode);
    folderViewToggleBtn.innerHTML = folderViewMode === 'list' ? '<i class="fas fa-list"></i>' : '<i class="fas fa-sitemap"></i>';
    renderFolderSidebar();
});

folderDensityToggleBtn?.addEventListener('click', () => {
    folderDensityMode = folderDensityMode === 'comfy' ? 'compact' : 'comfy';
    localStorage.setItem('folderDensityMode', folderDensityMode);
    folderDensityToggleBtn.innerHTML = folderDensityMode === 'comfy' ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
    if (folderDensityMode === 'compact') {
        folderContainer.classList.add('compact-view');
    } else {
        folderContainer.classList.remove('compact-view');
    }
});
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
    const value = parseFloat(this.value).toFixed(1);
    preferredWeightValue.textContent = value;
    // Also update the live value display in edit mode
    const liveValue = document.getElementById('weight-slider-value');
    if (liveValue) {
        liveValue.textContent = value;
    }
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
                if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                currentModel.json.web_civitai_data['civitai name'] = value;
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
                if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                currentModel.json.web_civitai_data['civitai text'] = value;
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
                if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                currentModel.json.web_civitai_data['creator'] = value;
                break;
            case 'model-example-prompt':
                currentModel.json['example prompt 1'] = value;
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
            showToast('Failed to save changes. Please try again.', 'error');
        }
    });
});

// Settings button event listener
settingsBtn.addEventListener('click', openSettingsModal);

// Civitai Scan button event listener
civitaiScanBtn.addEventListener('click', () => {
    window.location.href = `civitai-scan.html?location=${currentLocation}`;
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

// Browse button event handlers
// Note: Web browsers can't natively access file system dialogs for folders
// These handlers show a prompt to help users enter the path
document.getElementById('browse-loras-directory')?.addEventListener('click', () => {
    const currentPath = document.getElementById('modelsDirectoryInput').value;
    const newPath = prompt(
        'Enter the full path to your LoRA models directory:\n\n' +
        'Example: E:\\AI\\MODELS\\LoRA\n\n' +
        'Tip: You can copy the path from Windows Explorer\'s address bar.',
        currentPath
    );
    if (newPath !== null) {
        document.getElementById('modelsDirectoryInput').value = newPath;
    }
});

document.getElementById('browse-checkpoints-directory')?.addEventListener('click', () => {
    const currentPath = document.getElementById('checkpointsDirectoryInput').value;
    const newPath = prompt(
        'Enter the full path to your Checkpoints directory:\n\n' +
        'Example: E:\\AI\\MODELS\\Stable-Diffusion\n\n' +
        'Tip: You can copy the path from Windows Explorer\'s address bar.',
        currentPath
    );
    if (newPath !== null) {
        document.getElementById('checkpointsDirectoryInput').value = newPath;
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

    // Checkpoints directory
    const checkpointsInput = document.getElementById('checkpointsDirectoryInput');
    if (checkpointsInput) {
        checkpointsInput.value = settings.checkpointsDirectory || '';
    }

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

    // Load filename formats
    loadFilenameFormats(settings.filenameFormats || []);

    // Load model type roots
    loadModelTypeRoots(settings.modelTypeRoots || []);

    // Load grid card settings
    const gridCardSettings = settings.gridCardSettings || {};
    document.getElementById('gridcard-imageMode').value = gridCardSettings.imageMode || 'carousel';
    document.getElementById('gridcard-title').value = gridCardSettings.title || 'filename';
    document.getElementById('gridcard-subtitle1').value = gridCardSettings.subtitle1 || 'folder';
    document.getElementById('gridcard-subtitle2').value = gridCardSettings.subtitle2 || 'baseModel';
    document.getElementById('gridcard-subtitle3').value = gridCardSettings.subtitle3 || 'none';

    // Reset settings tabs to General
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabBtns.length > 0) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Find General tab
        const generalTab = Array.from(tabBtns).find(b => b.getAttribute('data-tab') === 'settings-general');
        if (generalTab) {
            generalTab.classList.add('active');
            document.getElementById('settings-general')?.classList.add('active');
        } else {
            // Fallback to first
            tabBtns[0].classList.add('active');
            const targetId = tabBtns[0].getAttribute('data-tab');
            document.getElementById(targetId)?.classList.add('active');
        }
    }
}

function closeSettingsModal() {
    console.log("Close Settings Modal");
    settingsModal.style.display = 'none'; // Hide the modal
}

// Initialize filename formats settings UI
function loadFilenameFormats(formats) {
    const list = document.getElementById('filename-format-list');
    if (!list) return;

    list.innerHTML = '';

    // Add logic to "Add Format" button if not already added (using a flag or removing old one)
    const addBtn = document.getElementById('add-filename-format-btn');
    if (addBtn) {
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        newAddBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const existing = getFilenameFormats().map(f => f.baseModel);
            // Default to empty array if models is undefined
            const currentModels = (typeof models !== 'undefined') ? models : [];
            const allBaseModels = [...new Set(currentModels.map(m => m.baseModel).filter(Boolean))];
            const available = allBaseModels.filter(m => !existing.includes(m));
            addFilenameFormatRow('', '', available);
        });
    }

    // Populate rows
    // Use defaults if valid formats not provided or empty
    if (!formats || !Array.isArray(formats) || formats.length === 0) {
        if (settingsManager && settingsManager.defaultSettings && settingsManager.defaultSettings.filenameFormats) {
            formats = settingsManager.defaultSettings.filenameFormats;
        } else {
            // Fallback default
            formats = [{ baseModel: 'Default', format: '{modelname} {version}' }];
        }
    }

    formats.forEach(f => addFilenameFormatRow(f.baseModel, f.format));
}

function addFilenameFormatRow(baseModel = '', format = '', availableModels = null) {
    const list = document.getElementById('filename-format-list');
    const row = document.createElement('div');
    row.className = 'filename-format-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';

    const isDefault = baseModel === 'Default';

    // Delete button logic
    const deleteBtnHtml = isDefault
        ? `<button class="btn btn-tiny btn-secondary" disabled style="opacity: 0.5; cursor: not-allowed;" title="Cannot delete Default rule"><i class="fas fa-lock"></i></button>`
        : `<button class="btn btn-tiny btn-danger remove-format-btn"><i class="fas fa-times"></i></button>`;

    // Base model input logic
    let baseModelInput;
    if (isDefault) {
        baseModelInput = `<input type="text" class="format-base-model" placeholder="Base Model" value="${baseModel}" style="flex: 1; padding: 4px;" readonly title="Default base model cannot be renamed">`;
    } else if (availableModels && Array.isArray(availableModels) && availableModels.length > 0) {
        // Sort alphabetically
        availableModels.sort((a, b) => a.localeCompare(b));
        const options = availableModels.map(m => `<option value="${m}">${m}</option>`).join('');
        baseModelInput = `<select class="format-base-model" style="flex: 1; padding: 4px;">
            <option value="" disabled selected>Select Base Model...</option>
            ${options}
        </select>`;
    } else {
        // Existing row or fallback
        baseModelInput = `<input type="text" class="format-base-model" placeholder="Base Model" value="${baseModel}" style="flex: 1; padding: 4px;">`;
    }

    row.innerHTML = `
        ${baseModelInput}
        <input type="text" class="format-string" placeholder="Format String" value="${format}" style="flex: 2; padding: 4px;">
        ${deleteBtnHtml}
    `;

    if (!isDefault) {
        row.querySelector('.remove-format-btn').addEventListener('click', () => {
            list.removeChild(row);
        });
    }

    list.appendChild(row);
}

function getFilenameFormats() {
    const list = document.getElementById('filename-format-list');
    if (!list) return [];

    const formats = [];
    list.querySelectorAll('.filename-format-row').forEach(row => {
        const baseModel = row.querySelector('.format-base-model').value.trim();
        const format = row.querySelector('.format-string').value.trim();
        if (baseModel && format) {
            formats.push({ baseModel, format });
        }
    });
    return formats;
}

// Initialize model type roots settings UI
async function loadModelTypeRoots(roots) {
    const list = document.getElementById('modeltype-root-list');
    if (!list) return;

    list.innerHTML = '';

    // Fetch folders for autocomplete datalist
    let availableFolders = [];
    try {
        const resLoras = await fetch('/get-folders?location=loras');
        if (resLoras.ok) {
            const data = await resLoras.json();
            availableFolders.push(...(data.folders || []).map(f => f.path).filter(Boolean));
        }
        const resCheckpoints = await fetch('/get-folders?location=checkpoints');
        if (resCheckpoints.ok) {
            const data = await resCheckpoints.json();
            availableFolders.push(...(data.folders || []).map(f => f.path).filter(Boolean));
        }
        availableFolders = [...new Set(availableFolders)].sort();
    } catch (e) {
        console.error('Error fetching folders for datalist', e);
    }
    
    // Add datalist to DOM if not exists
    let datalist = document.getElementById('folder-datalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'folder-datalist';
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = availableFolders.map(f => `<option value="${f}">`).join('');

    const addBtn = document.getElementById('add-modeltype-root-btn');
    if (addBtn) {
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        newAddBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const existing = getModelTypeRoots().map(r => r.baseModel);
            const currentModels = (typeof models !== 'undefined') ? models : [];
            const allBaseModels = [...new Set(currentModels.map(m => m.baseModel).filter(Boolean))];
            const available = allBaseModels.filter(m => !existing.includes(m));
            addModelTypeRootRow('', '', available);
        });
    }

    roots.forEach(r => addModelTypeRootRow(r.baseModel, r.rootFolder));
}

function addModelTypeRootRow(baseModel = '', rootFolder = '', availableModels = null) {
    const list = document.getElementById('modeltype-root-list');
    const row = document.createElement('div');
    row.className = 'modeltype-root-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';

    let baseModelInput;
    if (availableModels && Array.isArray(availableModels) && availableModels.length > 0) {
        availableModels.sort((a, b) => a.localeCompare(b));
        const options = availableModels.map(m => `<option value="${m}">${m}</option>`).join('');
        baseModelInput = `<select class="root-base-model" style="flex: 1; padding: 4px;">
            <option value="" disabled selected>Select Base Model...</option>
            ${options}
        </select>`;
    } else {
        baseModelInput = `<input type="text" class="root-base-model" placeholder="Base Model" value="${baseModel}" style="flex: 1; padding: 4px;">`;
    }

    row.innerHTML = `
        ${baseModelInput}
        <input type="text" list="folder-datalist" class="root-folder" placeholder="Relative Root Folder (e.g. Comfy/QWEN)" value="${rootFolder}" style="flex: 2; padding: 4px;">
        <button class="btn btn-tiny btn-danger remove-root-btn"><i class="fas fa-times"></i></button>
    `;

    row.querySelector('.remove-root-btn').addEventListener('click', () => {
        list.removeChild(row);
    });

    list.appendChild(row);
}

function getModelTypeRoots() {
    const list = document.getElementById('modeltype-root-list');
    if (!list) return [];

    const roots = [];
    list.querySelectorAll('.modeltype-root-row').forEach(row => {
        const baseModel = row.querySelector('.root-base-model').value.trim();
        const rootFolder = row.querySelector('.root-folder').value.trim();
        if (baseModel) {
            roots.push({ baseModel, rootFolder });
        }
    });
    return roots;
}


// Setup settings modal tabs
function setupSettingsTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Deactivate all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate clicked
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Initialize tabs
setupSettingsTabs();

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
            showToast('No model selected', 'warning');
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
                if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                currentModel.json.web_civitai_data['url'] = newValue;
            } else if (fieldName === 'author') {
                if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                currentModel.json.web_civitai_data['civitai name'] = newValue;
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
            showToast('Failed to save changes. Please try again.', 'error');
        }
    });
}

// ===== Textarea Auto-Resize =====
/**
 * Auto-resize a textarea to fit its content
 * @param {HTMLTextAreaElement} textarea - The textarea element to resize
 */
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to show all content
    textarea.style.height = textarea.scrollHeight + 'px';
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
            // Initialize the live value display with current slider value
            const liveValue = document.getElementById('weight-slider-value');
            if (liveValue) {
                liveValue.textContent = parseFloat(input.value).toFixed(1);
            }
        } else {
            // Text or textarea
            input.value = display.textContent.trim();
            if (input.value === '(empty)') input.value = '';
            display.style.display = 'none';
            input.style.display = 'block';

            // Auto-resize textarea to fit content
            if (input.tagName === 'TEXTAREA') {
                autoResizeTextarea(input);
                // Add resize listener for typing
                input.addEventListener('input', () => autoResizeTextarea(input));
            }
        }

        // Show field helper buttons if applicable (category/subcategory fields)
        const helperButtons = document.querySelector(`.field-helper-buttons[data-field="${fieldId}"]`);
        if (helperButtons) {
            helperButtons.style.display = 'flex';
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

        // Hide field helper buttons if present
        const helperButtons = document.querySelector(`.field-helper-buttons[data-field="${fieldId}"]`);
        if (helperButtons) {
            helperButtons.style.display = 'none';
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

            // Hide field helper buttons if present
            const helperButtons = document.querySelector(`.field-helper-buttons[data-field="${fieldId}"]`);
            if (helperButtons) {
                helperButtons.style.display = 'none';
            }

            // No need to refresh entire model list - we already updated currentModel

        } catch (error) {
            console.error('Error saving field:', error);
            showToast('Failed to save changes. Please try again.', 'error');
        }
    });

    // Set up use-folder button click handler if present
    const useFolderBtn = document.querySelector(`[data-field="${fieldId}"].use-folder-btn`);
    if (useFolderBtn) {
        const newUseFolderBtn = useFolderBtn.cloneNode(true);
        useFolderBtn.parentNode.replaceChild(newUseFolderBtn, useFolderBtn);

        newUseFolderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Extract folder name from model path
            if (currentModel && currentModel.path) {
                const path = currentModel.path.replace(/\\/g, '/');
                const parts = path.split('/');
                // Get the parent folder (second to last part, since last is filename)
                if (parts.length >= 2) {
                    const folderName = parts[parts.length - 2];
                    input.value = folderName;
                }
            }
        });
    }
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

    // Get current location from URL
    currentLocation = getLocationFromUrl();
    console.log('Current location:', currentLocation);

    // Update location tabs UI
    updateLocationTabs();

    // Update current view and sort from settings after they're loaded
    currentView = settingsManager.getSetting('defaultView');
    currentSort = settingsManager.getSetting('defaultSort');

    // Apply saved view preference
    switchView(currentView, false);

    // Apply saved folder pane state
    folderSidebar.style.display = showSidebar ? 'block' : 'none';
    if (showSidebar) sidebarToggleBtn?.classList.add('active');

    // Apply saved folder view mode
    if (folderViewToggleBtn) {
        folderViewToggleBtn.innerHTML = folderViewMode === 'list' ? '<i class="fas fa-list"></i>' : '<i class="fas fa-sitemap"></i>';
    }

    // Apply saved folder density mode
    if (folderDensityToggleBtn) {
        folderDensityToggleBtn.innerHTML = folderDensityMode === 'comfy' ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
        if (folderDensityMode === 'compact') {
            folderContainer.classList.add('compact-view');
        } else {
            folderContainer.classList.remove('compact-view');
        }
    }

    // Set sort select value from settings
    sortSelect.value = currentSort;

    // Sync SafeMode toggle with hideNSFW setting
    const hideNSFW = settingsManager.getSetting('hideNSFW');
    safemodeToggle.checked = hideNSFW || false;

    closeSettingsModal();

    // Initialize bulk operations
    BulkOps.initBulkOperations(displayModels, refreshModels, settingsManager, generateRecommendedNameForModel);

    // Get the appropriate directory based on current location
    const dirPath = currentLocation === 'checkpoints'
        ? settingsManager.getSetting('checkpointsDirectory')
        : settingsManager.getSetting('modelsDirectory');

    // Check if refresh parameter is present (e.g., coming back from scan page)
    const urlParams = new URLSearchParams(window.location.search);
    const forceRefresh = urlParams.get('refresh') === 'true';

    // Clean up the URL by removing the refresh parameter (so manual page reload won't force refresh again)
    if (forceRefresh) {
        urlParams.delete('refresh');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }

    if (dirPath) {
        await loadModelsFromDirectory(dirPath, null, forceRefresh);
    } else {
        // Hide loading overlay if no directory is set
        hideLoadingOverlay();
    }
}

// Update the location tab UI states
function updateLocationTabs() {
    const lorasTab = document.getElementById('loras-tab');
    const checkpointsTab = document.getElementById('checkpoints-tab');
    const pageTitle = document.getElementById('page-title');

    if (lorasTab && checkpointsTab) {
        if (currentLocation === 'checkpoints') {
            lorasTab.classList.remove('active');
            checkpointsTab.classList.add('active');
            if (pageTitle) pageTitle.textContent = 'Checkpoint Manager';
        } else {
            lorasTab.classList.add('active');
            checkpointsTab.classList.remove('active');
            if (pageTitle) pageTitle.textContent = 'Lora Model Manager';
        }
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
async function loadModelsFromDirectory(dirPath, location = null, forceRefresh = false) {
    // Use provided location or fall back to currentLocation
    const loc = location || currentLocation;
    try {
        models = await ModelOps.loadModelsFromDirectory(dirPath, modelsContainer, loc, forceRefresh);
        BulkOps.setModelsReference(models);
        if (showSidebar) renderFolderSidebar();
        displayModels();
    } catch (error) {
        // Error already handled in ModelOps
    }
}
// Refresh models (wrapper for ModelOps)
async function refreshModels() {
    await ModelOps.refreshModels(settingsManager, loadModelsFromDirectory, openSettingsModal, currentLocation);
}

// Display models based on current view, sort, and search
// @param {Array} modelsToDisplay - Optional array of models to display (bypasses normal filtering)
function displayModels(modelsToDisplay = null) {
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

    // If specific models array provided, use it directly (bypasses filtering)
    // Filter models based on search term and NSFW setting
    let filteredModels = modelsToDisplay !== null ? modelsToDisplay : models;

    // Only apply filters when displaying normal models (not a custom filtered set)
    if (modelsToDisplay === null) {
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
                filteredModels = filteredModels.filter(model => {
                    const tags = (model.json?.['tags'] || '').toLowerCase();
                    return model.name.toLowerCase().includes(searchLower) ||
                        model.filename.toLowerCase().includes(searchLower) ||
                        model.category.toLowerCase().includes(searchLower) ||
                        tags.includes(searchLower);
                });
            }
        }

        // Apply base model filter (multi-select)
        if (currentModelFilters.length > 0) {
            filteredModels = filteredModels.filter(model =>
                currentModelFilters.includes(model.baseModel || 'Unknown')
            );
        }

        // Apply folder filter
        if (currentFolderFilter !== null) {
            filteredModels = filteredModels.filter(model => {
                const folder = getRelativeFolderPath(model) || 'Root';
                if (folderViewMode === 'tree') {
                    if (currentFolderFilter === 'Root') return folder === 'Root';
                    return folder === currentFolderFilter || folder.startsWith(currentFolderFilter + '\\');
                } else {
                    return folder === currentFolderFilter;
                }
            });
        }

        // Populate the model filter dropdown with unique base models
        populateModelFilter();

        // Sort models
        filteredModels = sortModels(filteredModels, currentSort);
    }

    // Store for modal navigation
    currentFilteredModels = filteredModels;

    // Display models based on current view using imported modules
    if (currentView === 'grid') {
        // If grouping is enabled, use grouped grid view
        if (currentGroupBy !== 'none') {
            displayGroupedGridView(filteredModels, modelsContainer, openModelDetails, settingsManager.getAllSettings(), currentGroupBy);
        } else {
            displayGridView(filteredModels, modelsContainer, openModelDetails, settingsManager.getAllSettings());
        }
    } else {
        displayTableView(filteredModels, modelsContainer, openModelDetails, settingsManager.getAllSettings(), currentGroupBy);
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
                valueA = (a.json?.web_civitai_data?.['civitai text'] || '').toLowerCase();
                valueB = (b.json?.web_civitai_data?.['civitai text'] || '').toLowerCase();
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

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (modelFilterBtn && modelFilterDropdown && !modelFilterBtn.contains(e.target) && !modelFilterDropdown.contains(e.target)) {
        modelFilterDropdown.style.display = 'none';
        modelFilterBtn.classList.remove('active');
    }
});

if (modelFilterBtn) {
    modelFilterBtn.addEventListener('click', () => {
        const isHidden = modelFilterDropdown.style.display === 'none';
        modelFilterDropdown.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            modelFilterBtn.classList.add('active');
        } else {
            modelFilterBtn.classList.remove('active');
        }
    });
}

// Handle model filter selection
function handleModelFilterChange(baseModel, isChecked) {
    if (isChecked) {
        if (!currentModelFilters.includes(baseModel)) {
            currentModelFilters.push(baseModel);
        }
    } else {
        currentModelFilters = currentModelFilters.filter(m => m !== baseModel);
    }

    // Update button text
    if (currentModelFilters.length === 0) {
        modelFilterText.textContent = 'All Models';
    } else if (currentModelFilters.length === 1) {
        modelFilterText.textContent = currentModelFilters[0];
    } else {
        modelFilterText.textContent = `${currentModelFilters.length} Models Selected`;
    }

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

    // Clear existing options
    modelFilterDropdown.innerHTML = '';

    if (sortedBaseModels.length === 0) {
        modelFilterDropdown.innerHTML = '<div style="padding: 8px; color: var(--color-text-secondary); font-size: 12px;">No models found</div>';
        currentModelFilters = [];
        if (modelFilterText) modelFilterText.textContent = 'All Models';
        return;
    }

    // Add options for each unique base model
    sortedBaseModels.forEach(baseModel => {
        const option = document.createElement('label');
        option.className = 'multi-select-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = baseModel;
        checkbox.checked = currentModelFilters.includes(baseModel);

        checkbox.addEventListener('change', (e) => {
            handleModelFilterChange(baseModel, e.target.checked);
        });

        const textSpan = document.createElement('span');
        textSpan.textContent = baseModel;

        option.appendChild(checkbox);
        option.appendChild(textSpan);
        modelFilterDropdown.appendChild(option);
    });
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
    // Get checkpoints directory input
    const checkpointsInput = document.getElementById('checkpointsDirectoryInput');

    // Get all settings from form
    const newSettings = {
        modelsDirectory: modelsDirectoryInput.value,
        checkpointsDirectory: checkpointsInput ? checkpointsInput.value : '',
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
        columnOrder: Array.from(document.querySelectorAll('#sortable-columns li')).map(li => li.dataset.columnKey),
        // Get filename formats
        filenameFormats: getFilenameFormats(),
        // Get model type roots
        modelTypeRoots: getModelTypeRoots(),
        // Get grid card settings
        gridCardSettings: {
            imageMode: document.getElementById('gridcard-imageMode')?.value || 'carousel',
            title: document.getElementById('gridcard-title')?.value || 'filename',
            subtitle1: document.getElementById('gridcard-subtitle1')?.value || 'folder',
            subtitle2: document.getElementById('gridcard-subtitle2')?.value || 'baseModel',
            subtitle3: document.getElementById('gridcard-subtitle3')?.value || 'none'
        }
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

        // Reload models for current location after settings change
        const dirPath = currentLocation === 'checkpoints'
            ? newSettings.checkpointsDirectory
            : newSettings.modelsDirectory;
        if (dirPath) {
            loadModelsFromDirectory(dirPath);
        }
    } else {
        console.log('Error saving settings');
    }
}

// Modal Navigation Functions
function updateNavButtonStates() {
    const prevBtn = document.getElementById('modal-prev-btn');
    const nextBtn = document.getElementById('modal-next-btn');

    if (prevBtn) {
        prevBtn.disabled = currentModelIndex <= 0;
    }
    if (nextBtn) {
        nextBtn.disabled = currentModelIndex >= currentFilteredModels.length - 1;
    }
}

function navigateModel(direction) {
    const newIndex = currentModelIndex + direction;

    if (newIndex >= 0 && newIndex < currentFilteredModels.length) {
        const model = currentFilteredModels[newIndex];
        openModelDetails(model);
    }
}

// Modal navigation event listeners
document.addEventListener('DOMContentLoaded', () => {
    const prevBtn = document.getElementById('modal-prev-btn');
    const nextBtn = document.getElementById('modal-next-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateModel(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateModel(1);
        });
    }

    // Keyboard navigation when modal is open
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('model-modal');
        if (modal && modal.style.display === 'block') {
            // Don't navigate if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateModel(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigateModel(1);
            }
        }
    });
});

// Model Details Functions
function openModelDetails(model) {
    console.log('Open model details:', model);
    currentModel = model;

    // Track current model index for navigation
    currentModelIndex = currentFilteredModels.findIndex(m => m.path === model.path);
    updateNavButtonStates();

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
    modelSha256.textContent = model.json?.['sha256'] || 'Not generated';

    // Set URL in the non-editable section
    const modelUrl = model.json?.web_civitai_data?.['url'] || model.json?.['url'] || '';
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
    document.getElementById('model-author-static').textContent = model.json?.web_civitai_data?.['civitai name'] || model.json?.['civitai name'] || '';
    document.getElementById('model-basemodel-static').textContent = model.baseModel || '';
    document.getElementById('model-creator-static').textContent = model.json?.web_civitai_data?.['creator'] || model.json?.['creator'] || '';

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
    const civitaiTextField = model.json?.web_civitai_data?.['civitai text'] || model.json?.['civitai text'] || '';
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
    const examplePromptField = model.json?.['example prompt 1'] || model.json?.['example prompt'] || '';
    document.getElementById('model-example-prompt').value = examplePromptField;
    document.getElementById('model-example-prompt-display').textContent = examplePromptField || '';

    // Example Prompt 2
    const examplePrompt2Field = model.json?.['example prompt 2'] || '';
    document.getElementById('model-example-prompt-2').value = examplePrompt2Field;
    document.getElementById('model-example-prompt-2-display').textContent = examplePrompt2Field || '';

    // Tags - using TagInput component
    const tagsField = model.json?.['tags'] || '';
    if (!tagsInput) {
        tagsInput = new TagInput('tags-container', 'model-tags', {
            onChange: async (value) => {
                currentModel.json['tags'] = value;
                await saveModel();
            }
        });
    }
    tagsInput.setTags(tagsField);

    // Model Name - initially from json['name'] or Civitai name as fallback
    const modelNameField = model.json?.['name'] || model.json?.web_civitai_data?.['civitai name'] || '';
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

    // Note: model-tags is handled by TagInput component with its own onChange handler

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
        if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
        currentModel.json.web_civitai_data['civitai text'] = val;
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
        currentModel.json['example prompt 1'] = val;
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
                    if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                    currentModel.json.web_civitai_data['civitai name'] = value;
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
                    if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                    currentModel.json.web_civitai_data['civitai text'] = value;
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
                    if (!currentModel.json.web_civitai_data) currentModel.json.web_civitai_data = {};
                    currentModel.json.web_civitai_data['creator'] = value;
                    break;
                case 'model-example-prompt':
                    currentModel.json['example prompt 1'] = value;
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
                showToast('Failed to save changes. Please try again.', 'error');
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
                            thumbnailIndex: thumbnailNumber,
                            location: currentLocation
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
                    showToast('Failed to delete thumbnail', 'error');
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
                            newOrder: newOrder,
                            location: currentLocation
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
                    showToast('Failed to set thumbnail as default', 'error');
                }
            });
        }
    }

    // Initialize image drop zone functionality
    initializeImageDropZone(() => currentModel, refreshModelData, () => currentLocation);
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
        showToast(error.message, 'error');
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
        showToast('JSON metadata saved successfully!', 'success');
    } catch (error) {
        showToast(error.message || 'Error saving JSON metadata. Please try again.', 'error');
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
            },
            currentLocation
        );

        // Update models array with fresh data
        if (result && result.updatedModels) {
            models = result.updatedModels;
        }
    } catch (error) {
        showToast(error.message || 'Error refreshing model data. Please try again.', 'error');
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
const downloadThumbnailBtn = document.getElementById('download-thumbnail-btn');
const generateSha256Btn = document.getElementById('generate-sha256-btn');
const deleteModelBtn = document.getElementById('delete-model-btn');

// Event Listeners (using CivitaiAPI module)
getCivitaiDataBtn?.addEventListener('click', () => CivitaiAPI.getCivitaiData(currentModel, refreshModelData));
downloadThumbnailBtn?.addEventListener('click', () => CivitaiAPI.downloadCivitaiThumbnail(currentModel, refreshModelData));
generateSha256Btn?.addEventListener('click', () => CivitaiAPI.generateSha256(currentModel, refreshModelData));

deleteModelBtn?.addEventListener('click', async () => {
    if (!currentModel) return;

    const count = 1;
    const confirmed = confirm(
        `⚠️ DELETE MODEL?\n\n` +
        `This will permanently delete:\n` +
        `• Model file (.safetensors)\n` +
        `• All associated files (.json, .civitai.info, .preview.png)\n\n` +
        `This action cannot be undone!\n\n` +
        `Are you sure you want to delete "${currentModel.name}"?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch('/delete-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelPath: currentModel.path })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success' || data.status === 'partial') {
            showToast(`Successfully deleted ${data.deletedFiles.length} file(s)`, 'success');
            closeModelModal();
            refreshModels();
        } else {
            showToast('Failed to delete model', 'error');
        }
    } catch (error) {
        console.error('Error deleting model:', error);
        showToast(`Error deleting model: ${error.message}`, 'error');
    }
});


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
        currentModel.json?.web_civitai_data?.['civitai name'] ||
        currentModel.json?.['civitai name'] ||
        '';

    if (civitaiName) {
        // Populate the filename field (without extension)
        modelFilename.value = civitaiName;
        console.log(`Populated filename with Civitai name: ${civitaiName}`);
    } else {
        showToast('No Civitai name available for this model', 'warning');
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
        showToast('Filename does not contain "High" or "Low" to swap', 'warning');
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
        showToast(`No prefix mapping found for base model: "${baseModel}". Supported: Pony, SDXL 1.0, Illustrious, ZImageTurbo`, 'warning');
        return;
    }

    // Check if prefix already exists at the start
    if (currentFilename.startsWith(prefix)) {
        showToast(`Prefix "${prefix}" already exists at the beginning of the filename`, 'info');
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
        showToast(`No suffix mapping found for base model: "${baseModel}". Supported: Wan Video 2.2 models`, 'warning');
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
async function populateFileLocationDropdown(modelRelativePath) {
    const fileLocationSelect = document.getElementById('model-file-location');

    if (!fileLocationSelect) {
        console.error('File location dropdown not found');
        return;
    }

    try {
        // Fetch available folders from server using the global currentLocation (loras/checkpoints)
        const response = await fetch(`/get-folders?location=${encodeURIComponent(currentLocation)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        let folders = data.folders || [];

        // Filter folders based on model type (baseModel)
        const baseModel = currentModel?.baseModel;
        if (baseModel) {
            const modelTypeRoots = settingsManager.getSetting('modelTypeRoots') || [];
            const mapping = modelTypeRoots.find(r => r.baseModel === baseModel);
            if (mapping && mapping.rootFolder) {
                // Ensure rootPath uses standard slashes and doesn't end with slash
                const rootPath = mapping.rootFolder.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
                folders = folders.filter(f => {
                    if (f.path === '') return false; // Exclude root if a specific root is defined
                    const fPath = f.path.replace(/\\/g, '/').toLowerCase();
                    return fPath === rootPath || fPath.startsWith(rootPath + '/');
                });
            }
        }

        // Clear existing options
        fileLocationSelect.innerHTML = '';

        // Populate dropdown with folders
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.path;
            option.textContent = folder.name;

            // Select the current location based on model's relative path
            if (folder.path === modelRelativePath ||
                (folder.path === '' && modelRelativePath === '')) {
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
        showToast('Model is already in the selected location', 'info');
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
            showToast(`Success! Moved ${data.filesMoved} file(s) to ${targetLocationDisplay}`, 'success');

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
        showToast(`Error moving model: ${error.message}`, 'error');
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
        showToast('No Model Name available', 'warning');
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
        showToast('Model Name is required to generate a recommended filename', 'warning');
        return;
    }

    const baseModel = currentModel.baseModel || '';

    // Get High/Low toggle value for variables
    const highLowToggle = document.getElementById('high-low-toggle');
    const highLowValue = highLowToggle?.getAttribute('data-value') || '';

    // Get Category and Subcategory for variables
    const category = currentModel.category || '';
    const subcategory = currentModel.json?.['subcategory'] || '';

    // Get formats from settings
    const formats = settingsManager.getSetting('filenameFormats') || [];

    // Find matching format
    // Try exact match first (case insensitive)
    let matchingFormat = formats.find(f => f.baseModel && f.baseModel.toLowerCase() === baseModel.toLowerCase());

    if (!matchingFormat) {
        matchingFormat = formats.find(f => f.baseModel === 'Default');
    }

    // Fallback if no format found at all
    let formatString = matchingFormat ? matchingFormat.format : '{modelname} {version}';

    // Check if format uses {highlow} and warn if missing
    if (formatString.toLowerCase().includes('{highlow}') && (!highLowValue || highLowValue.toLowerCase() === 'none')) {
        showToast('⚠️ High/Low is required for this format but is missing or set to "None"', 'warning');
        // Still generate the name but with warning - user can see it's incomplete
    }

    // Replace variables (case-insensitive)
    let recommendedName = formatString
        .replace(/{modelname}/gi, modelName)
        .replace(/{version}/gi, version)
        .replace(/{highlow}/gi, (highLowValue && highLowValue.toLowerCase() !== 'none') ? highLowValue : '')
        .replace(/{category}/gi, category)
        .replace(/{subcategory}/gi, subcategory);

    // Clean up double spaces
    recommendedName = recommendedName.replace(/\s+/g, ' ').trim();

    // Populating the filename field (without extension)
    modelFilename.value = recommendedName;
    console.log(`Generated Recommended Filename: ${recommendedName} (Format used: ${matchingFormat ? matchingFormat.baseModel : 'Fallback'})`);
    showToast(`Generated filename using format: ${matchingFormat ? matchingFormat.baseModel : 'Default'}`, 'success');
}

/**
 * Generate a recommended filename for a given model object (used by bulk rename)
 * @param {Object} model - Model object with name, json, baseModel, category, etc.
 * @param {boolean} returnDetails - If true, returns object with details about missing variables
 * @returns {string|Object} The recommended filename, or object with details if returnDetails is true
 */
function generateRecommendedNameForModel(model, returnDetails = false) {
    if (!model) return returnDetails ? { name: '', missingRequired: [] } : '';

    const modelName = model.json?.['name'] || '';
    const version = model.json?.['model version'] || '';
    const baseModel = model.baseModel || '';
    const highLowValue = model.json?.['high low'] || '';
    const category = model.category || '';
    const subcategory = model.json?.['subcategory'] || '';

    if (!modelName) {
        // If no model name in JSON, return current name
        const currentName = model.name || '';
        return returnDetails ? { name: currentName, missingRequired: [] } : currentName;
    }

    // Get formats from settings
    const formats = settingsManager.getSetting('filenameFormats') || [];

    // Find matching format (case insensitive)
    let matchingFormat = formats.find(f => f.baseModel && f.baseModel.toLowerCase() === baseModel.toLowerCase());

    if (!matchingFormat) {
        matchingFormat = formats.find(f => f.baseModel === 'Default');
    }

    // Fallback if no format found at all
    let formatString = matchingFormat ? matchingFormat.format : '{modelname} {version}';

    // Check for missing required variables
    const missingRequired = [];
    if (formatString.toLowerCase().includes('{highlow}') && !highLowValue) {
        missingRequired.push({ variable: 'highlow', label: 'High/Low', modelName: model.name });
    }

    // Replace variables (case-insensitive)
    let recommendedName = formatString
        .replace(/{modelname}/gi, modelName)
        .replace(/{version}/gi, version)
        .replace(/{highlow}/gi, highLowValue)
        .replace(/{category}/gi, category)
        .replace(/{subcategory}/gi, subcategory);

    // Clean up double spaces
    recommendedName = recommendedName.replace(/\s+/g, ' ').trim();

    if (returnDetails) {
        return {
            name: recommendedName,
            missingRequired: missingRequired,
            format: matchingFormat?.baseModel || 'Default'
        };
    }
    return recommendedName;
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
        currentModel.json?.web_civitai_data?.['civitai name'] ||
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
        showToast('No Civitai name available for this model', 'warning');
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

    // 6. Convert ALL CAPS words to Title Case, while preserving mixed case
    modelName = modelName.replace(/\b([A-Z]{2,})\b/g, (match) => {
        // Convert ALL CAPS to Title Case (first letter upper, rest lower)
        return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });

    // 7. Capitalize first letter of each word (for lowercase words)
    modelName = modelName.replace(/\b[a-z]/g, char => char.toUpperCase());

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

// ===== Model Version Helper Buttons =====

// DOM Element for Guess Version button
const guessVersionBtn = document.getElementById('guess-version-btn');
guessVersionBtn?.addEventListener('click', handleGuessVersion);

/**
 * Guess version number from model name or filename
 * Looks for patterns like "v2.0", "v1.4", "12", etc.
 */
function handleGuessVersion() {
    if (!currentModel) return;

    const versionField = document.getElementById('model-version');
    if (!versionField) return;

    // Get potential sources for version info
    const modelName = currentModel.json?.['name'] || '';
    const filename = currentModel.name || currentModel.filename || '';
    const civitaiName = currentModel.json?.web_civitai_data?.['civitai name'] || currentModel.json?.['civitai name'] || '';

    // Combine all sources to search
    const searchTexts = [modelName, filename, civitaiName];

    let bestVersion = null;

    for (const text of searchTexts) {
        if (!text) continue;

        // Priority 1: Look for "v" followed by a number (e.g., "v2.0", "v1.4", "v12")
        // Match the LAST occurrence of v-number pattern (most likely to be the version)
        const vMatches = text.match(/v(\d+(?:\.\d+)?)/gi);
        if (vMatches && vMatches.length > 0) {
            // Take the last match as it's usually the version
            const lastMatch = vMatches[vMatches.length - 1];
            const numMatch = lastMatch.match(/v(\d+(?:\.\d+)?)/i);
            if (numMatch) {
                bestVersion = formatVersionNumber(numMatch[1]);
                break;
            }
        }
    }

    // If no v-prefixed version found, look for standalone numbers
    if (!bestVersion) {
        for (const text of searchTexts) {
            if (!text) continue;

            // Look for numbers that might be versions (standalone numbers at end of name)
            // Avoid matching things like model IDs (usually larger numbers)
            const matches = text.match(/\b(\d+(?:\.\d+)?)\b/g);
            if (matches && matches.length > 0) {
                // Take the last match, prefer smaller numbers (more likely to be versions)
                for (let i = matches.length - 1; i >= 0; i--) {
                    const num = parseFloat(matches[i]);
                    // Versions are typically small numbers (< 100)
                    if (num < 100) {
                        bestVersion = formatVersionNumber(matches[i]);
                        break;
                    }
                }
                if (bestVersion) break;
            }
        }
    }

    if (bestVersion) {
        versionField.value = bestVersion;
        showToast(`Guessed version: ${bestVersion}`, 'success');
    } else {
        showToast('Could not detect version from name or filename', 'warning');
    }
}

/**
 * Format version number: 1.0 -> 1, 1.4 -> 1.4, 0.3 -> 0.3
 */
function formatVersionNumber(versionStr) {
    const num = parseFloat(versionStr);
    // If it's a whole number (1.0, 2.0), return just the integer
    if (num === Math.floor(num)) {
        return String(Math.floor(num));
    }
    // Otherwise keep the decimal
    return String(num);
}

// Show/hide version helper buttons when entering/exiting edit mode
function setupVersionHelperButtons() {
    const helperButtonsContainer = document.querySelector('.version-helper-buttons');
    if (!helperButtonsContainer) return;

    const versionInput = document.getElementById('model-version');
    const versionDisplay = document.getElementById('model-version-display');

    if (!versionInput || !versionDisplay) return;

    // Create a MutationObserver to watch for display changes on the input
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                const inputVisible = versionInput.style.display === 'block';
                helperButtonsContainer.style.display = inputVisible ? 'flex' : 'none';
            }
        });
    });

    // Observe changes to the input's style attribute
    observer.observe(versionInput, { attributes: true });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay to ensure other setup has completed
    setTimeout(setupModelNameHelperButtons, 100);
    setTimeout(setupVersionHelperButtons, 100);
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
    const creatorName = currentModel.json?.web_civitai_data?.creator || 
        currentModel.json?.['creator'] ||
        currentModel.civitaiInfo?.creator?.username ||
        '';

    if (!creatorName) {
        showToast('No creator name available for this model', 'warning');
        return;
    }

    // Get current filename
    const currentFilename = modelFilename.value;

    // Check if the creator suffix already exists
    const suffixPattern = new RegExp(`\\s*-\\s*${creatorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (suffixPattern.test(currentFilename)) {
        showToast(`Creator suffix "- ${creatorName}" already exists in the filename`, 'info');
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

// ===== Base Model Dropdown Functions =====

// Get unique base models from all loaded models (same logic as populateModelFilter)
function getUniqueBaseModels() {
    const baseModels = new Set();
    models.forEach(model => {
        const baseModel = model.baseModel || 'Unknown';
        if (baseModel && baseModel !== 'Unknown') {
            baseModels.add(baseModel);
        }
    });

    // Convert to array and sort alphabetically
    return Array.from(baseModels).sort((a, b) => a.localeCompare(b));
}

// Populate the base model dropdown with existing base models
function populateBaseModelDropdown(currentValue = '') {
    const select = document.getElementById('model-basemodel-select');
    if (!select) return;

    // Clear existing options except first two (placeholder and custom)
    while (select.options.length > 2) {
        select.remove(2);
    }

    // Get unique base models
    const baseModels = getUniqueBaseModels();

    // Add options for each base model
    baseModels.forEach(baseModel => {
        const option = document.createElement('option');
        option.value = baseModel;
        option.textContent = baseModel;
        // Insert before the Custom option (which is at index 1)
        select.add(option, select.options.length);
    });

    // Set the current value
    if (currentValue) {
        // Check if the current value exists in the options
        const existingOption = Array.from(select.options).find(opt => opt.value === currentValue);
        if (existingOption) {
            select.value = currentValue;
        } else if (currentValue !== '') {
            // Current value is custom - show custom input
            select.value = '__custom__';
            const customInput = document.getElementById('model-basemodel-custom');
            if (customInput) {
                customInput.value = currentValue;
                customInput.style.display = 'block';
            }
        }
    }
}

// Initialize base model dropdown event handlers
function initBaseModelDropdown() {
    const editBtn = document.getElementById('edit-basemodel-btn');
    const saveBtn = document.getElementById('save-basemodel-btn');
    const cancelBtn = document.getElementById('cancel-basemodel-btn');
    const staticDisplay = document.getElementById('model-basemodel-static');
    const editContainer = document.getElementById('model-basemodel-edit-container');
    const select = document.getElementById('model-basemodel-select');
    const customInput = document.getElementById('model-basemodel-custom');

    if (!editBtn || !saveBtn || !cancelBtn || !staticDisplay || !editContainer || !select || !customInput) {
        console.warn('Base model dropdown elements not found');
        return;
    }

    // Handle select change - show/hide custom input
    select.addEventListener('change', () => {
        if (select.value === '__custom__') {
            customInput.style.display = 'block';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
            customInput.value = '';
        }
    });

    // Edit button click
    editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Populate dropdown with current base models
        populateBaseModelDropdown(currentModel?.baseModel || '');

        // Hide static display, show edit container
        staticDisplay.style.display = 'none';
        editContainer.style.display = 'flex';

        // Toggle buttons
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
    });

    // Cancel button click
    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Hide edit container, show static display
        editContainer.style.display = 'none';
        customInput.style.display = 'none';
        customInput.value = '';
        staticDisplay.style.display = 'inline';

        // Toggle buttons
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    });

    // Save button click
    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Get the value - either from dropdown or custom input
        let newValue;
        if (select.value === '__custom__') {
            newValue = customInput.value.trim();
        } else if (select.value === '') {
            newValue = '';
        } else {
            newValue = select.value;
        }

        try {
            // Update the model
            currentModel.baseModel = newValue;

            // Save to server
            await saveModel();

            // Update static display
            staticDisplay.textContent = newValue;

            // Hide edit container, show static display
            editContainer.style.display = 'none';
            customInput.style.display = 'none';
            customInput.value = '';
            staticDisplay.style.display = 'inline';

            // Toggle buttons
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';

            // Refresh models to update filter dropdown if needed
            displayModels();

        } catch (error) {
            console.error('Error saving base model:', error);
            showToast('Failed to save base model. Please try again.', 'error');
        }
    });
}

function renderFolderSidebar() {
    if (!folderContainer) return;

    folderContainer.innerHTML = '';

    // Apply Safe Mode check
    const hideNSFW = settingsManager.getSetting('hideNSFW');
    const visibleModels = hideNSFW
        ? models.filter(model => !(model.json && model.json['nsfw'] === 'true'))
        : models;

    // Add "All Folders" option
    const allItem = document.createElement('div');
    allItem.className = 'folder-item';
    const allContent = document.createElement('div');
    allContent.className = `folder-content ${currentFolderFilter === null ? 'active' : ''}`;
    allContent.innerHTML = `
        <i class="fas fa-layer-group folder-icon"></i>
        <span class="folder-name">All Folders</span>
        <span class="folder-count">${visibleModels.length}</span>
    `;
    allContent.addEventListener('click', () => {
        currentFolderFilter = null;
        renderFolderSidebar();
        displayModels();
    });
    allItem.appendChild(allContent);
    folderContainer.appendChild(allItem);

    // Get all folders and subfolders
    const folderStats = {};
    visibleModels.forEach(model => {
        const folder = getRelativeFolderPath(model) || 'Root';
        folderStats[folder] = (folderStats[folder] || 0) + 1;
    });

    if (folderViewMode === 'list') {
        const sortedFolders = Object.keys(folderStats).sort((a, b) => a.localeCompare(b));

        sortedFolders.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'folder-item';

            const content = document.createElement('div');
            content.className = `folder-content ${currentFolderFilter === folder ? 'active' : ''}`;

            let displayFolder = '';
            if (folder === 'Root') {
                displayFolder = folder;
            } else {
                const parts = folder.split('\\');
                const lastPart = parts.pop();
                if (parts.length > 0) {
                    displayFolder = `<span style="opacity: 0.5; font-size: 0.85em;">${parts.join(' | ')} | </span>`;
                }
                displayFolder += `<strong style="font-weight: 500;">${lastPart}</strong>`;
            }

            content.innerHTML = `
                <i class="fas fa-folder folder-icon"></i>
                <span class="folder-name" title="${folder}">${displayFolder}</span>
                <span class="folder-count">${folderStats[folder]}</span>
            `;

            content.addEventListener('click', () => {
                currentFolderFilter = folder;
                renderFolderSidebar();
                displayModels();
            });

            item.appendChild(content);
            folderContainer.appendChild(item);
        });
    } else {
        // Built Tree
        const buildTree = (paths) => {
            const root = { name: 'Root', children: {}, count: 0, fullPath: 'Root' };
            Object.keys(paths).forEach(path => {
                if (path === 'Root') {
                    root.count += paths[path];
                    return;
                }
                const parts = path.split(/[/\\]/);
                let current = root;
                root.count += paths[path];

                let currentPath = '';
                parts.forEach((part, i) => {
                    currentPath += (i > 0 ? '\\' : '') + part;
                    if (!current.children[part]) {
                        current.children[part] = {
                            name: part,
                            children: {},
                            count: 0,
                            fullPath: currentPath
                        };
                    }
                    current.children[part].count += paths[path];
                    current = current.children[part];
                });
            });
            return root;
        };

        const tree = buildTree(folderStats);

        const renderTree = (node, container, isRootNode = false) => {
            if (isRootNode) {
                // Render root contents
                if (folderStats['Root']) {
                    const item = document.createElement('div');
                    item.className = 'folder-item';
                    const content = document.createElement('div');
                    content.className = `folder-content ${currentFolderFilter === 'Root' ? 'active' : ''}`;
                    content.innerHTML = `
                        <i class="fas fa-folder folder-icon"></i>
                        <span class="folder-name">Root</span>
                        <span class="folder-count">${folderStats['Root']}</span>
                    `;
                    content.addEventListener('click', () => {
                        currentFolderFilter = 'Root';
                        renderFolderSidebar();
                        displayModels();
                    });
                    item.appendChild(content);
                    container.appendChild(item);
                }

                Object.keys(node.children).sort((a, b) => a.localeCompare(b)).forEach(key => {
                    renderTree(node.children[key], container);
                });
                return;
            }

            const item = document.createElement('div');
            item.className = 'folder-item';

            const content = document.createElement('div');
            content.className = `folder-content ${currentFolderFilter === node.fullPath ? 'active' : ''}`;

            const hasChildren = Object.keys(node.children).length > 0;
            const toggleIcon = hasChildren ? '<i class="fas fa-caret-down folder-toggle"></i>' : '<span style="width:24px;margin-right:4px;"></span>';

            let selfCount = folderStats[node.fullPath] || 0;
            const displayCount = selfCount > 0 ? selfCount : node.count;

            content.innerHTML = `
                ${toggleIcon}
                <i class="fas ${hasChildren ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                <span class="folder-name" title="${node.fullPath}">${node.name}</span>
                <span class="folder-count">${displayCount}</span>
            `;

            if (hasChildren) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
                Object.keys(node.children).sort((a, b) => a.localeCompare(b)).forEach(key => {
                    renderTree(node.children[key], childrenContainer);
                });

                const toggleBtn = content.querySelector('.folder-toggle');
                toggleBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = childrenContainer.style.display !== 'none';
                    childrenContainer.style.display = isExpanded ? 'none' : 'block';
                    toggleBtn.className = `fas ${isExpanded ? 'fa-caret-right' : 'fa-caret-down'} folder-toggle`;
                    const folderIcon = content.querySelector('.folder-icon');
                    folderIcon.className = `fas ${isExpanded ? 'fa-folder' : 'fa-folder-open'} folder-icon`;
                });

                item.appendChild(content);
                item.appendChild(childrenContainer);
            } else {
                item.appendChild(content);
            }

            content.addEventListener('click', (e) => {
                if (e.target.classList.contains('folder-toggle')) return;
                currentFolderFilter = node.fullPath;
                renderFolderSidebar();
                displayModels();
            });

            container.appendChild(item);
        };

        renderTree(tree, folderContainer, true);
    }
}

// Initialize base model dropdown when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay to ensure other setup has completed
    setTimeout(initBaseModelDropdown, 100);
});
