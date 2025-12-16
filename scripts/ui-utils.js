// ===== UI Utility Functions =====

/**
 * Show the loading progress bar
 */
export function showLoadingOverlay() {
    const progressBar = document.getElementById('loading-progress-bar');
    if (progressBar) {
        progressBar.classList.remove('hidden');
    }
}

/**
 * Hide the loading progress bar with smooth transition
 */
export function hideLoadingOverlay() {
    const progressBar = document.getElementById('loading-progress-bar');
    if (progressBar) {
        // Add a small delay for smooth transition
        setTimeout(() => {
            progressBar.classList.add('hidden');
        }, 300);
    }
}
