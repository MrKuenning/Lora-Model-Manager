import os
import json
import re
import requests
from html import unescape

def strip_html_tags(text):
    # Remove HTML tags from text using regular expressions
    clean = re.compile('<.*?>')
    # Replace HTML tags with a space to preserve spacing
    return re.sub(clean, ' ', text)

def get_creator_from_api(model_id, use_api=True):
    """
    Fetch creator information from Civitai API using model ID
    """
    # If API calls are disabled, return empty string
    if not use_api:
        return ''
        
    try:
        # Make API request to get model information
        api_url = f"https://civitai.com/api/v1/models/{model_id}"
        response = requests.get(api_url, timeout=10)
        
        # Check if request was successful
        if response.status_code == 200:
            model_data = response.json()
            # Extract creator information
            if 'creator' in model_data and 'username' in model_data['creator']:
                return model_data['creator']['username']
        
        # If we reach here, either the request failed or creator info wasn't found
        return 'Unknown'
    except Exception as e:
        print(f"Error fetching creator information: {e}")
        return 'Unknown'

def parse_civitai_info_file(file_path, use_api=True, existing_creator=''):
    civitai_info_data = {}
    with open(file_path, 'r', encoding='utf-8') as file:
        civitai_info_data = json.load(file)
    # Initialize all fields with empty values
    mapped_data = {
        'activation text': '',
        'base model': '',
        'category': '',
        'civitai name': '',
        'civitai text': '',
        'creator': '',
        'description': '',  # Will keep this empty as per requirement
        'example prompt': '',
        'folder': '',
        'high low': '',  # High/Low toggle field
        'model version': '',  # Model version field
        'name': '',  # Model name field (populated from civitai name)
        'negative text': '',
        'notes': '',
        'nsfw': '',
        'preferred weight': 0,
        'sd version': '',
        'subcategory': '',
        'tags': '',
        'url': ''
    }
    
    # Get folder from parent folder name
    parent_folder = os.path.basename(os.path.dirname(file_path))
    mapped_data['folder'] = parent_folder
    
    # Extract data from civitai.info
    if 'trainedWords' in civitai_info_data:
        trained_words = civitai_info_data['trainedWords']
        if isinstance(trained_words, list) and trained_words:
            mapped_data['activation text'] = trained_words[0]
            mapped_data['civitai text'] = ', '.join(trained_words)

    if 'baseModel' in civitai_info_data:
        mapped_data['base model'] = civitai_info_data['baseModel']
        mapped_data['sd version'] = 'SD1' if civitai_info_data['baseModel'].startswith('SD 1') else 'SD2'

    if 'model' in civitai_info_data:
        if 'name' in civitai_info_data['model']:
            mapped_data['civitai name'] = civitai_info_data['model']['name']
            # Also populate the 'name' field with civitai name
            mapped_data['name'] = civitai_info_data['model']['name']
        if 'nsfw' in civitai_info_data['model']:
            mapped_data['nsfw'] = str(civitai_info_data['model']['nsfw']).lower()

    # Process description for notes field but don't map to description field
    description = ''
    if 'description' in civitai_info_data:
        description = civitai_info_data['description']
        if description:
            description = unescape(description)
            description = strip_html_tags(description)
            # Normalize spaces by stripping leading/trailing spaces and reducing multiple spaces to a single space
            description = ' '.join(description.split())
            # No longer mapping to description field, but keeping for notes

    # Extract example prompt from images -> meta -> prompt
    if 'images' in civitai_info_data:
        images = civitai_info_data['images']
        if isinstance(images, list) and images:
            first_image = images[0]
            # Check if 'meta' is a dictionary before accessing 'prompt'
            if 'meta' in first_image and isinstance(first_image['meta'], dict) and 'prompt' in first_image['meta']:
                mapped_data['example prompt'] = first_image['meta']['prompt']
            # Check if 'meta' has 'negativePrompt'
            if 'meta' in first_image and isinstance(first_image['meta'], dict) and 'negativePrompt' in first_image['meta']:
                mapped_data['negative text'] = first_image['meta']['negativePrompt']

    # Build URL and notes
    if 'modelId' in civitai_info_data and 'id' in civitai_info_data:
        model_id = civitai_info_data['modelId']
        version_id = civitai_info_data['id']
        url = f"https://civitai.com/models/{model_id}?modelVersionId={version_id}"
        mapped_data['url'] = url

        # Use existing creator if provided, otherwise get from API if enabled
        if existing_creator:
            mapped_data['creator'] = existing_creator
        elif use_api:
            creator = get_creator_from_api(model_id, use_api)
            if creator:
                mapped_data['creator'] = creator

        # Construct notes field
        notes = [f"URL: {url}"]
        if 'baseModel' in civitai_info_data:
            notes.append(f"Base Model: {civitai_info_data['baseModel']}")
        if 'trainedWords' in civitai_info_data and civitai_info_data['trainedWords']:
            notes.append(f"Activation Words: {', '.join(civitai_info_data['trainedWords'])}")
        if description:
            notes.append(f"Description: {description}")
        mapped_data['notes'] = '\n'.join(notes)

    return mapped_data

def write_json_file(file_path, data):
    json_file_path = file_path[:-len('.civitai.info')] + '.json'  # Create corresponding JSON file path
    # Sort the data alphabetically by keys
    sorted_data = {k: data[k] for k in sorted(data.keys())}
    with open(json_file_path, 'w') as file:
        json.dump(sorted_data, file, indent=4)

def process_civitai_info_files(directory, use_api=True):
    for root, dirs, files in os.walk(directory):
        for filename in files:
            if filename.lower().endswith('.civitai.info'):
                civitai_info_file_path = os.path.join(root, filename)
                print(f"Processing file: {civitai_info_file_path}")
                json_file_path = civitai_info_file_path[:-len('.civitai.info')] + '.json'
                
                # Check for existing creator information
                existing_creator = ''
                if os.path.exists(json_file_path):
                    try:
                        with open(json_file_path, 'r', encoding='utf-8') as json_file:
                            existing_json = json.load(json_file)
                            if 'creator' in existing_json and existing_json['creator']:
                                existing_creator = existing_json['creator']
                                print(f"Using existing creator: {existing_creator}")
                    except Exception as e:
                        print(f"Error reading JSON file for creator info: {e}")
                
                data = parse_civitai_info_file(civitai_info_file_path, use_api, existing_creator)
                
                # If JSON file exists, merge with existing data
                if os.path.exists(json_file_path):
                    try:
                        with open(json_file_path, 'r', encoding='utf-8') as json_file:
                            existing_data = json.load(json_file)
                            
                            # Only populate fields that are empty in existing data
                            # Fields to preserve if already populated
                            fields_to_preserve = [
                                'activation text', 'sd version', 'preferred weight',
                                'negative text', 'civitai text', 
                                'nsfw', 'url', 'base model', 'example prompt',
                                'category', 'subcategory', 'tags', 'creator',
                                'name', 'model version', 'high low'  # New fields to preserve
                            ]
                            for field in fields_to_preserve:
                                # If field exists in existing data and has a value, keep the existing value
                                # Otherwise, use the new value from civitai.info
                                # Check explicitly for None and empty string to handle 0 and other falsy values correctly
                                if field in existing_data and existing_data[field] is not None and existing_data[field] != '':
                                    # Existing field has data, preserve it
                                    data[field] = existing_data[field]
                                # else: use the new value that was already set in data

                    except Exception as e:
                        print(f"Error reading JSON file {json_file_path}: {e}")
                        print("Creating a new JSON file instead.")
                
                write_json_file(civitai_info_file_path, data)

def main():
    print("Civitai-2-JSON v4 - Now with creator information from API")
    
    # Prompt user about API calls for creator information
    use_api = input("Do you want to run API calls to fetch creator information? (y/n): ").lower().strip() == 'y'
    
    if use_api:
        print("API calls for creator information enabled.")
    else:
        print("API calls for creator information disabled.")
    
    current_directory = os.getcwd()
    process_civitai_info_files(current_directory, use_api)
    print("Conversion completed successfully.")

if __name__ == "__main__":
    main()