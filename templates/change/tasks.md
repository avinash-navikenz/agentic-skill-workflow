# Tasks — {{CHANGE}}

Each task names the requirement it implements. A task with no `Implements:`
line fails traceability.

Write one list item per task, in this shape:

- [ ] **TASK-###** <description>
  - Implements: REQ-###

`###` is a placeholder, not a number to copy. It stays `###` on purpose: a
bold task id carrying real digits, with an `Implements:` line naming a real
requirement id, is read by `navi-delivery validate` as a live task — and in
a freshly proposed change no spec declares that requirement yet, so the
change failed T3 and could not be archived before anyone had touched it.
Replace both placeholders with real three-digit numbers only when the task
and the requirement are real.
