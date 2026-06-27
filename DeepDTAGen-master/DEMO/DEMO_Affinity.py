import torch
import torch.nn as nn
import pickle
import os

from tqdm import tqdm
import pandas as pd
from torch.utils.data import DataLoader
from required_files_for_demo.demo_utils import *

from required_files_for_demo.model_aff import DeepDTAGen

def demo():
    dataset_name = 'bindingdb'

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    # Paths relative to the project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "..", ".."))

    model_path = os.path.join(project_root, "models", f"deepdtagen_model_{dataset_name}.pth")
    tokenizer_path = os.path.join(project_root, "DeepDTAGen-master", "data", f"{dataset_name}_tokenizer.pkl")


    smiles = "CCN1Cc2ccc(NC(=O)c3ccc(C(=O)N4CCC(C5CCCN5)CC4)c(Nc4ccccc4)c3)cc2C1"
    protein_sequence = "MRRREGHGTDSEMGQGPVRESQSSDPPALQFRISEYKPLNMAGVEQPPSPELRQEGVTEYEDGGAPAGDGEAGPQQAEDHPQNPPEDPNQDPPEDDSTCQCQACGPHQAAGPDLGSSNDGCPQLFQERSVIVENSSGSTSASELLKPMKKRKRREYQSPSEEESEPEAMEKQEEGKDPEGQPTASTPESEEWSSSQPATGEKKECWSWESYLEEQKAITAPVSLFQDSQAVTHNKNGFKLGMKLEGIDPQHPSMYFILTVAEVCGYRLRLHFDGYSECHDFWVNANSPDIHPAGWFEKTGHKLQPPKGYKEEEFSWSQYLRSTRAQAAPKHLFVSQSHSPPPLGFQVGMKLEAVDRMNPSLVCVASVTDVVDSRFLVHFDNWDDTYDYWCDPSSPYIHPVGWCQKQGKPLTPPQDYPDPDNFCWEKYLEETGASAVPTWAFKVRPPHSFLVNMKLEAVDRRNPALIRVASVEDVEDHRIKIHFDGWSHGYDFWIDADHPDIHPAGWCSKTGHPLQPPLGPREPSSASPGGCPPLSYRSLPHTRTSKYSFHHRKCPTPGCDGSGHVTGKFTAHHCLSGCPLAERNQSRLKAELSDSEASARKKNLSGFSPRKKPRHHGRIGRPPKYRKIPQEDFQTLTPDVVHQSLFMSALSAHPDRSLSVCWEQHCKLLPGVAGISASTVAKWTIDEVFGFVQTLTGCEDQARLFKDEMIDGEAFLLLTQADIVKIMSVKLGPALKIYNAILMFKNADDTLK"
    # Load tokenizer
    with open(tokenizer_path, 'rb') as f:
        tokenizer = pickle.load(f)

    # Load model
    model = DeepDTAGen(tokenizer)
    # weights_only=False is required for newer pytorch versions to load this model format
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=False))

    model.to(device)

    # Load test data
    processed_data = os.path.join(project_root, "DeepDTAGen-master", "data", "processed", f"{smiles}.pt")

    if not os.path.isfile(processed_data):
        test_data = process_latent_a(smiles, protein_sequence)
    else:
        test_data = torch.load(processed_data)
    print(test_data)
    test_loader = torch.utils.data.DataLoader(test_data, batch_size=1, shuffle=False, collate_fn=collate)

    # Evaluate the model
    model.eval()
    with torch.no_grad():
        for data in tqdm(test_loader, desc='Testing'):
            predictions = model(data.to(device))
        print("Predicted Affinity :", predictions)

if __name__ == "__main__":
    demo()