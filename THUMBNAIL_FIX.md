# Thumbnail Mouseover Fix

## Problem
After adding the drop target functionality for uploading images to the model popup, the thumbnail mouseover feature stopped working. Users could no longer change the main preview image by hovering over the thumbnail images.

## Root Cause
The `initializeImageDropZone()` function was cloning the preview container to remove old event listeners (to prevent duplicate handlers). However, this cloning also removed the thumbnail mouseover event listeners that were attached earlier in the `openModelDetails()` function.

```javascript
// This line removed ALL event listeners, including thumbnail handlers
const newContainer = previewContainer.cloneNode(true);
previewContainer.parentNode.replaceChild(newContainer, previewContainer);
```

## Solution
Created a new `reattachThumbnailListeners()` function that:
1. Checks if the current model has multiple preview images
2. Re-queries the thumbnail elements after the container has been cloned
3. Reattaches the mouseover event listeners to each thumbnail

This function is called at the end of `initializeImageDropZone()` to restore the thumbnail functionality.

## Changes Made
- **File**: `scripts/script.js`
- **Lines**: Modified `initializeImageDropZone()` function (lines 1730-1799) to call `reattachThumbnailListeners()`
- **Added**: New `reattachThumbnailListeners()` function (lines 1802-1831)

## Result
Both features now work correctly:
✅ Thumbnails change the main image on mouseover
✅ Drop target allows dragging and dropping new images to upload
