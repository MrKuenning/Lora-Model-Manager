import http.server
import socketserver
import json
import os
import urllib.parse
import shutil
import webbrowser
import time
import sys
from pathlib import Path
import hashlib

# Add scripts directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts'))
import civitai_handler

# Import the JSON converter module (has hyphens in name)
import importlib.util
spec = importlib.util.spec_from_file_location("json_converter", 
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts", "zCivitai-2-JSONv4.py"))
json_converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(json_converter)

PORT = 8080
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

def load_initial_settings():
    try:
        with open(CONFIG_FILE, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        # Create default config file if it doesn't exist
        default_settings = {
            "modelsDirectory": "",
            "theme": "dark",
            "defaultView": "grid",
            "defaultSort": "name-asc",
            "hideNSFW": False,
            "visibleColumns": {
                "thumbnail": True,
                "filename": True,
                "civitaiName": True,
                "baseModel": True,
                "category": True,
                "path": True,
                "size": True,
                "date": True,
                "url": True,
                "nsfw": True,
                "positiveWords": True,
                "negativeWords": True,
                "authorsWords": True,
                "description": True
            }
        }
        with open(CONFIG_FILE, 'w') as file:
            json.dump(default_settings, file, indent=2)
        return default_settings
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in {CONFIG_FILE}. Using default settings.")
        return {"modelsDirectory": ""}

# Load settings globally
settings = load_initial_settings()
lora_path = settings.get('modelsDirectory', '')
print(f"Loaded settings A: {settings}")
print("Lora path = " + lora_path)

# Module-level cache for model data (persists across HTTP requests)
# Each handler instance is created per-request, so we need module-level storage
_lora_data_cache = None
_checkpoints_data_cache = None


class LoraManagerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        web_app_directory = os.path.dirname(os.path.abspath(__file__))
        super().__init__(*args, directory=web_app_directory, **kwargs)
    
    def get_path_for_location(self, location_type):
        """Get the directory path for the given location type."""
        settings = self.load_settings()
        if location_type == 'checkpoints':
            return settings.get('checkpointsDirectory', '')
        else:
            return settings.get('modelsDirectory', '')
        
    def end_headers(self):
        # Add CORS headers to allow JavaScript modules to load properly
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        global lora_path, _lora_data_cache, _checkpoints_data_cache
        print("do_GET called")
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # Redirect root path to pages/index.html
        if parsed_url.path == '/':
            self.send_response(301)
            self.send_header('Location', '/pages/index.html')
            self.end_headers()
            return

        # Redirect old HTML file paths to new pages/ location
        if parsed_url.path == '/index.html':
            self.send_response(301)
            self.send_header('Location', '/pages/index.html')
            self.end_headers()
            return
        
        if parsed_url.path == '/civitai-scan.html':
            self.send_response(301)
            self.send_header('Location', '/pages/civitai-scan.html')
            self.end_headers()
            return

        # Check if the request is for a model file (like preview images) vs a web app file
        # Web app files should be served from the web app directory, model files from the models directory
        if parsed_url.path.startswith('/') and not parsed_url.path.startswith('/load-') and not parsed_url.path.startswith('/edit-') and parsed_url.path != '/' and not os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), parsed_url.path.lstrip('/'))):
            # Try to serve the file from either the loras or checkpoints directory
            settings = self.load_settings()
            directories_to_check = [
                settings.get('modelsDirectory', ''),
                settings.get('checkpointsDirectory', '')
            ]
            
            for models_dir in directories_to_check:
                if not models_dir:
                    continue
                    
                # URL decode the path to handle spaces and special characters
                decoded_path = urllib.parse.unquote(parsed_url.path.lstrip('/'))
                file_path = os.path.join(models_dir, decoded_path)
                
                if os.path.exists(file_path) and os.path.isfile(file_path):
                    print(f"Serving file from models directory: {file_path}")
                    self.send_response(200)
                    
                    # Set content type based on file extension
                    if file_path.endswith('.png'):
                        self.send_header('Content-type', 'image/png')
                    elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
                        self.send_header('Content-type', 'image/jpeg')
                    else:
                        self.send_header('Content-type', 'application/octet-stream')
                    
                    self.end_headers()
                    with open(file_path, 'rb') as file:
                        shutil.copyfileobj(file, self.wfile)
                    return

        # Load models based on location parameter
        if parsed_url.path == '/load-loras':
            # Get location from query params (defaults to 'loras')
            location = query_params.get('location', ['loras'])[0]
            models_path = self.get_path_for_location(location)
            
            print(f"Loading models for location '{location}': {models_path}")
            
            if not models_path:
                self.send_error(400, f"Directory not set for location: {location}")
                return
            
            if not os.path.exists(models_path):
                self.send_error(400, f"Directory does not exist: {models_path}")
                return

            # Check if we need to refresh the cache
            refresh = query_params.get('refresh', ['false'])[0].lower() == 'true'
            
            # Use appropriate cache based on location
            if location == 'checkpoints':
                if _checkpoints_data_cache is None or refresh:
                    print("Building checkpoints data cache...")
                    _checkpoints_data_cache = self.get_lora_data(models_path)
                    print(f"Checkpoints cache built with {len(_checkpoints_data_cache)} items")
                else:
                    print(f"Using cached checkpoints data with {len(_checkpoints_data_cache)} items")
                data_cache = _checkpoints_data_cache
            else:
                if _lora_data_cache is None or refresh:
                    print("Building lora data cache...")
                    _lora_data_cache = self.get_lora_data(models_path)
                    print(f"Lora cache built with {len(_lora_data_cache)} items")
                else:
                    print(f"Using cached lora data with {len(_lora_data_cache)} items")
                data_cache = _lora_data_cache

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data_cache).encode())
            
        elif parsed_url.path == '/load-single-model':
            # Load a single model's data
            model_name = query_params.get('modelName', [''])[0]
            location = query_params.get('location', ['loras'])[0]
            
            if not model_name:
                self.send_error(400, "Missing 'modelName' parameter")
                return
                
            models_path = self.get_path_for_location(location)
            if not models_path or not os.path.exists(models_path):
                self.send_error(400, f"Directory not set or does not exist for location: {location}")
                return
                
            model_file_path = self.find_file_path(models_path, model_name + ".safetensors")
            if not model_file_path:
                self.send_error(404, f"Model file not found: {model_name}.safetensors")
                return
                
            root = os.path.dirname(model_file_path)
            file = os.path.basename(model_file_path)
            lora_path = models_path
            
            preview_path = os.path.join(root, f"{model_name}.preview.png")
            json_path = os.path.join(root, f"{model_name}.json")
            civitai_path = os.path.join(root, f"{model_name}.civitai.info")
            
            relative_preview_path = os.path.relpath(preview_path, lora_path).replace("\\", "/")
            preview_images = []
            if os.path.exists(preview_path):
                preview_images.append("/" + relative_preview_path)
            for i in range(2, 5):
                extra_preview_path = os.path.join(root, f"{model_name}.preview{i}.png")
                if os.path.exists(extra_preview_path):
                    relative_extra_preview = os.path.relpath(extra_preview_path, lora_path).replace("\\", "/")
                    preview_images.append("/" + relative_extra_preview)
            
            main_preview_url = preview_images[0] if preview_images else "/assets/placeholder.png"
            base_model = "Unknown"
            
            if os.path.exists(json_path):
                try:
                    with open(json_path, "r", encoding='utf-8-sig') as json_file:
                        json_data = json.load(json_file)
                        if "baseModel" in json_data:
                            base_model = json_data["baseModel"]
                        elif "base model" in json_data:
                            base_model = json_data["base model"]
                except Exception as e:
                    print(f"Error loading JSON for single model: {e}")
                    
            if base_model == "Unknown" and os.path.exists(civitai_path):
                try:
                    with open(civitai_path, "r", encoding='utf-8-sig') as civitai_file:
                        civitai_data = json.load(civitai_file)
                        if "baseModel" in civitai_data:
                            base_model = civitai_data["baseModel"]
                        elif "base model" in civitai_data:
                            base_model = civitai_data["base model"]
                except Exception as e:
                    print(f"Error loading Civitai info for single model: {e}")
                    
            associated_files = []
            for associated_file in os.listdir(root):
                if associated_file.startswith(model_name + "."):
                    associated_files.append(associated_file)
                    
            model_info = {
                "id": model_name,
                "name": model_name,
                "filename": file,
                "path": os.path.join(root, file),
                "previewUrl": main_preview_url,
                "previewImages": preview_images,
                "size": os.path.getsize(os.path.join(root, file)),
                "dateModified": os.path.getmtime(os.path.join(root, file)),
                "category": os.path.basename(root),
                "baseModel": base_model,
                "associatedFiles": associated_files
            }
            
            if os.path.exists(json_path):
                try:
                    with open(json_path, "r", encoding='utf-8-sig') as json_file:
                        json_data = json.load(json_file)
                        model_info["json"] = json_data
                        if "category" in json_data:
                            model_info["category"] = json_data["category"]
                except Exception as e:
                    print(f"Error loading JSON for model info: {e}")
                    model_info["json"] = {}
            else:
                model_info["json"] = {}
                
            if os.path.exists(civitai_path):
                try:
                    with open(civitai_path, "r", encoding='utf-8-sig') as civitai_file:
                        civitai_data = json.load(civitai_file)
                        model_info["civitaiInfo"] = civitai_data
                        if "url" in civitai_data:
                            model_info["civitaiInfo"]["modelUrl"] = civitai_data["url"]
                except Exception as e:
                    print(f"Error loading Civitai info for model info: {e}")
                    model_info["civitaiInfo"] = {}
            else:
                model_info["civitaiInfo"] = {}
                
            # Update cache if it exists
            target_cache = _checkpoints_data_cache if location == 'checkpoints' else _lora_data_cache
            if target_cache is not None:
                for i, m in enumerate(target_cache):
                    if m['name'] == model_name:
                        target_cache[i] = model_info
                        break
                else:
                    target_cache.append(model_info)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(model_info).encode())
        
        elif parsed_url.path == '/load-settings':
            settings = self.load_settings()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(settings).encode())
            
        elif parsed_url.path == '/get-folders':
            # Get list of all subdirectories in models directory
            # Get location from query params (defaults to 'loras')
            location = query_params.get('location', ['loras'])[0]
            loraPath = self.get_path_for_location(location)
            
            if not loraPath or not os.path.exists(loraPath):
                self.send_error(400, f"Directory not set or does not exist for location: {location}")
                return
            
            folders = []
            # Add root option
            folders.append({'path': '', 'name': 'Root'})
            
            # Walk through directory and collect all subdirectories
            for root, dirs, files in os.walk(loraPath):
                for dir_name in dirs:
                    full_path = os.path.join(root, dir_name)
                    # Get relative path from lora_path
                    relative_path = os.path.relpath(full_path, loraPath)
                    folders.append({
                        'path': relative_path.replace("\\", "/"),
                        'name': relative_path.replace("\\", "/")
                    })
            
            # Sort folders hierarchically so subfolders appear after parent folders
            # e.g., Animals, Animals/Cats, Trees, Trees/Green
            def hierarchical_sort_key(folder):
                if folder['path'] == '':
                    return ('', 0)  # Root always first
                parts = folder['path'].lower().split('/')
                return (parts, len(parts))
            
            folders.sort(key=lambda f: (
                0 if f['path'] == '' else 1,  # Root first
                tuple(f['path'].lower().split('/'))  # Then hierarchical sort
            ))
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'folders': folders}).encode())
            
        elif parsed_url.path == '/edit-json':
            name = query_params.get('name', [''])[0]
            if not name:
                self.send_error(400, "Missing 'name' parameter")
                return
            
            # Check both directories for the JSON file
            settings = self.load_settings()
            directories = [
                settings.get('modelsDirectory', ''),
                settings.get('checkpointsDirectory', '')
            ]
            
            file_path = None
            for directory in directories:
                if not directory:
                    continue
                file_path = self.find_file_path(directory, name + ".json")
                if file_path:
                    break
            
            if not file_path:
                self.send_error(404, "JSON File not found")
                return

            try:
                with open(file_path, 'r') as file:
                    json_data = json.load(file)
            except json.JSONDecodeError:
                self.send_error(500, "Invalid JSON format")
                return

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Edit JSON</title>
                <style>
                  body{{
                    font-family:monospace;
                  }}
                  textarea{{
                    width: 98%;
                    height: 80%;
                  }}
                </style>
            </head>
            <body>
              <textarea id='json-editor'>{json.dumps(json_data, indent=4)}</textarea>
              <br>
              <button onclick='saveJson()'>Save</button>
              <script>
              function saveJson(){{
                let jsonString = document.getElementById('json-editor').value;
                fetch('/save-json?name={name}', {{
                  method: 'POST',
                  headers: {{
                    'Content-Type': 'application/json'
                  }},
                  body: jsonString
                }}).then(response => {{
                  if(response.ok){{
                    alert("Saved")
                    window.close();
                  }}
                  else{{
                    alert("Error Saving")
                  }}
                }})
              }}
              </script>
            </body>
            </html>
            """

            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(html_content.encode())

        else:
          super().do_GET()

    def do_POST(self):
        global _lora_data_cache, _checkpoints_data_cache
        parsed_url = urllib.parse.urlparse(self.path)
        content_length = int(self.headers['Content-Length'])
        
        # For file uploads, don't read post_data - let cgi.FieldStorage handle it
        if parsed_url.path == '/upload-preview':
            # Skip reading post_data for multipart uploads
            post_data = None
        else:
            post_data = self.rfile.read(content_length)

        if parsed_url.path == '/save-settings':
            data = json.loads(post_data)
            
            # Load current settings to compare directories
            current_settings = self.load_settings()
            
            # Only invalidate cache if directory actually changed
            if 'modelsDirectory' in data:
                old_dir = current_settings.get('modelsDirectory', '')
                new_dir = data.get('modelsDirectory', '')
                if old_dir != new_dir:
                    _lora_data_cache = None
                    print(f"Lora cache invalidated: directory changed from '{old_dir}' to '{new_dir}'")
            
            if 'checkpointsDirectory' in data:
                old_dir = current_settings.get('checkpointsDirectory', '')
                new_dir = data.get('checkpointsDirectory', '')
                if old_dir != new_dir:
                    _checkpoints_data_cache = None
                    print(f"Checkpoints cache invalidated: directory changed from '{old_dir}' to '{new_dir}'")
            
            self.save_settings(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())

        elif parsed_url.path == '/save-json':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            name = query_params.get('name', [''])[0]
            if not name:
                self.send_error(400, "Missing 'name' parameter")
                return
            
            # Check both directories for the JSON file
            settings = self.load_settings()
            directories = [
                settings.get('modelsDirectory', ''),
                settings.get('checkpointsDirectory', '')
            ]
            
            file_path = None
            for directory in directories:
                if not directory:
                    continue
                file_path = self.find_file_path(directory, name + ".json")
                if file_path:
                    break
            
            if not file_path:
                self.send_error(404, "JSON File not found")
                return

            try:
                json_data = json.loads(post_data)
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON format")
                return

            try:
                with open(file_path, 'w') as file:
                    json.dump(json_data, file, indent=4)
                
                # Invalidate both caches after JSON edit
                _lora_data_cache = None
                _checkpoints_data_cache = None
                print("Caches invalidated due to JSON edit")
            except Exception as e:
                self.send_error(500, f"Error saving JSON: {e}")
                return

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())
            
        elif parsed_url.path == '/save-civitai':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            name = query_params.get('name', [''])[0]
            if not name:
                self.send_error(400, "Missing 'name' parameter")
                return
            
            # Check both directories for the civitai.info file
            settings = self.load_settings()
            directories = [
                settings.get('modelsDirectory', ''),
                settings.get('checkpointsDirectory', '')
            ]
            
            file_path = None
            for directory in directories:
                if not directory:
                    continue
                file_path = self.find_file_path(directory, name + ".civitai.info")
                if file_path:
                    break
            
            if not file_path:
                self.send_error(404, "Civitai Info File not found")
                return

            try:
                json_data = json.loads(post_data)
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON format")
                return

            try:
                with open(file_path, 'w') as file:
                    json.dump(json_data, file, indent=4)
            except Exception as e:
                self.send_error(500, f"Error saving Civitai Info: {e}")
                return

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())

        elif parsed_url.path == '/save-model':
            data = json.loads(post_data)
            model_name = data.get('name')
            if not model_name:
                self.send_error(400, "Missing 'name' parameter")
                return
            
            # Check both directories for the model
            settings = self.load_settings()
            directories = [
                settings.get('modelsDirectory', ''),
                settings.get('checkpointsDirectory', '')
            ]
            
            json_path = None
            model_path = None
            found_directory = None
            
            for directory in directories:
                if not directory:
                    continue
                # Try to find existing JSON
                json_path = self.find_file_path(directory, model_name + ".json")
                if json_path:
                    found_directory = directory
                    break
                # Try to find model file
                model_path = self.find_file_path(directory, model_name + ".safetensors")
                if model_path:
                    found_directory = directory
                    break
            
            # If JSON doesn't exist but model file does, create JSON in same directory
            if not json_path and model_path:
                json_path = os.path.splitext(model_path)[0] + ".json"
                print(f"Creating new JSON file at: {json_path}")
            
            if not json_path:
                self.send_error(404, "Model file not found in any configured directory")
                return
                
            try:
                # Get the json data from the request
                json_data = data.get('json', {})
                
                # If baseModel is provided at the top level, include it in the JSON data
                if 'baseModel' in data:
                    json_data['baseModel'] = data['baseModel']
                
                # Update the JSON file with the model's json data
                with open(json_path, 'w') as file:
                    json.dump(json_data, file, indent=4)
                    
                # Invalidate both caches after model edit
                _lora_data_cache = None
                _checkpoints_data_cache = None
                print("Caches invalidated due to model edit")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())
                return
            except Exception as e:
                self.send_error(500, f"Error saving model: {e}")
                return
                
        elif parsed_url.path == '/generate-sha256':
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                
                if not model_path:
                    self.send_error(400, "Missing 'modelPath' parameter")
                    return
                    
                if not os.path.exists(model_path):
                    self.send_error(404, f"Model file not found: {model_path}")
                    return
                
                # Calculate SHA256
                sha256_hash = hashlib.sha256()
                with open(model_path, "rb") as f:
                    for byte_block in iter(lambda: f.read(4096), b""):
                        sha256_hash.update(byte_block)
                hash_hex = sha256_hash.hexdigest()
                
                # Update JSON file
                root = os.path.dirname(model_path)
                model_name = os.path.splitext(os.path.basename(model_path))[0]
                json_path = os.path.join(root, f"{model_name}.json")
                
                json_data = {}
                if os.path.exists(json_path):
                    try:
                        with open(json_path, "r", encoding='utf-8-sig') as json_file:
                            json_data = json.load(json_file)
                    except Exception as e:
                        print(f"Error loading JSON for hash update: {e}")
                
                json_data['sha256'] = hash_hex
                
                with open(json_path, 'w', encoding='utf-8') as file:
                    json.dump(json_data, file, indent=4)
                
                # Invalidate cache
                _lora_data_cache = None
                _checkpoints_data_cache = None
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'hash': hash_hex,
                    'message': f'Generated SHA256: {hash_hex}'
                }).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
                
        elif parsed_url.path == '/rename-lora':
            data = json.loads(post_data)
            old_name = data.get('oldName')
            new_name = data.get('newName')
            if not old_name or not new_name:
                self.send_error(400, "Missing 'oldName' or 'newName' parameter")
                return
            
            # Check both directories for the model
            settings = self.load_settings()
            directories = [
                settings.get('modelsDirectory', ''),
                settings.get('checkpointsDirectory', '')
            ]
            
            # Find the model file in either directory
            found_directory = None
            old_model_path = None
            for directory in directories:
                if not directory:
                    continue
                old_model_path = self.find_file_path(directory, old_name + ".safetensors")
                if old_model_path:
                    found_directory = directory
                    break
            
            if not found_directory:
                self.send_error(404, "Model file not found in any configured directory")
                return
            
            # Find the original files with case-insensitive search in the found directory
            old_preview_path = self.find_file_path(found_directory, old_name + ".preview.png")
            old_json_path = self.find_file_path(found_directory, old_name + ".json")
            old_civitai_path = self.find_file_path(found_directory, old_name + ".civitai.info")
            
            # Find extra preview files (preview2, preview3, preview4)
            old_preview_paths = []
            if old_preview_path:
                old_preview_paths.append((old_preview_path, ".preview.png"))
            
            for i in range(2, 5):  # Check preview2, preview3, preview4
                extra_preview = self.find_file_path(found_directory, f"{old_name}.preview{i}.png")
                if extra_preview:
                    old_preview_paths.append((extra_preview, f".preview{i}.png"))
            
            # If files are found, preserve their original extension casing
            # but use lowercase for the new files to ensure consistency
            if old_model_path:
                _, ext = os.path.splitext(old_model_path)
                new_model_path = os.path.join(os.path.dirname(old_model_path), new_name + ".safetensors")
            
            if old_json_path:
                new_json_path = os.path.join(os.path.dirname(old_json_path), new_name + ".json")
            
            if old_civitai_path:
                new_civitai_path = os.path.join(os.path.dirname(old_civitai_path), new_name + ".civitai.info")

            try:
                # Only rename files that were found
                if old_model_path and os.path.exists(old_model_path):
                    os.rename(old_model_path, new_model_path)
                else:
                    print(f"Warning: Could not find model file to rename: {old_name}.safetensors")
                
                # Rename all preview files found
                for old_path, extension in old_preview_paths:
                    if os.path.exists(old_path):
                        new_preview_path = os.path.join(os.path.dirname(old_path), new_name + extension)
                        os.rename(old_path, new_preview_path)
                        print(f"Renamed preview: {old_path} -> {new_preview_path}")
                
                if not old_preview_paths:
                    print(f"Warning: Could not find any preview files to rename for: {old_name}")
                
                if old_json_path and os.path.exists(old_json_path):
                    os.rename(old_json_path, new_json_path)
                else:
                    print(f"Warning: Could not find JSON file to rename: {old_name}.json")
                
                if old_civitai_path and os.path.exists(old_civitai_path):
                    os.rename(old_civitai_path, new_civitai_path)

            except Exception as e:
                self.send_error(500, f"Error renaming Lora: {e}")
                return
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())
            
        elif parsed_url.path == '/move-model':
            # Move a model and all its associated files to a new folder
            data = json.loads(post_data)
            model_name = data.get('modelName')
            target_folder = data.get('targetFolder', '')  # Empty string means root
            
            if not model_name:
                self.send_error(400, "Missing 'modelName' parameter")
                return
            
            # Check both directories for the model
            settings = self.load_settings()
            directories = [
                settings.get('modelsDirectory', ''),
                settings.get('checkpointsDirectory', '')
            ]
            
            # Find which directory contains the model
            base_path = None
            model_file = None
            for directory in directories:
                if not directory:
                    continue
                model_file = self.find_file_path(directory, model_name + ".safetensors")
                if model_file:
                    base_path = directory
                    break
            
            if not model_file:
                self.send_error(404, "Model file not found in any configured directory")
                return
            
            # Get the current directory of the model
            current_dir = os.path.dirname(model_file)
            
            # Determine target directory (within the same base directory)
            if target_folder:
                target_dir = os.path.join(base_path, target_folder)
            else:
                target_dir = base_path
            
            # Create target directory if it doesn't exist
            if not os.path.exists(target_dir):
                try:
                    os.makedirs(target_dir)
                except Exception as e:
                    self.send_error(500, f"Failed to create target directory: {e}")
                    return
            
            # Find all associated files
            files_to_move = []
            extensions = [
                ".safetensors",
                ".json",
                ".civitai.info",
                ".preview.png",
                ".preview2.png",
                ".preview3.png",
                ".preview4.png"
            ]
            
            for ext in extensions:
                file_path = self.find_file_path(base_path, model_name + ext)
                if file_path and os.path.exists(file_path):
                    files_to_move.append(file_path)
            
            # Move all files
            try:
                for file_path in files_to_move:
                    filename = os.path.basename(file_path)
                    new_path = os.path.join(target_dir, filename)
                    
                    # Check if file already exists in target
                    if os.path.exists(new_path):
                        self.send_error(409, f"File already exists in target directory: {filename}")
                        return
                    
                    shutil.move(file_path, new_path)
                    print(f"Moved: {file_path} -> {new_path}")
                
                # Invalidate both caches after successful move
                _lora_data_cache = None
                _checkpoints_data_cache = None
                print("Caches invalidated due to model move")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': f'Moved {len(files_to_move)} file(s) successfully',
                    'filesMoved': len(files_to_move)
                }).encode())
                
            except Exception as e:
                self.send_error(500, f"Error moving files: {e}")
                return
            
        elif parsed_url.path == '/civitai/scan-models':
            # Scan models directory and return list with status
            try:
                # Get location from query params (defaults to 'loras')
                query_params = urllib.parse.parse_qs(parsed_url.query)
                location = query_params.get('location', ['loras'])[0]
                models_path = self.get_path_for_location(location)
                
                if not models_path:
                    self.send_error(400, f"Directory not set for location: {location}")
                    return
                
                models = civitai_handler.scan_models_directory(models_path)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'models': models}).encode())
            except Exception as e:
                self.send_error(500, f"Error scanning models: {e}")
                
        elif parsed_url.path == '/civitai/get-model-info':
            # Generate hash and fetch model info from Civitai
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                # Generate SHA256 hash
                print(f"Generating SHA256 for: {model_path}")
                file_hash = civitai_handler.generate_sha256(model_path)
                
                if not file_hash:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to generate SHA256 hash'
                    }).encode())
                    return
                
                # Fetch model info from Civitai
                print(f"Fetching model info for hash: {file_hash}")
                model_info = civitai_handler.fetch_model_info_by_hash(file_hash)
                
                if model_info is None:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to connect to Civitai API'
                    }).encode())
                    return
                
                if not model_info:
                    # Empty dict means model not found on Civitai
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'not_found',
                        'message': 'Model not found on Civitai'
                    }).encode())
                    return
                
                # Save directly as JSON (no longer creates .civitai.info)
                success = civitai_handler.save_civitai_info(model_path, model_info)
                
                # Also save the SHA256 hash to the model's JSON file
                civitai_handler.save_sha256_to_json(model_path, file_hash)
                
                if not success:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to save model JSON'
                    }).encode())
                    return
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': 'Model data saved to JSON successfully',
                    'modelInfo': model_info
                }).encode())
                
            except Exception as e:
                print(f"Error in get-model-info: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/get-model-info-by-url':
            # Fetch model info from Civitai using a manually provided URL
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                civitai_url = data.get('civitaiUrl')
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                    
                if not civitai_url:
                    self.send_error(400, "Missing civitaiUrl parameter")
                    return
                
                # Parse the URL to get model/version IDs
                print(f"Parsing Civitai URL: {civitai_url}")
                model_id, version_id = civitai_handler.parse_civitai_url(civitai_url)
                
                if not version_id and not model_id:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Could not parse model or version ID from URL. Please include modelVersionId parameter.'
                    }).encode())
                    return
                
                # Prefer version ID if available (gives exact version info)
                if version_id:
                    print(f"Fetching model version info for version ID: {version_id}")
                    model_info = civitai_handler.fetch_model_info_by_version_id(version_id)
                else:
                    # Fall back to model ID (gives latest version)
                    print(f"Fetching model info for model ID: {model_id}")
                    model_info = civitai_handler.fetch_model_info_by_id(model_id)
                    # Extract latest version from model info
                    if model_info and 'modelVersions' in model_info and model_info['modelVersions']:
                        model_info = model_info['modelVersions'][0]
                
                if model_info is None:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to connect to Civitai API'
                    }).encode())
                    return
                
                if not model_info:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'not_found',
                        'message': 'Model/version not found on Civitai'
                    }).encode())
                    return
                
                # Save directly as JSON (no longer creates .civitai.info)
                success = civitai_handler.save_civitai_info(model_path, model_info)
                
                if not success:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to save model JSON'
                    }).encode())
                    return
                
                # Invalidate caches
                _lora_data_cache = None
                _checkpoints_data_cache = None
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': 'Model data saved to JSON from URL',
                    'modelInfo': model_info
                }).encode())
                
            except Exception as e:
                print(f"Error in get-model-info-by-url: {e}")
                import traceback
                traceback.print_exc()
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/download-preview':
            # Download preview image for a model
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                max_size = data.get('maxSize', False)
                skip_nsfw = data.get('skipNsfw', True)
                force_additional = data.get('forceAdditional', False)
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                print(f"Downloading preview for: {model_path}")
                success = civitai_handler.download_preview_image(model_path, max_size, skip_nsfw, force_additional)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success' if success else 'skipped',
                    'message': 'Preview downloaded' if success else 'Preview skipped or already exists'
                }).encode())
                
            except Exception as e:
                print(f"Error in download-preview: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/convert-to-json':
            # Convert civitai.info to JSON format
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                use_api = data.get('useApi', True)
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                # Get civitai info path
                base_path = os.path.splitext(model_path)[0]
                info_path = f"{base_path}.civitai.info"
                
                if not os.path.exists(info_path):
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'No .civitai.info file found'
                    }).encode())
                    return
                
                # Check for existing JSON to preserve creator info
                json_path = f"{base_path}.json"
                existing_creator = ''
                if os.path.exists(json_path):
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            existing_json = json.load(f)
                            existing_creator = existing_json.get('creator', '')
                    except:
                        pass
                
                # Convert using the imported module
                print(f"Converting to JSON: {info_path}")
                
                # Track if API call will be made
                # API call only happens if: use_api is True AND existing_creator is empty
                api_call_made = use_api and not existing_creator
                
                mapped_data = json_converter.parse_civitai_info_file(info_path, use_api, existing_creator)
                
                # --- Add new fields from info file for the enhanced JSON format ---
                try:
                    with open(info_path, 'r', encoding='utf-8') as f:
                        info_data = json.load(f)
                    
                    # Initialize web_civitai_data sub-object
                    wcd = {
                        'civitai name': mapped_data.pop('civitai name', ''),
                        'civitai text': mapped_data.pop('civitai text', ''),
                        'creator': mapped_data.pop('creator', ''),
                        'downloadUrl': '',
                        'file_id': '',
                        'model_id': '',
                        'original_filename': '',
                        'preview_image_1': '',
                        'preview_image_2': '',
                        'published_date': '',
                        'url': mapped_data.pop('url', '')
                    }
                    
                    # New fields into web_civitai_data
                    if 'modelId' in info_data:
                        wcd['model_id'] = info_data['modelId']
                    if 'id' in info_data:
                        wcd['file_id'] = info_data['id']
                    if 'publishedAt' in info_data:
                        wcd['published_date'] = info_data['publishedAt']
                    if 'baseModelType' in info_data:
                        mapped_data['base_model_type'] = info_data['baseModelType']
                    if 'model' in info_data and 'type' in info_data['model']:
                        mapped_data['model_type'] = info_data['model']['type']
                    
                    # Files info (into web_civitai_data)
                    if 'files' in info_data and isinstance(info_data['files'], list) and info_data['files']:
                        first_file = info_data['files'][0]
                        if 'name' in first_file:
                            wcd['original_filename'] = first_file['name']
                        if 'downloadUrl' in first_file:
                            wcd['downloadUrl'] = first_file['downloadUrl']
                    if not wcd.get('downloadUrl') and 'downloadUrl' in info_data:
                        wcd['downloadUrl'] = info_data['downloadUrl']
                    
                    # Preview image URLs (into web_civitai_data)
                    if 'images' in info_data and isinstance(info_data['images'], list):
                        if len(info_data['images']) > 0 and 'url' in info_data['images'][0]:
                            wcd['preview_image_1'] = info_data['images'][0]['url']
                        if len(info_data['images']) > 1 and 'url' in info_data['images'][1]:
                            wcd['preview_image_2'] = info_data['images'][1]['url']
                        # Example prompt 2 from second image (stays at root)
                        if len(info_data['images']) > 1:
                            second_img = info_data['images'][1]
                            if 'meta' in second_img and isinstance(second_img['meta'], dict) and 'prompt' in second_img['meta']:
                                mapped_data['example prompt 2'] = second_img['meta']['prompt']
                    
                    # Build URL if not already set
                    if not wcd['url'] and wcd['model_id'] and wcd['file_id']:
                        wcd['url'] = f"https://civitai.com/models/{wcd['model_id']}?modelVersionId={wcd['file_id']}"
                    
                    mapped_data['web_civitai_data'] = wcd
                    
                except Exception as e:
                    print(f"Error adding new fields from info file: {e}")
                
                # Preserve existing data for certain fields (same logic as in zCivitai-2-JSONv4.py)
                if os.path.exists(json_path):
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            existing_data = json.load(f)
                            
                            print(f"DEBUG: Existing data loaded: {existing_data}")
                            
                            # Fields to preserve if already populated
                            fields_to_preserve = [
                                'activation text', 'sd version', 'preferred weight',
                                'negative text',
                                'nsfw', 'base model', 'example prompt 1',
                                'category', 'subcategory', 'tags',
                                'name', 'model version', 'high low',
                                'sha256'
                            ]
                            for field in fields_to_preserve:
                                if field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                                    print(f"DEBUG: Preserving field '{field}': '{existing_data[field]}'")
                                    mapped_data[field] = existing_data[field]
                                else:
                                    print(f"DEBUG: Not preserving field '{field}' (empty or missing)")
                            
                            # Preserve web_civitai_data sub-fields from old format
                            existing_wcd = existing_data.get('web_civitai_data', {})
                            for field in ['civitai text', 'url', 'creator']:
                                if field in existing_wcd and existing_wcd[field]:
                                    mapped_data['web_civitai_data'][field] = existing_wcd[field]
                                elif field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                                    mapped_data['web_civitai_data'][field] = existing_data[field]
                    except Exception as e:
                        print(f"Error reading existing JSON for field preservation: {e}")
                
                json_converter.write_json_file(info_path, mapped_data)
                
                # Invalidate cache
                _lora_data_cache = None
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': 'Converted to JSON successfully',
                    'apiCallMade': api_call_made
                }).encode())
                
            except Exception as e:
                print(f"Error in convert-to-json: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/fix-thumbnail':
            # Fix thumbnail name to .preview.png format
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                print(f"Fixing thumbnail for: {model_path}")
                status, message = civitai_handler.fix_thumbnail_name(model_path)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': status,
                    'message': message
                }).encode())
                
            except Exception as e:
                print(f"Error in fix-thumbnail: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/create-dummy-info':
            # Create an empty .civitai.info file for models not found on Civitai
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                print(f"Creating dummy info file for: {model_path}")
                success = civitai_handler.create_dummy_info_file(model_path)
                
                if success:
                    # Invalidate cache
                    _lora_data_cache = None
                    _checkpoints_data_cache = None
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'success',
                        'message': 'Dummy JSON marker created successfully'
                    }).encode())
                else:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to create dummy info file'
                    }).encode())
                
            except Exception as e:
                print(f"Error in create-dummy-info: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/generate-hash':
            # Generate SHA256 hash for a single model and save to JSON
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                skip_if_exists = data.get('skipIfExists', False)
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                # Check if hash already exists in JSON
                if skip_if_exists:
                    base_path = os.path.splitext(model_path)[0]
                    json_path = f"{base_path}.json"
                    if os.path.exists(json_path):
                        try:
                            with open(json_path, 'r', encoding='utf-8-sig') as f:
                                existing_data = json.load(f)
                                if existing_data.get('sha256'):
                                    self.send_response(200)
                                    self.send_header('Content-type', 'application/json')
                                    self.end_headers()
                                    self.wfile.write(json.dumps({
                                        'status': 'skipped',
                                        'message': 'Hash already exists',
                                        'sha256': existing_data['sha256']
                                    }).encode())
                                    return
                        except Exception as e:
                            print(f"Error checking existing hash in JSON: {e}")
                
                print(f"Generating SHA256 hash for: {model_path}")
                file_hash = civitai_handler.generate_sha256(model_path)
                
                if file_hash:
                    civitai_handler.save_sha256_to_json(model_path, file_hash)
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'success',
                        'message': 'Hash generated and saved',
                        'sha256': file_hash
                    }).encode())
                else:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to generate hash'
                    }).encode())
                    
            except Exception as e:
                print(f"Error in generate-hash: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/find-duplicates':
            # Find duplicate models by comparing SHA256 hashes
            try:
                # Get location from request body
                data = json.loads(post_data) if post_data else {}
                location = data.get('location', 'loras')
                models_path = self.get_path_for_location(location)
                
                if not models_path:
                    self.send_error(400, f"Directory not set for location: {location}")
                    return
                
                print(f"Finding duplicates in: {models_path}")
                result = civitai_handler.find_duplicate_models(models_path)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'duplicates': result['duplicates'],
                    'missingHash': result['missing_hash'],
                    'totalScanned': result['total_scanned'],
                    'duplicateGroupCount': len(result['duplicates']),
                    'duplicateFileCount': sum(len(group) for group in result['duplicates'])
                }).encode())
                
            except Exception as e:
                print(f"Error in find-duplicates: {e}")
                self.send_error(500, f"Error: {e}")
        
        elif parsed_url.path == '/delete-model':
            # Delete a model and all its associated files
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                
                print(f"Delete request for: {model_path}")
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                if not os.path.exists(model_path):
                    print(f"Model file not found: {model_path}")
                    self.send_error(404, f"Model file not found: {model_path}")
                    return
                
                # Get the base path for associated files
                base_path = os.path.splitext(model_path)[0]
                print(f"Base path for deletion: {base_path}")
                
                # List of associated file extensions to delete
                associated_extensions = [
                    '.safetensors',  # The model file itself
                    '.json',          # Metadata JSON
                    '.civitai.info',  # Civitai info file
                    '.preview.png',   # Preview image
                    '.preview2.png',  # Additional previews
                    '.preview3.png',
                    '.preview4.png',
                ]
                
                deleted_files = []
                failed_files = []
                
                for ext in associated_extensions:
                    file_path = base_path + ext
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            deleted_files.append(os.path.basename(file_path))
                            print(f"Deleted: {file_path}")
                        except Exception as e:
                            failed_files.append(os.path.basename(file_path))
                            print(f"Failed to delete {file_path}: {e}")
                
                # Invalidate cache
                _lora_data_cache = None
                _checkpoints_data_cache = None
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success' if not failed_files else 'partial',
                    'message': f"Deleted {len(deleted_files)} files",
                    'deletedFiles': deleted_files,
                    'failedFiles': failed_files
                }).encode())
                
            except Exception as e:
                print(f"Error in delete-model: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/upload-preview':
            # Upload a preview image for a model
            try:
                import cgi
                from io import BytesIO
                
                # Parse multipart form data using cgi module
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={
                        'REQUEST_METHOD': 'POST',
                        'CONTENT_TYPE': self.headers['Content-Type'],
                    }
                )
                
                # Get model name, image file, and location
                model_name = form.getvalue('modelName')
                image_file = form['imageFile']
                location = form.getvalue('location', 'loras')
                
                if not model_name or not image_file.file:
                    self.send_error(400, "Missing modelName or imageFile")
                    return
                
                # Read image data
                image_data = image_file.file.read()
                
                if not image_data:
                    self.send_error(400, "Empty image file")
                    return
                
                # Get the appropriate directory based on location
                base_path = self.get_path_for_location(location)
                if not base_path:
                    self.send_error(400, f"Directory not set for location: {location}")
                    return
                
                # Find the model file to get its directory
                model_file = self.find_file_path(base_path, model_name + ".safetensors")
                if not model_file:
                    self.send_error(404, f"Model not found in {location} directory")
                    return
                
                model_dir = os.path.dirname(model_file)
                
                # Determine next preview number
                preview_num = ""
                if os.path.exists(os.path.join(model_dir, f"{model_name}.preview.png")):
                    # preview.png exists, find next number
                    n = 2
                    while os.path.exists(os.path.join(model_dir, f"{model_name}.preview{n}.png")):
                        n += 1
                    preview_num = str(n)
                
                # Save the image file
                preview_filename = f"{model_name}.preview{preview_num}.png"
                preview_path = os.path.join(model_dir, preview_filename)
                
                with open(preview_path, 'wb') as f:
                    f.write(image_data)
                
                print(f"Saved preview image: {preview_path}")
                
                # Invalidate both caches
                _lora_data_cache = None
                _checkpoints_data_cache = None
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': f'Preview image saved as {preview_filename}',
                    'filename': preview_filename
                }).encode())
                
            except Exception as e:
                print(f"Error in upload-preview: {e}")
                import traceback
                traceback.print_exc()
                self.send_error(500, f"Error: {e}")

        elif parsed_url.path == '/delete-thumbnail':
            # Delete a specific thumbnail and renumber remaining ones
            try:
                data = json.loads(post_data)
                model_name = data.get('modelName')
                thumbnail_index = data.get('thumbnailIndex')  # 1-based index (1, 2, 3, 4)
                location = data.get('location', 'loras')
                
                if not model_name or thumbnail_index is None:
                    self.send_error(400, "Missing modelName or thumbnailIndex")
                    return
                
                # Get the appropriate directory based on location
                base_path = self.get_path_for_location(location)
                if not base_path:
                    self.send_error(400, f"Directory not set for location: {location}")
                    return
                
                # Determine the filename for the thumbnail to delete
                if thumbnail_index == 1:
                    thumb_filename = f"{model_name}.preview.png"
                else:
                    thumb_filename = f"{model_name}.preview{thumbnail_index}.png"
                
                # Find and delete the file
                thumb_path = self.find_file_path(base_path, thumb_filename)
                if not thumb_path or not os.path.exists(thumb_path):
                    self.send_error(404, f"Thumbnail not found: {thumb_filename}")
                    return
                
                # Delete the thumbnail
                os.remove(thumb_path)
                print(f"Deleted thumbnail: {thumb_path}")
                
                # Renumber remaining thumbnails to fill the gap
                base_dir = os.path.dirname(thumb_path)
                
                # Find all remaining thumbnails
                remaining_thumbs = []
                for i in range(1, 5):
                    if i == thumbnail_index:
                        continue  # Skip the one we just deleted
                    
                    if i == 1:
                        check_file = f"{model_name}.preview.png"
                    else:
                        check_file = f"{model_name}.preview{i}.png"
                    
                    check_path = os.path.join(base_dir, check_file)
                    if os.path.exists(check_path):
                        remaining_thumbs.append((i, check_path))
                
                # Renumber files using temp names first to avoid conflicts
                temp_renames = []
                for idx, (original_idx, file_path) in enumerate(remaining_thumbs, 1):
                    # Rename to temp name
                    temp_name = f"{model_name}.preview_temp_{idx}.png"
                    temp_path = os.path.join(base_dir, temp_name)
                    os.rename(file_path, temp_path)
                    temp_renames.append((temp_path, idx))
                    print(f"Temp rename: {file_path} -> {temp_path}")
                
                # Rename from temp names to final names
                for temp_path, final_idx in temp_renames:
                    if final_idx == 1:
                        final_name = f"{model_name}.preview.png"
                    else:
                        final_name = f"{model_name}.preview{final_idx}.png"
                    
                    final_path = os.path.join(base_dir, final_name)
                    os.rename(temp_path, final_path)
                    print(f"Final rename: {temp_path} -> {final_path}")
                
                # Invalidate both caches
                _lora_data_cache = None
                _checkpoints_data_cache = None
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': 'Thumbnail deleted and remaining thumbnails renumbered'
                }).encode())
                
            except Exception as e:
                print(f"Error in delete-thumbnail: {e}")
                import traceback
                traceback.print_exc()
                self.send_error(500, f"Error: {e}")

        elif parsed_url.path == '/reorder-thumbnails':
            # Reorder thumbnails (primarily for setting a new default)
            try:
                data = json.loads(post_data)
                model_name = data.get('modelName')
                new_order = data.get('newOrder')  # e.g., [2, 1, 3, 4] means preview2 becomes preview
                location = data.get('location', 'loras')
                
                if not model_name or not new_order:
                    self.send_error(400, "Missing modelName or newOrder")
                    return
                
                # Get the appropriate directory based on location
                base_path = self.get_path_for_location(location)
                if not base_path:
                    self.send_error(400, f"Directory not set for location: {location}")
                    return
                
                # Find the model file to get the directory
                model_file = self.find_file_path(base_path, f"{model_name}.safetensors")
                if not model_file:
                    self.send_error(404, f"Model file not found in {location} directory")
                    return
                
                base_dir = os.path.dirname(model_file)
                
                # Step 1: Collect existing files and rename to temp names
                existing_files = []
                for orig_idx in new_order:
                    if orig_idx == 1:
                        filename = f"{model_name}.preview.png"
                    else:
                        filename = f"{model_name}.preview{orig_idx}.png"
                    
                    file_path = os.path.join(base_dir, filename)
                    if os.path.exists(file_path):
                        temp_name = f"{model_name}.preview_temp_{orig_idx}.png"
                        temp_path = os.path.join(base_dir, temp_name)
                        os.rename(file_path, temp_path)
                        existing_files.append((orig_idx, temp_path))
                        print(f"Temp rename: {file_path} -> {temp_path}")
                
                # Step 2: Rename temp files to final positions
                for new_idx, (orig_idx, temp_path) in enumerate(existing_files, 1):
                    if new_idx == 1:
                        final_name = f"{model_name}.preview.png"
                    else:
                        final_name = f"{model_name}.preview{new_idx}.png"
                    
                    final_path = os.path.join(base_dir, final_name)
                    os.rename(temp_path, final_path)
                    print(f"Final rename: {temp_path} -> {final_path}")
                
                # Invalidate both caches
                _lora_data_cache = None
                _checkpoints_data_cache = None
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': 'Thumbnails reordered successfully'
                }).encode())
                
            except Exception as e:
                print(f"Error in reorder-thumbnails: {e}")
                import traceback
                traceback.print_exc()
                self.send_error(500, f"Error: {e}")


        else:
            self.send_error(404, "Not found")
            return


    def refresh_lora_data_cache(self, lora_path):
        """Refresh the cached model data."""
        global _lora_data_cache
        _lora_data_cache = self.get_lora_data(lora_path)

    def get_lora_data(self, lora_path):
        lora_data = []
        if not lora_path:
            self.send_error(400, "No models directory set. Please configure the models directory in Settings.")
            return []
        if not os.path.exists(lora_path) or not os.path.isdir(lora_path):
            self.send_error(400, f"Invalid models directory: {lora_path}")
            return []
        for root, dirs, files in os.walk(lora_path):
            for file in files:
                if file.endswith(".safetensors"):
                    model_name = file.replace(".safetensors", "")
                    preview_path = os.path.join(root, f"{model_name}.preview.png")
                    json_path = os.path.join(root, f"{model_name}.json")
                    civitai_path = os.path.join(root, f"{model_name}.civitai.info")
                    
                    relative_preview_path = os.path.relpath(preview_path, lora_path).replace("\\", "/")
                    
                    # Detect multiple preview images (preview.png, preview2.png, preview3.png, preview4.png)
                    preview_images = []
                    if os.path.exists(preview_path):
                        preview_images.append("/" + relative_preview_path)
                    
                    # Check for additional preview images
                    for i in range(2, 5):  # Check preview2, preview3, preview4
                        extra_preview_path = os.path.join(root, f"{model_name}.preview{i}.png")
                        if os.path.exists(extra_preview_path):
                            relative_extra_preview = os.path.relpath(extra_preview_path, lora_path).replace("\\", "/")
                            preview_images.append("/" + relative_extra_preview)
                    
                    # Determine the main preview URL (first available or placeholder)
                    main_preview_url = preview_images[0] if preview_images else "/assets/placeholder.png"
                    
                    # Initialize base model as unknown
                    base_model = "Unknown"
                    
                    # Try to get base model from JSON file if it exists
                    if os.path.exists(json_path):
                        try:
                            with open(json_path, "r") as json_file:
                                json_data = json.load(json_file)
                                # Check for both 'baseModel' and 'base model' in the JSON file
                                if "baseModel" in json_data:
                                    base_model = json_data["baseModel"]
                                elif "base model" in json_data:
                                    base_model = json_data["base model"]
                        except Exception as e:
                            print(f"Error reading base model from JSON: {json_path} - {e}")
                    
                    # If not found in JSON, try civitai.info
                    if base_model == "Unknown" and os.path.exists(civitai_path):
                        try:
                            with open(civitai_path, "r") as civitai_file:
                                civitai_data = json.load(civitai_file)
                                # Check for both 'baseModel' and 'base model' in the civitai.info file
                                if "baseModel" in civitai_data:
                                    base_model = civitai_data["baseModel"]
                                elif "base model" in civitai_data:
                                    base_model = civitai_data["base model"]
                        except Exception as e:
                            print(f"Error reading base model from civitai.info: {civitai_path} - {e}")
                    
                    # Find all associated files with the same base name
                    associated_files = []
                    for associated_file in files:
                        if associated_file.startswith(model_name + "."):
                            associated_files.append(associated_file)
                    
                    model_info = {
                        "id": model_name,
                        "name": model_name,
                        "filename": file,
                        "path": os.path.join(root, file),
                        "previewUrl": main_preview_url,
                        "previewImages": preview_images,  # New field for multiple previews
                        "size": os.path.getsize(os.path.join(root, file)),
                        "dateModified": os.path.getmtime(os.path.join(root, file)),
                        "category": os.path.basename(root),  # Default to folder name, will be overridden by JSON if available
                        "baseModel": base_model,
                        "associatedFiles": associated_files
                    }
                    
                    print(f"Preview URL: {model_info['previewUrl']}")

                    if os.path.exists(json_path):
                        try:
                            with open(json_path, "r") as json_file:
                                json_data = json.load(json_file)
                                model_info["json"] = json_data
                                
                                # Use category from JSON if it exists
                                if "category" in json_data:
                                    model_info["category"] = json_data["category"]
                        except Exception as e:
                            print(f"Error reading JSON: {json_path} - {e}")
                            model_info["json"] = {}
                    else:
                        model_info["json"] = {}
                    if os.path.exists(civitai_path):
                        try:
                            with open(civitai_path, "r") as civitai_file:
                                civitai_data = json.load(civitai_file)
                                model_info["civitaiInfo"] = civitai_data
                                
                                # Extract URL from civitai.info and add it as modelUrl
                                if "url" in civitai_data:
                                    model_info["civitaiInfo"]["modelUrl"] = civitai_data["url"]
                        except Exception as e:
                            print(f"Error reading civitaiInfo: {civitai_path} - {e}")
                            model_info["civitaiInfo"] = {}
                    else:
                        model_info["civitaiInfo"] = {}
                    
                    lora_data.append(model_info)
        return lora_data

    def load_settings(self):
        try:
            with open(CONFIG_FILE, 'r') as file:
                settings = json.load(file)
                print(f"Loaded settings B: {settings}")  # Debug print
                return settings
        except FileNotFoundError:
            # Create default config file if it doesn't exist
            default_settings = {"modelsDirectory": ""}
            self.save_settings(default_settings)
            return default_settings
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON format in {CONFIG_FILE}. Using default settings.")
            return {"modelsDirectory": ""}

    def save_settings(self, data):
        try:
            with open(CONFIG_FILE, 'w') as file:
                json.dump(data, file, indent=2)
        except Exception as e:
            print(f"Error saving settings to {CONFIG_FILE}: {e}")

    def find_file_path(self, directory, filename):
        # Make the search case-insensitive for file extensions
        filename_lower = filename.lower()
        filename_base, filename_ext = os.path.splitext(filename)
        
        for root, dirs, files in os.walk(directory):
            # First try exact match
            if filename in files:
                return os.path.join(root, filename)
            
            # Then try case-insensitive match
            for file in files:
                if file.lower() == filename_lower:
                    return os.path.join(root, file)
                
                # Special handling for known extensions like .preview.png
                if '.preview.' in filename_lower:
                    file_base, file_ext = os.path.splitext(file)
                    if file_base.lower() == filename_base.lower() and file_ext.lower() == filename_ext.lower():
                        return os.path.join(root, file)
        return None


with socketserver.TCPServer(("", PORT), LoraManagerHandler) as httpd:
    print(f"Serving at port: {PORT}")
    # webbrowser.open(f"http://localhost:{PORT}")
    httpd.serve_forever()
