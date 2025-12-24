// ===== Civitai API Integration Module =====
// Handles all Civitai API interactions and related operations

/**
 * Show status message in Civitai status area
 * @param {string} message - Message to display
 * @param {string} type - Message type ('info', 'success', 'error')
 */
export function showCivitaiStatus(message, type = 'info') {
    const statusElement = document.getElementById('civitai-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `civitai-status ${type}`;
    }
}

/**
 * Disable/enable Civitai action buttons
 * @param {boolean} disabled - Whether to disable buttons
 */
export function disableCivitaiButtons(disabled = true) {
    const buttons = [
        document.getElementById('get-civitai-data-btn'),
        document.getElementById('create-json-btn'),
        document.getElementById('download-thumbnail-btn'),
        document.getElementById('fix-thumbnail-btn')
    ];
    buttons.forEach(btn => btn && (btn.disabled = disabled));
}

/**
 * Fetch Civitai data for a model
 * @param {Object} model - Model object
 * @param {Function} refreshCallback - Callback to refresh model data
 */
export async function getCivitaiData(model, refreshCallback) {
    if (!model) throw new Error('No model provided');

    disableCivitaiButtons(true);
    showCivitaiStatus(`Fetching Civitai data for ${model.name}...`, 'info');

    try {
        const response = await fetch('/civitai/get-model-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelPath: model.path })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            showCivitaiStatus('✓ Civitai data saved successfully!', 'success');
            if (refreshCallback) await refreshCallback();
        } else if (data.status === 'not_found') {
            // Ask user if they want to create a dummy file
            const createDummy = confirm(
                `Model not found on Civitai.\n\n` +
                `Would you like to create an empty info file to prevent checking this model again?`
            );

            if (createDummy) {
                showCivitaiStatus('Creating dummy info file...', 'info');
                await createDummyInfoFile(model, refreshCallback);
            } else {
                showCivitaiStatus('⚠ Model not found on Civitai', 'error');
            }
        } else {
            showCivitaiStatus(`✗ Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error fetching Civitai data:', error);
        showCivitaiStatus(`✗ Error: ${error.message}`, 'error');
        throw error;
    } finally {
        disableCivitaiButtons(false);
    }
}

/**
 * Create JSON from .civitai.info file
 * @param {Object} model - Model object
 * @param {Function} refreshCallback - Callback to refresh model data
 */
export async function convertCivitaiToJson(model, refreshCallback) {
    if (!model) throw new Error('No model provided');

    disableCivitaiButtons(true);
    showCivitaiStatus(`Converting to JSON for ${model.name}...`, 'info');

    try {
        const response = await fetch('/civitai/convert-to-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelPath: model.path,
                useApi: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            showCivitaiStatus('✓ JSON created successfully!', 'success');
            if (refreshCallback) await refreshCallback();
        } else {
            showCivitaiStatus(`✗ Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error creating JSON:', error);
        showCivitaiStatus(`✗ Error: ${error.message}`, 'error');
        throw error;
    } finally {
        disableCivitaiButtons(false);
    }
}

/**
 * Download thumbnail from Civitai
 * @param {Object} model - Model object
 * @param {Function} refreshCallback - Callback to refresh model data
 */
export async function downloadCivitaiThumbnail(model, refreshCallback) {
    if (!model) throw new Error('No model provided');

    disableCivitaiButtons(true);
    showCivitaiStatus(`Downloading thumbnail for ${model.name}...`, 'info');

    try {
        const response = await fetch('/civitai/download-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelPath: model.path,
                maxSize: false,
                skipNsfw: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            showCivitaiStatus('✓ Thumbnail downloaded successfully!', 'success');
            if (refreshCallback) await refreshCallback();
        } else {
            showCivitaiStatus(`⊝ ${data.message}`, 'info');
        }
    } catch (error) {
        console.error('Error downloading thumbnail:', error);
        showCivitaiStatus(`✗ Error: ${error.message}`, 'error');
        throw error;
    } finally {
        disableCivitaiButtons(false);
    }
}

/**
 * Fix thumbnail naming
 * @param {Object} model - Model object
 * @param {Function} refreshCallback - Callback to refresh model data
 */
export async function fixThumbnailName(model, refreshCallback) {
    if (!model) throw new Error('No model provided');

    disableCivitaiButtons(true);
    showCivitaiStatus(`Fixing thumbnail name for ${model.name}...`, 'info');

    try {
        const response = await fetch('/civitai/fix-thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelPath: model.path
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            showCivitaiStatus(`✓ ${data.message}`, 'success');
            if (refreshCallback) await refreshCallback();
        } else if (data.status === 'skipped') {
            showCivitaiStatus(`⊝ ${data.message}`, 'info');
        } else {
            showCivitaiStatus(`⊝ ${data.message}`, 'info');
        }
    } catch (error) {
        console.error('Error fixing thumbnail:', error);
        showCivitaiStatus(`✗ Error: ${error.message}`, 'error');
        throw error;
    } finally {
        disableCivitaiButtons(false);
    }
}

/**
 * Create dummy info file for model not found on Civitai
 * @param {Object} model - Model object
 * @param {Function} refreshCallback - Callback to refresh model data
 */
export async function createDummyInfoFile(model, refreshCallback) {
    if (!model) throw new Error('No model provided');

    try {
        const response = await fetch('/civitai/create-dummy-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelPath: model.path
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            showCivitaiStatus('✓ Dummy info file created. Model will be skipped in future scans.', 'success');
            if (refreshCallback) await refreshCallback();
        } else {
            showCivitaiStatus(`✗ Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error creating dummy info file:', error);
        showCivitaiStatus(`✗ Error: ${error.message}`, 'error');
        throw error;
    }
}
