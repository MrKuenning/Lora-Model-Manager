# AI Lora Model Manager

A web-based application for organizing and managing thousands of AI Lora and Checkpoint models with their associated metadata, thumbnails, and Civitai information.

## Overview

The AI Lora Model Manager is a powerful tool designed to help you organize, search, and manage large collections of Lora and Checkpoint models. It provides an intuitive interface for viewing model metadata, editing information, and syncing with Civitai.

## Features

### 📊 Multiple View Modes
- **Grid View**: Visual card-based layout with thumbnails
- **Table View**: Detailed spreadsheet-style view with sortable columns
- **Grouped View**: Organize models by category, folder, or base model

### 🔍 Advanced Search & Filtering
- Full-text search across all model metadata
- Filter by category, tags, creator, base model
- Safe Mode toggle for NSFW content filtering
- Sort by name, date, size, or any column

### 📁 Dual Model Support
Manage both LoRA and Checkpoint models from separate directories:
- **LoRAs Tab**: Browse and manage LoRA models
- **Checkpoints Tab**: Browse and manage Checkpoint models
- Each location has its own configuration and folder structure
- Switch between locations with tab buttons in the header

### 🎨 Model Details Modal
- **Multiple preview images** with carousel navigation
- **Drag-and-drop thumbnail upload** for custom previews
- **Editable metadata** including:
  - Model Name (separate from filename)
  - Filename (renames all associated files)
  - Model Version and High/Low variant toggle
  - Tags, Category, Subcategory
  - Creator, Placeholder
  - Positive/Negative/Civitai keywords
  - Example prompts, Notes, Description
- **NSFW toggle** for content rating
- **Preferred weight slider** (-4 to +4 range with color gradient)
- **Dual JSON editor** for both model.json and civitai.info files
- **File information** split into File Info and File Data panels

### 🛠️ Filename Helper Tools
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
Dedicated Civitai Scan page with powerful tools:

- **Get Civitai Data**: Fetch model info using SHA256 hash lookup
- **Manual URL Matching**: Enter Civitai URL when hash matching fails
- **Download Thumbnails**: Download preview images from Civitai
- **Convert to JSON**: Convert .civitai.info to .json format
- **Fix Thumbnail Names**: Standardize thumbnail filenames
- **Dummy Info Files**: Create placeholder files for unmatched models

### 📝 Model-Specific Actions
Four Civitai action buttons in the model popup for single-model operations:
- Get Civitai Data for current model
- Create JSON from .civitai.info
- Download thumbnail
- Fix thumbnail name

### 📋 Smart Textarea Behavior
- View mode: Textareas shrink to fit content (max 20 lines with scrollbar)
- Edit mode: Textareas expand to show all content with auto-resize

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

Each model consists of up to four files:

```
model_name.safetensors          # The model file
model_name.json                 # Metadata for AI Web UI
model_name.civitai.info         # Civitai metadata (optional)
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
  "civitai name": "Official Model Name",
  "civitai text": "official, trigger, words",
  "creator": "Artist Name",
  "description": "Model description",
  "example prompt": "Example prompt text",
  "example prompt 2": "Additional example",
  "folder": "Styles/Anime",
  "high low": "High",
  "model name": "Display Name",
  "model version": "v1.0",
  "negative text": "negative, keywords",
  "nsfw": "false",
  "notes": "Personal notes about the model",
  "preferred weight": "0.8",
  "tags": "tag1, tag2, tag3",
  "url": "https://civitai.com/models/..."
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
3. Click **"Scan Models & Create Info Files"** to fetch metadata
4. For unmatched models: enter Civitai URL manually or create dummy file
5. Click **"Download Preview Images"** to get thumbnails
6. Click **"Convert to JSON"** to create .json files
7. Click **"Fix Thumbnail Names"** to standardize filenames (optional)

### Rate Limiting
- Smart delays (0.5s default) respect Civitai API limits
- Configurable delay between 0-5 seconds
- Only delays when API calls are needed

## Filename Helper Tools

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

See the full changelog at [changelog.md](changelog.md)

---


## License

This project is provided as-is for personal use. Please respect Civitai's API terms of service when using the scanning features.

## Contributing

This is a personal project, but suggestions and bug reports are welcome.

## Acknowledgments

- [Civitai](https://civitai.com) for providing the model metadata API
- Font Awesome for icons
- The AI community for inspiration
