# AI Lora Model Manager

A web-based application for organizing and managing thousands of AI Lora and Checkpoint models with their associated metadata, thumbnails, and Civitai information.

## Overview

The AI Lora Model Manager is a powerful tool designed to help you organize, search, and manage large collections of Lora and Checkpoint models. It provides an intuitive interface for viewing model metadata, editing information, and syncing with Civitai.

Go from this to this in seconds.
<p>
  <img src="https://github.com/user-attachments/assets/27656aab-5bd1-4d67-afda-c3ee2387938f" width="49%" alt="Description 1">
  <img src="https://github.com/user-attachments/assets/97e09e27-f343-46f3-ad18-005f01d5e8f2" width="49%" alt="Description 2">
</p>

## Changelog

See the full changelog at [CHANGELOG.md](CHANGELOG.md)

---

## Features

### 📊 Multiple View Modes
- **Grid View**: Visual card-based layout with thumbnails
<img src="https://github.com/user-attachments/assets/302b81b3-6409-4079-8846-c5f7473e7abe" width="500" />

- **Table View**: Detailed spreadsheet-style view with sortable columns
<img src="https://github.com/user-attachments/assets/c8732415-6fbb-48b5-a7e7-8e87b0671d64" width="500" />

- **Grouped View**: Organize models by category, folder, or base model
<img src="https://github.com/user-attachments/assets/87ff8bba-4e2a-48ec-9f92-4a4085077e75" width="500" />

- **Folder Tree & List View Sidebar**: Sidebar layout allowing toggleable Tree or List representations of directories. The sidebar's visibility and current view mode are persisted in your browser's local storage.

### 🔍 Advanced Search & Filtering
- Full-text search across all model metadata (including tags)
- **Multi-select base model filtering** to filter by multiple base models simultaneously
- Filter by category, tags, creator
- Safe Mode toggle for NSFW content filtering
- Sort by name, date, size, or any column

### 📁 Dual Model Support
Manage both LoRA and Checkpoint models from separate directories:
- **LoRAs Tab**: Browse and manage LoRA models
- **Checkpoints Tab**: Browse and manage Checkpoint models
- Each location has its own configuration and folder structure
- Switch between locations with tab buttons in the header

### 🎨 Model Details Modal
<img src="https://github.com/user-attachments/assets/a2d666ab-9eb3-422d-ad64-44cd67615b49" width="500" />

- **Multiple preview images** with carousel navigation
- **Drag-and-drop thumbnail upload** for custom previews
- **Editable metadata** including:
  - Model Name (separate from filename)
  - Filename (renames all associated files)
  - Model Version and High/Low variant toggle
  - Tags, Category, Subcategory
- **NSFW toggle** for content rating
- **Preferred weight slider** (-4 to +4 range with color gradient)
- **Built-in JSON editor** for powerful metadata management
- **File information** split into File Info (with SHA256 display) and File Data panels
- **SHA256 Hash Generation**: Instantly compute the SHA256 checksum of model files
- **Model Deletion**: Safely delete the model file and all associated files (metadata JSON, preview images) directly from the details view

### 🛠️ Filename Helper Tools
<img src="https://github.com/user-attachments/assets/212f2a7d-ca5a-43aa-a994-c83af99dbb70" width="500" />

Powerful buttons to help format and manage filenames:

1. **Model Name**: Copy model name to filename field
2. **Recommended**: Build filename from model name, type, version, and creator
3. **Civitai Name**: Auto-populate filename from Civitai metadata
4. **Clean**: Format filename with proper capitalization and spacing
5. **Trim Name**: Remove base model and version suffixes from model name
6. **Creator Suffix**: Append " - [creator name]" to filename
7. **High/Low**: Swap High/Low variants for WAN 2.2 models
8. **Append Prefix**: Add base model prefix ([P], [X], [I], [Z])
9. **Append Suffix**: Add WAN Video model suffixes

### 🌐 Civitai Integration
<img src="https://github.com/user-attachments/assets/1f20344f-c124-49c2-9d08-9a2b7a0a4f25" width="500" />

Dedicated Civitai Scan page with powerful tools:

- **Get Civitai Data**: Fetch model info using SHA256 hash lookup (creates JSON directly)
- **All-In-One Scan**: Automate matching, metadata JSON creation, and thumbnail downloads in a single click
- **Manual URL Matching**: Enter Civitai URL when hash matching fails
- **Download Thumbnails**: Download preview images from Civitai
- **Fix Thumbnail Names**: Standardize thumbnail filenames
- **Dummy JSON Files**: Create marker files for unmatched models

### 📝 Model-Specific Actions
Action buttons in the model popup for single-model operations:
- **Get Civitai Data** for current model
- **Download Thumbnail**
- **Fix Thumbnail Name**
- **Generate SHA256 Hash** for model integrity and duplicate scanning
- **Delete Model** to clean up the model and its associated metadata/previews

### 📦 Bulk Editing Mode
<img src="https://github.com/user-attachments/assets/bc2b8b01-c59c-4989-b2da-141576cd8df5" width="500" />

Perform batch operations on multiple models at once:
1. Click the **Bulk** button in the header to enter selection mode
2. Click on model cards to select/deselect them
3. Use the action buttons to perform operations:
   - **Move**: Move all selected models to a different folder
   - **Edit**: Update Category, Subcategory, Version, High/Low for all
   - **Rename**: Preview and apply recommended filenames
4. Click **Cancel** to exit bulk mode

### 🎴 Grid Card Settings

Customize what information appears on model cards in grid view via **Settings → Grid Card**:

- **Image Display**:
  - **Carousel**: Show navigation arrows to cycle through preview images
  - **Single**: Show only the first preview image (faster loading)

- **Title**: Choose what to display as the card title:
  - **File Name**: Shows the model filename
  - **Model Name**: Shows the display name from JSON metadata

- **Subtitle 1, 2, 3**: Configure up to three data fields to show below the title:
  - None, File Name, Model Name, Folder, Category, Subcategory
  - Base Model, Model Version, High/Low, Trigger Words, Creator, Tags
  - Fields are joined with " | " and empty fields are automatically hidden

**Example Configurations**:
- Classic: `Folder | Base Model` (default)
- Detailed: `Category | Base Model | Creator`
- Minimal: `Base Model` only (set others to None)

### 📋 Smart Textarea Behavior
- View mode: Textareas shrink to fit content (max 20 lines with scrollbar)
- Edit mode: Textareas expand to show all content with auto-resize

### 🗺️ Model Type Roots
Organize and clean up folder navigation when moving models by mapping Base Model Types to specific root directories:
- **Set Roots in Settings**: Map any base model (e.g. `Qwen`) to a target root folder (e.g., `Comfy/QWEN`) under the **Model Type Roots** settings tab.
- **Smart Path Auto-complete**: Configured via a drop-down combo-box that fetches valid, actual relative folders from both your LoRA and Checkpoint directories.
- **Dynamic Move Filtering**: When moving a model, the target location dropdown filters automatically to only show the configured root folder and its subdirectories.
- **Bulk Operations Integration**: Filters the destination folder list in bulk move operations if all selected models share the same base model.

## Installation

### Requirements
- Python 3.8 or higher
- Modern web browser (Chrome, Firefox, Edge)
- Windows operating system

### Setup

1. **Clone or download** the repository to your local machine

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure your models directories**:
   - Launch the application (see "Running the Application")
   - Click the Settings gear icon
   - Set your Lora models directory path
   - Set your Checkpoints directory path
   - Configure your preferred view and sort options

## Running the Application

1. **Start the server**:
   ```bash
   python manager.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:8000
   ```

3. **Set your models directories** in Settings if this is your first time

## File Structure

Each model consists of:

```
model_name.safetensors          # The model file
model_name.json                 # Metadata (including Civitai data)
model_name.preview.png          # Primary thumbnail
model_name.preview2.png         # Additional previews (optional)
model_name.preview3.png         # Additional previews (optional)
model_name.preview4.png         # Additional previews (optional)
```

## JSON Metadata Structure

The `model_name.json` file contains metadata in the following structure:

```json
{
  "activation text": "trigger_word",
  "base model": "SDXL 1.0",
  "category": "Style",
  "subcategory": "Anime",
  "description": "Model description",
  "example prompt 1": "Example prompt text",
  "example prompt 2": "Additional example",
  "high low": "High",
  "model name": "Display Name",
  "model version": "v1.0",
  "negative text": "negative, keywords",
  "nsfw": "false",
  "notes": "Personal notes about the model",
  "preferred weight": "0.8",
  "tags": "tag1, tag2, tag3",
  "web_civitai_data": {
    "civitai name": "Official Model Name",
    "civitai text": "official, trigger, words",
    "creator": "Artist Name",
    "url": "https://civitai.com/models/...",
    "model_id": "123456",
    "file_id": "7890",
    "published_date": "2024-03-19T00:00:00Z"
  }
}
```

## Configuration

Settings are stored in `config.json` and include:

- **modelsDirectory**: Path to your Lora models folder
- **checkpointsDirectory**: Path to your Checkpoints folder
- **theme**: "dark" or "light"
- **defaultView**: "grid" or "table"
- **defaultSort**: Sorting preference
- **hideNSFW**: Safe Mode toggle
- **visibleColumns**: Which columns to show in table view

## Civitai Scan Workflow

1. Navigate to **Civitai Scan** page (button in header)
2. Select **LoRAs** or **Checkpoints** tab
3. Click **"Scan & Fetch Missing"** to fetch metadata directly into JSON
4. For unmatched models: enter Civitai URL manually or create dummy JSON
5. Click **"Download Preview Images"** to get thumbnails
6. Click **"Fix Thumbnail Names"** to standardize filenames (optional)

### Rate Limiting
- Smart delays (0.5s default) respect Civitai API limits
- Configurable delay between 0-5 seconds
- Only delays when API calls are needed

## Filename Helper Tools

![2026-01-13 15_29_38-Greenshot](https://github.com/user-attachments/assets/434732d1-12c4-4dfc-a2dc-5bb15ca6ccbc)

### Model Name
Copies the display name from Model Name field to filename.

### Recommended
Builds a standardized filename from:
- Model Name
- Model Version (if set)
- High/Low variant (if set)
- Base model type

### Clean
Formats filenames with:
- Underscores replaced with spaces
- Proper capitalization
- Clean spacing around dashes
- Removal of extra spaces

**Example**: `my_model_name-v2` → `My Model Name - V2`

### Trim Name
Removes base model identifiers and version suffixes from the model name.

**Example**: `MyModel SDXL v1.5` → `MyModel`

### Creator Suffix
Appends the creator name as a suffix.

**Example**: `MyModel` → `MyModel - ArtistName`

### High/Low
Swaps "High" and "Low" in filenames for WAN 2.2 model pairs.

**Example**: `MyModel_High_v1` → `MyModel_Low_v1`

### Append Prefix
Adds base model prefix to filename:
- Pony → `[P]`
- SDXL 1.0 → `[X]`
- Illustrious → `[I]`
- ZImageTurbo → `[Z]`

**Example**: `MyModel_v1` → `[P] MyModel_v1`

### Append Suffix
Adds WAN Video model suffix to filename:
- Wan Video 2.2 I2V-A14B → `- High I2v - Wan22 14b`
- Wan Video 2.2 T2V-A14B → `- High T2v - Wan22 14b`
- Other WAN variants supported

## Custom Filename Formatting
![2026-01-13 16_04_35-Greenshot](https://github.com/user-attachments/assets/bf82b8a9-830b-41cc-9507-c65f927d15da)

Configure custom "Recommended" filename formats per Base Model type in **Settings → Filename Formatting**.

### Format Rules
Each rule consists of:
- **Base Model**: Which model type the rule applies to (e.g., "Pony", "SDXL 1.0", "Illustrious")
- **Format String**: Template using variables to build the filename

### Available Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{modelname}` | Display name from Model Name field | `My Character` |
| `{version}` | Model Version field | `2` |
| `{highlow}` | High/Low toggle value | `High` |
| `{category}` | Category field | `Character` |
| `{subcategory}` | Subcategory field | `Anime` |

### Example Formats
- **Default**: `{modelname} {version}` → `My Character 2`
- **With High/Low**: `{modelname} {highlow} {version}` → `My Character High 2`
- **With Category**: `{category} - {modelname}` → `Character - My Character`

### How It Works
1. When you click **Recommended** on a model, the app finds a matching format rule by Base Model
2. If no specific rule exists, it falls back to the **Default** rule
3. Variables are replaced with actual values; empty values are omitted
4. Extra spaces are automatically cleaned up

### Managing Rules
- The **Default** rule cannot be deleted (ensures fallback always exists)
- When adding a new rule, a dropdown shows detected Base Models that don't yet have rules
- Click the delete button to remove a rule (disabled for Default)

## Tips & Best Practices

1. **Organize before you start**: Set up your folder structure first
2. **Use Civitai Scan**: Automatically fetch metadata for all models
3. **Standardize filenames**: Use the filename helper tools for consistency
4. **Use categories**: Organize models with categories and subcategories
5. **Tag everything**: Good tags make searching much easier
6. **Regular backups**: Back up your .json files regularly
7. **Use Model Name field**: Keep display name separate from filename

## Keyboard Shortcuts

- **Escape**: Close open modals
- **Left/Right Arrows**: Navigate between models in popup
- **Ctrl+F5**: Hard refresh (useful after updates)

## Troubleshooting

### Models not loading
- Check that your models directory path is correct in Settings
- Ensure the directory contains .safetensors files
- Try clicking the Refresh button

### Civitai scan not working
- Check your internet connection
- Increase the delay between requests in scan options
- Some models may not exist on Civitai
- Use manual URL matching for unmatched models

### Changes not saving
- Make sure you click the Save button after editing
- Check the browser console (F12) for errors
- Verify file write permissions in your models directory

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Python HTTP Server
- **Styling**: Custom CSS with CSS variables
- **Icons**: Font Awesome 6

## Project Structure

```
App1/
├── manager.py                 # Python backend server
├── config.json               # Application configuration
├── changelog.txt             # Version history
├── pages/
│   ├── index.html           # Main application page
│   └── civitai-scan.html    # Civitai scan tools
├── css/
│   ├── styles.css           # Global styles
│   ├── modal.css            # Modal styling
│   ├── model-modal.css      # Model popup styling
│   ├── grid-view.css        # Grid view styling
│   ├── table-view.css       # Table view styling
│   ├── toast.css            # Toast notifications
│   └── civitai-scan.css     # Scan page styling
├── scripts/
│   ├── app.js               # Main application logic
│   ├── settings.js          # Settings management
│   ├── grid-view.js         # Grid view rendering
│   ├── table-view.js        # Table view rendering
│   ├── grid-group-view.js   # Grouped view rendering
│   ├── bulk-operations.js   # Bulk edit mode operations
│   ├── search-parser.js     # Search functionality
│   ├── civitai-scan.js      # Scan page logic
│   ├── civitai-api.js       # Civitai API functions
│   ├── civitai_handler.py   # Civitai API integration
│   ├── toast.js             # Toast notification system
│   └── zCivitai-2-JSONv4.py # JSON conversion
└── assets/
    └── placeholder.png       # Default thumbnail
```

---

## Changelog

See the full changelog at [CHANGELOG.md](CHANGELOG.md)

---


## License

This project is provided as-is for personal use. Please respect Civitai's API terms of service when using the scanning features.

## Contributing

This is a personal project, but suggestions and bug reports are welcome.

## Acknowledgments

- [Civitai](https://civitai.com) for providing the model metadata API
- Font Awesome for icons
- The AI community for inspiration
