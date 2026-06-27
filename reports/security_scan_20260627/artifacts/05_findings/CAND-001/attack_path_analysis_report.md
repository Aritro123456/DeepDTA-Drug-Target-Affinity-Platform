# CAND-001 Attack Path Analysis

Attack path:
1. Project files are uploaded to GitHub or shared.
2. Attacker reads the fixed values in the start scripts.
3. If those values are reused locally or in deployment, attacker can forge service requests or session material depending on exposure.

Severity: Medium.
Policy decision: report.

Counterevidence:
Docker Compose already uses environment variables and `.env` is ignored. Severity is medium, not high, because exploitation requires the checked-in local values to be reused in a reachable environment.
