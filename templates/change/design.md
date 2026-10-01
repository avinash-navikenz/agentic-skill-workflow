# Design — {{CHANGE}}

> G3-DESIGN is read against this file. Every heading below is one of G3's exit criteria, so a
> heading left with its placeholder is a criterion nobody answered. Fill each section in place;
> do not append a second copy of a heading that already exists here.

## Approach
<the technical shape; link ADR-### for anything consequential>

## Alternatives rejected
<what was considered and why it lost>

## Decisions
<one row per consequential decision. A choice with no rival option is not an ADR — state that
constraint under Approach instead. Written under `navi-skill-decision-records`.>

| ADR | Decision | What it binds |
|---|---|---|
| ADR-### | <the choice made> | <the component or contract it constrains> |

## Interface contracts
<one `CONTRACT-###` entry per boundary this design draws, each with all nine fields.
Written under `navi-skill-interface-contracts`.>

## Quality attributes
<the total-order ranking, then one `QAS-###` scenario per attribute with all six fields.
Written under `navi-skill-quality-attributes`.>

## Failure modes
<every failure mode this design identifies, each with the behaviour when it occurs. A failure
mode with no stated behaviour is an outage whose shape nobody has chosen.>

| Failure mode | Behaviour when it occurs | Detected by |
|---|---|---|

## Threat model
<link `delivery/changes/{{CHANGE}}/threat-model.md` by path. Written under
`navi-skill-threat-modelling`.
On `express` and `hotfix`, where G3 is not enforced, rename this heading `## Reach` and state
here what this change newly lets someone see or do and from which of the four access levels —
G6 is enforced by every lane and exercises that statement.>

## Risks
<what could go wrong and the mitigation>

## Linked artifacts
<every change-scoped document this design depends on, by path. This table is the one place a
design links out from; a skill that produces a change-scoped artifact adds a row here rather
than a heading of its own.>

| Artifact | Path | Written under |
|---|---|---|
