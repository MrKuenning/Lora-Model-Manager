// model-utils.js - Utility functions for model data

/**
 * Extract the folder name from a model's path.
 * This derives the folder from the path rather than storing it redundantly in JSON.
 * @param {Object} model - The model object with a path property
 * @returns {string} The folder name (last directory before the filename), or empty string if none
 */
export function getFolderFromPath(model) {
    if (!model || !model.path) {
        return '';
    }

    // Normalize path to forward slashes
    const normalizedPath = model.path.replace(/\\/g, '/');

    // Get the directory part (everything before the last slash)
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return ''; // No directory, file is in root
    }

    const dirPath = normalizedPath.substring(0, lastSlashIndex);

    // Get the last folder name (after the last remaining slash in dirPath)
    const folderSlashIndex = dirPath.lastIndexOf('/');
    if (folderSlashIndex === -1) {
        return dirPath; // Only one folder level
    }

    return dirPath.substring(folderSlashIndex + 1);
}
