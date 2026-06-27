import sys
import os

# Add paths
current_dir = os.path.dirname(os.path.abspath(__file__))
model_master_path = os.path.join(current_dir, 'DeepDTAGen-master')
demo_utils_path = os.path.join(model_master_path, 'DEMO', 'required_files_for_demo')
sys.path.append(model_master_path)
sys.path.append(demo_utils_path)

print(f"Python version: {sys.version}")
print(f"CWD: {os.getcwd()}")

try:
    import torch
    print("torch imported")
except ImportError:
    print("torch NOT found")

try:
    import torch_geometric
    print("torch_geometric imported")
except ImportError:
    print("torch_geometric NOT found")

try:
    import fairseq
    print("fairseq imported")
except ImportError:
    print("fairseq NOT found")

try:
    import einops
    print("einops imported")
except ImportError:
    print("einops NOT found")

try:
    from model_aff import DeepDTAGen
    print("DeepDTAGen (model_aff) imported")
except Exception as e:
    print(f"DeepDTAGen (model_aff) import FAILED: {e}")

try:
    from demo_utils import process_latent_a, collate
    print("demo_utils imported")
except Exception as e:
    print(f"demo_utils import FAILED: {e}")
