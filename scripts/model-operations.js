// ===== Model Operations Module =====
// Handles all model CRUD operations and server interactions

import { showLoadingOverlay, hideLoadingOverlay } from './ui-utils.js';

/**
 * Load models from the specified directory
 * @param {string} dirPath - Path to models directory
 * @param {HTMLElement} modelsContainer - Container element for displaying models
 * @returns {Promise<Array>} Array of model objects
 */
export async function loadModelsFromDirectory(dirPath, modelsContainer) {
    try {
        const response = await fetch('/load-loras?path=' + encodeURIComponent(dirPath));
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }
        const models = await response.json();
        return models;
    } catch (error) {
        console.error('Error loading Lora data:', error);
        if (modelsContainer) {
            modelsContainer.innerHTML = `
                <div class="placeholder-message">
                    <p>${error.message || 'Error loading models. Please check the directory path in settings and try again.'}</p>
                </div>
            `;
        }
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Refresh models from directory
 * @param {Object} settingsManager - Settings manager instance
 * @param {Function} loadCallback - Callback to load and display models
 * @param {Function} openSettingsCallback - Callback to open settings modal
 */
export async function refreshModels(settingsManager, loadCallback, openSettingsCallback) {
    const dirPath = settingsManager.getSetting('modelsDirectory');
    if (dirPath) {
        showLoadingOverlay();
        await loadCallback(dirPath);
    } else {
        alert('No models directory set. Please set a directory in Settings.');
        openSettingsCallback();
    }
}

/**
 * Save/rename model filename
 * @param {Object} currentModel - Current model object
 * @param {string} newName - New filename
 * @param {Function} refreshCallback - Callback to refresh models after rename
 * @returns {Promise<Object>} Updated model object
 */
export async function saveFilename(currentModel, newName, refreshCallback) {
    if (!currentModel) {
        throw new Error('No model selected');
    }

    const oldName = currentModel.name;

    if (oldName === newName.trim()) {
        return currentModel; // No change
    }

    try {
        const response = await fetch('/rename-lora', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                oldName: oldName,
                newName: newName.trim()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Update model object
        currentModel.name = newName.trim();
        currentModel.filename = newName.trim() + '.safetensors';

        // Refresh the model list
        if (refreshCallback) {
            refreshCallback();
        }

        return currentModel;
    } catch (error) {
        console.error('Error renaming file:', error);
        throw new Error('Error renaming file. Please try again.');
    }
}

/**
 * Save JSON metadata for model
 * @param {Object} currentModel - Current model object
 * @param {string} jsonContent - JSON content to save
 * @param {string} jsonType - Type of JSON ('model' or 'civitai')
 */
export async function saveJsonMetadata(currentModel, jsonContent, jsonType = 'model') {
    if (!currentModel) {
        throw new Error('No model selected');
    }

    try {
        let jsonData;
        try {
            jsonData = JSON.parse(jsonContent);
        } catch (e) {
            throw new Error('Invalid JSON format. Please check your syntax.');
        }

        const endpoint = jsonType === 'model' ? '/save-json' : '/save-civitai';
        const response = await fetch(`${endpoint}?name=${encodeURIComponent(currentModel.name)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: jsonContent
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('Error saving JSON metadata:', error);
        throw error;
    }
}

/**
 * Refresh current model data from server
 * @param {Object} currentModel - Current model object  
 * @param {Array} models - Array of all models
 * @param {Function} updateCallback - Callback to update UI with refreshed model
 * @returns {Promise<Object>} Updated current model
 */
export async function refreshModelData(currentModel, models, updateCallback) {
    if (!currentModel) {
        throw new Error('No model selected');
    }

    try {
        // Fetch the latest data for all models
        const response = await fetch('/load-loras?refresh=true');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Update the models array
        const updatedModels = await response.json();

        // Find the current model in the updated data
        const updatedModel = updatedModels.find(model => model.name === currentModel.name);

        if (updatedModel) {
            // Call the update callback to refresh UI
            if (updateCallback) {
                updateCallback(updatedModel);
            }

            console.log('Model data refreshed successfully');
            return { updatedModel, updatedModels };
        } else {
            throw new Error('Could not find the current model in the updated data. The model may have been renamed or deleted.');
        }
    } catch (error) {
        console.error('Error refreshing model data:', error);
        throw error;
    }
}
