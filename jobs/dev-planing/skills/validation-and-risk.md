# Skill — Validation & Risk Planning

Define how implementation success will be demonstrated before coding starts.

Plan validation in layers:
- focused regression/unit tests for changed behavior;
- type/lint/static checks relevant to the changed surface;
- affected package/module suites;
- build/package/startup smoke checks when integration is affected;
- migration/rollback verification for persistent or deployment changes;
- manual verification only where automation is not practical.

List material risks separately from ordinary implementation steps. Include compatibility, data loss, auth/security, concurrency, performance/resource, deployment, and external-service risk only when relevant.

Open questions are not risks. Keep unresolved decisions under **Open Questions** so the coding job does not silently guess them.
