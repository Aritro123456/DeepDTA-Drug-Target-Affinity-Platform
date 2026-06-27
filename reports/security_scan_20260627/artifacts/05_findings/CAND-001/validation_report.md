# CAND-001 Validation Report

Finding: Hardcoded local service secrets in start scripts.

Rubric:
- [x] Secret-like value exists in committed/runtime script.
- [x] Value protects an actual security boundary.
- [x] Script is inside the project and can be uploaded to GitHub.
- [x] Safer env-based path exists elsewhere.

Evidence:
- `start_backend_light.bat:8` contains a fixed Flask secret.
- `start_backend_light.bat:10` contains a fixed model-service token.
- `start_model_service.bat:7` contains the same fixed model-service token.
- `docker-compose.yml` expects these values from environment variables instead.

Disposition: reportable.
Confidence: high.
