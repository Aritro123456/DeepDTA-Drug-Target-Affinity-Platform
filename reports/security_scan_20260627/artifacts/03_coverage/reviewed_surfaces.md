# Reviewed Surfaces

Reportable:
- `start_backend_light.bat` and `start_model_service.bat`: hardcoded local secrets.
- `services/model_service.py` and `backend/services/model_client.py`: token auth fail-open when unset.

Suppressed / not reportable after validation:
- CORS is restricted by configured origins in `backend/app.py` and `backend/config.py`.
- CSRF middleware protects POST/PUT/PATCH/DELETE except login/register/csrf-token.
- Notebook ownership checks use `user.id` and reject cross-user load by ID.
- `/data/raw` downloads are filename allowlisted.
- Dataset upload returns opaque dataset metadata, not absolute paths.
- Prediction/generation backend routes require login and have rate limits.
- `/check`, `/molecule`, and `/visualize/protein` have input caps/rate limits; protein visualization requires login.
- Docker Compose binds frontend/backend to `127.0.0.1` and does not publish Postgres.
- React frontend uses React rendering; no surviving raw `innerHTML` insertion of user/server data was found.
- `npm audit --json` reported zero frontend dependency vulnerabilities.
