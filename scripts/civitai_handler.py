# -*- coding: UTF-8 -*-
"""
Civitai Handler Module
Handles all Civitai API interactions, file hashing, and model info management
"""

import os
import hashlib
import json
import requests
import re
import subprocess
import tempfile
import shutil
from pathlib import Path
from html import unescape

# Civitai API endpoints
CIVITAI_API_URLS = {
    "model_page": "https://civitai.com/models/",
    "model_id": "https://civitai.com/api/v1/models/",
    "model_version_id": "https://civitai.com/api/v1/model-versions/",
    "hash": "https://civitai.com/api/v1/model-versions/by-hash/"
}

# Default headers for requests
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

# File extensions
MODEL_EXTENSIONS = ['.safetensors', '.ckpt', '.pt', '.pth']
INFO_EXTENSION = '.civitai.info'
PREVIEW_EXTENSION = '.preview.png'


def map_sd_version(base_model):
    if not base_model:
        return 'Unknown'
    
    if base_model == 'SD 1.5': return 'sd'
    if base_model in ['SDXL 1.0', 'Pony', 'Illustrious']: return 'xl'
    if base_model in ['Flux.1 D', 'Flux.1 S']: return 'flux'
    if base_model in ['Flux.2 Klein 9B', 'Flux.2 Klein 9B-Base', 'lux.2 Klein 9B-Base']: return 'klein'
    if base_model == 'Qwen': return 'qwen'
    if base_model in ['ZImageTurbo', 'ZImageBase']: return 'zit'
    if base_model in ['Wan Video 2.2 I2V-A14B', 'Wan Video 2.2 T2V-A14B']: return 'wan'
    if base_model == 'Anima': return 'anima'
    if base_model == 'Ernie': return 'ernie'
    if base_model == 'Krea 2': return 'krea'
    
    return 'Unknown'

def load_json_robust(file_path):
    """
    Load JSON from a file with robust encoding handling and error reporting.
    Specifically handles UTF-8 with BOM (common on Windows).
    
    Args:
        file_path: Path to the JSON file
        
    Returns:
        dict: The loaded data, or None if the file doesn't exist or is invalid.
    """
    if not os.path.exists(file_path):
        return None
        
    try:
        # Try utf-8-sig first to handle potential BOM
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {file_path}: {e}")
        return None
    except Exception as e:
        print(f"Error: Could not read JSON file {file_path}: {e}")
        return None


def generate_sha256(file_path, chunk_size=8192):
    """
    Generate SHA256 hash for a file
    
    Args:
        file_path: Path to the file
        chunk_size: Size of chunks to read (default 8KB)
        
    Returns:
        SHA256 hash as hex string, or None on error
    """
    try:
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except Exception as e:
        print(f"Error generating SHA256 for {file_path}: {e}")
        return None


def save_sha256_to_json(model_path, sha256_hash):
    """
    Save SHA256 hash to the model's JSON file
    
    Args:
        model_path: Path to the model file
        sha256_hash: SHA256 hash string to save
        
    Returns:
        True on success, False on error
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        json_path = f"{base_path}.json"
        
        # Load existing JSON if it exists
        existing_data = load_json_robust(json_path)
        if existing_data is None and os.path.exists(json_path):
            # If the file exists but we couldn't read it, ABORT to prevent data loss!
            print(f"CRITICAL: Failed to read existing JSON at {json_path}. Aborting update to prevent data loss.")
            return False
            
        if existing_data is None:
            existing_data = {}
            
        # Update with SHA256
        existing_data['sha256'] = sha256_hash
        
        # Write back
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=4)
        
        print(f"Saved SHA256 to: {json_path}")
        return True
    except Exception as e:
        print(f"Error saving SHA256 to JSON: {e}")
        return False


def find_duplicate_models(directory):
    """
    Find duplicate models by comparing SHA256 hashes from JSON files
    
    Args:
        directory: Path to scan
        
    Returns:
        dict with:
            - duplicates: list of groups (each group is list of paths with same hash)
            - missing_hash: list of model paths without SHA256 in JSON
            - total_scanned: count of models scanned
    """
    hash_map = {}  # sha256 -> list of model paths
    missing_hash = []
    
    try:
        for root, dirs, files in os.walk(directory):
            for filename in files:
                if any(filename.lower().endswith(ext) for ext in MODEL_EXTENSIONS):
                    model_path = os.path.join(root, filename)
                    base_path = os.path.splitext(model_path)[0]
                    json_path = f"{base_path}.json"
                    
                    json_data = load_json_robust(json_path)
                    if json_data:
                        sha256 = json_data.get('sha256')
                        if sha256:
                            if sha256 not in hash_map:
                                hash_map[sha256] = []
                            hash_map[sha256].append(model_path)
                        else:
                            missing_hash.append(model_path)
                    else:
                        missing_hash.append(model_path)
    except Exception as e:
        print(f"Error scanning for duplicates: {e}")
    
    # Find groups with more than one file (duplicates)
    duplicates = [paths for paths in hash_map.values() if len(paths) > 1]
    
    return {
        'duplicates': duplicates,
        'missing_hash': missing_hash,
        'total_scanned': sum(len(paths) for paths in hash_map.values()) + len(missing_hash)
    }


def fetch_model_info_by_hash(file_hash):
    """
    Fetch model info from Civitai using SHA256 hash
    
    Args:
        file_hash: SHA256 hash of the model file
        
    Returns:
        Model info dict, or None on error
    """
    try:
        url = f"{CIVITAI_API_URLS['hash']}{file_hash}"
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=30)
        
        if response.status_code == 404:
            print(f"Model not found on Civitai for hash: {file_hash}")
            return {}
        elif not response.ok:
            print(f"Civitai API error {response.status_code}: {response.text}")
            return None
            
        return response.json()
    except Exception as e:
        print(f"Error fetching model info: {e}")
        return None


def fetch_model_info_by_id(model_id):
    """
    Fetch model info from Civitai using model ID
    
    Args:
        model_id: Civitai model ID
        
    Returns:
        Model info dict, or None on error
    """
    try:
        url = f"{CIVITAI_API_URLS['model_id']}{model_id}"
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=30)
        
        if not response.ok:
            print(f"Civitai API error {response.status_code}: {response.text}")
            return None
            
        return response.json()
    except Exception as e:
        print(f"Error fetching model info by ID: {e}")
        return None


def fetch_model_info_by_version_id(version_id):
    """
    Fetch model version info from Civitai using version ID
    
    Args:
        version_id: Civitai model version ID
        
    Returns:
        Model version info dict (same format as hash lookup), or None on error
    """
    try:
        url = f"{CIVITAI_API_URLS['model_version_id']}{version_id}"
        print(f"Fetching model version from: {url}")
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=30)
        
        if response.status_code == 404:
            print(f"Model version not found on Civitai: {version_id}")
            return {}
        elif not response.ok:
            print(f"Civitai API error {response.status_code}: {response.text}")
            return None
            
        return response.json()
    except Exception as e:
        print(f"Error fetching model info by version ID: {e}")
        return None


def parse_civitai_url(url):
    """
    Parse Civitai URL to extract model ID and version ID
    
    Supports URLs like:
    - https://civitai.com/models/402800?modelVersionId=1473181
    - https://civitai.com/models/402800/model-name?modelVersionId=1473181
    - https://civitai.com/models/402800
    
    Args:
        url: Civitai URL string
        
    Returns:
        tuple: (model_id, version_id) - version_id may be None
    """
    if not url:
        return (None, None)
    
    model_id = None
    version_id = None
    
    try:
        # Extract modelVersionId from query params
        if 'modelVersionId=' in url:
            match = re.search(r'modelVersionId=(\d+)', url)
            if match:
                version_id = match.group(1)
        
        # Extract model ID from path
        # Pattern: /models/{id} or /models/{id}/slug
        match = re.search(r'/models/(\d+)', url)
        if match:
            model_id = match.group(1)
            
    except Exception as e:
        print(f"Error parsing Civitai URL: {e}")
    
    return (model_id, version_id)


def strip_html_tags(text):
    """
    Remove HTML tags from text using regular expressions
    """
    clean = re.compile('<.*?>')
    return re.sub(clean, ' ', text)


def get_creator_from_api(model_id, use_api=True):
    """
    Fetch creator information from Civitai API using model ID
    """
    if not use_api:
        return ''
    try:
        api_url = f"https://civitai.com/api/v1/models/{model_id}"
        response = requests.get(api_url, headers=DEFAULT_HEADERS, timeout=10)
        if response.status_code == 200:
            model_data = response.json()
            if 'creator' in model_data and 'username' in model_data['creator']:
                return model_data['creator']['username']
        return 'Unknown'
    except Exception as e:
        print(f"Error fetching creator information: {e}")
        return 'Unknown'


def create_json_from_api_data(model_path, api_data, use_api_for_creator=True, existing_creator=''):
    """
    Create a .json file directly from Civitai API response data.
    This replaces the old two-step process of saving .civitai.info then converting.
    
    Args:
        model_path: Path to the model file
        api_data: Dict from Civitai API response
        use_api_for_creator: Whether to make API call for creator info
        existing_creator: Existing creator name to preserve
        
    Returns:
        True on success, False on error
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        json_path = f"{base_path}.json"
        
        # Initialize all fields with empty values (same structure as existing JSONs)
        mapped_data = {
            'activation text': '',
            'base model': '',
            'base_model_type': '',
            'category': '',
            'description': '',
            'example prompt 1': '',
            'example prompt 2': '',
            'folder': '',
            'high low': '',
            'model version': '',
            'model_type': '',
            'name': '',
            'negative text': '',
            'notes': '',
            'nsfw': '',
            'preferred weight': 0,
            'sd version': '',
            'sha256': '',
            'subcategory': '',
            'tags': '',
            'web_civitai_data': {
                'civitai name': '',
                'civitai text': '',
                'creator': '',
                'downloadUrl': '',
                'file_id': '',
                'model_id': '',
                'original_filename': '',
                'preview_image_1': '',
                'preview_image_2': '',
                'published_date': '',
                'url': ''
            }
        }
        
        # --- Extract data from API response ---
        
        # Trained words / activation text
        if 'trainedWords' in api_data:
            trained_words = api_data['trainedWords']
            if isinstance(trained_words, list) and trained_words:
                mapped_data['activation text'] = trained_words[0]
                mapped_data['web_civitai_data']['civitai text'] = ', '.join(trained_words)
        
        # Base model
        if 'baseModel' in api_data:
            mapped_data['base model'] = api_data['baseModel']
            mapped_data['sd version'] = map_sd_version(api_data['baseModel'])
        
        # Base model type (NEW)
        if 'baseModelType' in api_data:
            mapped_data['base_model_type'] = api_data['baseModelType']
        
        # Model info (name, nsfw, type)
        if 'model' in api_data:
            if 'name' in api_data['model']:
                mapped_data['web_civitai_data']['civitai name'] = api_data['model']['name']
                mapped_data['name'] = api_data['model']['name']
            if 'nsfw' in api_data['model']:
                mapped_data['nsfw'] = str(api_data['model']['nsfw']).lower()
            # Model type (NEW)
            if 'type' in api_data['model']:
                mapped_data['model_type'] = api_data['model']['type']
        
        # Model ID and File/Version ID (NEW)
        if 'modelId' in api_data:
            mapped_data['web_civitai_data']['model_id'] = api_data['modelId']
        if 'id' in api_data:
            mapped_data['web_civitai_data']['file_id'] = api_data['id']
        
        # Published date (NEW)
        if 'publishedAt' in api_data:
            mapped_data['web_civitai_data']['published_date'] = api_data['publishedAt']
        
        # Files info: original filename, download URL (NEW)
        if 'files' in api_data and isinstance(api_data['files'], list) and api_data['files']:
            first_file = api_data['files'][0]
            if 'name' in first_file:
                mapped_data['web_civitai_data']['original_filename'] = first_file['name']
            if 'downloadUrl' in first_file:
                mapped_data['web_civitai_data']['downloadUrl'] = first_file['downloadUrl']
            # Also get SHA256 from file hashes if available
            if 'hashes' in first_file and 'SHA256' in first_file['hashes']:
                mapped_data['sha256'] = first_file['hashes']['SHA256'].lower()
        
        # Root-level download URL fallback
        if not mapped_data['web_civitai_data']['downloadUrl'] and 'downloadUrl' in api_data:
            mapped_data['web_civitai_data']['downloadUrl'] = api_data['downloadUrl']
        
        # Process description for notes field
        description = ''
        if 'description' in api_data and api_data['description']:
            description = api_data['description']
            description = unescape(description)
            description = strip_html_tags(description)
            description = ' '.join(description.split())
        
        # Extract example prompts and preview image URLs from images
        if 'images' in api_data:
            images = api_data['images']
            if isinstance(images, list) and images:
                # First image: example prompt + preview URL
                first_image = images[0]
                if 'meta' in first_image and isinstance(first_image['meta'], dict):
                    if 'prompt' in first_image['meta']:
                        mapped_data['example prompt 1'] = first_image['meta']['prompt']
                    if 'negativePrompt' in first_image['meta']:
                        mapped_data['negative text'] = first_image['meta']['negativePrompt']
                if 'url' in first_image:
                    mapped_data['web_civitai_data']['preview_image_1'] = first_image['url']
                
                # Second image: example prompt 2 + preview URL (NEW)
                if len(images) > 1:
                    second_image = images[1]
                    if 'meta' in second_image and isinstance(second_image['meta'], dict):
                        if 'prompt' in second_image['meta']:
                            mapped_data['example prompt 2'] = second_image['meta']['prompt']
                    if 'url' in second_image:
                        mapped_data['web_civitai_data']['preview_image_2'] = second_image['url']
        
        # Build URL and notes
        wcd = mapped_data['web_civitai_data']
        if wcd['model_id'] and wcd['file_id']:
            url = f"https://civitai.com/models/{wcd['model_id']}?modelVersionId={wcd['file_id']}"
            wcd['url'] = url
            
            # Get creator
            if existing_creator:
                wcd['creator'] = existing_creator
            elif use_api_for_creator:
                creator = get_creator_from_api(wcd['model_id'], use_api_for_creator)
                if creator:
                    wcd['creator'] = creator
            
            # Construct notes field
            notes = [f"URL: {url}"]
            if 'baseModel' in api_data:
                notes.append(f"Base Model: {api_data['baseModel']}")
            if 'trainedWords' in api_data and api_data['trainedWords']:
                notes.append(f"Activation Words: {', '.join(api_data['trainedWords'])}")
            if description:
                notes.append(f"Description: {description}")
            mapped_data['notes'] = '\n'.join(notes)
        
 
        
        # --- Merge with existing JSON data (preserve user-edited fields) ---
        existing_data = load_json_robust(json_path)
        if existing_data:
            try:
                # Fields to preserve if already populated by user
                fields_to_preserve = [
                    'activation text', 'sd version', 'preferred weight',
                    'negative text',
                    'nsfw', 'base model', 'example prompt 1',
                    'category', 'subcategory', 'tags',
                    'name', 'model version', 'high low',
                    'sha256', 'folder', 'description'
                ]
                for field in fields_to_preserve:
                    if field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                        mapped_data[field] = existing_data[field]
                
                # Preserve web_civitai_data sub-fields if they exist in old format
                # (migrate from old flat format to nested)
                existing_wcd = existing_data.get('web_civitai_data', {})
                wcd_fields_to_preserve = ['civitai text', 'url', 'creator']
                for field in wcd_fields_to_preserve:
                    # Check nested location first
                    if field in existing_wcd and existing_wcd[field]:
                        mapped_data['web_civitai_data'][field] = existing_wcd[field]
                    # Fallback: check old flat location
                    elif field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                        mapped_data['web_civitai_data'][field] = existing_data[field]
                
                # Also preserve any extra fields in existing JSON not in our template
                fields_to_ignore = {'creator', 'original_filename', 'downloadUrl', 'z_info_file'}
                for key, value in existing_data.items():
                    if key not in mapped_data and key not in fields_to_ignore:
                        mapped_data[key] = value
                        
            except Exception as e:
                print(f"Error merging existing JSON data: {e}")
        elif os.path.exists(json_path):
            print(f"WARNING: Could not read existing JSON for merging at {json_path}. Proceeding with new data only.")
        
        # --- Write sorted JSON ---
        sorted_data = {k: mapped_data[k] for k in sorted(mapped_data.keys())}
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_data, f, indent=4)
        
        print(f"Created JSON directly from API data: {json_path}")
        return True
        
    except Exception as e:
        print(f"Error creating JSON from API data: {e}")
        return False


def save_civitai_info(model_path, model_info):
    """
    Save model info directly as .json file (no longer creates .civitai.info).
    This is the main entry point called by the server routes.
    
    Args:
        model_path: Path to the model file
        model_info: Model info dict from Civitai API
        
    Returns:
        True on success, False on error
    """
    return create_json_from_api_data(model_path, model_info)


def create_dummy_info_file(model_path):
    """
    Create a minimal .json file to mark model as already checked but not found on Civitai.
    No longer creates .civitai.info files.
    
    Args:
        model_path: Path to the model file
        
    Returns:
        True on success, False on error
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        json_path = f"{base_path}.json"
        
        # Load existing JSON if it exists to preserve data
        existing_data = load_json_robust(json_path)
        if existing_data is None and os.path.exists(json_path):
            # If the file exists but we couldn't read it, ABORT to prevent data loss!
            print(f"CRITICAL: Failed to read existing JSON at {json_path}. Aborting dummy creation to prevent data loss.")
            return False
            
        if existing_data is None:
            existing_data = {}
        
        # Mark as checked but not found
        existing_data['civitai_matched'] = False
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=4)
        
        print(f"Created dummy JSON marker: {json_path}")
        return True
    except Exception as e:
        print(f"Error creating dummy JSON: {e}")
        return False


def get_full_size_image_url(image_url, width):
    """
    Convert Civitai image URL to full size version
    
    Args:
        image_url: Original image URL
        width: Desired width
        
    Returns:
        Modified URL with new width
    """
    return re.sub(r'/width=\d+/', f'/width={width}/', image_url)


def check_ffmpeg_available():
    """
    Check if FFmpeg is available on the system
    
    Returns:
        True if FFmpeg is available, False otherwise
    """
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return False


def extract_video_frames(video_path, output_base_path):
    """
    Extract first and last frames from video using FFmpeg
    
    Args:
        video_path: Path to the video file
        output_base_path: Base path for output files (without extension)
        
    Returns:
        tuple: (success, message)
    """
    if not check_ffmpeg_available():
        return (False, "FFmpeg not available on system")
    
    try:
        preview_path = f"{output_base_path}{PREVIEW_EXTENSION}"
        preview2_path = f"{output_base_path}.preview2.png"
        
        # Extract first frame using select filter (as in the standalone version)
        first_frame_cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', 'select=eq(n\\,0)',
            '-vframes', '1',
            '-q:v', '2',
            preview_path
        ]
        
        print(f"Executing: {' '.join(first_frame_cmd)}")
        result = subprocess.run(
            first_frame_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30
        )
        
        if result.returncode != 0:
            error_msg = result.stderr.decode()
            print(f"FFmpeg error extracting first frame: {error_msg}")
            return (False, f"FFmpeg error extracting first frame: {error_msg[:200]}")
        
        # Extract last frame using reverse filter (proven method from standalone version)
        # This is slower but more reliable for certain formats/containers
        last_frame_cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', 'reverse',
            '-vframes', '1',
            '-q:v', '2',
            preview2_path
        ]
        
        print(f"Executing: {' '.join(last_frame_cmd)}")
        result = subprocess.run(
            last_frame_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60  # Increased timeout for slow reverse filter
        )
        
        if result.returncode != 0:
            error_msg = result.stderr.decode()
            print(f"FFmpeg error extracting last frame: {error_msg}")
            
            # Fallback: Just try to get one frame normally for the second slot if reverse fails
            print(f"Warning: Last frame extraction failed, using fallback.")
            fallback_cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-vframes', '1',
                '-q:v', '2',
                preview2_path
            ]
            subprocess.run(fallback_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
            return (True, "Extracted first frame (last frame fallback used)")
        
        return (True, "Extracted first and last frames")
        
    except subprocess.TimeoutExpired:
        return (False, "FFmpeg timeout - video too long or complex")
    except Exception as e:
        return (False, f"Error extracting frames: {str(e)}")


def download_preview_image(model_path, max_size=False, skip_nsfw=True, force_additional=False):
    """
    Download preview image for a model.
    Reads image URLs from the model's .json file (preview_image_1/2 fields,
    with fallback to z_info_file.images, then .civitai.info for backward compat).
    
    Args:
        model_path: Path to the model file
        max_size: Download full size image if True
        skip_nsfw: Skip NSFW images if True
        force_additional: If True, try to download additional images even if some exist
        
    Returns:
        True on success, False on error or skip
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        info_path = f"{base_path}{INFO_EXTENSION}"
        json_path = f"{base_path}.json"
        preview_path = f"{base_path}{PREVIEW_EXTENSION}"
        preview2_path = f"{base_path}.preview2.png"
        
        # Check which preview slots are available
        has_preview1 = os.path.exists(preview_path)
        has_preview2 = os.path.exists(preview2_path)
        
        # Count how many we still need to download
        slots_needed = 0
        if not has_preview1:
            slots_needed += 1
        if not has_preview2:
            slots_needed += 1
        
        # In force mode, always try to fill empty slots even if some are filled
        if not force_additional and slots_needed == 0:
            print(f"All preview slots filled: {preview_path}")
            return True
        
        # In normal mode, skip if no slots needed
        if not force_additional and has_preview1 and slots_needed == 0:
            print(f"Preview exists (use force mode to add more): {preview_path}")
            return True
        
        # --- Try to get image URLs from multiple sources ---
        images = []
        
        # Source 1: JSON file preview_image fields (preferred)
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                
                # Check for preview_image fields in web_civitai_data
                wcd = json_data.get('web_civitai_data', {})
                img1 = wcd.get('preview_image_1', '')
                img2 = wcd.get('preview_image_2', '')
                # Fallback to old flat format
                if not img1:
                    img1 = json_data.get('preview_image_1', '')
                if not img2:
                    img2 = json_data.get('preview_image_2', '')
                if img1:
                    img_type = 'video' if '.mp4' in img1.lower() or '.webm' in img1.lower() else 'image'
                    images.append({'url': img1, 'type': img_type, 'nsfwLevel': 1})
                if img2:
                    img_type = 'video' if '.mp4' in img2.lower() or '.webm' in img2.lower() else 'image'
                    images.append({'url': img2, 'type': img_type, 'nsfwLevel': 1})
                
                # Fallback: check z_info_file.images
                if not images:
                    z_info = json_data.get('z_info_file', {})
                    if 'images' in z_info:
                        images = z_info['images']
            except Exception as e:
                print(f"Error reading JSON for preview URLs: {e}")
        
        # Source 2: Legacy .civitai.info file (backward compat)
        if not images and os.path.exists(info_path):
            try:
                with open(info_path, 'r', encoding='utf-8') as f:
                    model_info = json.load(f)
                images = model_info.get('images', [])
            except Exception as e:
                print(f"Error reading info file for preview URLs: {e}")
        
        if not images:
            print(f"No preview image URLs found")
            return False
        
        # Track if we found any video to try as fallback
        video_to_try = None
        
        # Collect suitable images
        images_to_skip = 0
        if has_preview1:
            images_to_skip += 1
        if has_preview2:
            images_to_skip += 1
        
        suitable_images = []
        skipped_count = 0
        
        for img in images:
            # Handle both dict format (from z_info_file/info) and simple URL string
            if isinstance(img, dict):
                # Skip if NSFW and skip_nsfw is True
                if skip_nsfw and img.get('nsfw') and img.get('nsfw') != 'None':
                    print(f"Skipping NSFW item")
                    continue
                
                img_type = img.get('type', 'image')
                img_url = img.get('url')
            else:
                # Simple URL string from preview_image fields
                img_type = 'image'
                img_url = img
            
            if not img_url:
                continue
            
            # Collect image URLs
            if img_type == 'image':
                # Skip images for already-filled slots
                if skipped_count < images_to_skip:
                    skipped_count += 1
                    continue
                
                # Use max size if requested
                if max_size and isinstance(img, dict) and img.get('width'):
                    img_url = get_full_size_image_url(img_url, img['width'])
                suitable_images.append(img_url)
                
                # Stop after collecting enough images for empty slots
                if len(suitable_images) >= slots_needed:
                    break
            
            # Save first video URL for fallback
            elif img_type == 'video' and video_to_try is None:
                video_to_try = img_url
        
        # Download collected images to empty slots
        if suitable_images:
            downloaded_count = 0
            image_index = 0
            
            # Download to first slot if empty
            if not has_preview1 and image_index < len(suitable_images):
                try:
                    response = requests.get(suitable_images[image_index], headers=DEFAULT_HEADERS, timeout=30)
                    if response.ok:
                        with open(preview_path, 'wb') as f:
                            f.write(response.content)
                        print(f"Downloaded preview: {preview_path}")
                        downloaded_count += 1
                        image_index += 1
                    else:
                        print(f"Failed to download first image: {response.status_code}")
                except Exception as e:
                    print(f"Error downloading first image: {e}")
            
            # Download to second slot if empty
            if not has_preview2 and image_index < len(suitable_images):
                try:
                    response = requests.get(suitable_images[image_index], headers=DEFAULT_HEADERS, timeout=30)
                    if response.ok:
                        with open(preview2_path, 'wb') as f:
                            f.write(response.content)
                        print(f"Downloaded preview2: {preview2_path}")
                        downloaded_count += 1
                    else:
                        print(f"Failed to download second image: {response.status_code}")
                except Exception as e:
                    print(f"Error downloading second image: {e}")
            
            if downloaded_count > 0:
                return True
        
        # If no image found but we have a video, try to extract frames
        if video_to_try:
            print(f"No suitable image found, trying to extract frames from video...")
            
            if not check_ffmpeg_available():
                print("FFmpeg not available - cannot extract video frames")
                print("Install FFmpeg to enable video thumbnail extraction")
                return False
            
            # Download video to temp file
            try:
                response = requests.get(video_to_try, headers=DEFAULT_HEADERS, timeout=60, stream=True)
                if not response.ok:
                    print(f"Failed to download video: {response.status_code}")
                    return False
                
                # Create temp file with video extension
                with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_video:
                    for chunk in response.iter_content(chunk_size=8192):
                        tmp_video.write(chunk)
                    tmp_video_path = tmp_video.name
                
                # Extract frames
                success, message = extract_video_frames(tmp_video_path, base_path)
                
                # Cleanup temp video
                try:
                    os.unlink(tmp_video_path)
                except:
                    pass
                
                if success:
                    print(f"Video frame extraction: {message}")
                    return True
                else:
                    print(f"Video frame extraction failed: {message}")
                    return False
                    
            except Exception as e:
                print(f"Error processing video: {e}")
                return False
                
        print(f"No suitable preview image or video found")
        return False
        
    except Exception as e:
        print(f"Error downloading preview: {e}")
        return False


def scan_models_directory(directory):
    """
    Scan directory for model files and check for civitai info
    
    Args:
        directory: Path to scan
        
    Returns:
        List of dicts with model info: {path, name, has_info, has_preview, has_json, has_hash}
    """
    models = []
    
    try:
        for root, dirs, files in os.walk(directory):
            for filename in files:
                # Check if file is a model
                if any(filename.lower().endswith(ext) for ext in MODEL_EXTENSIONS):
                    file_path = os.path.join(root, filename)
                    base_path = os.path.splitext(file_path)[0]
                    json_path = f"{base_path}.json"
                    
                    # Check if hash exists in JSON and if model has civitai data
                    json_data = load_json_robust(json_path)
                    has_hash = False
                    has_civitai_data = False
                    
                    if json_data:
                        has_hash = bool(json_data.get('sha256'))
                        # Model has civitai data if it has z_info_file, web_civitai_data, or civitai_matched marker
                        has_civitai_data = bool(
                            json_data.get('z_info_file') or 
                            json_data.get('web_civitai_data', {}).get('model_id') or
                            json_data.get('model_id') or  # legacy flat format
                            json_data.get('civitai_matched') is not None
                        )
                    
                    model_data = {
                        'path': file_path,
                        'name': filename,
                        'has_info': has_civitai_data or os.path.exists(f"{base_path}{INFO_EXTENSION}"),
                        'has_preview': os.path.exists(f"{base_path}{PREVIEW_EXTENSION}"),
                        'has_json': os.path.exists(json_path),
                        'has_hash': has_hash
                    }
                    models.append(model_data)
    except Exception as e:
        print(f"Error scanning directory: {e}")
    
    return models


def get_model_id_from_url(url_or_id):
    """
    Extract model ID from Civitai URL or return ID if already numeric
    
    Args:
        url_or_id: Civitai URL or model ID
        
    Returns:
        Model ID as string, or empty string on error
    """
    if not url_or_id:
        return ""
    
    # Check if already numeric
    if str(url_or_id).isnumeric():
        return str(url_or_id)
    
    # Try to extract from URL
    # Remove query parameters and split by /
    parts = re.sub(r'\?.+$', '', url_or_id).split('/')
    
    if len(parts) < 2:
        return ""
    
    # Check last two parts for numeric ID
    if parts[-2].isnumeric():
        return parts[-2]
    elif parts[-1].isnumeric():
        return parts[-1]
    
    return ""


def fix_thumbnail_name(model_path):
    """
    Rename adjacent image files to .preview.png format
    
    Args:
        model_path: Path to the model file
        
    Returns:
        tuple: (status, message) where status is 'success', 'skipped', or 'error'
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        model_dir = os.path.dirname(model_path)
        model_basename = os.path.basename(base_path)
        target_preview = f"{base_path}{PREVIEW_EXTENSION}"
        
        # If .preview.png already exists, skip
        if os.path.exists(target_preview):
            return ('skipped', 'Already has .preview.png')
        
        # Look for image files with the same base name
        image_extensions = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG']
        
        for ext in image_extensions:
            potential_image = f"{base_path}{ext}"
            if os.path.exists(potential_image):
                # Found an image file, rename it
                os.rename(potential_image, target_preview)
                return ('success', f'Renamed {model_basename}{ext} to {model_basename}.preview.png')
        
        # No image file found
        return ('skipped', 'No image file found')
        
    except Exception as e:
        print(f"Error fixing thumbnail name: {e}")
        return ('error', str(e))

