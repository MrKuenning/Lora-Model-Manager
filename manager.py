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


class LoraManagerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        web_app_directory = os.path.dirname(os.path.abspath(__file__))
        self.lora_data_cache = None  # Initialize cache variable before calling super()
        super().__init__(*args, directory=web_app_directory, **kwargs)
        
    def end_headers(self):
        # Add CORS headers to allow JavaScript modules to load properly
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        print("do_GET called")
        global lora_path
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
            # Try to serve the file from the models directory
            if lora_path:
                # URL decode the path to handle spaces and special characters
                decoded_path = urllib.parse.unquote(parsed_url.path.lstrip('/'))
                file_path = os.path.join(lora_path, decoded_path)
                
                #print(f"Looking for file in models directory: {file_path}")
                
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

        # Use global lora_path
        if parsed_url.path == '/load-loras':
            print("Lora path = " + lora_path)
            if not lora_path:
                self.send_error(400, "Missing 'path' parameter")
                return
            print("loading path: " + lora_path)  # Debug print

            # Check if we need to refresh the cache
            refresh = query_params.get('refresh', ['false'])[0].lower() == 'true'
            
            # Use cached data if available and no refresh requested
            if self.lora_data_cache is None or refresh:
                print("Building lora data cache...")
                self.lora_data_cache = self.get_lora_data(lora_path)
                print(f"Cache built with {len(self.lora_data_cache)} items")
            else:
                print(f"Using cached data with {len(self.lora_data_cache)} items")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(self.lora_data_cache).encode())
        
        elif parsed_url.path == '/load-settings':
            settings = self.load_settings()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(settings).encode())
            
        elif parsed_url.path == '/get-folders':
            # Get list of all subdirectories in models directory
            loraPath = self.load_settings().get('modelsDirectory', "")
            if not loraPath or not os.path.exists(loraPath):
                self.send_error(400, "Models directory not set or does not exist")
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
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'folders': folders}).encode())
            
        elif parsed_url.path == '/edit-json':
            name = query_params.get('name', [''])[0]
            if not name:
                self.send_error(400, "Missing 'name' parameter")
                return
            file_path = self.find_file_path(self.load_settings().get('modelsDirectory', ""), name + ".json")
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
            self.save_settings(data)
            # Invalidate cache if models directory changed
            if 'modelsDirectory' in data and self.lora_data_cache is not None:
                self.lora_data_cache = None
                print("Cache invalidated due to settings change")
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
            
            loraPath = self.load_settings().get('modelsDirectory', "")
            file_path = self.find_file_path(loraPath, name + ".json")
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
                
                # Invalidate cache after JSON edit
                self.lora_data_cache = None
                print("Cache invalidated due to JSON edit")
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
            
            loraPath = self.load_settings().get('modelsDirectory', "")
            file_path = self.find_file_path(loraPath, name + ".civitai.info")
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
                
            loraPath = self.load_settings().get('modelsDirectory', "")
            json_path = self.find_file_path(loraPath, model_name + ".json")
            if not json_path:
                self.send_error(404, "JSON File not found")
                return
                
            try:
                # Update the JSON file with the model's json data
                with open(json_path, 'w') as file:
                    json.dump(data.get('json', {}), file, indent=4)
                    
                # Invalidate cache after model edit
                self.lora_data_cache = None
                print("Cache invalidated due to model edit")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())
                return
            except Exception as e:
                self.send_error(500, f"Error saving model: {e}")
                return
                
        elif parsed_url.path == '/rename-lora':
            data = json.loads(post_data)
            old_name = data.get('oldName')
            new_name = data.get('newName')
            if not old_name or not new_name:
                self.send_error(400, "Missing 'oldName' or 'newName' parameter")
                return
            
            loraPath = self.load_settings().get('modelsDirectory', "")
            
            
            
            # Find the original files with case-insensitive search
            old_model_path = self.find_file_path(loraPath, old_name + ".safetensors")
            old_preview_path = self.find_file_path(loraPath, old_name + ".preview.png")
            old_json_path = self.find_file_path(loraPath, old_name + ".json")
            old_civitai_path = self.find_file_path(loraPath, old_name + ".civitai.info")
            
            # Find extra preview files (preview2, preview3, preview4)
            old_preview_paths = []
            if old_preview_path:
                old_preview_paths.append((old_preview_path, ".preview.png"))
            
            for i in range(2, 5):  # Check preview2, preview3, preview4
                extra_preview = self.find_file_path(loraPath, f"{old_name}.preview{i}.png")
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
            
            loraPath = self.load_settings().get('modelsDirectory', "")
            if not loraPath:
                self.send_error(400, "Models directory not set")
                return
            
            # Find all associated files for this model
            model_file = self.find_file_path(loraPath, model_name + ".safetensors")
            if not model_file:
                self.send_error(404, "Model file not found")
                return
            
            # Get the current directory of the model
            current_dir = os.path.dirname(model_file)
            
            # Determine target directory
            if target_folder:
                target_dir = os.path.join(loraPath, target_folder)
            else:
                target_dir = loraPath
            
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
                file_path = self.find_file_path(loraPath, model_name + ext)
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
                
                # Invalidate cache after successful move
                self.lora_data_cache = None
                print("Cache invalidated due to model move")
                
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
                loraPath = self.load_settings().get('modelsDirectory', "")
                if not loraPath:
                    self.send_error(400, "Models directory not set")
                    return
                
                models = civitai_handler.scan_models_directory(loraPath)
                
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
                
                # Save civitai info file
                success = civitai_handler.save_civitai_info(model_path, model_info)
                
                if not success:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'error',
                        'message': 'Failed to save civitai info file'
                    }).encode())
                    return
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': 'Model info saved successfully',
                    'modelInfo': model_info
                }).encode())
                
            except Exception as e:
                print(f"Error in get-model-info: {e}")
                self.send_error(500, f"Error: {e}")
                
        elif parsed_url.path == '/civitai/download-preview':
            # Download preview image for a model
            try:
                data = json.loads(post_data)
                model_path = data.get('modelPath')
                max_size = data.get('maxSize', False)
                skip_nsfw = data.get('skipNsfw', True)
                
                if not model_path:
                    self.send_error(400, "Missing modelPath parameter")
                    return
                
                print(f"Downloading preview for: {model_path}")
                success = civitai_handler.download_preview_image(model_path, max_size, skip_nsfw)
                
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
                
                # Preserve existing data for certain fields (same logic as in zCivitai-2-JSONv4.py)
                if os.path.exists(json_path):
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            existing_data = json.load(f)
                            
                            print(f"DEBUG: Existing data loaded: {existing_data}")
                            
                            # Fields to preserve if already populated
                            fields_to_preserve = [
                                'activation text', 'sd version', 'preferred weight',
                                'negative text', 'civitai text', 
                                'nsfw', 'url', 'base model', 'example prompt',
                                'category', 'subcategory', 'tags', 'creator'
                            ]
                            for field in fields_to_preserve:
                                # If field exists in existing data and has a value, keep the existing value
                                # Otherwise, use the new value from civitai.info
                                # Check explicitly for None and empty string to handle 0 and other falsy values correctly
                                if field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                                    print(f"DEBUG: Preserving field '{field}': '{existing_data[field]}'")
                                    # Existing field has data, preserve it
                                    mapped_data[field] = existing_data[field]
                                else:
                                    print(f"DEBUG: Not preserving field '{field}' (empty or missing)")
                    except Exception as e:
                        print(f"Error reading existing JSON for field preservation: {e}")
                
                json_converter.write_json_file(info_path, mapped_data)
                
                # Invalidate cache
                self.lora_data_cache = None
                
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
                
                # Get model name and image file
                model_name = form.getvalue('modelName')
                image_file = form['imageFile']
                
                if not model_name or not image_file.file:
                    self.send_error(400, "Missing modelName or imageFile")
                    return
                
                # Read image data
                image_data = image_file.file.read()
                
                if not image_data:
                    self.send_error(400, "Empty image file")
                    return
                
                loraPath = self.load_settings().get('modelsDirectory', "")
                if not loraPath:
                    self.send_error(400, "Models directory not set")
                    return
                
                # Find the model file to get its directory
                model_file = self.find_file_path(loraPath, model_name + ".safetensors")
                if not model_file:
                    self.send_error(404, "Model not found")
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
                
                # Invalidate cache
                self.lora_data_cache = None
                
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


        else:
            self.send_error(404, "Not found")
            return


    def refresh_lora_data_cache(self, lora_path):
        """Refresh the cached model data."""
        self.lora_data_cache = self.get_lora_data(lora_path)

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
