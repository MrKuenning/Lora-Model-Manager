// Civitai Scan Page JavaScript
// Handles scanning, downloading previews, and converting to JSON

let models = [];
let currentOperation = null;
let currentLocation = 'loras';

// DOM Elements
const backButton = document.getElementById('backButton');
const runAllInOneBtn = document.getElementById('runAllInOneBtn');
const scanModelsBtn = document.getElementById('scanModelsBtn');
const downloadPreviewsBtn = document.getElementById('downloadPreviewsBtn');
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
const modelsWithoutInfoSpan = document.getElementById('modelsWithoutInfo');
const modelsMissingThumbnailsSpan = document.getElementById('modelsMissingThumbnails');
const modelsMissingHashesSpan = document.getElementById('modelsMissingHashes');
const resultsLog = document.getElementById('resultsLog');

// Get location from URL query parameters
function getLocationFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('location') || 'loras';
}

// Update the location tabs UI based on currentLocation
function updateLocationTabs() {
    const lorasTab = document.getElementById('loras-tab');
    const checkpointsTab = document.getElementById('checkpoints-tab');
    const pageTitle = document.getElementById('page-title');

    if (currentLocation === 'checkpoints') {
        lorasTab?.classList.remove('active');
        checkpointsTab?.classList.add('active');
        if (pageTitle) pageTitle.textContent = 'Civitai Scan - Checkpoints';
    } else {
        lorasTab?.classList.add('active');
        checkpointsTab?.classList.remove('active');
        if (pageTitle) pageTitle.textContent = 'Civitai Scan - LoRAs';
    }
}

// Load scan settings from server
async function loadScanSettings() {
    try {
        const response = await fetch('/settings');
        if (!response.ok) return;

        const settings = await response.json();
        const scanSettings = settings.civitaiScanSettings || {};

        // Apply saved settings to checkboxes
        if (skipExistingCheckbox && scanSettings.skipExisting !== undefined) {
            skipExistingCheckbox.checked = scanSettings.skipExisting;
        }
        if (skipNsfwPreviewCheckbox && scanSettings.skipNsfwPreview !== undefined) {
            skipNsfwPreviewCheckbox.checked = scanSettings.skipNsfwPreview;
        }
        if (maxSizePreviewCheckbox && scanSettings.maxSizePreview !== undefined) {
            maxSizePreviewCheckbox.checked = scanSettings.maxSizePreview;
        }
        if (useApiForCreatorCheckbox && scanSettings.useApiForCreator !== undefined) {
            useApiForCreatorCheckbox.checked = scanSettings.useApiForCreator;
        }
        if (delayInput && scanSettings.delayBetweenRequests !== undefined) {
            delayInput.value = scanSettings.delayBetweenRequests;
        }
    } catch (error) {
        console.error('Error loading scan settings:', error);
    }
}

// Save scan settings to server
async function saveScanSettings() {
    try {
        // First get existing settings
        const response = await fetch('/settings');
        if (!response.ok) return;

        const settings = await response.json();

        // Update scan settings
        settings.civitaiScanSettings = {
            skipExisting: skipExistingCheckbox?.checked ?? true,
            skipNsfwPreview: skipNsfwPreviewCheckbox?.checked ?? true,
            maxSizePreview: maxSizePreviewCheckbox?.checked ?? false,
            useApiForCreator: useApiForCreatorCheckbox?.checked ?? true,
            delayBetweenRequests: parseFloat(delayInput?.value) || 0.5
        };

        // Save back to server
        await fetch('/save-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
    } catch (error) {
        console.error('Error saving scan settings:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get location from URL
    currentLocation = getLocationFromUrl();
    updateLocationTabs();

    backButton.addEventListener('click', () => {
        // Go back to main page with same location and trigger refresh
        window.location.href = `index.html?location=${currentLocation}&refresh=true`;
    });

    // Settings modal handlers
    const settingsButton = document.getElementById('settingsButton');
    const scanSettingsModal = document.getElementById('scanSettingsModal');
    const closeModal = scanSettingsModal?.querySelector('.close-modal');

    if (settingsButton && scanSettingsModal) {
        settingsButton.addEventListener('click', () => {
            scanSettingsModal.style.display = 'block';
        });

        closeModal?.addEventListener('click', () => {
            scanSettingsModal.style.display = 'none';
        });

        scanSettingsModal.addEventListener('click', (e) => {
            if (e.target === scanSettingsModal) {
                scanSettingsModal.style.display = 'none';
            }
        });
    }

    runAllInOneBtn?.addEventListener('click', runAllInOneScan);
    scanModelsBtn.addEventListener('click', scanAllModels);
    downloadPreviewsBtn.addEventListener('click', downloadMissingPreviews);
    document.getElementById('downloadAllPreviewsBtn')?.addEventListener('click', downloadAllPreviews);
    fixThumbnailsBtn?.addEventListener('click', fixThumbnailNames);
    clearLogBtn?.addEventListener('click', clearLog);
    document.getElementById('generateHashesBtn')?.addEventListener('click', generateAllHashes);
    document.getElementById('generateMissingHashesBtn')?.addEventListener('click', generateMissingHashes);
    document.getElementById('findDuplicatesBtn')?.addEventListener('click', findDuplicates);

    // Load saved scan settings
    loadScanSettings();

    // Auto-save settings when changed
    skipExistingCheckbox?.addEventListener('change', saveScanSettings);
    skipNsfwPreviewCheckbox?.addEventListener('change', saveScanSettings);
    maxSizePreviewCheckbox?.addEventListener('change', saveScanSettings);
    useApiForCreatorCheckbox?.addEventListener('change', saveScanSettings);
    delayInput?.addEventListener('change', saveScanSettings);

    // Load initial model list
    loadModels();
});

// Load models from server
async function loadModels() {
    try {
        addLog('info', `Loading ${currentLocation} model list...`);

        const response = await fetch(`/civitai/scan-models?location=${encodeURIComponent(currentLocation)}`, {
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
        addLog('success', `Loaded ${models.length} models from ${currentLocation}`);

    } catch (error) {
        addLog('error', `Failed to load models: ${error.message}`);
    }
}

// Update summary statistics
function updateSummary() {
    const withoutInfo = models.filter(m => !m.has_info).length;
    const missingThumbnails = models.filter(m => !m.has_preview).length;
    const missingHashes = models.filter(m => !m.has_hash).length;

    totalModelsSpan.textContent = models.length;
    modelsWithoutInfoSpan.textContent = withoutInfo;
    if (modelsMissingThumbnailsSpan) modelsMissingThumbnailsSpan.textContent = missingThumbnails;
    if (modelsMissingHashesSpan) modelsMissingHashesSpan.textContent = missingHashes;
}

// Run all-in-one scan (Scan missing -> Create missing JSON -> Download missing previews)
async function runAllInOneScan() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    addLog('info', '--- Starting All-In-One Scan (Steps 1 and 2) ---');

    // Step 1: Civitai Data (now creates JSON directly)
    await scanAllModels();

    // Step 2: Thumbnails
    await downloadMissingPreviews();

    addLog('info', '--- All-In-One Scan Sequence Complete ---');
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
    let notFoundModels = []; // Track models not found on Civitai

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
                addLog('success', `✓ ${model.name}: JSON created`);
                successCount++;
                model.has_info = true;
                model.has_json = true;
            } else if (data.status === 'not_found') {
                addLog('warning', `⚠ ${model.name}: Not found on Civitai`);
                notFoundModels.push(model);
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
    addLog('info', `Scan complete: ${successCount} success, ${notFoundModels.length} not found, ${errorCount} errors`);

    // If any models were not found, offer options for each
    if (notFoundModels.length > 0) {
        console.log('Not found models to process:', notFoundModels.length, notFoundModels);
        addLog('info', `Processing ${notFoundModels.length} unmatched models...`);

        let urlMatchedCount = 0;
        let dummyCreatedCount = 0;
        let skippedCount = 0;

        for (const model of notFoundModels) {
            console.log('Prompting for model:', model.name);
            const userChoice = prompt(
                `Model not found: ${model.name}\n\n` +
                `Options:\n` +
                `• Enter a Civitai URL to match manually\n` +
                `• Leave empty and click OK to create a dummy file\n` +
                `• Click Cancel to skip this model\n\n` +
                `Civitai URL (include modelVersionId if possible):`
            );
            console.log('User choice for', model.name, ':', userChoice);

            if (userChoice === null) {
                // User clicked Cancel - skip this model
                addLog('info', `⊝ ${model.name}: Skipped`);
                skippedCount++;
            } else if (userChoice.trim() === '') {
                // Create dummy file
                try {
                    const response = await fetch('/civitai/create-dummy-info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ modelPath: model.path })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.status === 'success') {
                            addLog('success', `✓ ${model.name}: Dummy JSON created`);
                            model.has_info = true;
                            model.has_json = true;
                            dummyCreatedCount++;
                        }
                    }
                } catch (error) {
                    addLog('error', `✗ ${model.name}: Failed to create dummy - ${error.message}`);
                }
            } else {
                // Try to fetch by URL
                try {
                    const response = await fetch('/civitai/get-model-info-by-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            modelPath: model.path,
                            civitaiUrl: userChoice.trim()
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.status === 'success') {
                            addLog('success', `✓ ${model.name}: Matched from URL!`);
                            model.has_info = true;
                            urlMatchedCount++;
                        } else {
                            addLog('error', `✗ ${model.name}: ${data.message}`);
                            skippedCount++;
                        }
                    }
                } catch (error) {
                    addLog('error', `✗ ${model.name}: URL fetch failed - ${error.message}`);
                    skippedCount++;
                }
            }
        }

        updateSummary();
        addLog('info', `Unmatched processing complete: ${urlMatchedCount} URL matched, ${dummyCreatedCount} dummy files, ${skippedCount} skipped`);
    } else {
        console.log('No not found models to process');
    }

    currentOperation = null;
    enableButtons();
}

// Download previews for models without any preview (missing only)
async function downloadMissingPreviews() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    const maxSize = maxSizePreviewCheckbox.checked;
    const skipNsfw = skipNsfwPreviewCheckbox.checked;
    const delay = parseFloat(delayInput.value) * 1000;

    // Only download for models with Civitai data AND no preview
    const modelsToDownload = models.filter(m => (m.has_info || m.has_json) && !m.has_preview);

    if (modelsToDownload.length === 0) {
        addLog('info', 'No models missing previews');
        return;
    }

    currentOperation = 'download';
    disableButtons();

    addLog('info', `Starting download for ${modelsToDownload.length} models missing previews...`);

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

// Download previews for ALL models (try to get 2 images each)
async function downloadAllPreviews() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    const maxSize = maxSizePreviewCheckbox.checked;
    const skipNsfw = skipNsfwPreviewCheckbox.checked;
    const delay = parseFloat(delayInput.value) * 1000;

    // Process ALL models with Civitai data
    const modelsToDownload = models.filter(m => m.has_info || m.has_json);

    if (modelsToDownload.length === 0) {
        addLog('info', 'No models with Civitai info to process');
        return;
    }

    currentOperation = 'download';
    disableButtons();

    addLog('info', `Starting download for ALL ${modelsToDownload.length} models (trying to get 2 images each)...`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < modelsToDownload.length; i++) {
        const model = modelsToDownload[i];

        updateProgress(`Downloading previews: ${model.name}`, i + 1, modelsToDownload.length);

        try {
            const response = await fetch('/civitai/download-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelPath: model.path,
                    maxSize: maxSize,
                    skipNsfw: skipNsfw,
                    forceAdditional: true  // Always try to download more
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                addLog('success', `✓ ${model.name}: Previews downloaded`);
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

// Generate SHA256 hashes for models without existing hashes
async function generateMissingHashes() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    // Filter to only models without hashes
    const modelsToHash = models.filter(m => !m.has_hash);

    if (modelsToHash.length === 0) {
        addLog('info', 'All models already have hashes');
        return;
    }

    currentOperation = 'generate-hashes';
    disableButtons();

    addLog('info', `Generating SHA256 hashes for ${modelsToHash.length} models missing hashes...`);
    addLog('warning', 'This may take a while for large files...');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < modelsToHash.length; i++) {
        const model = modelsToHash[i];

        updateProgress(`Hashing: ${model.name}`, i + 1, modelsToHash.length);

        try {
            const response = await fetch('/civitai/generate-hash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelPath: model.path })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                addLog('success', `✓ ${model.name}: Hash generated`);
                successCount++;
                model.has_hash = true;  // Update local state
            } else {
                addLog('error', `✗ ${model.name}: ${data.message}`);
                errorCount++;
            }

        } catch (error) {
            addLog('error', `✗ ${model.name}: ${error.message}`);
            errorCount++;
        }
    }

    updateProgress('Hash generation complete', modelsToHash.length, modelsToHash.length);
    updateSummary();  // Refresh the summary counts
    addLog('info', `Hash generation complete: ${successCount} generated, ${errorCount} errors`);

    currentOperation = null;
    enableButtons();
}

// Generate SHA256 hashes for all models
async function generateAllHashes() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    // Get models that need hashes (check by looking for sha256 in their JSON)
    // For simplicity, we'll hash all models and the backend will save to JSON
    if (models.length === 0) {
        addLog('info', 'No models to process');
        return;
    }

    currentOperation = 'generate-hashes';
    disableButtons();

    addLog('info', `Generating SHA256 hashes for ${models.length} models...`);
    addLog('warning', 'This may take a while for large files...');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];

        updateProgress(`Hashing: ${model.name}`, i + 1, models.length);

        try {
            const response = await fetch('/civitai/generate-hash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelPath: model.path })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                addLog('success', `✓ ${model.name}: Hash saved`);
                successCount++;
            } else {
                addLog('error', `✗ ${model.name}: ${data.message}`);
                errorCount++;
            }

        } catch (error) {
            addLog('error', `✗ ${model.name}: ${error.message}`);
            errorCount++;
        }
    }

    updateProgress('Hash generation complete', models.length, models.length);
    addLog('info', `Hash generation complete: ${successCount} success, ${errorCount} errors`);

    currentOperation = null;
    enableButtons();
}

// Find duplicate models by comparing SHA256 hashes
async function findDuplicates() {
    if (currentOperation) {
        addLog('warning', 'An operation is already in progress');
        return;
    }

    currentOperation = 'find-duplicates';
    disableButtons();

    addLog('info', 'Scanning for duplicate models...');
    updateProgress('Scanning for duplicates...', 0, 1);

    try {
        const response = await fetch('/civitai/find-duplicates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: currentLocation })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        updateProgress('Scan complete', 1, 1);

        if (data.duplicates && data.duplicates.length > 0) {
            addLog('warning', `Found ${data.duplicateGroupCount} duplicate groups (${data.duplicateFileCount} files total)`);

            // Log each duplicate group
            data.duplicates.forEach((group, index) => {
                addLog('info', `--- Duplicate Group ${index + 1} ---`);
                group.forEach(path => {
                    // Extract just the filename and immediate folder
                    const parts = path.replace(/\\/g, '/').split('/');
                    const shortPath = parts.slice(-2).join('/');
                    addLog('warning', `  📋 ${shortPath}`);
                });
            });
        } else {
            addLog('success', '✓ No duplicate models found!');
        }

        if (data.missingHash && data.missingHash.length > 0) {
            addLog('info', `Note: ${data.missingHash.length} models don't have SHA256 hashes yet. Run "Generate All Hashes" first.`);
        }

        addLog('info', `Scanned ${data.totalScanned} models total`);

    } catch (error) {
        addLog('error', `Error finding duplicates: ${error.message}`);
    }

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
    if (runAllInOneBtn) runAllInOneBtn.disabled = true;
    scanModelsBtn.disabled = true;
    downloadPreviewsBtn.disabled = true;
    document.getElementById('downloadAllPreviewsBtn').disabled = true;
    if (fixThumbnailsBtn) fixThumbnailsBtn.disabled = true;
    const genHashBtn = document.getElementById('generateHashesBtn');
    const genMissingHashBtn = document.getElementById('generateMissingHashesBtn');
    const findDupBtn = document.getElementById('findDuplicatesBtn');
    if (genHashBtn) genHashBtn.disabled = true;
    if (genMissingHashBtn) genMissingHashBtn.disabled = true;
    if (findDupBtn) findDupBtn.disabled = true;
}

// Enable buttons after operation
function enableButtons() {
    if (runAllInOneBtn) runAllInOneBtn.disabled = false;
    scanModelsBtn.disabled = false;
    downloadPreviewsBtn.disabled = false;
    document.getElementById('downloadAllPreviewsBtn').disabled = false;
    if (fixThumbnailsBtn) fixThumbnailsBtn.disabled = false;
    const genHashBtn = document.getElementById('generateHashesBtn');
    const genMissingHashBtn = document.getElementById('generateMissingHashesBtn');
    const findDupBtn = document.getElementById('findDuplicatesBtn');
    if (genHashBtn) genHashBtn.disabled = false;
    if (genMissingHashBtn) genMissingHashBtn.disabled = false;
    if (findDupBtn) findDupBtn.disabled = false;
}

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Create dummy info files for multiple models (batch operation)
async function createDummyFilesForModels(modelsArray) {
    addLog('info', `Creating dummy info files for ${modelsArray.length} models...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < modelsArray.length; i++) {
        const model = modelsArray[i];

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
                addLog('success', `✓ ${model.name}: Dummy info file created`);
                successCount++;
                model.has_info = true;
            } else {
                addLog('error', `✗ ${model.name}: ${data.message}`);
                errorCount++;
            }
        } catch (error) {
            addLog('error', `✗ ${model.name}: ${error.message}`);
            errorCount++;
        }
    }

    updateSummary();
    addLog('info', `Dummy file creation complete: ${successCount} success, ${errorCount} errors`);
}
