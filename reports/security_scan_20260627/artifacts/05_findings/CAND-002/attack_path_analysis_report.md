# CAND-002 Attack Path Analysis

Attack path:
1. Operator starts or deploys `services/model_service.py` without `MODEL_SERVICE_TOKEN`.
2. Service code treats the missing token as no-auth mode.
3. Any client that can reach the model service can call `/predict`, `/generate`, or `/unload`.
4. Attacker can consume compute or unload the model directly.

Severity: Medium.
Policy decision: report.

Counterevidence:
Compose deployment requires the token. Severity is medium because the default/manual service code is fail-open, but the main Compose path has a compensating environment requirement.
