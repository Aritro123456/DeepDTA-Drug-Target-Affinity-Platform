# CAND-002 Validation Report

Finding: Model-service token authentication fails open when token is unset.

Rubric:
- [x] Security control depends on environment variable.
- [x] Missing value disables authentication rather than failing closed.
- [x] Protected endpoints perform expensive or operational actions.
- [x] Counterevidence reviewed for Compose deployment.

Evidence:
- `services/model_service.py:40` defaults token to empty string.
- `services/model_service.py:47` enters token comparison only when the token is truthy.
- `services/model_service.py:168`, `services/model_service.py:208`, and `services/model_service.py:262` decorate prediction, generation, and unload.
- `docker-compose.yml` requires `MODEL_SERVICE_TOKEN`, which mitigates Compose but not manual/non-Compose deployment.

Disposition: reportable.
Confidence: medium-high.
