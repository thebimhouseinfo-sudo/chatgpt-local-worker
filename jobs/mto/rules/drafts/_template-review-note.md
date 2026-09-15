# Draft Rule Template Review Note

The draft rules in this directory were reviewed against the currently available schedule templates before being written.

Template samples are treated as **layout/schema evidence only**, not as authoritative project engineering values. Where a template sample conflicts with equipment semantics or appears copied from another schedule, the draft rule records the defect explicitly instead of inheriting the sample as a default.

Draft rules are **runnable development rules**. They are intentionally used on real projects with a mandatory `DRAFT / NOT FINAL` warning so implementation evidence can expose incorrect assumptions and improve the rule.

Real project implementation remains the authority for promoting a draft rule from `draft` to `stable`. Promotion removes the mandatory draft warning; it is not the point at which the rule first becomes usable.
