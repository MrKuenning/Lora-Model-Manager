# Lora Model Manager - Changelog


### 07/07/2026

**Added**
- **SD Version Mapping & Column**
  - Integrated `sd version` mapping into Civitai scanning logic based on `baseModel` attributes.
  - Added `SD Version` to the table list view columns list (complete with sorting, visibility toggle, and configuration persistence).
  - Integrated `Base Model` and `SD Version` fields into the Bulk Edit modal for batch updating.

**Fixed**
- **Incorrect SD2 Tags**
  - Ran database migration to clean up incorrect "SD2" tags and update all existing model JSON files to match correct SD Version mapping configurations.
  - Applied the new mapping logic to the standalone `All-In-One Scan.py` script to ensure it correctly populates `sd version` going forward.

---

### 05/28/2026

**Fixed**
- **Bulk Model Moving Filter**
  - Updated bulk move folder filtering to check if all selected models resolve to the exact same configured root folder (even if they have different base model names, such as different Wan Video variants), ensuring the destination folder list is still filtered correctly.

---

### 05/26/2026

**Added**
- **Model Type Roots**
  - Added a new Settings tab for mapping Base Model Types to specific subdirectory paths within the models directory.
  - Implemented dropdown/combo-box selection using a <datalist> populated with actual folders from the backend, ensuring valid relative paths are configured.
  - Added dynamic filtering for folder dropdowns in single-model moving operations based on configured model roots.
  - Added dynamic filtering for folder dropdowns in bulk-moving operations (applies when all selected models share the same base model).

---

### 04/01/2026

**Added**
- **SHA256 Generation & Display**
  - Added a "Generate SHA256" button to the model actions panel.
  - Hashes are now persisted in the model's `.json` file and displayed in the "File Info" section of the model popup.
- **Model Deletion**
  - Added a "Delete Model" button to the model popup for streamlined file management.

**Changed**
- **Model Popup Layout Refinement**
  - Renamed "Civitai Actions" to "Actions".
  - Restructured the actions area to display buttons and associated files side-by-side for better space utilization.
- **Multi-Select Model Filter**
  - Refined the multi-select model filter with a custom checkbox-based dropdown.
  - Increased the dropdown height and tightened item spacing for improved usability in large collections.

**Fixed**
- **Checkpoint Bulk Operations**
  - Resolved a bug where Lora folders were incorrectly displayed in bulk edit/move modals when viewing Checkpoints.
- **Server Stability**
  - Fixed a Python `SyntaxError` in `manager.py` related to global cache declarations.
- **UI Feedback**
  - Corrected DOM element selection in `civitai-api.js` to ensure operation status messages are properly displayed.
- **Creator Suffix Button**
  - Fixed the "Creator Suffix" button logic to correctly retrieve the creator's name from the new `web_civitai_data` nested JSON object.

---

### 03/20/2026

**Fixed**
- **Video Thumbnail Extraction**
  - Fixed an issue where `.mp4` and `.webm` video URLs from Civitai were being mistakenly saved directly as unreadable `.png` files. The application now correctly identifies video URLs and passes them to FFmpeg to extract proper image frames for thumbnails.
  - Implemented this fix for both the standalone `All-In-One Scan.py` script and the main web UI backend (`civitai_handler.py`).

---

### 03/19/2026

**Changed**
- **Unified JSON Architecture**
  - Eliminated the redundant two-step file generation pipeline. The `.civitai.info` files are no longer created; Civitai API data is mapped and injected directly into the model's `.json` file at scan time.
  - Added a dedicated nested `web_civitai_data` object in the JSON to neatly house all WebUI/API-exclusive variables (`creator`, `published_date`, `url`, `preview_image_1/2`, `model_id`, `file_id`, `downloadUrl`, `original_filename`).
- **Bloat Removal**
  - Removed the bulky, unformatted `z_info_file` raw payload from the JSON completely to save substantial storage space.
- **Example Prompts**
  - Standardized prompt terminology: The legacy `example prompt` root-level key has been structurally renamed to `example prompt 1` to gracefully pair with `example prompt 2`.

---

### 03/10/2026

**Added**
- **Folder Pane Persistence**
  - The folder pane's state (visible/hidden) and view mode (Tree/List) now persist across sessions using `localStorage`.

---

### 03/05/2026

**Added**
- **All-In-One Scan Button**
  - New "Run All-In-One Scan" button on the Civitai scan page to automate matching, info file creation, and thumbnail downloads in one click.
- **Multi-Select Model Filter**
  - Replaced the single-select model filter with a multi-select dropdown, allowing users to filter by multiple base models simultaneously.

**Changed**
- **Model Popup UI Cleanup**
  - Refined the model card interface for better clarity and added new action buttons.

---

### 03/02/2026

**Changed**
- **Clean Name Improvements**
  - The "Clean Name" button now automatically converts ALL-CAPS names to Title Case for better readability.
- **Fast Media Updates**
  - Optimized the media update process to bypass slow disk scans, allowing new images to appear in the UI almost instantly.

---

### 02/24/2026

**Added**
- **Folder Tree & List View**
  - New sidebar with toggleable Tree and List views for enhanced folder navigation and management.

---

### 01/27/2026

**Fixed**
- **Model Cache Persistence**  
  Fixed a critical bug where the model cache was not actually persisting between requests. The cache was stored on handler instances which are recreated per HTTP request, defeating the caching entirely. Moved cache to module-level variables so models are scanned once on first load, then served instantly from cache. Use the refresh button to force a re-scan when needed.

- **Refresh Button Not Detecting New Files**  
  Fixed an issue where clicking the refresh button would not detect newly added model files. The refresh button now correctly passes `refresh=true` to the backend, forcing a full re-scan of the models directory.

- **SafeMode Toggle Invalidating Cache**  
  Fixed an issue where toggling SafeMode (or changing any setting) would incorrectly invalidate the model cache and force a slow re-scan. Cache is now only invalidated when the models directory path actually changes.

---

### 01/26/2026

**Changed**
- **Base Model Dropdown**  
  The Base Model field on the model card is now a dropdown populated with all existing base models from your collection (same list used for grid filtering). Includes a "Custom..." option to enter values not in the list.

---

### 01/21/2026

**Added**
- **Bulk Delete**  
  New delete button in bulk edit mode allows deleting selected models and all associated files (.json, .civitai.info, preview images).
- **Civitai Scan Page Redesign**  
  Actions reorganized into card-based layout with icons, descriptions, and grouped buttons.
- **Settings Gear on Civitai Scan Page**  
  Scan options moved to a settings modal, accessible via gear icon. Settings auto-save to config.json.
- **High/Low Required Field Validation**  
  When filename formats use `{highlow}`, models missing this value show warnings during rename operations.

**Changed**
- **Button Colors**  
  Added `btn-danger` (red) and `btn-warning` (muted orange) button styles for better visual hierarchy.
- **Action Button Sections**  
  Civitai Scan buttons now organized into labeled sections: Civitai Data, JSON, Thumbnails, Hashes, and Duplicates.

---

### 01/20/2026

**Added**
- **SHA256 Hash Storage**  
  SHA256 hashes are now saved to each model's JSON file when fetching Civitai data. This enables duplicate detection and faster lookups.
- **Generate Hashes Buttons**  
  New buttons on Civitai Scan page: "Generate Hashes - Missing" (skips models with existing hashes) and "Generate Hashes - All" (regenerates all).
- **Find Duplicates Button**  
  New button on Civitai Scan page to detect duplicate model files by comparing their SHA256 hashes.

**Changed**
- **Hierarchical Folder Sorting**  
  Folders now sort hierarchically so subfolders appear directly after their parent folders (e.g., Animals, Animals/Cats, Trees, Trees/Green). Applies to Group By Folder/Path views and all folder dropdowns.
- **Bulk Move Folder List**  
  Replaced the dropdown with a scrollable, clickable folder list for easier folder selection when bulk moving models.

---

### 01/17/2026

**Added**
- **Grid Card Settings Tab**  
  New settings tab to customize grid view card display. Configure image mode (single vs carousel), title source (filename or model name), and up to 3 subtitle fields from various options including folder, category, base model, version, and more.
- **Configurable Subtitles**  
  Grid cards now show customizable subtitle fields joined with " | ", with empty fields automatically hidden.

**Changed**
- **Folder Field Deprecated**  
  The `folder` JSON field is no longer stored in model files. Folder is now derived dynamically from the model's file path, eliminating stale data when files are moved.
- **Grid Card Display**  
  Grid cards now use settings for title and subtitle content instead of hardcoded values.

---

### 01/13/2026

**Added**
- **Favicon**  
  Added application favicon in assets folder.
- **Modal Navigation Arrows**  
  Previous/next buttons in model popup header to navigate between models. Keyboard shortcuts: Left/Right arrow keys.
- **Modern Tag Input**  
  Pill-style tag input component for the Tags field. Type and press Enter to add, click X to remove.
- **Use Folder Button**  
  When editing Category or Subcategory, a "Use Folder" button appears to populate the field with the model's current folder name.
- **Search by Tags**  
  Search now includes tags in addition to name, filename, and category.
- **Filename Customization**  
  Added settings to configure "Recommended Filename" formats per Base Model using variables like `{modelname}` and `{version}`.
- **Smart Rule Creation**  
  When adding a new format rule, a dropdown now lists detected Base Models that aren't yet configured.
- **Bulk Editing Mode**  
  Select multiple models at once to perform batch operations:
  - **Bulk Move**: Move all selected models to a different folder
  - **Bulk Edit**: Update Category, Subcategory, Version, and High/Low for all selected models
  - **Bulk Rename**: Preview and apply recommended filenames to selected models
- **Guess Version Button**  
  When editing Model Version, a button appears to auto-detect version numbers from the model name or filename (e.g., "v2.0" → "2").

**Changed**
- **Keywords Section Reorganized**  
  Trigger words (positive, negative, all) now on the left, Example Prompts on the right. Section renamed to "Keywords & Prompts".
- **Table View Grouping**  
  Table view now supports grouping just like grid view. Group headers span all columns with model counts.
- **Settings Modal Tabs**  
  Organized settings into tabs (General, Table Columns, Filename Formatting) for better navigation.
- **Header Button Text**  
  Shortened button labels: "Grid View" → "Grid", "Table View" → "Table", "Civitai Scan" → "Civitai".
- **Categorization Section Reorganized**  
  Category/Subcategory now on left, Tags on right. Improved modal header button spacing.
- **Modal UI Cleanup**  
  Consistent spacing and dark theme colors in left column. Larger nav/refresh/close icons.

---

### 01/08/2026

**Added**
- **Video Thumbnail Extraction**  
  Extracts first and last frames from Civitai video previews using FFmpeg when no images are available.
- **Multi-Image Downloads**  
  Thumbnail download now fetches up to 2 images per model (`.preview.png` and `.preview2.png`).
- **Download Thumbnails - All Button**  
  New button on Civitai Scan page to download/update thumbnails for ALL models, not just missing ones.
- **Requirements File**  
  Added `requirements.txt` with Python dependencies and FFmpeg installation notes.

**Changed**
- **Smart Thumbnail Filling**  
  Download Thumbnail button now fills empty preview slots without re-downloading existing images.

---

### 01/03/2026

**Changed**
- **Model Identity Layout**  
  Model Version and High/Low toggle now display side by side (70/30 split).

---

### 01/01/2026

**Changed**
- **Modal Title Styling**  
  Moved horizontal rule to directly under title text instead of full header width.

**Fixed**
- **Duplicate Horizontal Rules**  
  Removed duplicate HR styling that caused two lines to appear under modal title.
- **Thumbnail Border Radius**  
  Fixed thumbnail corners to be rounded on all sides, not just top.

---

### 12/31/2025

**Changed**
- **Textarea Auto-Resize**  
  View mode shrinks to fit content (max 20 lines with scrollbar); edit mode expands to show all.
- **Changelog Format**  
  Migrated changelog from TXT to Markdown format with improved structure.

**Fixed**
- **Text Spacing**  
  Fixed spacing issues in UI text elements.
- **Model Weight Display**  
  Corrected model weight rendering in the interface.

---

### 12/30/2025

**Added**
- **Manual Civitai URL Matching**  
  Prompts for manual URL entry when hash matching fails, or creates dummy file.

**Fixed**
- **Move Location Dropdown**  
  Fixed dropdown to show correct folders for LoRAs vs Checkpoints.
- **Preferred Weight Slider**  
  Fixed slider display and value updates in edit mode.

---

### 12/29/2025

**Added**
- **Checkpoint Model Support**  
  Added second model location for Checkpoints with separate UI tab.

**Fixed**
- **Checkpoint Move Function**  
  Fixed file moving for Checkpoint models.
- **Checkpoint Civitai Scan**  
  Fixed scanning and matching for Checkpoint models.

---

### 12/28/2025

**Added**
- **Creator Suffix Button**  
  Appends " - [creator name]" to proposed filename.
- **Trim Name Button**  
  Removes base model and version suffixes from model name.

**Changed**
- **Move/Rename UI**  
  Improved visibility toggles, added recommended button outside edit mode.
- **Civitai2JSON Script**  
  Writes Civitai name to Model Name field; preserves existing Model Name, High/Low, and Version when updating.

---

### 12/27/2025

**Added**
- **Filename Helper Buttons**  
  Model Name button copies to filename; Recommended builds filename from metadata.

**Changed**
- **Naming Buttons Reorganization**  
  Moved Civitai Name and Clean buttons under Model Name field.

---

### 12/26/2025

**Added**
- **Model Name Field**  
  New field to store display name (separate from filename), auto-populated from Civitai.
- **High/Low Toggle**  
  Toggle for Wan2.2 model variants (High or Low).

**Changed**
- **Split Info Panels**  
  Separated read-only area into File Info and File Data sections.

---

### 12/25/2025

**Added**
- **Version in Title Bar**  
  Displays model version in popup title when available.
- **Description Section**  
  Added organized section for Notes and Description fields.

**Changed**
- **Thumbnail Aspect Ratio**  
  Thumbnails now use consistent 3:4 aspect ratio with cover fit.
- **Recommended Name Button**  
  Generates suggested filename based on model type and metadata.
- **File Management Overhaul**  
  Redesigned file operations area for better usability.

---

### 12/24/2025

**Added**
- **Settings and Model JSON Handling**  
  Improved model JSON handling and new settings options.
- **Civitai Integration**  
  Initial Civitai API integration for model metadata.

**Changed**
- **.gitignore Update**  
  Added Python cache directories to .gitignore.

**Fixed**
- **Deleted File Cleanup**  
  Removed stale deleted file references from the project.

---

### 12/15/2025

**Added**
- **Loading Indicator**  
  Visual loading indicator while models are being scanned.
- **Search and Filter**  
  Search bar and filter options for model browsing.
- **Sorting Options**  
  Sort models by various criteria.
- **Auto-Create JSON Files**  
  Creates model JSON file automatically when a field is populated.
- **Dummy Civitai Info Files**  
  Prompts to create placeholder file when no Civitai match is found.
- **Copy Prompt Button**  
  Added clipboard copy button for prompt text boxes.
- **New JSON Fields**  
  Added Example Prompt 2 and Model Version fields.
- **Comprehensive Styling**  
  New CSS files for general, model, and settings modals plus components and layout.

**Changed**
- **Renamed Fields**  
  Positive Words → Triggerwords for WebUI; Negative Words → Negative Words for WebUI; Civitai Words → All Triggerwords.
- **Default Application Port**  
  Set default port for the application.

**Fixed**
- **Thumbnail Mouseover**  
  Fixed thumbnail mouseover functionality in grid view.

---

### 12/14/2025

**Added**
- **Civitai Integration**  
  Civitai API integration for model information and preview images.
- **Civitai Scan UI**  
  UI for scanning models against Civitai database.
- **Direct Preview Upload**  
  Upload preview images directly from the UI.

---

### 12/13/2025

**Added**
- **Multi-Image Preview Carousel**  
  Carousel with side navigation and indicator for model cards.

---

### 12/12/2025

**Added**
- **Initial Web UI**  
  Lora model management interface with grid/table views.
- **Backend Endpoints**  
  API endpoints for folder listing and model moving.
- **Civitai Metadata Parser**  
  Script to generate JSON files from Civitai metadata.
- **Model Details Modal**  
  Popup modal for viewing detailed model information.
- **Search & Filters**  
  Search, filter, and sort functionality for models.
- **README Documentation**  
  Comprehensive README detailing features, installation, and usage.

---
