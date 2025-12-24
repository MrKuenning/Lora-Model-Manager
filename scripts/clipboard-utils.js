// ===== Clipboard Utilities Module =====
// Handles copy-to-clipboard functionality for text fields

/**
 * Initialize all copy buttons on the page
 */
export function initializeCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-field-btn');

    copyButtons.forEach(button => {
        button.addEventListener('click', handleCopyClick);
    });
}

/**
 * Handle copy button click
 * @param {Event} event - Click event
 */
async function handleCopyClick(event) {
    const button = event.currentTarget;
    const fieldId = button.dataset.copyField;

    if (!fieldId) {
        console.error('No field ID specified for copy button');
        return;
    }

    // Get the field element (could be input or textarea)
    const field = document.getElementById(fieldId);
    if (!field) {
        console.error(`Field not found: ${fieldId}`);
        return;
    }

    // Get the text to copy
    const textToCopy = field.value || '';

    if (!textToCopy.trim()) {
        // Don't copy empty fields, show brief feedback
        showCopyFeedback(button, false);
        return;
    }

    try {
        // Use modern clipboard API
        await navigator.clipboard.writeText(textToCopy);
        showCopyFeedback(button, true);
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showCopyFeedback(button, false);

        // Fallback: try the old method
        fallbackCopyToClipboard(textToCopy, button);
    }
}

/**
 * Show visual feedback after copy attempt
 * @param {HTMLElement} button - The copy button
 * @param {boolean} success - Whether copy was successful
 */
function showCopyFeedback(button, success) {
    const icon = button.querySelector('i');
    if (!icon) return;

    // Store original icon class
    const originalClass = icon.className;

    // Change icon based on success
    if (success) {
        icon.className = 'fas fa-check';
        button.classList.remove('btn-secondary');
        button.classList.add('btn-success');
    } else {
        icon.className = 'fas fa-exclamation';
        button.classList.remove('btn-secondary');
        button.classList.add('btn-warning');
    }

    // Revert after brief delay
    setTimeout(() => {
        icon.className = originalClass;
        if (success) {
            button.classList.remove('btn-success');
            button.classList.add('btn-secondary');
        } else {
            button.classList.remove('btn-warning');
            button.classList.add('btn-secondary');
        }
    }, 1000);
}

/**
 * Fallback copy method for browsers that don't support clipboard API
 * @param {string} text - Text to copy
 * @param {HTMLElement} button - The copy button
 */
function fallbackCopyToClipboard(text, button) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    try {
        textarea.select();
        const successful = document.execCommand('copy');
        showCopyFeedback(button, successful);
    } catch (error) {
        console.error('Fallback copy failed:', error);
        showCopyFeedback(button, false);
    } finally {
        document.body.removeChild(textarea);
    }
}
