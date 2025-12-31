# Lora Model Manager - Changelog

---

### 12/31/2025

**Textarea Auto-Resize**
View mode: shrinks to fit content (max 20 lines with scrollbar).
Edit mode: expands to show all content.

---

### 12/30/2025

**Manual Civitai URL Matching**
When hash matching fails, prompts for manual URL entry or dummy file creation.

**Move Location Fix**
Fixed dropdown to show correct folders for LoRAs vs Checkpoints.

**Preferred Weight Slider Fix**
Fixed slider display and value updates in edit mode.

---

### 12/29/2025

**Checkpoint Model Support**
Added second model location for Checkpoints with separate UI tab.

**Checkpoint Civitai Scan**
Fixed scanning and matching for Checkpoint models.

---

### 12/28/2025

**Creator Suffix Button**
Appends " - [creator name]" to proposed filename.

**Move/Rename UI Cleanup**
Improved visibility toggles, added recommended button outside edit mode.

**Trim Name Button**
Removes base model and version suffixes from model name.

**Civitai2JSON Script Update**
Writes Civitai name to Model Name field; preserves existing Model Name, High/Low, and Version when updating.

---

### 12/27/2025

**Naming Buttons Reorganization**
Moved Civitai Name and Clean buttons under Model Name field.

**Filename Helper Buttons**
- Model Name: Copies model name to filename
- Recommended: Builds filename from model name, type, and version

---

### 12/26/2025

**Model Name Field**
New field to store display name (separate from filename), auto-populated from Civitai.

**High/Low Toggle**
Toggle for Wan2.2 model variants (High or Low).

**Split Info Panels**
Separated read-only area into File Info and File Data sections.

---

### 12/25/2025

**Thumbnail Aspect Ratio**
Thumbnails now use consistent 3:4 aspect ratio with cover fit.

**Recommended Name Button**
Generates suggested filename based on model type and metadata.

**Version in Title Bar**
Displays model version in popup title when available.

**Description Section**
Added organized section for Notes and Description fields.

**File Management Overhaul**
Redesigned file operations area for better usability.

---

### 12/15/2025

**Auto-Create JSON Files**
Creates model JSON file automatically when a field is populated.

**Dummy Civitai Info Files**
Prompts to create placeholder file when no Civitai match is found.

**Copy Prompt Button**
Added clipboard copy button for prompt text boxes.

**New JSON Fields**
Added Example Prompt 2 and Model Version fields.

**Renamed Fields**
- Positive Words → Triggerwords for WebUI
- Negative Words → Negative Words for WebUI  
- Civitai Words → All Triggerwords

---
