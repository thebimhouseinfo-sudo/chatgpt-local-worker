# CAD Fix SOP

1. Inspect the confirmed CAD/LISP source and any mapping/reference files.
2. Identify the smallest deterministic change that satisfies the task.
3. Preserve existing command names, layer conventions, and workflow unless the task explicitly changes them.
4. Use the core patch/filesystem/git tools for source edits.
5. Run available syntax/static checks and inspect the final diff.
6. Write outputs only to the confirmed destination.
7. Do not create CAD behavior that is not specified by the source rules or the user.
