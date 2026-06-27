import os

import numpy as np
from rdkit import Chem

from ..config import UPLOAD_DIR
from ..extensions import db


NOTEBOOK_NAMESPACE = {
    "__name__": "__main__",
    "db": db,
    "np": np,
    "Chem": Chem,
    "workspace_upload_dir": UPLOAD_DIR,
    "uploaded_datasets": [],
    "plt": None,
    "sns": None,
}


def initialize_notebook_runtime(app):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    NOTEBOOK_NAMESPACE["app"] = app

    try:
        import torch
        NOTEBOOK_NAMESPACE["torch"] = torch
    except ImportError:
        NOTEBOOK_NAMESPACE["torch"] = None

    try:
        import matplotlib.pyplot as plt
        import seaborn as sns
        NOTEBOOK_NAMESPACE["plt"] = plt
        NOTEBOOK_NAMESPACE["sns"] = sns
    except ImportError:
        pass

    NOTEBOOK_NAMESPACE["get_uploaded_dataset_path"] = get_uploaded_dataset_path


def get_uploaded_dataset_path(dataset_id):
    for dataset in NOTEBOOK_NAMESPACE.get("uploaded_datasets", []):
        if dataset.get("id") == dataset_id:
            return dataset.get("path")
    raise KeyError(f"Dataset not found: {dataset_id}")
