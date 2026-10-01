---
name: navi-skill-model-registry-and-promotion
description: >
  Use when a model artifact has to move toward or away from serving traffic, when G7 asks
  whether the model version is registered and the promotion criteria met, or when a rollback
  has to be decided. Defines the promotion criteria file written before any candidate is
  scored, the PROMO-### entry, the append-only registry, the four stages, the reproducibility
  precondition and the rollback record.
  Trigger phrases include: model registry, promote model, promotion criteria, model version,
  staging to production, model rollback, shadow traffic, canary, retire model, what is
  serving, model provenance, reproducible training run, G7 model release.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: mlops
  lifecycle_phases: [4, 7]
  used_by_agents: [navi-agent-mlops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "mlops, registry, promotion, reproducibility, rollback, stages, g7"
  model: sonnet
---

## When to use

A model artifact exists and a stage decision is due; G7 is about to be recorded for a
model-bearing change; a rollback is being considered; or someone is asking what is serving
traffic and why it replaced what was there before.

## Rules

1. Write the promotion criteria at
   `delivery/changes/<name>/specs/models/<model>/promotion.md` **before any candidate has been
   scored**, and record the date. `navi-delivery archive` folds `changes/<name>/specs/` into
   `delivery/specs/`, so the criteria stay current truth for every later promotion of the same
   model.
2. Record a criterion added after a candidate's score as a dated amendment, and re-evaluate the
   candidate that motivated it against the whole amended set from the start. A criterion
   chosen knowing the score is not a criterion; it is a description of the score that passed.
3. Give every `PROMO-###` four fields: `Criterion`, `Measured by` (an `EVAL-###`, an `SLI-###`,
   or a named command), `Threshold`, `Blocking` (`yes` or `no`). There is no third value:
   "advisory" is `no`, and a criterion nobody would ever hold a release for is not a criterion.
4. Cover five at minimum: aggregate quality against the incumbent, every `SLICE-###` against
   the incumbent, inference latency at a stated percentile, inference cost per 1,000
   predictions, and the presence of a current model card at the candidate's exact version.
5. Fail a candidate that regresses any `SLICE-###` beyond that slice's interval, even where the
   aggregate improves. That criterion is `Blocking: yes` and it is evaluated mechanically, not
   argued at the promotion meeting.
6. Register before promoting. Every artifact that could serve traffic has an entry in
   `delivery/ops/models/<model>/registry.md` naming: the model name, the version, the training
   run identifier, the code commit, the `DC-###` versions, the `EVAL-###` results, the model
   card path, and the stage.
7. Use exactly four stages: `candidate`, `staging`, `production`, `retired`. Movement is one
   step at a time, forward only — `candidate → staging → production`, and any stage →
   `retired`. A rollback is not a backwards move: it is a fresh promotion of a previously
   retired version, with its own record and its own approver.
8. Refuse promotion to `production` of an artifact whose training run cannot be re-executed
   from the recorded commit, `DC-###` versions and seed. Where such an artifact is already
   serving, record that fact in the registry and escalate through
   `navi-skill-human-checkpoints` — it is a model that cannot be fixed under pressure.
9. Refuse promotion of a candidate whose test set was read more than once.
   `navi-skill-evaluation-design` requires every read logged; more than one read for the same
   candidate means the reported score is the best of several draws and will not reproduce.
10. Treat promotion as a human checkpoint. gates.md requires release approval by a named human
    for G7; the promotion record names the approver, their role and the date, and
    `navi-skill-human-checkpoints` governs how the approval is obtained.
11. Append to the registry, never edit it. The register answers "what was serving on the 14th",
    and that answer is destroyed by an in-place correction. A mistake is corrected by appending
    a dated entry that says what was wrong.
12. Record in every promotion what it replaced and how to put it back: the previous version,
    the exact command, and a **measured** time to restore from a rehearsal. gates.md requires
    the rollback path exercised with a known time-to-restore; for a model, rehearsing means
    re-promoting the previous version in a non-production environment and timing it, not
    describing what would happen.
13. Name the rollback target explicitly where the previous version is stale or its feature
    pipeline has moved. Where the safest state is the non-model path, say so and state what the
    system does with no model serving — that sentence is the one the on-call engineer reads.
14. State the exposure method and its duration: `shadow` (traffic mirrored, output discarded),
    `canary` (a stated traffic fraction), or `offline-only`, with the fraction and the window.
    A promotion with no stated exposure method was a deployment.
15. Retire explicitly, with a date. A version left at `production` that nothing serves makes
    the register a guess, and the guess is consulted during an incident.
16. Pass G7 with one file. `navi-delivery gate` accepts exactly one `--evidence` value and
    checks only that it resolves, while G7's evidence list names the pipeline run record, the
    rollback rehearsal and the approval. Write
    `delivery/changes/<name>/evidence/g7-promotion.md` as an index linking the registry entry,
    the model card, the evaluation and the rehearsal, and pass that path.

## Decision table

| Observed condition | Required action |
|---|---|
| A candidate has been scored and no criteria file exists | Stop — write the criteria, then re-score against them from the start |
| A criterion is being added after a score is known | Dated amendment; the candidate is re-evaluated against the whole set |
| A criterion nobody would hold a release for | Not a criterion — delete it or mark it `Blocking: no` and expect it ignored |
| The aggregate improves and one `SLICE-###` regresses beyond its interval | Refuse promotion; `Blocking: yes` |
| The training run cannot be re-executed | Refuse promotion to `production`; escalate if it is already serving |
| The candidate's test set was read twice | Refuse; re-evaluate on a fresh hold-out first |
| No model card exists at the candidate's exact version | Refuse; `navi-skill-model-cards` owns the card |
| The card's `## Identity` does not match the registry entry | Refuse; one of the two is describing a different artifact |
| A promotion is proposed with no named approver | Not a promotion — `navi-skill-human-checkpoints` governs the approval |
| The registry needs a correction | Append a dated entry saying what was wrong; never edit in place |
| The previous version is stale or its features have moved | Name the non-model path as the rollback target and state its behaviour |
| The rollback has never been executed anywhere | Rehearse it and record the measured restore time before G7 |
| The decision the model informs is expensive | `shadow` or `canary` before `production`, with the fraction and window stated |
| Exposure itself carries risk to a person | `offline-only`; state that no shadow or canary was run and why |
| A version has stopped serving | Move it to `retired` with a date |
| G7 is being recorded | Pass `evidence/g7-promotion.md`, the index — not the registry file |

## Template

The criteria, written before any candidate is scored, at
`delivery/changes/<name>/specs/models/theme-ranker/promotion.md`:

```markdown
# Promotion criteria — theme-ranker

Written 2026-09-18, before the first fit. Amended once — see `## Amendments`.

| Id | Criterion | Measured by | Threshold | Blocking |
|---|---|---|---|---|
| PROMO-001 | Beats the incumbent on the outcome the proposal names | EVAL-001 | 24h switch rate at or below 0.70 × the incumbent's | yes |
| PROMO-002 | Beats the best baseline on accuracy by more than the interval | EVAL-002 | Lower bound above BASELINE-003's upper bound | no |
| PROMO-003 | No slice regresses beyond its interval against the incumbent | Every `SLICE-###` in `evaluation.md` | Candidate's upper bound at or above the incumbent's point estimate, per slice | yes |
| PROMO-004 | Inference latency | `ml/bench/latency.py --model theme-ranker --percentile 99` | p99 at or below 12ms on the serving host | yes |
| PROMO-005 | Inference cost | `ml/bench/cost.py --model theme-ranker` | At or below 0.40 USD per 1,000 predictions | yes |
| PROMO-006 | A current model card exists at this exact version | `specs/models/theme-ranker/model-card.md` `## Identity` | Registry version matches the card's | yes |
| PROMO-007 | The training run re-executes from the recorded commit, data versions and seed | `ml/train.py --reproduce train-20260924-03` | Byte-identical artifact hash | yes |

PROMO-002 is `Blocking: no` deliberately: the framing already concluded that accuracy inside
the baseline's interval is "no difference", so the release is held on EVAL-001 — the outcome —
and not on a metric whose movement the team has agreed not to read as a win.

## Amendments

| Date | Change | Re-evaluated |
|---|---|---|
| 2026-09-26 | PROMO-004 added: p99 latency, 12ms. Added after version 6's shadow run showed 31ms p99, which nobody had set a bound for. | Version 6 re-evaluated against all seven criteria from the start; it fails PROMO-004 and PROMO-003. |
```

The registry, appended to at `delivery/ops/models/theme-ranker/registry.md`:

```markdown
# Registry — theme-ranker

Append-only. Corrections are appended, never edited in place.

## Version 7

- **Stage:** production (since 2026-10-02T09:14Z)
- **Training run:** `train-20260924-03`
- **Commit:** `a41f2c8`
- **Data:** DC-003@v2, DC-001@v4
- **Evaluation:** EVAL-001 0.191 [0.188, 0.194] · EVAL-002 0.859 [0.850, 0.868] (no difference
  vs BASELINE-003) · SLICE-007 0.792 [0.761, 0.823], no longer a regression
- **Model card:** `delivery/specs/models/theme-ranker/model-card.md` (`## Identity` version 7)
- **Criteria:** PROMO-001 pass · PROMO-002 fail (non-blocking) · PROMO-003 pass ·
  PROMO-004 pass (p99 9.1ms) · PROMO-005 pass (0.31 USD/1k) · PROMO-006 pass · PROMO-007 pass
- **Replaced:** version 6, retired 2026-10-02
- **Exposure:** canary at 5% of first renders for 72 hours from 2026-09-29, then 100%
- **Rollback:** `navi-delivery`-external —
  `ml/registry.py promote --model theme-ranker --version 6 --stage production`.
  Rehearsed 2026-09-30 in staging: **measured restore time 4m 12s**, from command to first
  request served by version 6.
- **Rollback target if version 6 is unusable:** the non-model path — BASELINE-003, the
  `prefers-color-scheme` header read with a local-hour fallback, which ships in the shell and
  needs no serving infrastructure. With no model serving, the shell renders BASELINE-003's
  choice and stores nothing extra.
- **Approved by:** Priya Raman, Head of Platform, 2026-10-02

## Version 6

- **Stage:** retired (2026-10-02)
- **Reason:** superseded by version 7. Its reported aggregate was inflated by LEAK-002, and it
  regressed SLICE-007 against BASELINE-003.
- **Training run:** `train-20260810-01` · **Commit:** `9c2e04b` · **Data:** DC-003@v1, DC-001@v4
- **Served:** 2026-08-11 to 2026-10-02
- **Approved by:** Priya Raman, Head of Platform, 2026-08-11
```

The G7 evidence index, at `delivery/changes/<name>/evidence/g7-promotion.md`:

```markdown
# G7 evidence — theme-persistence

- Registry entry: `delivery/ops/models/theme-ranker/registry.md` `## Version 7`
- Promotion criteria: `delivery/specs/models/theme-ranker/promotion.md` (7 criteria, 1 amendment)
- Model card: `delivery/specs/models/theme-ranker/model-card.md` (version 7)
- Evaluation: `delivery/specs/models/theme-ranker/evaluation.md`
- Rollback rehearsal: staging, 2026-09-30, measured 4m 12s
- Approval: Priya Raman, Head of Platform, 2026-10-02
```

Then the gate:

```bash
navi-delivery gate G7 --pass --evidence delivery/changes/theme-persistence/evidence/g7-promotion.md
# => G7 pass (evidence: delivery/changes/theme-persistence/evidence/g7-promotion.md)
```

## Checklist

- [ ] `promotion.md` is dated before the first candidate was scored
- [ ] Every criterion added later is a dated amendment, with the candidate re-evaluated in full
- [ ] Every `PROMO-###` has `Criterion`, `Measured by`, `Threshold` and `Blocking`
- [ ] The five minimum criteria are covered
- [ ] The per-slice criterion is `Blocking: yes`
- [ ] The registry entry names run, commit, `DC-###` versions, `EVAL-###` results, card path and stage
- [ ] The card's `## Identity` version matches the registry entry
- [ ] The stage is one of the four, and the move was one step forward
- [ ] The training run re-executes, or the promotion to `production` is refused
- [ ] The candidate's test set was read exactly once
- [ ] The registry was appended to, not edited
- [ ] The record names the previous version, the rollback command and a measured restore time
- [ ] The rollback was rehearsed, not described
- [ ] The rollback target is named where the previous version is stale or its features moved
- [ ] The exposure method and its fraction and window are stated
- [ ] Every version no longer serving is `retired` with a date
- [ ] The approver is a named person with a role and a date
- [ ] `evidence/g7-promotion.md` exists and links the registry, the card, the evaluation and the rehearsal

## Anti-patterns

**Criteria written after the score.** The candidate hits 0.859 and the criterion becomes "at
least 0.85". It will always be met, and the promotion decision was made by the number rather
than about it. Write the criteria before the first fit and date them.

**The aggregate-only gate.** One criterion: beat the incumbent on accuracy. The candidate is
two points better overall and eight points worse in one region, and nothing stops it. Make the
per-slice criterion blocking.

**Promotion as a deploy step.** The pipeline promotes whatever passed the tests, on merge.
There is no decision, no approver and no record of what was traded away. gates.md requires a
named human for G7; promotion is where that human decides.

**The unreproducible production model.** The artifact serves traffic; the training run was a
notebook on a laptop that has since been reimaged. Nothing can be fixed, retrained or
explained. Refuse promotion on it, and escalate where it is already serving.

**Rollback by belief.** `Rollback: re-promote the previous version.` It has never been done.
During the incident the previous version's feature pipeline has moved and it cannot load. Name
the non-model path, and rehearse the rollback with a stopwatch.

**The registry edited in place.** A wrong commit hash corrected by overwriting the line. The
question "what was serving on the 14th" now has a confident wrong answer. Append the correction.

**Everything at `production`.** Six versions all marked production because nobody retires
anything. During an incident the register is consulted and it does not know what is serving.
Retire with a date.

**Canary without a fraction.** `Rolled out gradually.` Nobody can say what share saw the new
model or for how long, so the canary's evidence cannot be read. State the fraction and the
window.

**The card that describes something else.** The registry says version 7, the card's
`## Identity` says version 6. One of them is wrong and the promotion meeting read the card.
Match all six identity facts before promoting.

## Validation

```bash
CHANGE=<name>
MODEL=<model>
P=$(find delivery/specs/models delivery/changes/$CHANGE/specs/models -name promotion.md 2>/dev/null | head -1)
R=delivery/ops/models/$MODEL/registry.md

# The criteria predate every candidate they judged. A version promoted BEFORE these
# criteria existed is not judged by them and carries no '**Criteria:**' line, so it is
# skipped — only versions that cite the criteria are checked against the written date.
python3 - "$P" "$R" <<'PYEOF'
import re, sys, pathlib
crit, reg = (pathlib.Path(a).read_text() for a in sys.argv[1:3])
w = re.search(r"Written (\d{4}-\d{2}-\d{2})", crit)
if not w:
    print("promotion.md records no 'Written <date>'")
    raise SystemExit
for entry in re.split(r"(?m)^## Version ", reg)[1:]:
    ver = entry.split(None, 1)[0]
    if "**Criteria:**" not in entry:
        continue
    run = re.search(r"train-(\d{4})(\d{2})(\d{2})", entry)
    if run and w.group(1) > "-".join(run.groups()):
        print(f"version {ver} was trained {'-'.join(run.groups())} but the criteria judging "
              f"it were written {w.group(1)} — the criteria follow the score")
PYEOF

# Every PROMO-### carries all four fields, and Blocking is yes or no
awk -F'|' '/^\| *PROMO-/ {
  if (NF < 6) { print "malformed criterion row: " $2; next }
  b=$6; gsub(/[ \t]/,"",b)
  if (b != "yes" && b != "no") print $2 ": Blocking is \"" b "\", not yes/no"
  for (i=3;i<=5;i++) { c=$i; gsub(/[ \t]/,"",c); if (c=="") print $2 ": empty field in column " i-1 }
}' "$P"

# The five minimum criteria are present by subject. The search is scoped to the PROMO rows'
# own columns and padded with a non-alphanumeric class, or 'card' is satisfied by
# "cardinality" and 'cost' by any use of the word in the surrounding prose. The padding is
# [^[:alnum:]] rather than \< \>, which the awk shipped with macOS matches never.
for k in incumbent slice latency cost card; do
  awk -F'|' -v k="$k" -v p="$P" '
    /^\| *PROMO-/ { row = " " tolower($3 " " $4 " " $5) " "
                    if (row ~ "[^[:alnum:]]" k "[^[:alnum:]]") hit = 1 }
    END { if (!hit) print p ": no PROMO criterion is about \"" k "\"" }' "$P"
done

# The per-slice criterion is blocking
awk -F'|' '/^\| *PROMO-/ && tolower($3) ~ /slice/ { b=$6; gsub(/[ \t]/,"",b); if (b!="yes") print "the per-slice criterion is not blocking" }' "$P"

# Every registry version names the mandatory facts
awk '/^## Version /{v=$3} /^- \*\*/{f[v]=f[v] $0 "\n"}
     END{for (v in f) {
       if (f[v] !~ /\*\*Stage:\*\*/)          print "version " v ": no Stage"
       if (f[v] !~ /\*\*Training run:\*\*/)   print "version " v ": no Training run"
       if (f[v] !~ /\*\*Commit:\*\*/)         print "version " v ": no Commit"
       if (f[v] !~ /\*\*Data:\*\*/)           print "version " v ": no Data versions"
       if (f[v] !~ /\*\*Approved by:\*\*/)    print "version " v ": no Approved by"
     }}' "$R"

# Every stage is one of the four
grep '\*\*Stage:\*\*' "$R" | grep -vE 'candidate|staging|production|retired'

# At most one version is at production
n=$(grep -c '\*\*Stage:\*\* production' "$R")
[ "$n" -le 1 ] || echo "$n versions are at stage production"

# The rollback restore time is measured, not described
grep -q 'measured restore time' "$R" || echo "$R: no measured rollback restore time"

# The registry was appended to, not rewritten
[ "$(git log --follow -p -- "$R" 2>/dev/null | grep -c '^-- \*\*')" = 0 ] \
  || echo "$R: a previous entry line was removed in a past commit — the register is not append-only"

# Every commit named in the registry exists
for c in $(grep '\*\*Commit:\*\*' "$R" | grep -o '`[0-9a-f]\{7,40\}`' | tr -d '`'); do
  git cat-file -e "$c^{commit}" 2>/dev/null || echo "registry names commit $c, which is not in this repository"
done

# The card's version matches the production entry
CARD=$(find delivery/specs/models/$MODEL delivery/changes/$CHANGE/specs/models/$MODEL -name model-card.md 2>/dev/null | head -1)
CV=$(sed -n 's/^- \*\*Registry version:\*\* *//p' "$CARD" | head -1)
RV=$(awk '/^## Version /{v=$3} /\*\*Stage:\*\* production/{print v; exit}' "$R")
[ -n "$CV" ] || echo "$CARD: no '- **Registry version:** <n>' line in '## Identity'"
[ "$CV" = "$RV" ] || echo "card is at version '$CV'; the production registry entry is version '$RV'"

test -f delivery/changes/$CHANGE/evidence/g7-promotion.md || echo "no G7 evidence index"
```

Each command prints nothing when the rule holds. The date comparison between the criteria and
the first training run is the mechanical form of rule 1 — it is the only one of these checks
that catches criteria reverse-engineered from a result, and it is the failure that matters most.
