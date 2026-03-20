import os
import json
import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import civitai_handler

def test_json_robustness():
    # 1. Create a malformed JSON file
    test_model = "test_malformed_model.safetensors"
    json_path = "test_malformed_model.json"
    
    with open(json_path, 'w') as f:
        f.write("{ invalid json: [")
        
    print(f"Testing malformed JSON protection for {json_path}...")
    
    # Try to create a dummy info file
    success = civitai_handler.create_dummy_info_file(test_model)
    
    if not success:
        print("SUCCESS: Aborted update for malformed JSON.")
        # Check if file still contains malformed content (not overwritten)
        with open(json_path, 'r') as f:
            content = f.read()
            if "{ invalid json: [" in content:
                print("PASSED: Malformed JSON file was NOT overwritten.")
            else:
                print("FAILED: Malformed JSON file WAS overwritten!")
    else:
        print("FAILED: Did not abort update for malformed JSON.")

    # 2. Test UTF-8-BOM handling
    bom_model = "test_bom_model.safetensors"
    bom_json_path = "test_bom_model.json"
    
    # Write UTF-8 with BOM
    data = {"original_data": "important_value"}
    with open(bom_json_path, 'w', encoding='utf-8-sig') as f:
        json.dump(data, f)
        
    print(f"\nTesting UTF-8-BOM handling for {bom_json_path}...")
    
    # Try to save a hash
    civitai_handler.save_sha256_to_json(bom_model, "fake_hash_123")
    
    # Verify both original data and hash exist
    new_data = civitai_handler.load_json_robust(bom_json_path)
    if new_data and new_data.get('original_data') == "important_value" and new_data.get('sha256') == "fake_hash_123":
        print("PASSED: Mixed data preserved with UTF-8-BOM.")
    else:
        print(f"FAILED: Data loss or corruption detected. Data: {new_data}")

    # Cleanup
    for f in [test_model, json_path, bom_model, bom_json_path]:
        if os.path.exists(f):
            os.remove(f)

if __name__ == "__main__":
    test_json_robustness()
