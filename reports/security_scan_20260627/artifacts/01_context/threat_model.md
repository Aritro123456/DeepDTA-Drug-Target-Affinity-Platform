# DeepDTA Threat Model

Primary assets:
- User accounts and session cookies.
- Saved notebooks and uploaded datasets.
- Local `.env` secrets such as Gemini API key, Flask secret key, database password, and model-service token.
- Model service compute resources and model artifacts.
- Notebook execution sandbox isolation boundary.

Trust boundaries:
- Browser to Flask backend over HTTP with cookie sessions and CSRF token.
- Flask backend to model service using `X-Model-Service-Token`.
- Flask backend to sandbox executor for notebook code execution.
- Flask backend to database.
- User-uploaded datasets/notebooks crossing into backend runtime storage.

Attacker-controlled inputs:
- Login/register fields.
- SMILES strings, protein sequences, notebook content, uploaded files, notebook names/content, and API query parameters.
- Any public request reaching Docker-published ports or manual service processes.

Important invariants:
- Backend routes that access user data must authenticate sessions and enforce object ownership.
- State-changing routes must require CSRF tokens.
- Service-to-service routes must not be callable by untrusted clients.
- Uploaded files must not expose internal paths or overwrite trusted files.
- Notebook execution must not run in the main backend process or with host filesystem/secrets access.
- Secrets must not be committed to source control.
