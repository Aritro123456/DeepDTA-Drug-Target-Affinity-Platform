import sys
import os

try:
    import fairseq
    print(f"Fairseq version: {fairseq.__version__}")
except ImportError as e:
    print(f"Failed to import fairseq: {e}")

try:
    import torch
    print(f"Torch version: {torch.__version__}")
except ImportError as e:
    print(f"Failed to import torch: {e}")
