// ===== Bulk Operations Module =====
// Handles bulk selection mode and operations (Move, Edit, Rename)

import { showToast } from './toast.js';

// ========== State ==========
let bulkModeActive = false;
let selectedModels = new Set(); // Stores model IDs
let allModels = []; // Reference to models array

// ========== DOM References ==========
const bulkEditToggle = document.getElementById('bulkEditToggle');
const bulkActionsBar = document.getElementById('bulkActionsBar');
const selectedCountEl = document.getElementById('selectedCount');
const bulkMoveBtn = document.getElementById('bulkMoveBtn');
const bulkEditBtn = document.getElementById('bulkEditBtn');
const bulkRenameBtn = document.getElementById('bulkRenameBtn');
const bulkCancelBtn = document.getElementById('bulkCancelBtn');

// Modals
const bulkMoveModal = document.getElementById('bulkMoveModal');
const bulkEditModal = document.getElementById('bulkEditModal');
const bulkRenameModal = document.getElementById('bulkRenameModal');

// ========== Getters ==========
export function isBulkModeActive() {
    return bulkModeActive;
}

export function getSelectedModels() {
    return Array.from(selectedModels).map(id => allModels.find(m => m.id === id)).filter(Boolean);
}

export function getSelectedCount() {
    return selectedModels.size;
}

// ========== State Management ==========
export function setModelsReference(models) {
    allModels = models;
}

export function toggleBulkMode(displayModelsCallback) {
    bulkModeActive = !bulkModeActive;

    if (bulkModeActive) {
        bulkEditToggle.classList.add('active');
        bulkActionsBar.style.display = 'flex';
    } else {
        bulkEditToggle.classList.remove('active');
        bulkActionsBar.style.display = 'none';
        clearSelection();
    }

    // Redraw models with or without checkboxes
    if (displayModelsCallback) {
        displayModelsCallback();
    }

    updateSelectedCount();
}

export function exitBulkMode(displayModelsCallback) {
    if (bulkModeActive) {
        bulkModeActive = false;
        bulkEditToggle.classList.remove('active');
        bulkActionsBar.style.display = 'none';
        clearSelection();

        if (displayModelsCallback) {
            displayModelsCallback();
        }
    }
}

export function toggleModelSelection(modelId) {
    if (selectedModels.has(modelId)) {
        selectedModels.delete(modelId);
    } else {
        selectedModels.add(modelId);
    }
    updateSelectedCount();
    updateCardVisual(modelId);
}

export function clearSelection() {
    selectedModels.clear();
    updateSelectedCount();
}

function updateSelectedCount() {
    if (selectedCountEl) {
        selectedCountEl.textContent = selectedModels.size;
    }

    // Disable action buttons if nothing selected
    const hasSelection = selectedModels.size > 0;
    if (bulkMoveBtn) bulkMoveBtn.disabled = !hasSelection;
    if (bulkEditBtn) bulkEditBtn.disabled = !hasSelection;
    if (bulkRenameBtn) bulkRenameBtn.disabled = !hasSelection;
}

function updateCardVisual(modelId) {
    const card = document.querySelector(`.model-card[data-id="${modelId}"]`);
    if (!card) return;

    const checkbox = card.querySelector('.bulk-checkbox-overlay');
    if (selectedModels.has(modelId)) {
        card.classList.add('selected');
        if (checkbox) checkbox.classList.add('checked');
    } else {
        card.classList.remove('selected');
        if (checkbox) checkbox.classList.remove('checked');
    }
}

// ========== Checkbox Creation ==========
export function addBulkCheckbox(modelCard, modelId) {
    // Create checkbox overlay
    const checkbox = document.createElement('div');
    checkbox.className = 'bulk-checkbox-overlay';
    if (selectedModels.has(modelId)) {
        checkbox.classList.add('checked');
        modelCard.classList.add('selected');
    }

    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleModelSelection(modelId);
    });

    modelCard.classList.add('bulk-mode');
    modelCard.insertBefore(checkbox, modelCard.firstChild);

    // Override card click to toggle selection instead of opening modal
    modelCard.dataset.bulkClick = 'true';
}

// ========== Modal Operations ==========

// --- Bulk Move ---
export async function openBulkMoveModal(settingsManager) {
    const count = selectedModels.size;
    if (count === 0) {
        showToast('No models selected', 'warning');
        return;
    }

    document.getElementById('bulkMoveCount').textContent = count;

    // Populate folder dropdown
    const folderSelect = document.getElementById('bulkMoveFolder');
    folderSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        const response = await fetch('/get-folders');
        if (response.ok) {
            const data = await response.json();
            const folders = data.folders || [];
            folderSelect.innerHTML = folders.map(f =>
                `<option value="${f.path}">${f.name || 'Root'}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Error loading folders:', error);
        folderSelect.innerHTML = '<option value="">Error loading folders</option>';
    }

    bulkMoveModal.style.display = 'block';
}

export async function executeBulkMove(targetFolder, refreshCallback) {
    const models = getSelectedModels();
    if (models.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const model of models) {
        try {
            const response = await fetch('/move-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelName: model.name,
                    targetFolder: targetFolder
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
                console.error(`Failed to move ${model.name}`);
            }
        } catch (error) {
            failCount++;
            console.error(`Error moving ${model.name}:`, error);
        }
    }

    bulkMoveModal.style.display = 'none';

    if (successCount > 0) {
        showToast(`Moved ${successCount} model(s) successfully`, 'success');
    }
    if (failCount > 0) {
        showToast(`Failed to move ${failCount} model(s)`, 'error');
    }

    clearSelection();
    if (refreshCallback) refreshCallback();
}

// --- Bulk Edit ---
export function openBulkEditModal() {
    const count = selectedModels.size;
    if (count === 0) {
        showToast('No models selected', 'warning');
        return;
    }

    document.getElementById('bulkEditCount').textContent = count;

    // Clear form
    document.getElementById('bulkCategory').value = '';
    document.getElementById('bulkSubcategory').value = '';
    document.getElementById('bulkVersion').value = '';
    document.getElementById('bulkHighLow').value = '';

    bulkEditModal.style.display = 'block';
}

export async function executeBulkEdit(fields, refreshCallback) {
    const models = getSelectedModels();
    if (models.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const model of models) {
        try {
            // Get existing JSON data
            const jsonData = model.json || {};

            // Only update fields that have values
            if (fields.category) jsonData.category = fields.category;
            if (fields.subcategory) jsonData.subcategory = fields.subcategory;
            if (fields.version) jsonData['model version'] = fields.version;
            if (fields.highLow) jsonData['high low'] = fields.highLow;

            // Save updated JSON
            const response = await fetch('/save-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: model.name,
                    json: jsonData
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            failCount++;
            console.error(`Error editing ${model.name}:`, error);
        }
    }

    bulkEditModal.style.display = 'none';

    if (successCount > 0) {
        showToast(`Updated ${successCount} model(s) successfully`, 'success');
    }
    if (failCount > 0) {
        showToast(`Failed to update ${failCount} model(s)`, 'error');
    }

    clearSelection();
    if (refreshCallback) refreshCallback();
}

// --- Bulk Rename ---
export function openBulkRenameModal(generateRecommendedName) {
    const models = getSelectedModels();
    if (models.length === 0) {
        showToast('No models selected', 'warning');
        return;
    }

    const list = document.getElementById('bulkRenameList');
    list.innerHTML = '';

    models.forEach(model => {
        const proposedName = generateRecommendedName(model);
        const isSame = model.name === proposedName;

        const item = document.createElement('div');
        item.className = 'bulk-rename-item' + (isSame ? ' same-name' : '');
        item.dataset.modelId = model.id;
        item.dataset.proposedName = proposedName;

        item.innerHTML = `
            <input type="checkbox" ${isSame ? '' : 'checked'} ${isSame ? 'disabled' : ''}>
            <span class="rename-current" title="${model.name}">${model.name}</span>
            <span class="rename-arrow"><i class="fas fa-arrow-right"></i></span>
            <span class="rename-proposed" title="${proposedName}">${isSame ? '(no change)' : proposedName}</span>
        `;

        list.appendChild(item);
    });

    bulkRenameModal.style.display = 'block';
}

export async function executeBulkRename(refreshCallback) {
    const list = document.getElementById('bulkRenameList');
    const items = list.querySelectorAll('.bulk-rename-item');

    const toRename = [];
    items.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked && !checkbox.disabled) {
            const modelId = item.dataset.modelId;
            const proposedName = item.dataset.proposedName;
            const model = allModels.find(m => m.id === modelId);
            if (model && model.name !== proposedName) {
                toRename.push({ model, newName: proposedName });
            }
        }
    });

    if (toRename.length === 0) {
        showToast('No models to rename', 'info');
        bulkRenameModal.style.display = 'none';
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const { model, newName } of toRename) {
        try {
            const response = await fetch('/rename-lora', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldName: model.name,
                    newName: newName
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            failCount++;
            console.error(`Error renaming ${model.name}:`, error);
        }
    }

    bulkRenameModal.style.display = 'none';

    if (successCount > 0) {
        showToast(`Renamed ${successCount} model(s) successfully`, 'success');
    }
    if (failCount > 0) {
        showToast(`Failed to rename ${failCount} model(s)`, 'error');
    }

    clearSelection();
    if (refreshCallback) refreshCallback();
}

// ========== Modal Close Handlers ==========
export function closeBulkMoveModal() {
    bulkMoveModal.style.display = 'none';
}

export function closeBulkEditModal() {
    bulkEditModal.style.display = 'none';
}

export function closeBulkRenameModal() {
    bulkRenameModal.style.display = 'none';
}

// ========== Initialize Event Listeners ==========
export function initBulkOperations(displayModelsCallback, refreshCallback, settingsManager, generateRecommendedName) {
    // Toggle button
    if (bulkEditToggle) {
        bulkEditToggle.addEventListener('click', () => toggleBulkMode(displayModelsCallback));
    }

    // Cancel button
    if (bulkCancelBtn) {
        bulkCancelBtn.addEventListener('click', () => exitBulkMode(displayModelsCallback));
    }

    // Action buttons
    if (bulkMoveBtn) {
        bulkMoveBtn.addEventListener('click', () => openBulkMoveModal(settingsManager));
    }

    if (bulkEditBtn) {
        bulkEditBtn.addEventListener('click', openBulkEditModal);
    }

    if (bulkRenameBtn) {
        bulkRenameBtn.addEventListener('click', () => openBulkRenameModal(generateRecommendedName));
    }

    // Move modal
    document.getElementById('bulkMoveConfirm')?.addEventListener('click', () => {
        const folder = document.getElementById('bulkMoveFolder').value;
        executeBulkMove(folder, refreshCallback);
    });
    document.getElementById('bulkMoveCancel')?.addEventListener('click', closeBulkMoveModal);

    // Edit modal
    document.getElementById('bulkEditConfirm')?.addEventListener('click', () => {
        const fields = {
            category: document.getElementById('bulkCategory').value.trim(),
            subcategory: document.getElementById('bulkSubcategory').value.trim(),
            version: document.getElementById('bulkVersion').value.trim(),
            highLow: document.getElementById('bulkHighLow').value
        };
        executeBulkEdit(fields, refreshCallback);
    });
    document.getElementById('bulkEditCancel')?.addEventListener('click', closeBulkEditModal);

    // Rename modal
    document.getElementById('bulkRenameConfirm')?.addEventListener('click', () => {
        executeBulkRename(refreshCallback);
    });
    document.getElementById('bulkRenameCancel')?.addEventListener('click', closeBulkRenameModal);

    // Close modal on X button
    bulkMoveModal?.querySelector('.close-modal')?.addEventListener('click', closeBulkMoveModal);
    bulkEditModal?.querySelector('.close-modal')?.addEventListener('click', closeBulkEditModal);
    bulkRenameModal?.querySelector('.close-modal')?.addEventListener('click', closeBulkRenameModal);

    // Close modal on background click
    bulkMoveModal?.addEventListener('click', (e) => { if (e.target === bulkMoveModal) closeBulkMoveModal(); });
    bulkEditModal?.addEventListener('click', (e) => { if (e.target === bulkEditModal) closeBulkEditModal(); });
    bulkRenameModal?.addEventListener('click', (e) => { if (e.target === bulkRenameModal) closeBulkRenameModal(); });
}
