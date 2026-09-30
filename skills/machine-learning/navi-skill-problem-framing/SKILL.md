---
name: navi-skill-problem-framing
description: >
  Use when a change proposes to solve something with a learned model, before any model is
  fitted, or when G4 asks whether a baseline exists and what the metric is tied to. Defines the
  framing file, the decision the output informs, the cost-of-error table, the BASELINE-###
  entry, the target and unit of prediction, and the recorded outcome that no model is needed.
  Trigger phrases include: problem framing, is ML the right tool, do we need a model, baseline,
  heuristic baseline, label definition, unit of prediction, prediction time, cost of a wrong
  prediction, classification or regression, feature availability at inference, G4 baseline.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: machine-learning
  lifecycle_phases: [3, 4]
  used_by_agents: [navi-agent-machine-learning-engineer]
  owner: OWNER_TBD
  tags: "ml, problem-framing, baselines, labels, cost-of-error, g4"
  model: opus
---

## When to use

A proposal says a model will solve something; a model is about to be fitted and no baseline
exists; G4 is about to be recorded and needs the baseline and the metric tied to the
proposal's outcome; or the answer "this does not need a model" needs recording rather than
losing.

## Rules

1. Write the framing at `delivery/changes/<name>/specs/models/<model>/framing.md`.
   `navi-delivery archive` folds `changes/<name>/specs/` into `delivery/specs/`, so the framing
   survives as the answer to "why is there a model here" after the change closes.
2. Give the framing all nine sections, none omitted: `## The decision`, `## Cost of being
   wrong`, `## Target`, `## Unit of prediction`, `## Framing`, `## Features at inference`,
   `## Why not rules`, `## Segments to report`, `## Verdict`.
3. Open `## The decision` with one sentence naming the decision the output informs, the person
   or system that makes it, and what they do differently when the output changes. A model
   whose output changes nobody's action is not framed, whatever its accuracy.
4. Give `## Cost of being wrong` one row per error type — false positive and false negative for
   a binary task, one row per confusable class pair otherwise — with the consequence, who bears
   it, and the name and date of the person who stated it. Do not invent the cost: where nobody
   owning the consequence will state it, record that and escalate, because no threshold can be
   chosen without it and the default that gets used instead belongs to nobody.
5. Define the label in `## Target`: how it is computed, which `DC-###` supplies it, how long it
   takes to arrive after the prediction, and what decision or process produced it. A label
   produced by a past human decision encodes that decision; name whose it was.
6. State in `## Unit of prediction` what one row of the evaluation set is, and the exact
   **prediction time** — the moment at which the model is asked. Everything knowable only after
   that moment is unavailable at inference and is leakage if it reaches the features;
   `navi-skill-evaluation-design` runs the pass that checks it.
7. Set `## Framing` to exactly one learning task: binary classification, multiclass
   classification, regression, ranking, sequence labelling, generation,
   retrieval-augmented generation, or clustering. Changing it mid-change reopens the
   evaluation, because the metric, the split and the baselines all follow from it.
8. List every feature in `## Features at inference` with the `DC-###` that supplies it and
   whether that source is readable at prediction time in production. A feature available only
   in the warehouse is not a feature; it is a warehouse column that will be missing on the day
   the model serves.
9. Try the alternatives before the model, not after. `## Why not rules` carries at least three
   `BASELINE-###` entries: the constant or majority baseline, one rule a domain expert would
   write, and the current production behaviour where one exists. Each is actually run and
   actually scored on the evaluation from `navi-skill-evaluation-design`.
10. Give every `BASELINE-###` five fields: `What`, `Implementation`, `Score`, `Cost to build`,
    `Cost to run`. `Implementation` names a file or a query that exists — a baseline nobody
    can re-run is a number somebody remembers.
11. Take the baseline where the proposed model's advantage does not exceed the evaluation's
    stated uncertainty interval. Record the margin either way. "The model is slightly better"
    inside the interval is "no difference", and the simpler thing wins on cost to run,
    explainability and the absence of drift.
12. Name in `## Segments to report` the groups the error profile is reported across, and bind
    each to a `SLICE-###` in the evaluation plan. Where a segmenting attribute is one the
    organisation does not lawfully hold, say so and record that no segment reporting is
    possible on it rather than substituting a proxy silently; a proxy that is used is named as
    one.
13. End with `## Verdict`: `model` or `no model`, with the reason and the date. `no model` is a
    result, not a failure — record it, and the change proceeds without one. A framing deleted
    because the answer was no leaves the next person to re-derive it.
14. Bind the metric to the proposal. G4 requires the evaluation metric tied to the outcome named
    in `proposal.md`; quote that outcome verbatim in `## The decision` and name the `EVAL-###`
    that measures it. A metric chosen without that link measures something the change did not
    promise.
15. Record the framing before G4 is recorded, and before the first model is fitted.
    `cli/lib/lanes.js` gives `standard` a fixed gate set without G4, and `navi-delivery gate`
    refuses a gate outside the lane's set, so a model change on `standard` has no G4 to pass.
    Take `full` at proposal time under `navi-skill-lane-selection`.

## Decision table

| Observed condition | Required action |
|---|---|
| Nobody can say what changes when the output changes | Not framed — stop; there is no decision to inform |
| Nobody owning the consequence will state the cost of an error | Record it and escalate; do not invent a cost or take the default threshold |
| The label comes from a past human decision | Name whose decision, and report the error profile across the groups it affected |
| The label arrives 90 days after the prediction | State the delay; `navi-skill-drift-monitoring` carries the whole burden until then |
| A feature is only available in the warehouse | Not a feature — remove it or arrange the serving path before it is used |
| A feature is computed from data later than the prediction time | Leakage — remove it; the evaluation pass will find it if this does not |
| Fewer than three baselines have been run | Not enough — the constant, the expert rule and the incumbent are the minimum |
| A baseline is within the model's uncertainty interval | Take the baseline; record the margin |
| The framing changed from ranking to classification | The evaluation reopens — new metric, new split, new baselines |
| The segmenting attribute is not lawfully held | Record that segment reporting is impossible on it; name any proxy as a proxy |
| The answer is that no model is needed | Record `## Verdict: no model` with the reason; do not delete the framing |
| The metric is not the outcome `proposal.md` names | Rebind it, or re-propose with the outcome the metric actually measures |
| The change is on the `standard` lane | Re-propose on `full`; `standard` cannot record G4 |

## Template

Copy into `delivery/changes/<name>/specs/models/theme-ranker/framing.md`:

```markdown
# Framing — theme-ranker

Change: theme-persistence. Written 2026-09-18, before the first fit.

## The decision

When a signed-in user opens the shell with no stored theme preference, the shell picks a
default instead of rendering light. The shell makes the call, at render time, and the
prediction changes which stylesheet is served on that first paint. `proposal.md`'s outcome is
quoted verbatim: *"reduce first-session theme switches by 30% for users arriving with no stored
preference"*. EVAL-001 measures it.

## Cost of being wrong

| Error | Consequence | Who bears it | Stated by |
|---|---|---|---|
| Predict dark, user wants light | One manual switch; the preference is then stored and never asked again | The user, once | Priya Raman, Head of Platform, 2026-09-17 |
| Predict light, user wants dark | One manual switch, plus a brief bright flash in a dark environment — the complaint driver in the 2026-Q2 support sample | The user, once | Priya Raman, Head of Platform, 2026-09-17 |

The two costs are close and both small, which is why the operating point in EVAL-004 is chosen
near the balanced point rather than skewed. Had nobody stated these, no threshold could have
been chosen and this section would read "unstated — escalated 2026-09-17".

## Target

- **Label:** the theme the user is on 24 hours after first render — `light` or `dark`
- **Source:** DC-003 `session_events.theme`, first non-null value per `user_id` after the
  session in question
- **Arrival delay:** 24 hours by construction; 4% of users never set one and are excluded from
  training, which NOTFIT-004 in the model card records
- **Produced by:** the user's own action. No past human or automated decision is encoded, which
  is the one respect in which this label is unusually clean.

## Unit of prediction

One row is one *first render for a user with no stored preference*. **Prediction time** is the
moment the shell requests the theme, before the first paint. Nothing recorded after that
instant is available — including the theme the user later picks, which is the label.

## Framing

Binary classification. `light` is the negative class, `dark` the positive.

## Features at inference

| Feature | Source | Readable at prediction time in production? |
|---|---|---|
| `prefers_color_scheme` header | request header | Yes |
| `client_region` | DC-003, resolved at the edge on this request | Yes |
| `local_hour` | request, derived from the client timezone offset | Yes |
| `account_age_days` | DC-001 `user_directory`, cached in the session payload | Yes |
| `sessions_last_30d` | DC-005 `theme_daily`, warehouse only, refreshed daily | **No — removed 2026-09-19** |

`sessions_last_30d` was the strongest feature in the first pass and is not available at render
time. It was removed rather than served, because serving it needs a new online store, which is
a different change.

## Why not rules

### BASELINE-001 — Always light

- **What:** the majority class, and the current behaviour
- **Implementation:** `ml/baselines/constant_light.py`
- **Score:** EVAL-001 = 0.612 accuracy [0.601, 0.623]
- **Cost to build:** none, it exists
- **Cost to run:** none

### BASELINE-002 — Honour `prefers-color-scheme`

- **What:** the one rule a front-end engineer would write: use the OS setting where the header
  is present, light otherwise
- **Implementation:** `ml/baselines/prefers_color_scheme.py`
- **Score:** EVAL-001 = 0.831 accuracy [0.822, 0.840]
- **Cost to build:** half a day
- **Cost to run:** none — it is a header read

### BASELINE-003 — Header, with a local-hour fallback

- **What:** BASELINE-002 plus "dark after 19:00 local" where the header is absent
- **Implementation:** `ml/baselines/header_plus_hour.py`
- **Score:** EVAL-001 = 0.847 accuracy [0.838, 0.856]
- **Cost to build:** one day
- **Cost to run:** none

The gradient-boosted candidate scores 0.859 [0.850, 0.868]. Its interval overlaps
BASELINE-003's, so by rule 11 the margin is **not established**: 0.012 with overlapping
intervals is "no difference". See `## Verdict`.

## Segments to report

| Segment | Cut on | Slice |
|---|---|---|
| Header present vs absent | request header | SLICE-001, SLICE-002 |
| Region | DC-003 `client_region` | SLICE-003..SLICE-008 |
| Account age band | DC-001 `account_age_days` | SLICE-009..SLICE-011 |

Accessibility need is the segment that matters most here and is not lawfully held: no
segment reporting is possible on it, and no proxy is substituted.

## Verdict

**no model** — 2026-09-19. BASELINE-003 is within the candidate's uncertainty interval, costs
nothing to run, has no drift surface, needs no online feature store, and can be explained to a
user in one sentence. The change ships BASELINE-003 as the shell's default-picking rule. The
candidate is retained at `ml/experiments/2026-09-18-theme-gbm/` so the comparison can be
re-run when `sessions_last_30d` becomes servable.
```

## Checklist

- [ ] The framing is under `changes/<name>/specs/models/<model>/`, so `archive` folds it
- [ ] All nine sections are present
- [ ] `## The decision` names the decision, the decider, and what changes
- [ ] The `proposal.md` outcome is quoted verbatim and bound to an `EVAL-###`
- [ ] Every error type has a consequence, a bearer, and a named person with a date
- [ ] The label's computation, source `DC-###`, arrival delay and producing decision are stated
- [ ] The prediction time is stated as a moment, not a date
- [ ] `## Framing` names exactly one learning task
- [ ] Every feature names its `DC-###` and its availability at prediction time
- [ ] At least three `BASELINE-###`, each with all five fields and a runnable implementation
- [ ] The margin against the best baseline is stated against the uncertainty interval
- [ ] Every segment binds to a `SLICE-###`; unheld attributes are recorded as unreportable
- [ ] `## Verdict` is `model` or `no model`, with a reason and a date
- [ ] The framing predates the first fit and the G4 verdict
- [ ] The lane is `full`, because `standard` cannot record G4

## Anti-patterns

**The model with no decision.** `We'll predict churn probability for each account.` Nobody says
what happens at 0.7 that does not happen at 0.3, so no threshold is choosable and no cost is
stateable. Name the decision and the person who makes it, or there is nothing to evaluate
against.

**The invented cost.** The cost table filled in by the person building the model, because the
business owner was in meetings. The threshold now encodes an engineer's guess about a
commercial trade-off, invisibly. Record "unstated" and escalate — an empty row that is visible
beats a plausible row that is wrong.

**The baseline that could not have won.** `Baseline: random guessing, 50%.` It exists to be
beaten and it proves nothing. The useful baseline is the one a competent person would actually
ship: the header read, the last value carried forward, the existing rule.

**The warehouse feature.** The best feature is a 30-day aggregate that lives in the warehouse
and refreshes nightly. Offline it lifts the score four points; online it does not exist. List
availability at prediction time beside every feature, before the fit.

**Prediction time left vague.** "We predict on the session." Which moment — the request, the
first paint, the end of the session? Each admits different features, and the loosest reading
admits the label. State the instant.

**The label nobody looked at.** The target is "was the account flagged by the review team",
and the review team's flagging policy changed in March. The model learns to reproduce two
different policies. Name what produced the label and when it changed.

**Segment reporting by proxy, unlabelled.** Region used as a stand-in for an attribute the
organisation does not hold, reported as if it were the attribute. Name the proxy as a proxy, or
record that the segment cannot be reported.

**The deleted "no".** The framing concluded no model was needed, so it was never committed. Six
months later the same idea returns and the same three baselines are rebuilt from scratch.
Record `## Verdict: no model` and keep it.

## Validation

```bash
CHANGE=<name>
F=$(find delivery/changes/$CHANGE/specs/models -name framing.md 2>/dev/null | head -1)
test -n "$F" || echo "no framing.md under changes/$CHANGE/specs/models/"

for s in "The decision" "Cost of being wrong" "Target" "Unit of prediction" "Framing" \
         "Features at inference" "Why not rules" "Segments to report" "Verdict"; do
  grep -q "^## $s\$" "$F" || echo "$F: missing section '## $s'"
done

# At least three baselines, each with all five fields
n=$(grep -c '^### BASELINE-[0-9]\{3,\}' "$F")
[ "$n" -ge 3 ] || echo "$F: only $n baseline(s); three is the minimum"
for id in $(grep -o 'BASELINE-[0-9]\{3,\}' "$F" | sort -u); do
  body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$F")
  for k in What Implementation Score "Cost to build" "Cost to run"; do
    printf '%s\n' "$body" | grep -q "\*\*$k:\*\*" || echo "$id: missing $k"
  done
  # The implementation exists
  for impl in $(printf '%s\n' "$body" | awk '/\*\*Implementation:\*\*/{print}' | grep -o '`[^`]*`' | tr -d '`'); do
    test -e "$impl" || echo "$id: implementation not found: $impl"
  done
done

# Exactly one learning task named
n=$(awk '/^## Framing$/{on=1;next} /^## /{on=0} on' "$F" \
    | grep -oiE 'binary classification|multiclass classification|regression|ranking|sequence labelling|retrieval-augmented generation|generation|clustering' \
    | sort -u | wc -l | tr -d ' ')
[ "$n" = 1 ] || echo "$F: '## Framing' names $n learning tasks; exactly one is required"

# Every cost row names a person and a date
awk '/^## Cost of being wrong$/{on=1;next} /^## /{on=0}
     on && /^\| / && !/^\| *Error/ && !/^\| *-/ {
       if ($0 !~ /[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/)
         print "cost row with no dated attribution: " $0 }' "$F"

# The proposal outcome is quoted verbatim somewhere in the framing
python3 - "$CHANGE" <<'PY'
import re, sys, pathlib
change = sys.argv[1]
prop = pathlib.Path(f"delivery/changes/{change}/proposal.md").read_text()
fr = " ".join(pathlib.Path(p).read_text() for p in
              pathlib.Path(f"delivery/changes/{change}/specs/models").rglob("framing.md"))
quoted = re.findall(r'\*"(.+?)"\*', fr, re.S)
if not quoted:
    print("framing quotes no proposal outcome verbatim")
for q in quoted:
    if " ".join(q.split()) not in " ".join(prop.split()):
        print(f"framing quotes an outcome that is not in proposal.md: {q[:60]}…")
PY

# The verdict is one of the two words
grep -qE '^\*\*(model|no model)\*\*' "$F" || echo "$F: '## Verdict' does not open with **model** or **no model**"

LANE=$(python3 -c 'import json;print(json.load(open("delivery/.adlc/state.json"))["lane"])')
[ "$LANE" = full ] || echo "lane is '$LANE' — G4 is enforced only on 'full'; re-propose before recording G4"
```

Each command prints nothing when the rule holds, except the lane check. The verbatim-quote
check is the one that enforces G4's "metric tied to the outcome named in `proposal.md`"
mechanically rather than on the author's word.
