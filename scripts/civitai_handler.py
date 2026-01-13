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


def create_dummy_info_file(model_path):
    """
    Create an empty .civitai.info file to mark model as already checked
    
    Args:
        model_path: Path to the model file
        
    Returns:
        True on success, False on error
    """
    try:
        base_path = os.path.splitext(model_path)[0]
        info_path = f"{base_path}{INFO_EXTENSION}"
        
        # Create empty JSON object
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump({}, f, indent=2)
        
        print(f"Created dummy info file: {info_path}")
        return True
    except Exception as e:
        print(f"Error creating dummy info file: {e}")
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
        
        # Extract first frame
        first_frame_cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', 'select=eq(n\\,0)',
            '-vframes', '1',
            '-q:v', '2',
            preview_path
        ]
        
        result = subprocess.run(
            first_frame_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30
        )
        
        if result.returncode != 0:
            return (False, f"FFmpeg error extracting first frame: {result.stderr.decode()[:200]}")
        
        # Extract last frame using reverse filter
        last_frame_cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', 'reverse',
            '-vframes', '1',
            '-q:v', '2',
            preview2_path
        ]
        
        result = subprocess.run(
            last_frame_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30
        )
        
        if result.returncode != 0:
            # First frame succeeded, just log warning for second
            print(f"Warning: Could not extract last frame: {result.stderr.decode()[:200]}")
            return (True, f"Extracted first frame (last frame failed)")
        
        return (True, f"Extracted first and last frames")
        
    except subprocess.TimeoutExpired:
        return (False, "FFmpeg timeout - video too long or complex")
    except Exception as e:
        return (False, f"Error extracting frames: {str(e)}")


def download_preview_image(model_path, max_size=False, skip_nsfw=True, force_additional=False):
    """
    Download preview image for a model from its .civitai.info file
    
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
        
        # Track if we found any video to try as fallback
        video_to_try = None
        
        # Collect suitable images
        # We need to skip images for slots that are already filled
        # If preview1 exists, skip 1 image. If both exist, skip 2.
        images_to_skip = 0
        if has_preview1:
            images_to_skip += 1
        if has_preview2:
            images_to_skip += 1
        
        suitable_images = []
        skipped_count = 0
        
        for img in images:
            # Skip if NSFW and skip_nsfw is True
            if skip_nsfw and img.get('nsfw') and img.get('nsfw') != 'None':
                print(f"Skipping NSFW item")
                continue
            
            img_type = img.get('type', 'image')
            img_url = img.get('url')
            
            if not img_url:
                continue
            
            # Collect image URLs
            if img_type == 'image':
                # Skip images for already-filled slots
                if skipped_count < images_to_skip:
                    skipped_count += 1
                    continue
                
                # Use max size if requested
                if max_size and img.get('width'):
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
        List of dicts with model info: {path, name, has_info, has_preview, has_json}
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
                        'has_preview': os.path.exists(f"{base_path}{PREVIEW_EXTENSION}"),
                        'has_json': os.path.exists(f"{base_path}.json")
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

