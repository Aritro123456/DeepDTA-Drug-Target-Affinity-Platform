# Finding Discovery Report

Candidates promoted:
- CAND-001: Hardcoded local service secrets in checked-in start scripts.
- CAND-002: Model service token authentication fails open when `MODEL_SERVICE_TOKEN` is unset.

Candidate families checked and suppressed:
- Missing auth/IDOR on notebook routes: suppressed because routes require login and load by owner.
- CSRF on state changes: suppressed because middleware enforces `X-CSRF-Token`.
- Dataset download traversal: suppressed because only exact public filenames are allowed.
- XSS in frontend rendering: suppressed because React rendering is used and no surviving raw `innerHTML` insertion of user data was found.
- Open Docker database exposure: suppressed because Postgres is not published to host.
- Frontend dependency vulnerabilities: suppressed because `npm audit --json` returned zero vulnerabilities.
