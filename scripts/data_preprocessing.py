import pandas as pd
from rdkit import Chem

def validate_and_canonicalize_smiles(smiles):
    if pd.isna(smiles):
        return None

    smiles = str(smiles).strip()
    if smiles == "":
        return None

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    canonical = Chem.MolToSmiles(mol, canonical=True)
    return canonical

file_path = 'bindingdb_highconf_pKd_clean.csv'
df = pd.read_csv(file_path)
print("Dataset loaded successfully!")
print(f"Shape: {df.shape}")
print("\nFirst 5 rows:")
print(df.head())
print("\nColumns:")
print(df.columns.tolist())

required_cols = ["compound_iso_smiles", "target_sequence", "affinity"]
df_clean = df.dropna(subset=required_cols)

print(f"Shape after removing missing values: {df_clean.shape}")

df_clean = df_clean.drop_duplicates(subset=["compound_iso_smiles", "target_sequence", "affinity"]
)

print(f"Shape after removing duplicates: {df_clean.shape}")

print("Starting SMILES canonicalization")
df_clean["canonical_smiles"] = df_clean["compound_iso_smiles"].apply(validate_and_canonicalize_smiles)

df_clean = df_clean.dropna(subset=["canonical_smiles"]).reset_index(drop=True)

df_clean["compound_iso_smiles"] = df_clean["canonical_smiles"]
df_clean = df_clean.drop(columns=["canonical_smiles"])

print(f"Dataset shape after SMILES preprocessing: {df_clean.shape}")
print(df_clean.head())
df_clean.to_csv("bindingdb_highconf_pKd_clean_canonical.csv", index=False)


