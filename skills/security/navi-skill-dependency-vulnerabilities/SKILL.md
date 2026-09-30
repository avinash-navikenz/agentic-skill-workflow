---
name: navi-skill-dependency-vulnerabilities
description: >
  Use when a change ships third-party dependencies and G6 asks whether they carry known
  vulnerabilities, or when a scanner has produced findings that need dispositioning. Defines
  the scan scope, the per-ecosystem command, the advisory ids to record, the four
  dispositions, and how a finding that will not be fixed is accepted with an expiry.
  Trigger phrases include: dependency vulnerabilities, npm audit, pip-audit, govulncheck,
  dotnet list package --vulnerable, OWASP dependency-check, CVE, GHSA, OSV, SCA, SBOM,
  transitive dependency, lockfile, false positive, vulnerability waiver.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: security
  lifecycle_phases: [5, 6]
  used_by_agents: [navi-agent-security-engineer, navi-agent-fullstack-developer, navi-agent-devops-engineer]
  owner: OWNER_TBD
  tags: "security, dependencies, sca, cve, vulnerabilities, g6, supply-chain"
  model: sonnet
---

## When to use

A change is approaching G6 and the dependencies it ships have to be checked against known
vulnerabilities; a scan has produced findings that need dispositioning; or a dependency is
being added and somebody has to own it.

## Rules

1. Scan the resolved set, not the declared ranges. The input is the lockfile or its
   equivalent — `package-lock.json`, `poetry.lock`, `requirements.txt` with pinned versions,
   `pom.xml` with its resolved tree, `packages.lock.json`, `go.sum`. A manifest carrying
   ranges describes a set of possible builds, and the one that shipped is only one of them.
2. Scan every ecosystem the change ships. A repository with a `package.json` and a
   `pyproject.toml` needs both scans; the record names both.
3. Scan what ships. Exclude development and test dependencies from the shipped set, and say
   which flag did it (`--omit=dev`, `--only=main`, `scope=runtime`). A finding in a test-only
   dependency is recorded as `not-applicable` with that reason, not silently dropped.
4. Record every finding with the advisory id from the source that reported it — `GHSA-…`,
   `CVE-…`, `OSV-…`, `GO-…`, `PYSEC-…` — plus the source's name. Where a finding carries a
   CVE, deduplicate across sources on the CVE; where it does not, treat ids from different
   sources as different findings until shown otherwise.
5. Record for every finding: the package, the resolved version, whether it is `direct` or
   `transitive`, the path from a direct dependency for a transitive one, the fixed version if
   one exists, and the disposition.
6. Dispose of every finding as exactly one of four: `fixed` (upgraded or replaced, naming the
   new version), `mitigated` (the vulnerable path is unreachable because of a control this
   change owns — name the control and the test), `not-applicable` (the vulnerable code is not
   shipped or not called — name the evidence), or `waived` (accepted, with an expiry and a
   named person). No finding is left without one, and `will look at it later` is not one.
7. Do not adopt a severity cutoff the team has not already agreed and written down. Where an
   agreed policy exists, cite it by name in the record and apply it. Where none exists,
   dispose of every finding individually on two observable facts — whether the vulnerable
   function is called by shipped code, and from which reach the call is triggerable — rather
   than on a score produced by whoever ran the scanner.
8. Fix a transitive finding at the direct dependency where an upgrade exists. Where none
   exists, pin the transitive version through the ecosystem's override mechanism (`overrides`
   in npm, `dependencyManagement` in Maven, a `replace` directive in Go, a constraint pin in
   pip) and record the pin as the fix, with a note to remove it when the direct dependency
   catches up.
9. Record every `waived` finding twice: as an `ADR-###` carrying `Accepted-risk:` and
   `Accepted-by:` with a person's name, and as an issue in the team's tracker (Azure DevOps
   work item, GitHub issue, or Jira issue) whose due date equals the waiver expiry. The ADR
   is why; the issue is what makes somebody see it again.
10. Record G6 as `--waive` rather than `--pass` on any change carrying a waived finding, with
    the reason naming the advisory id and what is accepted, and an expiry that is the date the
    fix lands. The `waivers.md` row is the only durable record of the exception —
    `navi-skill-waivers-and-deferrals` owns the rules for reasons, expiries and renewals.
11. Write the scan record to `delivery/changes/<name>/evidence/g6-dependencies.md` and keep
    the raw scanner output beside it as `g6-dependencies-<ecosystem>.json`. The record is what
    a reviewer reads; the raw output is what makes the record checkable.
12. Regenerate the scan after the last change to any lockfile. Evidence must post-date what it
    attests — a scan from before the final dependency bump describes a build that did not
    ship, and `navi-skill-phase-gate-protocol` rule 9 refuses it.
13. Name an owner for every direct dependency this change adds, in the same record: the person
    who upgrades it when the next advisory lands. A dependency added by a change nobody owns
    becomes everybody's at the first CVE.
14. Run the same scan in the pipeline on the default branch on a schedule, not only in the
    change. Advisories are published against versions already shipped, so a change-time scan
    proves the day it ran and nothing after it.

## Decision table

| Observed condition | Required action |
|---|---|
| `package-lock.json` present | `npm audit --omit=dev --json > g6-dependencies-npm.json` |
| `yarn.lock` present | `yarn npm audit --environment production --json > g6-dependencies-npm.json` |
| `poetry.lock` or pinned `requirements.txt` present | `pip-audit -r requirements.txt -f json -o g6-dependencies-pip.json` |
| `pom.xml` present | `mvn org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=11 -Dformat=JSON` |
| `packages.lock.json` or a `.csproj` present | `dotnet list package --vulnerable --include-transitive --format json` |
| `go.mod` present | `govulncheck -json ./... > g6-dependencies-go.json` |
| A container image ships | Scan the image as its own ecosystem; OS packages are dependencies too |
| Two ecosystems in one repository | Run both; the record names both and merges the findings |
| Finding is in a dev-only dependency | `not-applicable`, reason: not in the shipped set, naming the flag that excluded it |
| Vulnerable function is demonstrably never called | `not-applicable`, naming the evidence (call-graph output, `govulncheck` reachability) |
| A fixed version exists and the upgrade is compatible | `fixed`, naming the new version; re-run the scan |
| Fixed version exists only in a later major | Upgrade if the interface contracts survive it; otherwise disposition is `mitigated` or `waived` |
| No fixed version exists anywhere | `mitigated` with a named control and test, or `waived` with an ADR and expiry |
| Transitive, direct parent has an upgrade | Upgrade the direct dependency; do not pin the transitive one |
| Transitive, no parent upgrade exists | Pin through the ecosystem's override mechanism; record the pin and its removal trigger |
| The team has an agreed severity policy | Cite it by name in the record and apply it |
| The team has no agreed severity policy | Dispose individually on reachability and reach; invent no cutoff |
| Any finding is `waived` | Record G6 as `--waive` with the advisory id in the reason, never `--pass` |
| A lockfile changed after the scan ran | Re-run the scan; the old output attests a build that did not ship |
| The scanner cannot reach its advisory database | The scan did not run; a zero-finding report from an offline scanner is not evidence |

## Template

Copy into `delivery/changes/<name>/evidence/g6-dependencies.md`:

```markdown
# Dependency vulnerability check — theme-persistence

- **Scanned:** 2026-09-28T14:02Z, after the last lockfile change (2026-09-28T11:40Z)
- **Ecosystems:** npm (`package-lock.json`), Go (`go.sum`)
- **Commands:**
  - `npm audit --omit=dev --json > evidence/g6-dependencies-npm.json`
  - `govulncheck -json ./... > evidence/g6-dependencies-go.json`
- **Sources:** GitHub Advisory Database (npm), Go vulnerability database (OSV)
- **Severity policy applied:** none agreed; each finding dispositioned individually on
  reachability and reach
- **Shipped-set flag:** `--omit=dev` (npm); `govulncheck` reports reachable symbols only

| Finding | Package @ version | Direct? | Fixed in | Disposition |
|---|---|---|---|---|
| GHSA-4x7v-2q8m | `tar-fs@2.1.1` | transitive (via `image-build@4.2.0`) | 2.1.2 | fixed |
| CVE-2026-1188 | `libxml2@2.12.6` | direct | none | waived — ADR-014 |
| GO-2026-3401 | `golang.org/x/net@0.24.0` | direct | 0.25.0 | fixed |
| GHSA-9wc3-hh7q | `debug@4.3.4` | transitive (dev only) | 4.3.6 | not-applicable |

## GHSA-4x7v-2q8m — tar-fs path traversal

Transitive through `image-build@4.2.0`. No upgrade of `image-build` exists that resolves it,
so `tar-fs` is pinned to 2.1.2 through `overrides` in `package.json`. Remove the override when
`image-build` releases a version depending on 2.1.2 or later — tracked as DEV-4412.
**Disposition:** fixed (2.1.2, via override). Re-scan output: `g6-dependencies-npm.json`.

## CVE-2026-1188 — libxml2 out-of-bounds read in the XSD validator

Direct dependency; no fixed version published. Shipped code calls `libxml2` only through
`parseConfig()`, which reads a file written by the deploy pipeline and never by a request, so
the reach is `privileged`. Not dispositioned as `not-applicable` because the parser is still
compiled in and a future caller would reopen it.
**Disposition:** waived — ADR-014, `Accepted-by: Priya Raman, Head of Platform (2026-09-28)`,
expiry 2026-12-15, tracked as JIRA SEC-881 with the same due date. G6 recorded as `--waive`.

## GHSA-9wc3-hh7q — debug ReDoS

Present only under `devDependencies`, excluded from the shipped set by `--omit=dev` and absent
from the production image manifest.
**Disposition:** not-applicable — not in the shipped set.

## Dependencies added by this change

| Package | Version | Why | Upgrade owner |
|---|---|---|---|
| `golang.org/x/net` | 0.25.0 | HTTP/2 client for the session payload fetch | Dan Okafor |
```

Recording the gate when a finding is waived:

```bash
# 1. Re-run the scan after the final lockfile change
npm audit --omit=dev --json > delivery/changes/theme-persistence/evidence/g6-dependencies-npm.json

# 2. Write the record above, then record the verdict — waived, because CVE-2026-1188 is open
navi-delivery gate G6 --waive "CVE-2026-1188 in libxml2 has no fix; reach is privileged (deploy-written config only); ADR-014, tracked as SEC-881" --expires 2026-12-15
# => G6 waived until 2026-12-15

navi-delivery status
```

Pipeline wiring — GitHub Actions, on pull requests and nightly on the default branch:

```yaml
name: dependency-scan
on:
  pull_request:
  schedule:
    - cron: "0 3 * * *"
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --omit=dev --json > npm-audit.json
        continue-on-error: true
      - run: go run golang.org/x/vuln/cmd/govulncheck@latest -json ./... > govulncheck.json
        continue-on-error: true
      - uses: actions/upload-artifact@v4
        with:
          name: dependency-scan
          path: |
            npm-audit.json
            govulncheck.json
```

Pipeline wiring — Azure DevOps, same two scans:

```yaml
trigger: [main]
schedules:
  - cron: "0 3 * * *"
    branches: { include: [main] }
    always: true
steps:
  - script: npm ci && npm audit --omit=dev --json > $(Build.ArtifactStagingDirectory)/npm-audit.json
    displayName: npm audit
    continueOnError: true
  - script: govulncheck -json ./... > $(Build.ArtifactStagingDirectory)/govulncheck.json
    displayName: govulncheck
    continueOnError: true
  - publish: $(Build.ArtifactStagingDirectory)
    artifact: dependency-scan
```

`continueOnError` is deliberate: the scan's job is to produce findings for dispositioning, and
a red pipeline on an advisory nobody has read yet teaches the team to rerun it. The gate, not
the pipeline, is what refuses to pass with an open finding.

## Checklist

- [ ] Every ecosystem the change ships was scanned, from its lockfile
- [ ] The scan ran after the last lockfile change
- [ ] Development-only dependencies are excluded, and the excluding flag is named
- [ ] Every finding carries its advisory id and the source that reported it
- [ ] Every finding records package, resolved version, direct or transitive, and fixed version
- [ ] Every finding has exactly one of the four dispositions
- [ ] No severity cutoff was applied that the team has not agreed and written down
- [ ] Every `not-applicable` names the evidence for non-reachability
- [ ] Every `mitigated` names the control and the test that fails without it
- [ ] Every `waived` has an `ADR-###` with a named person, a tracker issue, and an expiry
- [ ] G6 is recorded as `--waive`, not `--pass`, if any finding is waived
- [ ] The record and the raw scanner output are both in `evidence/`
- [ ] Every direct dependency this change adds has a named upgrade owner
- [ ] The same scan runs on a schedule against the default branch

## Anti-patterns

**Scanning the manifest.** `npm audit` run against a `package.json` with carets, in a
repository whose lockfile pins older versions. The report describes a build nobody shipped.
Scan the lockfile.

**The invented cutoff.** `We only fix High and Critical.` Nobody agreed that, so it is the
scanner's opinion promoted to policy, and the Medium that is reachable from `anonymous`
outranks the Critical that is not. Dispose on reachability and reach, or cite the policy the
team actually wrote down.

**The silent drop.** Twelve findings, four in the record, eight in a dev dependency and
deleted. A reviewer cannot tell a considered exclusion from a missed one. Record all twelve;
mark the eight `not-applicable` with the flag that excluded them.

**False positive by assertion.** `Disposition: not-applicable — we don't think we use that
function.` Nobody can check it, and the next upgrade quietly makes it true. Name the evidence:
`govulncheck` reports the symbol unreachable, or the call-graph output attached beside it.

**Pinning over fixing.** Overriding a transitive version when the direct parent has a release
that resolves it. The override survives the parent's fix and blocks the next upgrade. Upgrade
the parent; pin only when no parent upgrade exists, and record the removal trigger.

**Waiver with no name and no date.** `Accepted — no fix available.` This is how an accepted
finding becomes a permanent one. Write the ADR with `Accepted-by: <person>`, the tracker issue
with a due date, and the `waivers.md` row with the same expiry.

**Pass with an open finding.** G6 recorded `--pass` while `CVE-2026-1188` is unfixed, on the
grounds that it is "accepted anyway". The waiver row is the only place the exception is
durable, and `--pass` does not write one. Record `--waive`.

**The stale scan.** A scan from Tuesday attached to a Thursday build whose lockfile changed on
Wednesday. Regenerate after the last lockfile change; phase-gate rule 9 refuses evidence that
predates its input.

**Offline zero.** A scanner that could not reach its advisory database reports no findings, and
the report is attached as evidence of none. Check the scan's own status before reading its
count; a scan that did not run is not a scan that passed.

## Validation

```bash
CHANGE=<name>
EV=delivery/changes/$CHANGE/evidence

# The scan post-dates the last lockfile change
for lock in package-lock.json yarn.lock poetry.lock go.sum packages.lock.json; do
  test -f "$lock" || continue
  test "$EV/g6-dependencies.md" -nt "$lock" || echo "scan record is older than $lock"
done

# Every finding id in the record appears in the raw scanner output
for id in $(grep -oE '(GHSA|CVE|OSV|GO|PYSEC)-[A-Za-z0-9-]+' "$EV/g6-dependencies.md" | sort -u); do
  grep -qr "$id" "$EV"/g6-dependencies-*.json || echo "$id is in the record but not in any raw output"
done

# Every finding row carries one of the four dispositions
grep -nE '^\| (GHSA|CVE|OSV|GO|PYSEC)-' "$EV/g6-dependencies.md" \
  | grep -vE 'fixed|mitigated|not-applicable|waived'

# Every waived finding names an ADR that exists and carries an acceptor
for adr in $(grep -oE 'ADR-[0-9]{3,}' "$EV/g6-dependencies.md" | sort -u); do
  test -f "delivery/decisions/$adr.md" || echo "missing $adr"
  grep -q '^## Accepted-by$' "delivery/decisions/$adr.md" || echo "$adr has no Accepted-by"
done

# If anything is waived, G6 must be waived rather than passed.
# The last G6 event is the current verdict; earlier ones are history.
grep -q 'waived' "$EV/g6-dependencies.md" \
  && grep '"gate":"G6"' delivery/.adlc/events.jsonl | tail -1 | grep -q '"verdict":"pass"' \
  && echo "G6 recorded as pass while a finding is waived"
```

Each command prints nothing when the rule holds.

**Known gap: the gate has three dispositions, a scanner produces four.** `references/gates.md`
requires every G6 security finding to be `fixed`, `mitigated`, or `waived`. A scanner
routinely reports a vulnerability in code that is not shipped or not called, which is none of
the three: calling it `mitigated` claims a control that does not exist, and waiving it spends
a gate waiver on a finding that was never real. This skill therefore adds `not-applicable` as
a fourth disposition, admissible only with named evidence of non-reachability, and treats it
as carrying no risk into the gate. Until `gates.md` is amended, a reviewer reading the gate
text literally will find a disposition it does not list; the record names the evidence so the
disagreement is visible rather than hidden inside `mitigated`.

**Known gap: waivers are gate-shaped, findings are not.** `navi-delivery gate --waive` attaches
one reason and one expiry to a whole gate, so a single unfixable advisory waives all of G6
rather than itself. Rule 10 makes that explicit rather than papering over it: the reason names
the advisory, and settling means re-scanning and re-recording G6. A change carrying two waived
findings with different fix dates takes the earlier expiry, and the later finding is settled by
re-recording the gate again.
