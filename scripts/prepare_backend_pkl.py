import torch
import pickle
import os
import sys

# Add DeepDTAGen paths to load the model class
current_dir = os.path.dirname(os.path.abspath(__file__))
model_master_path = os.path.join(current_dir, 'DeepDTAGen-master')
sys.path.append(model_master_path)

try:
    from model import DeepDTAGen
    print("Successfully imported DeepDTAGen from model.py")
except ImportError as e:
    print(f"Error importing DeepDTAGen: {e}")
    sys.exit(1)

def prepare_pkl(dataset_name='bindingdb'):
    print(f"Preparing consolidated PKL for {dataset_name}...")
    
    # Paths
    model_path = os.path.join(current_dir, 'models', f'deepdtagen_model_{dataset_name}.pth')
    tokenizer_path = os.path.join(model_master_path, 'data', f'{dataset_name}_tokenizer.pkl')
    output_pkl = os.path.join(current_dir, 'models', f'deepdtagen_full_{dataset_name}.pkl')
    
    if not os.path.exists(model_path):
        print(f"Model file not found: {model_path}")
        return
    if not os.path.exists(tokenizer_path):
        print(f"Tokenizer file not found: {tokenizer_path}")
        return

    # Load tokenizer
    with open(tokenizer_path, 'rb') as f:
        tokenizer = pickle.load(f)
    print("Loaded tokenizer.")

    # Load model state dict
    # We store the state_dict instead of the whole model object to avoid pickling issues 
    # with custom classes across different environments, although we could pickle the whole thing.
    # However, pickling the state_dict + tokenizer is safer.
    state_dict = torch.load(model_path, map_location='cpu')
    print("Loaded model state dict.")

    # Consolidate into a dictionary
    combined_data = {
        'state_dict': state_dict,
        'tokenizer': tokenizer,
        'dataset': dataset_name,
        'model_class': DeepDTAGen # Optional, but can be useful
    }

    # Save to PKL
    with open(output_pkl, 'wb') as f:
        pickle.dump(combined_data, f)
    
    print(f"Successfully created consolidated PKL at: {output_pkl}")
    print(f"Size: {os.path.getsize(output_pkl) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    # Ensure models directory exists
    os.makedirs(os.path.join(current_dir, 'models'), exist_ok=True)
    
    # Prepare for all available models if possible
    datasets = ['bindingdb', 'davis', 'kiba']
    for ds in datasets:
        try:
            prepare_pkl(ds)
        except Exception as e:
            print(f"Failed to prepare PKL for {ds}: {e}")
