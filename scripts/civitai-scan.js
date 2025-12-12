// Civitai Scan Page JavaScript
// Handles scanning, downloading previews, and converting to JSON

let models = [];
let currentOperation = null;

// DOM Elements
const backButton = document.getElementById('backButton');
const scanModelsBtn = document.getElementById('scanModelsBtn');
const downloadPreviewsBtn = document.getElementById('downloadPreviewsBtn');
const convertToJsonBtn = document.getElementById('convertToJsonBtn');
const fixThumbnailsBtn = document.getElementById('fixThumbnailsBtn');
const clearLogBtn = document.getElementById('clearLogBtn');

const skipExistingCheckbox = document.getElementById('skipExisting');
const skipNsfwPreviewCheckbox = document.getElementById('skipNsfwPreview');
const maxSizePreviewCheckbox = document.getElementById('maxSizePreview');
const useApiForCreatorCheckbox = document.getElementById('useApiForCreator');
const delayInput = document.getElementById('delayBetweenRequests');

const progressText = document.getElementById('progressText');
const progressCount = document.getElementById('progressCount');
const progressBar = document.getElementById('progressBar');

const totalModelsSpan = document.getElementById('totalModels');
const modelsWithInfoSpan = document.getElementById('modelsWithInfo');
const modelsWithoutInfoSpan = document.getElementById('modelsWithoutInfo');
const resultsLog = document.getElementById('resultsLog');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    scanModelsBtn.addEventListener('click', scanAllModels);
    downloadPreviewsBtn.addEventListener('click', downloadAllPreviews);
    convertToJsonBtn.addEventListener('click', convertAllToJson);
    fixThumbnailsBtn.addEventListener('click', fixThumbnailNames);
    clearLogBtn.addEventListener('click', clearLog);

    // Load initial model list
    loadModels();
});

// Load models from server
async function loadModels() {
    try {
        addLog('info', 'Loading model list...');

        const response = await fetch('/civitai/scan-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        models = data.models || [];

        updateSummary();
        addLog('success', `Loaded ${models.length} models`);

    } catch (error) {
        addLog('error', `Failed to load models: ${error.message}`);
    }
}

// Update summary statistics
function updateSummary() {
    const withInfo = models.filter(m => m.has_info).length;
    const withoutInfo = models.length - withInfo;

    totalModelsSpan.textContent = models.length;
    modelsWithInfoSpan.textContent = withInfo;
    modelsWithoutInfoSpan.textContent = withoutInfo;
}

// Scan all models
async function scanAllModels() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    const skipExisting = skipExistingCheckbox.checked;
    const delay = parseFloat(delayInput.value) * 1000; // Convert to milliseconds

    // Filter models to scan
    let modelsToScan = models;
    if (skipExisting) {
        modelsToScan = models.filter(m => !m.has_info);
    }

    if (modelsToScan.length === 0) {
        addLog('info', 'No models to scan');
        return;
    }

    currentOperation = 'scan';
    disableButtons();

    addLog('info', `Starting scan of ${modelsToScan.length} models...`);

    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < modelsToScan.length; i++) {
        const model = modelsToScan[i];

        updateProgress(`Scanning: ${model.name}`, i + 1, modelsToScan.length);

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
                addLog('success', `✓ ${model.name}: Info saved`);
                successCount++;
                model.has_info = true;
            } else if (data.status === 'not_found') {
                addLog('warning', `⚠ ${model.name}: Not found on Civitai`);
                notFoundCount++;
            } else {
                addLog('error', `✗ ${model.name}: ${data.message}`);
                errorCount++;
            }

        } catch (error) {
            addLog('error', `✗ ${model.name}: ${error.message}`);
            errorCount++;
        }

        // Delay between requests to avoid rate limiting
        if (i < modelsToScan.length - 1 && delay > 0) {
            await sleep(delay);
        }
    }

    updateSummary();
    updateProgress('Scan complete', modelsToScan.length, modelsToScan.length);
    addLog('info', `Scan complete: ${successCount} success, ${notFoundCount} not found, ${errorCount} errors`);

    currentOperation = null;
    enableButtons();
}

// Download all previews
async function downloadAllPreviews() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    const maxSize = maxSizePreviewCheckbox.checked;
    const skipNsfw = skipNsfwPreviewCheckbox.checked;
    const delay = parseFloat(delayInput.value) * 1000;

    // Only download for models with .civitai.info files
    const modelsToDownload = models.filter(m => m.has_info && !m.has_preview);

    if (modelsToDownload.length === 0) {
        addLog('info', 'No previews to download');
        return;
    }

    currentOperation = 'download';
    disableButtons();

    addLog('info', `Starting download of ${modelsToDownload.length} previews...`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < modelsToDownload.length; i++) {
        const model = modelsToDownload[i];

        updateProgress(`Downloading preview: ${model.name}`, i + 1, modelsToDownload.length);

        try {
            const response = await fetch('/civitai/download-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelPath: model.path,
                    maxSize: maxSize,
                    skipNsfw: skipNsfw
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                addLog('success', `✓ ${model.name}: Preview downloaded`);
                successCount++;
                model.has_preview = true;
            } else {
                addLog('info', `⊝ ${model.name}: ${data.message}`);
                skippedCount++;
            }

        } catch (error) {
            addLog('error', `✗ ${model.name}: ${error.message}`);
            errorCount++;
        }

        // Delay between requests
        if (i < modelsToDownload.length - 1 && delay > 0) {
            await sleep(delay);
        }
    }

    updateProgress('Download complete', modelsToDownload.length, modelsToDownload.length);
    addLog('info', `Preview download complete: ${successCount} success, ${skippedCount} skipped, ${errorCount} errors`);

    currentOperation = null;
    enableButtons();
}

// Convert all to JSON
async function convertAllToJson() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    const useApi = useApiForCreatorCheckbox.checked;
    const delay = parseFloat(delayInput.value) * 1000;

    // Only convert models with .civitai.info files
    const modelsToConvert = models.filter(m => m.has_info);

    if (modelsToConvert.length === 0) {
        addLog('info', 'No models to convert');
        return;
    }

    currentOperation = 'convert';
    disableButtons();

    addLog('info', `Starting conversion of ${modelsToConvert.length} models to JSON...`);
    if (useApi) {
        addLog('info', 'Note: API calls enabled for creator info - this will be slower');
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < modelsToConvert.length; i++) {
        const model = modelsToConvert[i];

        updateProgress(`Converting: ${model.name}`, i + 1, modelsToConvert.length);

        try {
            const response = await fetch('/civitai/convert-to-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelPath: model.path,
                    useApi: useApi
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                addLog('success', `✓ ${model.name}: Converted to JSON`);
                successCount++;

                // Only delay if an API call was made for this model
                if (data.apiCallMade && i < modelsToConvert.length - 1 && delay > 0) {
                    await sleep(delay);
                }
            } else {
                addLog('error', `✗ ${model.name}: ${data.message}`);
                errorCount++;
            }

        } catch (error) {
            addLog('error', `✗ ${model.name}: ${error.message}`);
            errorCount++;
        }
    }

    updateProgress('Conversion complete', modelsToConvert.length, modelsToConvert.length);
    addLog('info', `Conversion complete: ${successCount} success, ${errorCount} errors`);

    currentOperation = null;
    enableButtons();
}

// Fix thumbnail names
async function fixThumbnailNames() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    if (models.length === 0) {
        addLog('info', 'No models to process');
        return;
    }

    currentOperation = 'fix-thumbnails';
    disableButtons();

    addLog('info', `Checking ${models.length} models for thumbnail files...`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];

        updateProgress(`Checking: ${model.name}`, i + 1, models.length);

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
                addLog('success', `✓ ${model.name}: ${data.message}`);
                successCount++;
            } else if (data.status === 'skipped') {
                // Don't log skipped items to keep log clean
                skippedCount++;
            } else {
                addLog('info', `⊝ ${model.name}: ${data.message}`);
                skippedCount++;
            }

        } catch (error) {
            addLog('error', `✗ ${model.name}: ${error.message}`);
            errorCount++;
        }
    }

    updateProgress('Thumbnail fix complete', models.length, models.length);
    addLog('info', `Thumbnail fix complete: ${successCount} renamed, ${skippedCount} skipped, ${errorCount} errors`);

    currentOperation = null;
    enableButtons();
}

// Update progress UI
function updateProgress(text, current, total) {
    progressText.textContent = text;
    progressCount.textContent = `${current} / ${total}`;

    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
}

// Add log entry
function addLog(type, message) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const time = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-entry-time';
    timeSpan.textContent = `[${time}]`;

    entry.appendChild(timeSpan);
    entry.appendChild(document.createTextNode(` ${message}`));

    resultsLog.appendChild(entry);
    resultsLog.scrollTop = resultsLog.scrollHeight;
}

// Clear log
function clearLog() {
    resultsLog.innerHTML = '';
}

// Disable buttons during operation
function disableButtons() {
    scanModelsBtn.disabled = true;
    downloadPreviewsBtn.disabled = true;
    convertToJsonBtn.disabled = true;
    fixThumbnailsBtn.disabled = true;
}

// Enable buttons after operation
function enableButtons() {
    scanModelsBtn.disabled = false;
    downloadPreviewsBtn.disabled = false;
    convertToJsonBtn.disabled = false;
    fixThumbnailsBtn.disabled = false;
}

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
