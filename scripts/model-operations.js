// ===== Model Operations Module =====
// Handles all model CRUD operations and server interactions

import { showLoadingOverlay, hideLoadingOverlay } from './ui-utils.js';
import { showToast } from './toast.js';

/**
 * Load models from the specified directory
 * @param {string} dirPath - Path to models directory
 * @param {HTMLElement} modelsContainer - Container element for displaying models
 * @param {string} location - Location type ('loras' or 'checkpoints')
 * @param {boolean} forceRefresh - If true, forces a cache refresh to detect new files
 * @returns {Promise<Array>} Array of model objects
 */
export async function loadModelsFromDirectory(dirPath, modelsContainer, location = 'loras', forceRefresh = false) {
    try {
        const refreshParam = forceRefresh ? '&refresh=true' : '';
        const response = await fetch(`/load-loras?location=${encodeURIComponent(location)}${refreshParam}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }
        const models = await response.json();
        return models;
    } catch (error) {
        console.error('Error loading model data:', error);
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
 * Refresh models from directory (forces cache refresh)
 * @param {Object} settingsManager - Settings manager instance
 * @param {Function} loadCallback - Callback to load and display models (dirPath, location, forceRefresh)
 * @param {Function} openSettingsCallback - Callback to open settings modal
 * @param {string} location - Location type ('loras' or 'checkpoints')
 */
export async function refreshModels(settingsManager, loadCallback, openSettingsCallback, location = 'loras') {
    const settingKey = location === 'checkpoints' ? 'checkpointsDirectory' : 'modelsDirectory';
    const dirPath = settingsManager.getSetting(settingKey);

    if (dirPath) {
        showLoadingOverlay();
        // Pass forceRefresh=true to ensure cache is refreshed
        await loadCallback(dirPath, location, true);
    } else {
        const locName = location === 'checkpoints' ? 'checkpoints' : 'LoRAs';
        showToast(`No ${locName} directory set. Please set a directory in Settings.`, 'warning');
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
 * @param {string} location - Location type ('loras' or 'checkpoints')
 * @returns {Promise<Object>} Updated current model
 */
export async function refreshModelData(currentModel, models, updateCallback, location = 'loras') {
    if (!currentModel) {
        throw new Error('No model selected');
    }

    try {
        // Fetch the latest data for the specific model
        const response = await fetch(`/load-single-model?modelName=${encodeURIComponent(currentModel.name)}&location=${encodeURIComponent(location)}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Could not find the current model in the updated data. The model may have been renamed or deleted.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the updated model data
        const updatedModel = await response.json();

        if (updatedModel) {
            // Update the model in the models array
            const modelIndex = models.findIndex(m => m.name === currentModel.name);
            if (modelIndex !== -1) {
                models[modelIndex] = updatedModel;
            } else {
                models.push(updatedModel);
            }

            // Call the update callback to refresh UI
            if (updateCallback) {
                updateCallback(updatedModel);
            }

            console.log('Model data refreshed successfully');
            return { updatedModel, updatedModels: models };
        } else {
            throw new Error('Could not find the current model in the updated data. The model may have been renamed or deleted.');
        }
    } catch (error) {
        console.error('Error refreshing model data:', error);
        throw error;
    }
}
