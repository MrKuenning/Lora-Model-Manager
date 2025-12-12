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
from pathlib import Path

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


def save_civitai_info(model_path, model_info):
    """
    Save model info as .civitai.info file
    
    Args:
        model_path: Path to the model file
        model_info: Model info dict from Civitai API
        
    Returns:
        True on success, False on error
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        info_path = f"{base_path}{INFO_EXTENSION}"
        
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump(model_info, f, indent=2)
        
        print(f"Saved model info to: {info_path}")
        return True
    except Exception as e:
        print(f"Error saving civitai info: {e}")
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


def download_preview_image(model_path, max_size=False, skip_nsfw=True):
    """
    Download preview image for a model from its .civitai.info file
    
    Args:
        model_path: Path to the model file
        max_size: Download full size image if True
        skip_nsfw: Skip NSFW images if True
        
    Returns:
        True on success, False on error or skip
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        info_path = f"{base_path}{INFO_EXTENSION}"
        preview_path = f"{base_path}{PREVIEW_EXTENSION}"
        
        # Check if preview already exists
        if os.path.exists(preview_path):
            print(f"Preview already exists: {preview_path}")
            return True
        
        # Load civitai info
        if not os.path.exists(info_path):
            print(f"No civitai info file found: {info_path}")
            return False
            
        with open(info_path, 'r', encoding='utf-8') as f:
            model_info = json.load(f)
        
        # Get images from model info
        images = model_info.get('images', [])
        if not images:
            print(f"No images found in civitai info")
            return False
        
        # Find first suitable image
        for img in images:
            # Skip if NSFW and skip_nsfw is True
            if skip_nsfw and img.get('nsfw') and img.get('nsfw') != 'None':
                print(f"Skipping NSFW image")
                continue
            
            # Skip if not an image type
            if img.get('type') != 'image':
                continue
            
            # Get image URL
            img_url = img.get('url')
            if not img_url:
                continue
            
            # Use max size if requested
            if max_size and img.get('width'):
                img_url = get_full_size_image_url(img_url, img['width'])
            
            # Download image
            response = requests.get(img_url, headers=DEFAULT_HEADERS, timeout=30)
            if response.ok:
                with open(preview_path, 'wb') as f:
                    f.write(response.content)
                print(f"Downloaded preview: {preview_path}")
                return True
            else:
                print(f"Failed to download image: {response.status_code}")
                
        print(f"No suitable preview image found")
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
        List of dicts with model info: {path, name, has_info, has_preview}
    """
    models = []
    
    try:
        for root, dirs, files in os.walk(directory):
            for filename in files:
                # Check if file is a model
                if any(filename.lower().endswith(ext) for ext in MODEL_EXTENSIONS):
                    file_path = os.path.join(root, filename)
                    base_path = os.path.splitext(file_path)[0]
                    
                    model_data = {
                        'path': file_path,
                        'name': filename,
                        'has_info': os.path.exists(f"{base_path}{INFO_EXTENSION}"),
                        'has_preview': os.path.exists(f"{base_path}{PREVIEW_EXTENSION}")
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

