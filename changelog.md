# Lora Model Manager - Changelog

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
