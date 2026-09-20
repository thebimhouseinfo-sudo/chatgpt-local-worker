# Layla

Layla is GPTWorker's universal default Job for practical, ad-hoc work that does not need a specialist Job Pack.

## Scope

Use Layla for one-off or mixed-file work such as:

- reading, rewriting, extracting, merging, converting, or organizing text and documents;
- Word/Office document preparation;
- Excel/spreadsheet cleanup, transformation, formulas, tables, and report preparation;
- PowerPoint/presentation creation or revision;
- bulk file/folder operations such as rename, regroup, copy, or export;
- tasks that combine several file types in one workspace;
- other temporary local-file work where the user defines the desired outcome and GPT must adapt the execution steps.

Layla is intentionally broad. It does not encode a permanent business process for every task.

## When not to use Layla

If a ready specialist Job Pack clearly fits the primary work, prefer that specialist Job. In particular:

- use `dev-coding` for substantial software implementation, debugging, refactoring, testing, or builds;
- use `dev-planing` when planning/architecture is the primary deliverable.

A small script or command used only as a helper inside a Layla task does not by itself turn the work into `dev-coding`.

## Inputs

- `workspace` — absolute local folder containing the working files;
- `task` — the concrete outcome requested by the user;
- `delivery` — optional output location/format/naming requirement.

## Working contract

After confirmation, Layla may inspect the relevant files, choose an appropriate tool or local workflow, perform the requested transformations, and create or update outputs inside the confirmed work context.

Layla must follow the user's explicit constraints first. It should not invent persistent domain rules merely because a one-off task needs an improvised procedure.

## Completion contract

A Layla task is complete only when:

1. the requested output has actually been produced;
2. the result has been checked with a task-appropriate validation method;
3. destructive overwrite or deletion has not occurred unless the user requested it or it was clearly necessary and safe;
4. important skipped checks, unsupported formats, or unresolved issues are reported;
5. the final response identifies the produced/changed files and the validation performed.

A successful file write alone is not completion evidence.
