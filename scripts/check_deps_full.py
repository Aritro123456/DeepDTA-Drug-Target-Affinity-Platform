import sys
import os
import importlib

deps = [
    'torch',
    'torch_geometric',
    'fairseq',
    'einops',
    'rdkit',
    'networkx',
    'flask',
    'flask_cors'
]

results = {}

for dep in deps:
    try:
        importlib.import_module(dep)
        results[dep] = "INSTALLED"
    except ImportError as e:
        results[dep] = f"MISSING: {e}"

output = []
output.append("--- Dependency Check ---")
for dep, status in results.items():
    output.append(f"{dep:20}: {status}")

# Check local model files too
model_files = [
    'DeepDTAGen-master/model.py',
    'DeepDTAGen-master/utils.py',
    'models/deepdtagen_model_bindingdb.pth',
    'DeepDTAGen-master/data/bindingdb_tokenizer.pkl'
]

output.append("\n--- Model Files Check ---")
for f in model_files:
    exists = os.path.exists(f)
    output.append(f"{f:40}: {'FOUND' if exists else 'NOT FOUND'}")

with open('deps_report_fixed.txt', 'w') as f:
    f.write("\n".join(output))

print("Report saved to deps_report_fixed.txt")
