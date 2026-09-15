# Skill — Security Review

Use when changes touch authentication/authorization, secrets, untrusted input, filesystem paths, shell/process execution, network requests, deserialization, uploads, crypto, permissions, or dependency supply chain.

## Boundary review

Check whether untrusted data can reach command execution, queries/templates, filesystem/archive paths, HTML/URLs/redirects, network destinations, parsers/deserializers, authorization decisions, logs, or secrets/config.

Prefer structured APIs and allowlists over string concatenation. Normalize/validate at the boundary that owns the contract.

## Authorization and secrets

Authentication does not imply authorization. Enforce authorization at the server-side resource/action boundary. Never commit credentials/private keys/session tokens/local `.env` values or log secret-bearing payloads. Preserve least privilege when changing scopes/permissions.

## Security-sensitive fixes

Do not resolve failures by disabling verification, widening CORS/auth rules, swallowing validation errors, or adding insecure fallback behavior unless the user explicitly requires a documented tradeoff.

Run repository security/static checks when they already exist and are relevant. Report any unvalidated area.
