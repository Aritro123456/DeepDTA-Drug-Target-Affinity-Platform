# DeepDTA Security Scan Report

Date: 2026-06-27
Scope: `C:\Aritro_Personal_Study\Minor_Project\Codes\DeepDTA`

## Summary

Two reportable issues survived validation:

1. Medium: hardcoded local service secrets in start scripts.
2. Medium: model-service token authentication fails open when `MODEL_SERVICE_TOKEN` is unset.

Validated as not currently reportable: open CORS, missing CSRF, notebook IDOR, raw dataset path traversal, old frontend XSS hotspots, npm dependency vulnerabilities, Docker DB exposure, and public model prediction without authentication. Those previously reported issues now have compensating controls in the reviewed code.

## Findings

### CAND-001: Hardcoded local service secrets in start scripts

Severity: Medium
CWE: CWE-798

Affected locations:
- `start_backend_light.bat:8` sets a fixed `FLASK_SECRET_KEY`.
- `start_backend_light.bat:10` sets a fixed `MODEL_SERVICE_TOKEN`.
- `start_model_service.bat:7` sets the same fixed `MODEL_SERVICE_TOKEN`.

Attack path:
If these scripts are committed or shared, anyone with the repository can learn the backend session secret and the model-service bearer token used by local runs. The token is the boundary between the Flask backend and the model service, and the Flask secret protects signed session cookies. This is especially risky because the user has repeatedly discussed GitHub upload/deployment.

Counterevidence:
Docker Compose correctly requires these values from environment variables, and `.env` is ignored by git/Docker. The issue is specific to the checked-in `.bat` scripts.

Recommendation:
Remove literal secrets from the scripts. Load them from `.env`, generate them if missing for local-only use, or fail with a clear message. Do not commit real or reusable service tokens.

### CAND-002: Model-service token auth fails open if token is missing

Severity: Medium
CWE: CWE-306

Affected locations:
- `services/model_service.py:40` defaults `MODEL_SERVICE_TOKEN` to an empty string.
- `services/model_service.py:47` only checks the token if a token is configured.
- `services/model_service.py:168`, `services/model_service.py:208`, and `services/model_service.py:262` protect prediction/generation/unload with the fail-open decorator.
- `backend/config.py:22` and `backend/services/model_client.py:21` similarly allow backend calls without a token when the variable is absent.

Attack path:
If the model service is deployed or started with `MODEL_SERVICE_HOST=0.0.0.0` but without `MODEL_SERVICE_TOKEN`, prediction, generation, and unload endpoints become callable without service authentication. An attacker who can reach the service can consume heavy model CPU/memory and call operational endpoints directly.

Counterevidence:
`docker-compose.yml` uses `${MODEL_SERVICE_TOKEN:?set ...}`, so the Compose deployment fails if the token is missing. The local scripts also set a token. The weakness is in the service code itself and any non-Compose/manual deployment.

Recommendation:
Fail closed. Refuse to start the model service unless `MODEL_SERVICE_TOKEN` is set to a sufficiently long value, except behind an explicit `MODEL_SERVICE_ALLOW_INSECURE_LOCAL=true` development override bound to `127.0.0.1`.

## Reviewed Surfaces

- Flask app setup, CORS, session cookies, CSRF middleware, and rate limiting.
- Auth routes: register, login, csrf-token, me, logout.
- Dataset upload and `/data/raw` download controls.
- Notebook upload, save/list/load ownership, and sandbox execution handoff.
- Model proxy routes and model-service token handling.
- Molecule/protein visualization input limits and rate limits.
- Docker Compose ports, environment requirements, networks, volumes, and resource limits.
- React API client, auth context, localStorage usage, and DOM insertion patterns.
- Frontend dependency audit with `npm audit --json`.

## Validation Notes

- `npm audit --json` returned zero vulnerabilities.
- `.env` and `.env.*` are ignored by the root `.gitignore` and `.dockerignore`.
- Dataset downloads are allowlisted to `davis-filter.txt` and `kiba.txt`.
- Notebook routes require login and load notebooks by owner.
- Prediction/generation routes require login at the backend.
- CSRF protection covers state-changing routes except login/register/csrf-token.
- The old legacy frontend folder was deleted before this scan.
