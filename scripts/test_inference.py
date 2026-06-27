import sys
import os
import torch
import pickle
import traceback
from types import ModuleType

# Mock Fairseq before anything else
def mock_fairseq():
    m = ModuleType('fairseq')
    sys.modules['fairseq'] = m
    
    models = ModuleType('fairseq.models')
    sys.modules['fairseq.models'] = models
    models.FairseqIncrementalDecoder = type('FairseqIncrementalDecoder', (object,), {})
    
    modules = ModuleType('fairseq.modules')
    sys.modules['fairseq.modules'] = modules
    modules.TransformerDecoderLayer = type('TransformerDecoderLayer', (object,), {})
    modules.TransformerEncoderLayer = type('TransformerEncoderLayer', (object,), {})
    print("Fairseq mocked")

mock_fairseq()

# Add paths
current_dir = os.path.dirname(os.path.abspath(__file__))
model_master_path = os.path.join(current_dir, 'DeepDTAGen-master')
demo_utils_path = os.path.join(model_master_path, 'DEMO', 'required_files_for_demo')
sys.path.insert(0, model_master_path)
sys.path.insert(0, demo_utils_path)

try:
    from model_aff import DeepDTAGen
    from demo_utils import process_latent_a, collate
    print("Imports successful")

    device = torch.device('cpu')
    dataset_name = 'bindingdb'
    model_path = os.path.join(current_dir, 'models', f'deepdtagen_model_{dataset_name}.pth')
    tokenizer_path = os.path.join(model_master_path, 'data', f'{dataset_name}_tokenizer.pkl')

    with open(tokenizer_path, 'rb') as f:
        tokenizer = pickle.load(f)

    print(f"Loading model from {model_path}...")
    model = DeepDTAGen(tokenizer)
    
    # Use strict=False and allow unpickling mock classes
    sd = torch.load(model_path, map_location=device, weights_only=False)
    model.load_state_dict(sd, strict=False)
    print("Model state dict loaded")

    model.eval()
    
    # Test inputs
    smiles = "O=C(c1nc(NS(=O)(=O)c2cc(Br)cc(Cl)c2O)cn1C1CCCC1)N1CCC(C2CCCN2)CC1"
    protein_sequence = "MATEEKKPETEAARAQPTPSSSATQSKPTPVKPNYALKFTLAGHTKAVSSVKFSPNGEWLASSSADKLIKIWGAYDGKFEKTISGHKLGISDVAWSSDSNLLVSASDDKTLKIWDVSSGKCLKTLKGHSNYVFCCNFNPQSNLIVSGSFDESVRIWDVKTGKCLKTLPAHSDPVSAVHFNRDGSLIVSSSYDGLCRIWDTASGQCLKTLIDDDNPPVSFVKFSPNGKYILAATLDNTLKLWDYSKGKCLKTYTGHKNEKYCIFANFSVTGGKWIVSGSEDNLVYIWNLQTKEIVQKLQGHTDVVISTACHPTENIIASAALENDKTIKLWKSDC"

    os.makedirs('data', exist_ok=True)
    test_data = process_latent_a(smiles, protein_sequence)
    test_loader = torch.utils.data.DataLoader(test_data, batch_size=1, shuffle=False, collate_fn=collate)

    with torch.no_grad():
        for data_batch in test_loader:
            prediction = model(data_batch.to(device))
            # My modified model_aff returns Pridection directly
            score = float(prediction.cpu().numpy()[0])
            print(f"Predicted Score: {score}")

except Exception as e:
    print(f"Error: {e}")
    traceback.print_exc()
