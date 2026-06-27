import torch
import torch.nn as nn
import torch.nn.functional as F
import math
from torch_geometric.nn import GCNConv, global_max_pool as gmp
from torch.nn.utils.rnn import pad_sequence
from typing import Optional, Dict
from einops.layers.torch import Rearrange

# ==========================================
# 1. Positional Encoding
# ==========================================
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, dropout=0.1, max_len=5000):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        pd = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pd[:, 0::2] = torch.sin(position * div_term)
        pd[:, 1::2] = torch.cos(position * div_term)
        pd = pd.unsqueeze(0).transpose(0, 1)
        self.register_buffer('pe', pd)

    def forward(self, x):
        # x: [seq_len, batch_size, embed_dim]
        x = x + self.pe[:x.size(0), :]
        return self.dropout(x)

# ==========================================
# 2. Graph Encoder Module (Drug)
# ==========================================
class GraphEncoder(nn.Module):
    def __init__(self, in_features, hidden_dim=376, output_dim=128, dropout=0.2):
        super().__init__()
        self.hidden_dim = hidden_dim
        
        # GCN Layers
        self.gcn1 = GCNConv(in_features, in_features * 2)
        self.gcn2 = GCNConv(in_features * 2, in_features * 3)
        self.gcn3 = GCNConv(in_features * 3, in_features * 4) # Output used for FC prediction
        
        # Conditioning Layers
        self.cond = nn.Linear(96 * 107, hidden_dim)

        # VAE Mean and Variance Layers
        self.mean_layer = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim)
        )
        self.var_layer = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim)
        )

        # Output FC for Affinity Prediction branch
        self.drug_fc = nn.Sequential(
            nn.Linear(in_features * 4, 1024),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(1024, output_dim)
        )
        
        self.relu = nn.ReLU()
        # Learnable encoding for sequence padding
        self.pp_seg_encoding = nn.Parameter(torch.randn(hidden_dim))

    def reparameterize(self, mu, logvar, con):
        """VAE Reparameterization Trick"""
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        z = mu + eps * std
        
        # Conditioning (add Protein info to latent vector)
        con = con.view(-1, 96 * 107)
        con_emb = self.cond(con)
        
        z = z + con_emb
        
        # KL Divergence Loss
        kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp()) / 64
        return z, kl_loss

    def process_graph_to_seq(self, node_features, num_nodes, batch):
        """Converts graph node features into padded sequences for Transformer"""
        # Split by graph
        split_features = torch.split(node_features, num_nodes.tolist())
        # Pad sequence
        padded = pad_sequence(split_features, batch_first=False, padding_value=-999)
        
        # Create mask
        mask = (padded[:, :, 0].T == -999).bool() # [Batch, Seq]
        
        # Recover true values (replace -999 padding with 0 or ignored, but we add segment enc)
        # We need to ensure we don't add encoding to padding, technically, 
        # but original code adds it everywhere then masks.
        
        # Safe add:
        out = padded.clone()
        # In original code: padded_sequence_with_encoding = d_node_features + self.pp_seg_encoding
        # Note: d_node_features has shape [Seq, Batch, Dim]
        out = out + self.pp_seg_encoding.unsqueeze(1) 
        
        return out, mask

    def forward(self, x, edge_index, batch, num_nodes, protein_con):
        # GCN 1
        x = self.relu(self.gcn1(x, edge_index))
        # GCN 2
        x = self.relu(self.gcn2(x, edge_index))
        # GCN 3 -> This is PMVO (Pre-Mean-Variance Output) equivalent
        pmvo_features = self.gcn3(x, edge_index)
        x_gcn = self.relu(pmvo_features)
        
        # Process for VAE (Sequence format)
        seq_features, mask = self.process_graph_to_seq(x_gcn, num_nodes, batch)
        
        # Variational Autoencoder Layers
        mu = self.mean_layer(seq_features)
        logvar = self.var_layer(seq_features)
        
        # Latent Vector Z[AMVO]
        z_latent, kl_loss = self.reparameterize(mu, logvar, protein_con)
        
        # Process for Affinity Prediction (Global Pooling)
        x_pooled = gmp(x_gcn, batch)
        pred_features = self.drug_fc(x_pooled)
        
        return seq_features, z_latent, mask, pred_features, kl_loss

# ==========================================
# 3. Gated-CNN Module (Protein)
# ==========================================
class GatedCNN(nn.Module):
    def __init__(self, vocab_size, num_filters, embed_dim, output_dim, kernel_size):
        super().__init__()
        self.embed = nn.Embedding(vocab_size + 1, embed_dim)
        
        # Layer 1
        self.conv1 = nn.Conv1d(1000, num_filters, kernel_size)
        self.gate1 = nn.Conv1d(1000, num_filters, kernel_size)
        
        # Layer 2
        self.conv2 = nn.Conv1d(num_filters, num_filters * 2, kernel_size)
        self.gate2 = nn.Conv1d(num_filters, num_filters * 2, kernel_size)
        
        # Layer 3
        self.conv3 = nn.Conv1d(num_filters * 2, num_filters * 3, kernel_size)
        self.gate3 = nn.Conv1d(num_filters * 2, num_filters * 3, kernel_size)
        
        self.fc = nn.Linear(96 * 107, output_dim)
        self.relu = nn.ReLU()

    def forward(self, target_seq_indices):
        # Embedding
        x = self.embed(target_seq_indices) # [Batch, Seq, Embed]
        # Original code expects [Batch, 1000, Embed]? No, Conv1d expects [Batch, Channels, Length]
        # But wait, original code: in_channels=1000? That implies sequence length is 1000 and treated as channels?
        # Let's check original: "self.Protein_Embed = nn.Embedding(Protein_Features + 1, Embed_dim)"
        # then "self.Protein_Conv1 = nn.Conv1d(in_channels=1000, ...)"
        # This implies input to conv is [Batch, 1000, Embed_dim] -> permuted?
        # Typically Conv1d input is [Batch, C_in, L_in]. 
        # DeepDTAGen implementation puts Embed_dim as L_in? Or 1000 as C_in?
        # If in_channels=1000, then input must have 1000 channels.
        # This is unusual but we stick to reference:
        
        # Original: Embed = self.Protein_Embed(target) 
        # Then: conv1 = self.Protein_Conv1(Embed)
        # If Embed is [Batch, 1000, Embed_dim], then Conv1d treats 1000 as channels.
        
        x = self.conv1(x) * torch.sigmoid(self.gate1(x))
        x = self.relu(x)
        
        x = self.conv2(x) * torch.sigmoid(self.gate2(x))
        x = self.relu(x)
        
        x = self.conv3(x) * torch.sigmoid(self.gate3(x))
        x = self.relu(x)
        
        # Flatten
        out_tensor = x   # Used as condition later
        flat = x.view(-1, 96 * 107)
        out_vector = self.fc(flat)
        
        return out_vector, out_tensor

# ==========================================
# 4. Affinity Predictor Module
# ==========================================
class AffinityPredictor(nn.Module):
    def __init__(self, input_dim, hidden_dims=[1024, 512, 256], dropout=0.3):
        super().__init__()
        layers = []
        curr_dim = input_dim
        for h_dim in hidden_dims:
            layers.append(nn.Linear(curr_dim, h_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            curr_dim = h_dim
        layers.append(nn.Linear(curr_dim, 1))
        
        self.net = nn.Sequential(*layers)

    def forward(self, drug_feat, protein_feat):
        combined = torch.cat((drug_feat, protein_feat), dim=1)
        return self.net(combined)

# ==========================================
# 5. Transformer Decoder Module
# ==========================================
class UnifiedDecoder(nn.Module):
    def __init__(self, d_model, nhead, num_layers, vocab_size):
        super().__init__()
        self.d_model = d_model
        
        # Native PyTorch Transformer Decoder
        decoder_layer = nn.TransformerDecoderLayer(d_model=d_model, nhead=nhead)
        self.transformer_decoder = nn.TransformerDecoder(decoder_layer, num_layers=num_layers)
        
        self.fc_out = nn.Linear(d_model, vocab_size)
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoder = PositionalEncoding(d_model)

    def forward(self, tgt, memory, tgt_mask=None, memory_mask=None, tgt_key_padding_mask=None, memory_key_padding_mask=None):
        # tgt: [Seq_len, Batch] (if batch_first=False)
        # memory: [Seq_len, Batch, Dim]
        
        tgt_emb = self.embedding(tgt) * math.sqrt(self.d_model)
        tgt_emb = self.pos_encoder(tgt_emb)
        
        output = self.transformer_decoder(
            tgt_emb, 
            memory, 
            tgt_mask=tgt_mask,
            memory_mask_key_padding_mask=memory_mask # logic needs check for specific pytorch version arg names
        )
        return self.fc_out(output)

# ==========================================
# 6. Unified Model
# ==========================================
class DeepDTAGenUnified(nn.Module):
    def __init__(self, tokenizer):
        super().__init__()
        
        # Hyperparameters (matching reference)
        self.hidden_dim = 376
        self.output_dim = 128
        self.protein_features = 25
        self.num_filters = 32
        self.kernel_size = 8
        self.heads = 8
        self.layers = 8
        self.max_len = 128
        
        # Tokenizer info
        self.tokenizer = tokenizer
        self.vocab_size = len(tokenizer)
        self.sos_token = tokenizer.s2i.get('<sos>', 0)
        self.eos_token = tokenizer.s2i.get('<eos>', 1)
        self.pad_token = tokenizer.s2i.get('<pad>', 2)

        # 1. Protein Encoder
        self.protein_encoder = GatedCNN(
            vocab_size=self.protein_features, 
            num_filters=self.num_filters, 
            embed_dim=self.output_dim, 
            output_dim=self.output_dim, 
            kernel_size=self.kernel_size
        )

        # 2. Drug Graph Encoder
        self.drug_encoder = GraphEncoder(
            in_features=94, 
            hidden_dim=self.hidden_dim, 
            output_dim=self.output_dim
        )

        # 3. Affinity Predictor
        self.affinity_predictor = AffinityPredictor(
            input_dim=self.output_dim * 2
        )

        # 4. Latent Fusion / Decoder Prep
        self.zz_seg_encoding = nn.Parameter(torch.randn(self.hidden_dim))
        
        # Reference used a TransformerEncoder just to process the latent vector? 
        # Yes, "self.dencoder". Let's instantiate a small encoder for that.
        encoder_layer = nn.TransformerEncoderLayer(d_model=self.hidden_dim, nhead=self.heads)
        self.latent_transformer = nn.TransformerEncoder(encoder_layer, num_layers=self.layers)

        # 5. Decoder (Generation)
        # Note: We use native PyTorch decoder logic
        decoder_layer = nn.TransformerDecoderLayer(d_model=self.hidden_dim, nhead=self.heads)
        self.decoder = nn.TransformerDecoder(decoder_layer, num_layers=self.layers)
        
        self.word_embedding = nn.Embedding(self.vocab_size, self.hidden_dim)
        self.pos_encoder = PositionalEncoding(self.hidden_dim)
        self.word_predictor = nn.Linear(self.hidden_dim, self.vocab_size)

    def expand_and_fuse(self, z_latent, mask, seq_features):
        """Prepare latent variable for the decoder"""
        # z_latent: [1, Batch, Dim] (from reparameterize usually)
        # seq_features: [Seq, Batch, Dim] (from drug graph)
        
        zzs = z_latent + self.zz_seg_encoding
        
        # Concat along sequence dimension: [Seq_graph + Seq_latent, Batch, Dim]
        # In reference: zzz = torch.cat((vvs, zzs), dim=0)
        # vvs is seq_features
        
        # Ensure zzs has batch dim
        if zzs.dim() == 2:
           zzs = zzs.unsqueeze(0)
           
        zzz = torch.cat((seq_features, zzs), dim=0)
        
        # Prepare Mask
        # mask is [Batch, Seq_graph]. We need to append False (unmasked) for the latent tokens
        # We added 1 latent token per sequence roughly (or same shape as zzs)
        # Reference: full_mask = torch.cat((pp_mask, full_mask), dim=1) 
        # Note: PyTorch Transformer expects mask [Batch, Key_Seq_Len] (bool) or [Key_Seq, Key_Seq] (float) 
        
        bsz = mask.size(0)
        latent_len = zzs.size(0) - seq_features.size(0)
        latent_mask = torch.zeros(bsz, latent_len, dtype=torch.bool, device=mask.device)
        
        full_mask = torch.cat([mask, latent_mask], dim=1)
        
        # Run through latent transformer (dencoder in reference)
        # Note: PyTorch Transformer encoder expects [Seq, Batch, Dim] and src_key_padding_mask=[Batch, Seq]
        zzz_encoded = self.latent_transformer(zzz, src_key_padding_mask=full_mask)
        
        return zzz_encoded, full_mask

    def forward(self, data):
        # 1. Protein Encoding
        protein_vec, protein_con = self.protein_encoder(data.target)
        
        # 2. Drug Graph Encoding
        # Note: GraphEncoder expects 'con' (protein condition) for VAE
        seq_features, z_latent, mask, drug_vec, kl_loss = self.drug_encoder(
            data.x, data.edge_index, data.batch, data.c_size, protein_con
        )
        
        # 3. Affinity Prediction Branch
        affinity_pred = self.affinity_predictor(drug_vec, protein_vec)
        
        # 4. Drug Generation Branch (Training/Teacher Forcing)
        # Prepare latent memory for decoder
        memory, memory_key_padding_mask = self.expand_and_fuse(z_latent, mask, seq_features)
        
        # Prepare Targets
        targets = data.target_seq
        # Shift inputs for teacher forcing: inputs=[:-1], targets=[1:]
        tgt_inp = targets[:, :-1].transpose(0, 1) # [Seq, Batch]
        tgt_out = targets[:, 1:].transpose(0, 1)  # [Seq, Batch]
        
        # Embed and Pos Encode
        tgt_emb = self.word_embedding(tgt_inp) * math.sqrt(self.hidden_dim)
        tgt_emb = self.pos_encoder(tgt_emb)
        
        # Causal Mask
        tgt_seq_len = tgt_inp.size(0)
        tgt_mask = nn.Transformer.generate_square_subsequent_mask(tgt_seq_len).to(tgt_inp.device)
        
        # Decoder Forward
        output = self.decoder(
            tgt_emb, 
            memory, 
            tgt_mask=tgt_mask, 
            memory_key_padding_mask=memory_key_padding_mask
        )
        
        token_logits = self.word_predictor(output)
        
        return affinity_pred, token_logits, tgt_out, kl_loss

    @torch.no_grad()
    def generate(self, data, max_len=128):
        """Inference / Generation Mode"""
        # Encode
        _, protein_con = self.protein_encoder(data.target)
        seq_features, z_latent, mask, _, _ = self.drug_encoder(
            data.x, data.edge_index, data.batch, data.c_size, protein_con
        )
        
        # Memory
        memory, memory_mask = self.expand_and_fuse(z_latent, mask, seq_features)
        
        batch_size = memory.size(1)
        
        # Start Token
        curr_tokens = torch.full((1, batch_size), self.sos_token, dtype=torch.long, device=data.x.device)
        
        generated_seqs = torch.zeros(batch_size, max_len, dtype=torch.long, device=data.x.device)
        
        finished = torch.zeros(batch_size, dtype=torch.bool, device=data.x.device)
        
        for i in range(max_len):
            # Embed
            tgt_emb = self.word_embedding(curr_tokens) * math.sqrt(self.hidden_dim)
            tgt_emb = self.pos_encoder(tgt_emb)
            
            # Mask
            seq_len = tgt_emb.size(0)
            tgt_mask = nn.Transformer.generate_square_subsequent_mask(seq_len).to(tgt_emb.device)
            
            # Decode
            out = self.decoder(tgt_emb, memory, tgt_mask=tgt_mask, memory_key_padding_mask=memory_mask)
            
            # Get last token logits
            last_token_logits = self.word_predictor(out[-1, :, :])
            
            # Greedy Decode
            next_token = torch.argmax(last_token_logits, dim=-1) # [Batch]
            
            generated_seqs[:, i] = next_token
            
            # Update finished status
            finished |= (next_token == self.eos_token)
            
            if finished.all():
                break
                
            # Append for next step
            curr_tokens = torch.cat([curr_tokens, next_token.unsqueeze(0)], dim=0)
            
        return generated_seqs

if __name__ == '__main__':
    print("Initializing Unified DeepDTAGen Model...")
    # Mock Tokenizer for testing
    class MockTokenizer:
        def __init__(self):
            self.s2i = {'<sos>': 0, '<eos>': 1, '<pad>': 2}
        def __len__(self): return 100
        
    model = DeepDTAGenUnified(MockTokenizer())
    print("Model created successfully.")
    print(model)
