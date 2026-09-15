# HVAC Takeoff

## Goal
Produce a traceable HVAC takeoff from explicitly supplied source files and an explicitly resolved output destination.

## Scope
This pack orchestrates the existing MCP core. It does not define project-specific quantity rules by itself.

## Completion criteria
- The source path is concrete and accessible.
- The result path is concrete.
- Relevant source files used for the takeoff are identified.
- Every reported quantity/specification is traceable to source evidence or is marked unresolved.
- No missing model/specification/quantity is silently invented.
- Pack validators pass.
