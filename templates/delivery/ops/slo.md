# Service level objectives

> Every shipped capability has at least one `SLI-###` here. G8-OPERATE reads this file by path.
> An SLI with no objective is a chart; an objective with no error budget is a wish; a budget
> with no alert ahead of it is discovered after it is spent.

Each entry carries all five fields. Numbering is sequential and never reused: an SLI whose
definition changes keeps its id and gains a row in `## History`; a retired SLI is marked
`retired` with a date rather than deleted.

## SLIs

### SLI-001 — <what the user experiences, named as the user would name it>

- **Measures:** <the ratio or quantity, and where it is read from>
- **Objective:** <number, unit, and the rolling window it holds over>
- **Error budget:** <what quantity of failure the objective permits over that window>
- **Alerts before the budget burns:** <the alert, its condition, and how much of the window
  it leaves>
- **Runbook:** `delivery/ops/runbooks/<alert>.md`

## Capability coverage

| Capability | SLIs | If none, why |
|---|---|---|
| <capability> | SLI-001 | — |

## History

| Date | SLI | Change |
|---|---|---|
