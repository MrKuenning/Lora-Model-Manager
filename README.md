# AI Lora Model Manager

A web-based application for organizing and managing thousands of AI Lora models with their associated metadata, thumbnails, and Civitai information.

## Overview

The AI Lora Model Manager is a powerful tool designed to help you organize, search, and manage large collections of Lora models. It provides an intuitive interface for viewing model metadata, editing information, and syncing with Civitai.

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

### 🎨 Model Details Modal
- **Multiple preview images** with carousel navigation
- **Editable metadata** including:
  - Filename (renames all associated files)
  - Tags, Category, Subcategory
  - Creator, Placeholder
  - Positive/Negative/Civitai keywords
  - Example prompts, Notes, Description
- **NSFW toggle** for content rating
- **Dual JSON editor** for both model.json and civitai.info files
- **File information** including path, size, date, and URL

### 🛠️ Filename Helper Tools
Five powerful buttons to help format and manage filenames:

1. **Civitai Name**: Auto-populate filename from Civitai metadata
2. **Clean**: Format filename with proper capitalization and spacing
3. **High/Low**: Swap High/Low variants for WAN 2.2 models
4. **Append Prefix**: Add base model prefix ([P], [X], [I], [Z])
5. **Append Suffix**: Add WAN Video model suffixes

### 🌐 Civitai Integration
Dedicated Civitai Scan page with four powerful tools:

- **Get Civitai Data**: Fetch model info using SHA256 hash lookup
- **Download Thumbnails**: Download preview images from Civitai
- **Convert to JSON**: Convert .civitai.info to .json format
- **Fix Thumbnail Names**: Standardize thumbnail filenames

### 📝 Model-Specific Actions
Four Civitai action buttons in the model popup for single-model operations:
- Get Civitai Data for current model
- Create JSON from .civitai.info
- Download thumbnail
- Fix thumbnail name

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

3. **Configure your models directory**:
   - Launch the application (see "Running the Application")
   - Click the Settings gear icon
   - Set your Lora models directory path
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

3. **Set your models directory** in Settings if this is your first time

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
  "folder": "Styles/Anime",
  "negative text": "negative, keywords",
  "nsfw": "false",
  "tags": "tag1, tag2, tag3",
  "url": "https://civitai.com/models/...",
  "notes": "Personal notes about the model"
}
```

## Configuration

Settings are stored in `config.json` and include:

- **modelsDirectory**: Path to your Lora models folder
- **theme**: "dark" or "light"
- **defaultView**: "grid" or "table"
- **defaultSort**: Sorting preference
- **hideNSFW**: Safe Mode toggle
- **visibleColumns**: Which columns to show in table view

## Civitai Scan Workflow

1. Navigate to **Civitai Scan** page (button in header)
2. Click **"Scan Models & Create Info Files"** to fetch metadata
3. Click **"Download Preview Images"** to get thumbnails
4. Click **"Convert to JSON"** to create .json files
5. Click **"Fix Thumbnail Names"** to standardize filenames (optional)

### Rate Limiting
- Smart delays (0.5s default) respect Civitai API limits
- Configurable delay between 0-5 seconds
- Only delays when API calls are needed

## Filename Helper Tools

### Civitai Name
Populates the filename field with the model's official Civitai name.

### Clean
Formats filenames with:
- Underscores replaced with spaces
- Proper capitalization
- Clean spacing around dashes
- Removal of extra spaces

**Example**: `my_model_name-v2` → `My Model Name - V2`

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
├── pages/
│   ├── index.html           # Main application page
│   └── civitai-scan.html    # Civitai scan tools
├── css/
│   ├── styles.css           # Global styles
│   ├── modal.css            # Modal styling
│   ├── model-modal.css      # Model popup styling
│   ├── grid-view.css        # Grid view styling
│   ├── table-view.css       # Table view styling
│   └── civitai-scan.css     # Scan page styling
├── scripts/
│   ├── script.js            # Main application logic
│   ├── settings.js          # Settings management
│   ├── grid-view.js         # Grid view rendering
│   ├── table-view.js        # Table view rendering
│   ├── grid-group-view.js   # Grouped view rendering
│   ├── search-parser.js     # Search functionality
│   ├── civitai-scan.js      # Scan page logic
│   ├── civitai_handler.py   # Civitai API integration
│   └── zCivitai-2-JSONv4.py # JSON conversion
└── assets/
    └── placeholder.png       # Default thumbnail
```

## License

This project is provided as-is for personal use. Please respect Civitai's API terms of service when using the scanning features.

## Contributing

This is a personal project, but suggestions and bug reports are welcome.

## Acknowledgments

- [Civitai](https://civitai.com) for providing the model metadata API
- Font Awesome for icons
- The AI community for inspiration
