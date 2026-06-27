import torch
import torch.nn as nn
import torch.optim as optim
from torch_geometric.data import Dataset, Data, Batch
from torch_geometric.loader import DataLoader
from torch.nn.utils.rnn import pad_sequence
import pandas as pd
import numpy as np
import pickle
import os
import sys
# Add DeepDTAGen-master to path so 'utils' module can be found for unpickling Tokenizer
sys.path.append(os.path.abspath('DeepDTAGen-master'))

from tqdm import tqdm
from rdkit import Chem
import networkx as nx
import re

# Import unified model
from deepdta_gen_unified import DeepDTAGenUnified

# ==========================================
# 1. Helper Functions (SMILES -> Graph)
# ==========================================

# Copied from demo_utils.py/utils.py with minor fixes

def one_of_k_encoding(x, allowable_set):
    if x not in allowable_set:
        x = allowable_set[-1]
    return [x == s for s in allowable_set]

def one_of_k_encoding_unk(x, allowable_set):
    if x not in allowable_set:
        x = allowable_set[-1]
    return [x == s for s in allowable_set] + [x not in allowable_set]

def atom_features(atom):
    return np.array(one_of_k_encoding_unk(atom.GetSymbol(),['C', 'N', 'O', 'S', 'F', 'Si', 'P', 'Cl', 'Br', 'Mg', 'Na','Ca', 'Fe', 'As', 'Al', 'I', 'B', 'V', 'K', 'Tl', 'Yb','Sb', 'Sn', 'Ag', 'Pd', 'Co', 'Se', 'Ti', 'Zn', 'H','Li', 'Ge', 'Cu', 'Au', 'Ni', 'Cd', 'In', 'Mn', 'Zr','Cr', 'Pt', 'Hg', 'Pb', 'Unknown']) + 
                    one_of_k_encoding(atom.GetDegree(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
                    one_of_k_encoding_unk(atom.GetTotalNumHs(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
                    one_of_k_encoding_unk(atom.GetImplicitValence(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
                    one_of_k_encoding_unk(atom.GetFormalCharge(), [-1, -2, 1, 2, 0]) +
                    one_of_k_encoding_unk(atom.GetHybridization(), [Chem.rdchem.HybridizationType.SP, Chem.rdchem.HybridizationType.SP2, Chem.rdchem.HybridizationType.SP3, Chem.rdchem.HybridizationType.SP3D, Chem.rdchem.HybridizationType.SP3D2]) +
                    [atom.GetIsAromatic()] +
                    [atom.IsInRing()])

def bond_features(bond):
    bt = bond.GetBondType()
    bond_feats = [0, 0, 0, 0, bond.GetBondTypeAsDouble()]
    if bt == Chem.rdchem.BondType.SINGLE:
        bond_feats = [1, 0, 0, 0, bond.GetBondTypeAsDouble()]
    elif bt == Chem.rdchem.BondType.DOUBLE:
        bond_feats = [0, 1, 0, 0, bond.GetBondTypeAsDouble()]
    elif bt == Chem.rdchem.BondType.TRIPLE:
        bond_feats = [0, 0, 1, 0, bond.GetBondTypeAsDouble()]
    elif bt == Chem.rdchem.BondType.AROMATIC:
        bond_feats = [0, 0, 0, 1, bond.GetBondTypeAsDouble()]
    return np.array(bond_feats)

def smile_to_graph(smile):
    mol = Chem.MolFromSmiles(smile)
    if mol is None: return None
    
    c_size = mol.GetNumAtoms()
    
    features = []
    for atom in mol.GetAtoms():
        feature = atom_features(atom)
        features.append(feature / sum(feature))

    edges = []
    for bond in mol.GetBonds():
        edge_feats = bond_features(bond)
        edges.append((bond.GetBeginAtomIdx(), bond.GetEndAtomIdx(), {'edge_feats': edge_feats}))
        
    g = nx.Graph()
    if len(edges) == 0:
        # Handle single atom or no bonds
        pass
    else:
        g.add_edges_from(edges)
        
    g = g.to_directed()
    edge_index = []
    edge_feats = []
    for e1, e2, feats in g.edges(data=True):
        edge_index.append([e1, e2])
        edge_feats.append(feats['edge_feats'])
        
    return c_size, features, edge_index, edge_feats

def seq_cat(prot):
    seq_voc = "ABCDEFGHIKLMNOPQRSTUVWXYZ"
    seq_dict = {v:(i+1) for i,v in enumerate(seq_voc)}
    max_seq_len = 1000
    x = np.zeros(max_seq_len)
    for i, ch in enumerate(prot[:max_seq_len]): 
        x[i] = seq_dict.get(ch, 0) # Use 0 for unknown
    return x

# ==========================================
# 2. Tokenizer
# ==========================================
class Tokenizer:
    NUM_RESERVED_TOKENS = 32
    SPECIAL_TOKENS = ('<sos>', '<eos>', '<pad>', '<mask>', '<sep>', '<unk>')
    SPECIAL_TOKENS += tuple([f'<t_{i}>' for i in range(len(SPECIAL_TOKENS), 32)])

    PATTEN = re.compile(r'\[[^\]]+\]'
                        r'|B[r]?|C[l]?|N|O|P|S|F|I'
                        r'|[bcnops]'
                        r'|@@|@'
                        r'|%\d{2}'
                        r'|.')
    
    def __init__(self, vocabs):
        special_tokens = list(Tokenizer.SPECIAL_TOKENS)
        vocabs = special_tokens + sorted(set(vocabs) - set(special_tokens), key=lambda x: (len(x), x))
        self.vocabs = vocabs
        self.i2s = {i: s for i, s in enumerate(vocabs)}
        self.s2i = {s: i for i, s in self.i2s.items()}

    def parse(self, smiles):
        l = []
        l.append(self.s2i['<sos>'])
        for s in re.findall(Tokenizer.PATTEN, smiles):
            l.append(self.s2i.get(s, self.s2i['<unk>']))
        l.append(self.s2i['<eos>'])
        return l

    def __len__(self):
        return len(self.vocabs)

# ==========================================
# 3. Dataset
# ==========================================
class BindingDBDataset(Dataset):
    def __init__(self, csv_path, tokenizer_path):
        super().__init__()
        print(f"Loading CSV from {csv_path}...")
        self.df = pd.read_csv(csv_path)
        print(f"Loaded {len(self.df)} samples.")
        
        print(f"Loading Tokenizer from {tokenizer_path}...")
        with open(tokenizer_path, 'rb') as f:
            self.tokenizer = pickle.load(f)
            
    def len(self):
        return len(self.df)

    def get(self, idx):
        row = self.df.iloc[idx]
        smile = row['compound_iso_smiles']
        seq = row['target_sequence']
        affinity = float(row['affinity'])
        
        # Smile -> Graph
        graph_data = smile_to_graph(smile)
        if graph_data is None:
            # Handle error or return dummy? usually skip but here we must return something
            # Return None and filter in collate
            return None
            
        c_size, features, edge_index, edge_feats = graph_data
        
        # Smile -> Tokens
        tokenized_smi = self.tokenizer.parse(smile)
        
        # Protein -> Seq
        target_seq = seq_cat(seq)
        
        data = Data(
            x=torch.tensor(features, dtype=torch.float),
            edge_index=torch.tensor(edge_index, dtype=torch.long).t().contiguous(),
            edge_attr=torch.tensor(edge_feats, dtype=torch.float),
            y=torch.tensor([affinity], dtype=torch.float),
            target=torch.tensor(target_seq, dtype=torch.long),     # Protein Encoded
            target_seq=torch.tensor(tokenized_smi, dtype=torch.long), # SMILES Tokens
            c_size=torch.tensor([c_size], dtype=torch.long)
        )
        return data

# ==========================================
# 4. Collate Function
# ==========================================
def custom_collate(data_list):
    # Filter Nones (failed graphs)
    data_list = [d for d in data_list if d is not None]
    if len(data_list) == 0:
        return None
        
    # Standard PyG Batching for graph parts
    batch = Batch.from_data_list(data_list)
    
    # Custom Padding for sequences
    # target (Protein): Stacked ? No, they are all fixed 1000 length in `seq_cat`
    # seq_cat returns numpy array of shape (1000,)
    
    # target_seq (SMILES Tokens): Variable length, needs padding
    smile_tokens = [d.target_seq for d in data_list]
    padded_smiles = pad_sequence(smile_tokens, batch_first=True, padding_value=2) # 2 is <pad> usually
    
    # Override batch attributes with combined/padded versions if needed
    # But batch.target_seq is currently a flattened concat. We replace it.
    batch.target_seq = padded_smiles
    
    # batch.target (Protein) is (Batch*1000) flattened by default?
    # No, PyG automatically stacks if shapes match. 
    # seq_cat returns (1000,). So batch.target should be [Batch, 1000] automatically.
    # Check PyG behavior: it usually concatenates along dim 0.
    # So [1000] becomes [Batch*1000]. We want [Batch, 1000].
    # We should    # Reshape
    # batch.target is concatenated [Batch*1000].
    print(f"DEBUG: Collate data_list len: {len(data_list)}", flush=True)
    print(f"DEBUG: Original batch.target shape in collate: {batch.target.shape}", flush=True)
    num_graphs = len(data_list)
    batch.target = batch.target.view(num_graphs, -1)
    print(f"DEBUG: Reshaped batch.target shape in collate: {batch.target.shape}", flush=True)
    
    return batch

# ==========================================
# 5. Training
# ==========================================
def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Config
    CSV_PATH = 'bindingdb_highconf_pKd_clean.csv'
    TOKENIZER_PATH = 'DeepDTAGen-master/data/bindingdb_tokenizer.pkl'
    BATCH_SIZE = 16 # Adjust based on GPU memory
    LR = 0.0001
    EPOCHS = 10
    
    # Data
    dataset = BindingDBDataset(CSV_PATH, TOKENIZER_PATH)
    
    # Use standard torch DataLoader with custom collate, accessing Dataset via indexing
    # Note: PyG 'Dataset' behaves slightly differently than torch Dataset w.r.t __getitem__ vs get
    # But PyG DataLoader is recommended.
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, collate_fn=custom_collate)
    
    # Model
    model = DeepDTAGenUnified(dataset.tokenizer).to(device)
    
    # Optim
    optimizer = optim.Adam(model.parameters(), lr=LR)
    
    # Losses
    mse_loss_fn = nn.MSELoss()
    ce_loss_fn = nn.CrossEntropyLoss(ignore_index=dataset.tokenizer.s2i['<pad>'])
    
    print("Starting training...")
    model.train()
    
    for epoch in range(EPOCHS):
        total_loss = 0
        total_mse = 0
        total_ce = 0
        total_kl = 0
        
    print("Starting training...")
    model.train()
    
    for epoch in range(EPOCHS):
        total_loss = 0
        total_mse = 0
        total_ce = 0
        total_kl = 0
        
        print(f"Epoch {epoch+1}/{EPOCHS}")
        # Manual loop to verify prints
        for i, batch in enumerate(loader):
            if i % 10 == 0: print(f"Batch {i}")
            if batch is None: continue
            
            # DEBUG: Check shape
            if i == 0:
                print(f"DEBUG: Batch target shape entering model: {batch.target.shape}", flush=True)
            
            batch = batch.to(device)
            optimizer.zero_grad()
            
            # Forward
            # Returns: affinity_pred, token_logits, tgt_out, kl_loss
            pred_affinity, token_logits, tgt_out, kl_loss = model(batch)
            
            # 1. Affinity Loss
            loss_aff = mse_loss_fn(pred_affinity.squeeze(), batch.y)
            
            # 2. Generation Loss
            # token_logits: [Seq, Batch, Vocab] -> Permute to [Batch, Vocab, Seq] ?
            # Pytorch CrossEntropy expects [Batch, C, d1...]
            # token_logits: [Seq, Batch, Vocab]
            # tgt_out: [Seq, Batch] (from forward return) is already shifted?
            # Unified model returns:
            # token_logits = self.word_predictor(output) -> [Seq, Batch, Vocab]
            # tgt_out = targets[:, 1:].transpose(0, 1) -> [Seq, Batch]
            
            # Flatten for loss
            loss_gen = ce_loss_fn(token_logits.view(-1, model.vocab_size), tgt_out.reshape(-1))
            
            # 3. KL Loss
            loss_kl = kl_loss # scalar, usually handled in forward
            
            # Total Loss
            loss = loss_aff + loss_gen + loss_kl
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            total_mse += loss_aff.item()
            total_ce += loss_gen.item()
            total_kl += loss_kl.item() if isinstance(loss_kl, torch.Tensor) else loss_kl
            
            pbar.set_postfix({'Loss': loss.item(), 'MSE': loss_aff.item(), 'CE': loss_gen.item()})
            
        print(f"Epoch {epoch+1} Mean Loss: {total_loss/len(loader):.4f}")
        
        # Save Checkpoint
        torch.save(model.state_dict(), f'deepdta_unified_epoch_{epoch+1}.pth')

if __name__ == '__main__':
    train()
