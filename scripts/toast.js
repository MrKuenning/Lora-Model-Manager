/**
 * Toast Notification Utility
 * 
 * Displays floating toast notifications that auto-dismiss.
 * Usage: showToast('Message', 'success'); // types: 'success', 'error', 'warning', 'info'
 */

// Icon mappings for each toast type
const TOAST_ICONS = {
    success: '<i class="fas fa-check-circle"></i>',
    error: '<i class="fas fa-exclamation-circle"></i>',
    warning: '<i class="fas fa-exclamation-triangle"></i>',
    info: '<i class="fas fa-info-circle"></i>'
};

// Default durations by type (in milliseconds)
const TOAST_DURATIONS = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000
};

/**
 * Get or create the toast container element
 * @returns {HTMLElement} The toast container
 */
function getToastContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} [type='info'] - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} [duration] - Auto-dismiss time in ms (defaults based on type)
 */
export function showToast(message, type = 'info', duration) {
    const container = getToastContainer();

    // Use default duration for type if not specified
    const dismissTime = duration || TOAST_DURATIONS[type] || 3000;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
        <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    // Add close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => dismissToast(toast));

    // Add to container
    container.appendChild(toast);

    // Auto-dismiss after duration
    setTimeout(() => dismissToast(toast), dismissTime);
}

/**
 * Dismiss a toast with animation
 * @param {HTMLElement} toast - The toast element to dismiss
 */
function dismissToast(toast) {
    if (!toast || toast.classList.contains('toast-hiding')) return;

    toast.classList.add('toast-hiding');

    // Remove after animation completes
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300); // Match animation duration
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
