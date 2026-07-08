import os
import hashlib
import json
import requests
import re
import subprocess
import tempfile
import time
from html import unescape
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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
print("fetch missing Civitai data, create JSON files directly,")
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
    """No longer creates .civitai.info — now creates JSON directly."""
    return create_json_from_api_data(model_path, model_info)

def create_json_from_api_data(model_path, api_data):
    """Create a comprehensive JSON file directly from Civitai API data."""
    try:
        base_path = os.path.splitext(model_path)[0]
        json_path = f"{base_path}.json"
        
        # Build the mapped data structure
        data = {
            'activation text': '', 'base model': '', 'category': '',
            'description': '', 'example prompt 1': '', 'example prompt 2': '',
            'high low': '', 'model version': '', 'name': '', 'negative text': '',
            'notes': '', 'nsfw': '', 'preferred weight': 0,
            'sd version': '', 'subcategory': '', 'tags': '',
            'model_type': '', 'base_model_type': '',
            'web_civitai_data': {
                'civitai name': '', 'civitai text': '',
                'creator': '', 'downloadUrl': '',
                'file_id': '', 'model_id': '', 'original_filename': '',
                'preview_image_1': '', 'preview_image_2': '',
                'published_date': '', 'url': ''
            }
        }
        
        wcd = data['web_civitai_data']
        
        # Extract fields from API data
        if 'trainedWords' in api_data and api_data['trainedWords']:
            data['activation text'] = api_data['trainedWords'][0]
            wcd['civitai text'] = ', '.join(api_data['trainedWords'])
        
        if 'baseModel' in api_data:
            data['base model'] = api_data['baseModel']
            
            # Map sd version based on baseModel if sd version doesn't exist yet
            if not data.get('sd version'):
                data['sd version'] = map_sd_version(api_data['baseModel'])
        
        if 'model' in api_data:
            if 'name' in api_data['model']:
                wcd['civitai name'] = api_data['model']['name']
                data['name'] = api_data['model']['name']
            if 'nsfw' in api_data['model']:
                data['nsfw'] = str(api_data['model']['nsfw']).lower()
            if 'type' in api_data['model']:
                data['model_type'] = api_data['model']['type']
        
        # Description
        description = api_data.get('description', '')
        if description:
            description = ' '.join(strip_html_tags(unescape(description)).split())
        
        # Example prompts from images
        if 'images' in api_data and api_data['images']:
            first_img = api_data['images'][0]
            meta = first_img.get('meta', {})
            if isinstance(meta, dict):
                data['example prompt 1'] = meta.get('prompt', '')
                data['negative text'] = meta.get('negativePrompt', '')
            
            # Preview image URLs
            if 'url' in first_img:
                wcd['preview_image_1'] = first_img['url']
            
            if len(api_data['images']) > 1:
                second_img = api_data['images'][1]
                if 'url' in second_img:
                    wcd['preview_image_2'] = second_img['url']
                meta2 = second_img.get('meta', {})
                if isinstance(meta2, dict) and 'prompt' in meta2:
                    data['example prompt 2'] = meta2['prompt']
        
        # New fields
        if 'modelId' in api_data:
            wcd['model_id'] = api_data['modelId']
        if 'id' in api_data:
            wcd['file_id'] = api_data['id']
        if 'publishedAt' in api_data:
            wcd['published_date'] = api_data['publishedAt']
        if 'baseModelType' in api_data:
            data['base_model_type'] = api_data['baseModelType']
        
        # Files info
        if 'files' in api_data and isinstance(api_data['files'], list) and api_data['files']:
            first_file = api_data['files'][0]
            if 'name' in first_file:
                wcd['original_filename'] = first_file['name']
            if 'downloadUrl' in first_file:
                wcd['downloadUrl'] = first_file['downloadUrl']
        if not wcd.get('downloadUrl') and 'downloadUrl' in api_data:
            wcd['downloadUrl'] = api_data['downloadUrl']
        
        # URL and notes
        if wcd['model_id'] and wcd['file_id']:
            wcd['url'] = f"https://civitai.com/models/{wcd['model_id']}?modelVersionId={wcd['file_id']}"
            notes = [f"URL: {wcd['url']}"]
            if 'baseModel' in api_data: notes.append(f"Base Model: {api_data['baseModel']}")
            if 'trainedWords' in api_data: notes.append(f"Activation: {', '.join(api_data['trainedWords'])}")
            if description: notes.append(f"Description: {description}")
            data['notes'] = '\n'.join(notes)
        
        # Creator
        try:
            if wcd['model_id']:
                resp = requests.get(f"https://civitai.com/api/v1/models/{wcd['model_id']}", timeout=10)
                if resp.status_code == 200:
                    wcd['creator'] = resp.json().get('creator', {}).get('username', 'Unknown')
        except:
            wcd['creator'] = 'Unknown'
        
        # Read existing JSON to preserve user-edited fields
        existing_data = {}
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                preserve = ['activation text', 'sd version', 'preferred weight', 'negative text',
                           'nsfw', 'base model', 'example prompt 1',
                           'category', 'subcategory', 'tags', 'name', 'model version',
                           'high low', 'sha256']
                for field in preserve:
                    if field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                        data[field] = existing_data[field]
                # Preserve web_civitai_data sub-fields from old format
                existing_wcd = existing_data.get('web_civitai_data', {})
                for field in ['civitai text', 'url', 'creator']:
                    if field in existing_wcd and existing_wcd[field]:
                        wcd[field] = existing_wcd[field]
                    elif field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                        wcd[field] = existing_data[field]
            except: pass
        
        sorted_data = {k: data[k] for k in sorted(data.keys())}
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_data, f, indent=4)
        return True
    except Exception as e:
        print(f"  {Colors.FAIL}[Error]{Colors.ENDC} Creating JSON: {e}")
        return False

def create_dummy_json(model_path):
    """Create a minimal JSON marker file for models not found on Civitai."""
    try:
        base_path = os.path.splitext(model_path)[0]
        json_path = f"{base_path}.json"
        
        existing = {}
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
            except json.JSONDecodeError:
                pass # File exists but is invalid, will be overwritten or merged
        
        existing['civitai_matched'] = False
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=4)
        return True
    except Exception as e:
        print(f"  {Colors.FAIL}[Error]{Colors.ENDC} Creating dummy JSON: {e}")
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
        json_path = f"{base_path}.json"
        preview_path = f"{base_path}{PREVIEW_EXTENSION}"
        preview2_path = f"{base_path}.preview2.png"
        
        has_preview1 = os.path.exists(preview_path)
        has_preview2 = os.path.exists(preview2_path)
        
        slots_needed = 0
        if not has_preview1: slots_needed += 1
        if not has_preview2: slots_needed += 1
        
        if slots_needed == 0:
            return True, "Already exists"
            
        if not os.path.exists(json_path):
            return False, "No JSON file"
            
        with open(json_path, 'r', encoding='utf-8') as f:
            model_data = json.load(f)
            
        raw_urls = []
        wcd = model_data.get('web_civitai_data', {})
        if wcd.get('preview_image_1'):
            raw_urls.append(wcd['preview_image_1'])
        if wcd.get('preview_image_2'):
            raw_urls.append(wcd['preview_image_2'])
        # Fallback to old flat format
        if not raw_urls:
            if model_data.get('preview_image_1'):
                raw_urls.append(model_data['preview_image_1'])
            if model_data.get('preview_image_2'):
                raw_urls.append(model_data['preview_image_2'])
        
        preview_urls = []
        video_to_try = None
        for u in raw_urls:
            if '.mp4' in u.lower() or '.webm' in u.lower():
                if not video_to_try: video_to_try = u
            else:
                preview_urls.append(u)

        # Fallback to z_info_file images if direct preview_image_1/2 are not set
        if len(preview_urls) < 2 and 'z_info_file' in model_data:
            z_images = model_data['z_info_file'].get('images', [])
            for img in z_images:
                if img.get('url'):
                    if img.get('type') == 'video':
                        if not video_to_try: video_to_try = img['url']
                    elif img.get('type', 'image') == 'image':
                        if not (img.get('nsfw') and img.get('nsfw') != 'None'):
                            if img['url'] not in preview_urls:
                                preview_urls.append(img['url'])
                            if len(preview_urls) >= 2:
                                break
        
        downloaded = 0
        image_index = 0
        
        if not has_preview1 and image_index < len(preview_urls):
            response = requests.get(preview_urls[image_index], headers=DEFAULT_HEADERS, timeout=30)
            if response.ok:
                with open(preview_path, 'wb') as f:
                    f.write(response.content)
                downloaded += 1
            image_index += 1
                
        if not has_preview2 and image_index < len(preview_urls):
            response = requests.get(preview_urls[image_index], headers=DEFAULT_HEADERS, timeout=30)
            if response.ok:
                with open(preview2_path, 'wb') as f:
                    f.write(response.content)
                downloaded += 1
        
        if downloaded > 0:
            return True, f"Downloaded {downloaded} preview(s)"
                
        if video_to_try and slots_needed > 0: # Only try video if we still need previews
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
        'description': '', 'example prompt 1': '', 'high low': '',
        'model version': '', 'name': '', 'negative text': '',
        'notes': '', 'nsfw': '', 'preferred weight': 0,
        'sd version': '', 'subcategory': '', 'tags': '', 'url': ''
    }
    
    if 'trainedWords' in info and info['trainedWords']:
        data['activation text'] = info['trainedWords'][0]
        data['civitai text'] = ', '.join(info['trainedWords'])
        
    if 'baseModel' in info:
        data['base model'] = info['baseModel']
        if not data.get('sd version'):
            data['sd version'] = map_sd_version(info['baseModel'])
        
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
            data['example prompt 1'] = meta.get('prompt', '')
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
                       'civitai text', 'nsfw', 'url', 'base model', 'example prompt 1', 
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

# Track which models we pulled fresh data for
newly_processed_models = set()

# --- STEP 1: Civitai Data → JSON ---
print(f"{Colors.HEADER}--- STEP 1: Fetching missing Civitai Data & Creating JSON ---{Colors.ENDC}")
for i, path in enumerate(models):
    base_path = os.path.splitext(path)[0]
    json_path = f"{base_path}.json"
    name = os.path.basename(path)
    
    # Skip if JSON already has Civitai data
    has_civitai_data = False
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            # Check for markers of existing Civitai data
            if existing.get('z_info_file') or existing.get('web_civitai_data', {}).get('model_id') or existing.get('model_id') or existing.get('civitai_matched') is not None:
                has_civitai_data = True
        except: pass
    
    # Also check for legacy .civitai.info files
    info_path = f"{base_path}{INFO_EXTENSION}"
    if has_civitai_data or os.path.exists(info_path):
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
            print(f"  -> {Colors.WARNING}[Skip]{Colors.ENDC} Not found on Civitai. Creating dummy JSON marker.")
            create_dummy_json(path)
        else:
            # Create JSON directly from API data
            success = create_json_from_api_data(path, info)
            if success:
                # Save hash to the JSON
                try:
                    with open(json_path, 'r', encoding='utf-8') as jf:
                        json_data = json.load(jf)
                    json_data['sha256'] = file_hash
                    with open(json_path, 'w', encoding='utf-8') as jf:
                        json.dump(json_data, jf, indent=4)
                except: pass
                
                newly_processed_models.add(path)
                print(f"  -> {Colors.OKGREEN}[OK]{Colors.ENDC} JSON created with Civitai data.")
            else:
                print(f"  -> {Colors.FAIL}[Error]{Colors.ENDC} Failed to create JSON.")
        time.sleep(0.5) # Rate limit protection

# --- STEP 2: Thumbnails ---
print(f"\n{Colors.HEADER}--- STEP 2: Downloading missing Thumbnails ---{Colors.ENDC}")
for i, path in enumerate(models):
    name = os.path.basename(path)
    base_path = os.path.splitext(path)[0]
    preview_path = f"{base_path}{PREVIEW_EXTENSION}"
    preview2_path = f"{base_path}.preview2.png"
    json_path = f"{base_path}.json"
    info_path = f"{base_path}{INFO_EXTENSION}"
    
    has_preview1 = os.path.exists(preview_path)
    has_preview2 = os.path.exists(preview2_path)
    
    # Needs both to be skipped
    if has_preview1 and has_preview2:
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
