import os
import hashlib
import json
import requests
import re
import subprocess
import tempfile
import time
from html import unescape

# Enable ANSI colors on Windows
if os.name == 'nt':
    os.system('color')

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

print(f"{Colors.OKCYAN}====================================================={Colors.ENDC}")
print(f"{Colors.BOLD}         Civitai All-In-One Standalone Scan          {Colors.ENDC}")
print(f"{Colors.OKCYAN}====================================================={Colors.ENDC}")
print("This script will scan the current directory for models,")
print("fetch missing Civitai data, generate/update JSON files,")
print("and download any missing preview thumbnails (up to 2).")
print(f"{Colors.OKCYAN}=====================================================\n{Colors.ENDC}")

# --- Configuration & Constants ---
MODEL_EXTENSIONS = ['.safetensors', '.ckpt', '.pt', '.pth']
INFO_EXTENSION = '.civitai.info'
PREVIEW_EXTENSION = '.preview.png'

CIVITAI_API_URLS = {
    "hash": "https://civitai.com/api/v1/model-versions/by-hash/",
    "model_id": "https://civitai.com/api/v1/models/",
    "model_version_id": "https://civitai.com/api/v1/model-versions/"
}

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

# --- Helper Functions (From civitai_handler.py) ---

def generate_sha256(file_path, chunk_size=8192):
    try:
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except Exception as e:
        print(f"  {Colors.FAIL}[Error]{Colors.ENDC} Generating SHA256 for {os.path.basename(file_path)}: {e}")
        return None

def fetch_model_info_by_hash(file_hash):
    try:
        url = f"{CIVITAI_API_URLS['hash']}{file_hash}"
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=30)
        if response.status_code == 404:
            return {}
        elif not response.ok:
            print(f"  {Colors.FAIL}[APIErr]{Colors.ENDC} HTTP {response.status_code}: {response.text}")
            return None
        return response.json()
    except Exception as e:
        print(f"  {Colors.FAIL}[Error]{Colors.ENDC} Fetching model info from API: {e}")
        return None

def save_civitai_info(model_path, model_info):
    try:
        base_path = os.path.splitext(model_path)[0]
        info_path = f"{base_path}{INFO_EXTENSION}"
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump(model_info, f, indent=2)
        return True
    except Exception as e:
        print(f"  {Colors.FAIL}[Error]{Colors.ENDC} Saving {INFO_EXTENSION}: {e}")
        return False

def check_ffmpeg_available():
    try:
        result = subprocess.run(['ffmpeg', '-version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
        return result.returncode == 0
    except:
        return False

def extract_video_frames(video_path, output_base_path):
    if not check_ffmpeg_available():
        return False
    try:
        preview_path = f"{output_base_path}{PREVIEW_EXTENSION}"
        preview2_path = f"{output_base_path}.preview2.png"
        
        # Extract first frame
        cmd1 = ['ffmpeg', '-y', '-i', video_path, '-vf', 'select=eq(n\\,0)', '-vframes', '1', '-q:v', '2', preview_path]
        result1 = subprocess.run(cmd1, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        
        # Extract last frame
        cmd2 = ['ffmpeg', '-y', '-i', video_path, '-vf', 'reverse', '-vframes', '1', '-q:v', '2', preview2_path]
        result2 = subprocess.run(cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        
        return result1.returncode == 0
    except:
        return False

def download_preview_image(model_path):
    try:
        base_path = os.path.splitext(model_path)[0]
        info_path = f"{base_path}{INFO_EXTENSION}"
        preview_path = f"{base_path}{PREVIEW_EXTENSION}"
        preview2_path = f"{base_path}.preview2.png"
        
        has_preview1 = os.path.exists(preview_path)
        has_preview2 = os.path.exists(preview2_path)
        
        slots_needed = 0
        if not has_preview1: slots_needed += 1
        if not has_preview2: slots_needed += 1
        
        if slots_needed == 0:
            return True, "Already exists"
            
        if not os.path.exists(info_path):
            return False, "No info file"
            
        with open(info_path, 'r', encoding='utf-8') as f:
            model_info = json.load(f)
            
        images = model_info.get('images', [])
        if not images:
            return False, "No images in info"
            
        video_to_try = None
        suitable_images = []
        
        images_to_skip = 0
        if has_preview1: images_to_skip += 1
        if has_preview2: images_to_skip += 1
        
        skipped_count = 0
        for img in images:
            if img.get('nsfw') and img.get('nsfw') != 'None':
                continue # Skip NSFW
            
            img_type = img.get('type', 'image')
            img_url = img.get('url')
            
            if img_type == 'image' and img_url:
                if skipped_count < images_to_skip:
                    skipped_count += 1
                    continue
                suitable_images.append(img_url)
                if len(suitable_images) >= slots_needed:
                    break
            elif img_type == 'video' and img_url and video_to_try is None:
                video_to_try = img_url
                
        downloaded = 0
        image_index = 0
        if not has_preview1 and image_index < len(suitable_images):
            response = requests.get(suitable_images[image_index], headers=DEFAULT_HEADERS, timeout=30)
            if response.ok:
                with open(preview_path, 'wb') as f:
                    f.write(response.content)
                downloaded += 1
                image_index += 1
                
        if not has_preview2 and image_index < len(suitable_images):
            response = requests.get(suitable_images[image_index], headers=DEFAULT_HEADERS, timeout=30)
            if response.ok:
                with open(preview2_path, 'wb') as f:
                    f.write(response.content)
                downloaded += 1
        
        if downloaded > 0:
            return True, f"Downloaded {downloaded} preview(s)"
                
        if video_to_try:
            if not check_ffmpeg_available():
                return False, "Is video, but FFmpeg not installed"
            response = requests.get(video_to_try, headers=DEFAULT_HEADERS, timeout=60, stream=True)
            if response.ok:
                with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_video:
                    for chunk in response.iter_content(chunk_size=8192):
                        tmp_video.write(chunk)
                    tmp_video_path = tmp_video.name
                success = extract_video_frames(tmp_video_path, base_path)
                try: os.unlink(tmp_video_path)
                except: pass
                if success:
                    return True, "Extracted from video"
                    
        return False, "No suitable preview found"
    except Exception as e:
        return False, f"Error: {e}"

# --- Helper Functions (From json_converter.py) ---

def strip_html_tags(text):
    clean = re.compile('<.*?>')
    return re.sub(clean, ' ', text)

def parse_civitai_info_to_json(model_path, existing_creator='', use_api=True):
    base_path = os.path.splitext(model_path)[0]
    info_path = f"{base_path}{INFO_EXTENSION}"
    json_path = f"{base_path}.json"
    
    with open(info_path, 'r', encoding='utf-8') as f:
        info = json.load(f)
        
    data = {
        'activation text': '', 'base model': '', 'category': '',
        'civitai name': '', 'civitai text': '', 'creator': '',
        'description': '', 'example prompt': '', 'high low': '',
        'model version': '', 'name': '', 'negative text': '',
        'notes': '', 'nsfw': '', 'preferred weight': 0,
        'sd version': '', 'subcategory': '', 'tags': '', 'url': ''
    }
    
    if 'trainedWords' in info and info['trainedWords']:
        data['activation text'] = info['trainedWords'][0]
        data['civitai text'] = ', '.join(info['trainedWords'])
        
    if 'baseModel' in info:
        data['base model'] = info['baseModel']
        data['sd version'] = 'SD1' if info['baseModel'].startswith('SD 1') else 'SD2'
        
    if 'model' in info:
        if 'name' in info['model']:
            data['civitai name'] = info['model']['name']
            data['name'] = info['model']['name']
        if 'nsfw' in info['model']:
            data['nsfw'] = str(info['model']['nsfw']).lower()
            
    description = info.get('description', '')
    if description:
        description = ' '.join(strip_html_tags(unescape(description)).split())
        
    if 'images' in info and info['images']:
        meta = info['images'][0].get('meta', {})
        if isinstance(meta, dict):
            data['example prompt'] = meta.get('prompt', '')
            data['negative text'] = meta.get('negativePrompt', '')
            
    if 'modelId' in info and 'id' in info:
        data['url'] = f"https://civitai.com/models/{info['modelId']}?modelVersionId={info['id']}"
        notes = [f"URL: {data['url']}"]
        if 'baseModel' in info: notes.append(f"Base Model: {info['baseModel']}")
        if 'trainedWords' in info: notes.append(f"Activation: {', '.join(info['trainedWords'])}")
        if description: notes.append(f"Description: {description}")
        data['notes'] = '\n'.join(notes)
        
        if existing_creator:
            data['creator'] = existing_creator
        elif use_api:
            try:
                resp = requests.get(f"https://civitai.com/api/v1/models/{info['modelId']}", timeout=10)
                if resp.status_code == 200:
                    data['creator'] = resp.json().get('creator', {}).get('username', 'Unknown')
            except:
                data['creator'] = 'Unknown'

    # Read existing JSON to preserve fields
    existing_data = {}
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                
            preserve = ['activation text', 'sd version', 'preferred weight', 'negative text', 
                       'civitai text', 'nsfw', 'url', 'base model', 'example prompt', 
                       'category', 'subcategory', 'tags', 'creator', 'name', 'model version', 
                       'high low', 'sha256']
            for field in preserve:
                if field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                    data[field] = existing_data[field]
        except: pass
        
    sorted_data = {k: data[k] for k in sorted(data.keys())}
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(sorted_data, f, indent=4)
    return True

# --- Main Script Logic ---

target_dir = input(f"{Colors.BOLD}Enter directory to scan (leave blank for current folder): {Colors.ENDC}").strip()
if not target_dir:
    target_dir = os.getcwd()

if not os.path.exists(target_dir):
    print(f"{Colors.FAIL}Directory does not exist!{Colors.ENDC}")
    exit(1)

models = []
print(f"\nScanning directory: {Colors.OKCYAN}{target_dir}{Colors.ENDC}")
for root, _, files in os.walk(target_dir):
    for f in files:
        if any(f.lower().endswith(ext) for ext in MODEL_EXTENSIONS):
            models.append(os.path.join(root, f))

print(f"Found {Colors.OKGREEN}{len(models)}{Colors.ENDC} model(s).\n")

# Track which models we pulled fresh `.civitai.info` data for
newly_processed_models = set()

# --- STEP 1: Civitai Info ---
print(f"{Colors.HEADER}--- STEP 1: Fetching missing Civitai Data ---{Colors.ENDC}")
for i, path in enumerate(models):
    base_path = os.path.splitext(path)[0]
    info_path = f"{base_path}{INFO_EXTENSION}"
    name = os.path.basename(path)
    
    if os.path.exists(info_path):
        continue
        
    print(f"[{i+1}/{len(models)}] {Colors.OKBLUE}{name}{Colors.ENDC}")
    print("  -> Generating Hash...")
    file_hash = generate_sha256(path)
    
    if file_hash:
        print("  -> Fetching from API...")
        info = fetch_model_info_by_hash(file_hash)
        if info is None:
            print(f"  -> {Colors.FAIL}[Error]{Colors.ENDC} API failure, skipping.")
        elif not info:
            print(f"  -> {Colors.WARNING}[Skip]{Colors.ENDC} Not found on Civitai. Creating empty info file to skip in future.")
            save_civitai_info(path, {})
        else:
            save_civitai_info(path, info)
            newly_processed_models.add(path)
            
            # Save hash to JSON if possible
            json_path = f"{base_path}.json"
            existing = {}
            if os.path.exists(json_path):
                try:
                    with open(json_path, 'r', encoding='utf-8') as jf:
                        existing = json.load(jf)
                except: pass
            existing['sha256'] = file_hash
            try:
                with open(json_path, 'w', encoding='utf-8') as jf:
                    json.dump(existing, jf, indent=4)
            except: pass
            
            print(f"  -> {Colors.OKGREEN}[OK]{Colors.ENDC} Saved Civitai info.")
        time.sleep(0.5) # Rate limit protection

# --- STEP 2: JSON Files ---
print(f"\n{Colors.HEADER}--- STEP 2: Generating missing/updating new JSON files ---{Colors.ENDC}")
for i, path in enumerate(models):
    base_path = os.path.splitext(path)[0]
    info_path = f"{base_path}{INFO_EXTENSION}"
    json_path = f"{base_path}.json"
    name = os.path.basename(path)
    
    if not os.path.exists(info_path):
        continue # Needs info to generate JSON
        
    with open(info_path, 'r', encoding='utf-8') as f:
        try: info = json.load(f)
        except: info = {}
        
    if not info: # Empty info file = dummy file for missing models
        continue
        
    # We generate JSON if it's completely missing OR if we just pulled fresh civitai info
    if not os.path.exists(json_path) or path in newly_processed_models:
        print(f"[{i+1}/{len(models)}] {Colors.OKCYAN}Generating/Updating JSON{Colors.ENDC} for {name}")
        parse_civitai_info_to_json(path)

# --- STEP 3: Thumbnails ---
print(f"\n{Colors.HEADER}--- STEP 3: Downloading missing Thumbnails ---{Colors.ENDC}")
for i, path in enumerate(models):
    name = os.path.basename(path)
    base_path = os.path.splitext(path)[0]
    preview_path = f"{base_path}{PREVIEW_EXTENSION}"
    preview2_path = f"{base_path}.preview2.png"
    info_path = f"{base_path}{INFO_EXTENSION}"
    
    has_preview1 = os.path.exists(preview_path)
    has_preview2 = os.path.exists(preview2_path)
    
    # Needs both to be skipped
    if has_preview1 and has_preview2:
        continue
        
    if not os.path.exists(info_path):
        continue # Can't download without info
        
    with open(info_path, 'r', encoding='utf-8') as f:
        try: info = json.load(f)
        except: info = {}
        
    if not info:
        continue
        
    print(f"[{i+1}/{len(models)}] {Colors.OKBLUE}Fetching thumbnails{Colors.ENDC} for {name}")
    success, msg = download_preview_image(path)
    if success:
        print(f"  -> {Colors.OKGREEN}[OK]{Colors.ENDC} {msg}")
    else:
        print(f"  -> {Colors.WARNING}[Skip]{Colors.ENDC} {msg}")

print(f"\n{Colors.OKCYAN}====================================================={Colors.ENDC}")
print(f"{Colors.BOLD} All-In-One Scan Complete! {Colors.ENDC}")
print(f"{Colors.OKCYAN}====================================================={Colors.ENDC}")
input("Press Enter to exit...")
