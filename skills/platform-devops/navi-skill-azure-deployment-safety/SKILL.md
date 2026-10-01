---
name: navi-skill-azure-deployment-safety
description: >
  Use when a wave plan has to become an Azure operation — which primitive implements the
  exposure, which control-plane call is the kill switch, and what that call does and does not
  restore on this particular Azure service. Defines the per-service exposure register, the
  binding from each ROLL-### to its Azure mechanism, the Container Apps revision and traffic
  shape, the probe set, and the register of operations for which no rollback exists at all.
  Trigger phrases include: deployment slot, slot swap, sticky setting, slotSetting, Container
  Apps revision, traffic weight, activeRevisionsMode, revision label, canary on Azure, AKS
  rollout undo, revisionHistoryLimit, APIM revision, APIM version, Front Door origin weight,
  health probe, readiness probe, startup probe, warm-up, point-in-time restore, expand and
  contract, what rollback restores.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: platform-devops
  lifecycle_phases: [7, 8]
  used_by_agents: [navi-agent-devops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "devops, azure, deployment-safety, slots, revisions, traffic-weight, probes, rollback, canary"
  model: sonnet
---

## When to use

A wave plan exists and the exposure has to become an Azure operation somebody can run; a canary
is being described as "slots" without anyone saying what a swap-back leaves behind; a rollback
is being promised for a change that includes a migration; a container app is being deployed in
`Single` revision mode and a canary is expected from it; a readiness probe returns 200 from the
first millisecond; or an incident is under way and the question is which call stops this, now.

## Rules

1. Record every Azure service this estate deploys to at
   `delivery/ops/azure/deployment-safety.md`, one row per service, with all seven fields:
   `Exposure mechanism`, `Health signal`, `Rollback action`, `Rollback restores`,
   `Rollback does not restore`, and `Bounded by`. The register is per service because the
   answers differ per service, and a single sentence about "rollback" is true of none of them.
2. Fill `Rollback does not restore` before the first wave runs. It is the column that gets left
   blank, and it is the one every incident turns on: a swap-back that leaves the sticky settings
   behind, a weight shift that cannot un-write a row, a cached object that keeps serving.
3. Bind every `ROLL-###` in `delivery/changes/<name>/rollout.md` to the Azure mechanism that
   implements its `Selector`. `navi-skill-progressive-delivery` owns the wave — the exposure,
   the soak, the halt condition, the blast radius; this file owns which primitive provides it,
   so that a selector written as a percentage becomes a traffic block somebody can read.
4. Make every kill switch a control-plane operation and never a redeploy — a traffic weight, a
   slot swap, a removed revision label, an origin weight. A redeploy takes the pipeline's
   time-to-restore and needs the pipeline to be working, which during an incident is an
   assumption and not a fact.
5. Run Container Apps in `activeRevisionsMode: 'Multiple'`. `Single` deactivates the previous
   revision on every deploy, which removes the canary and the weight-shift rollback in one
   setting, and does it silently: the deploy succeeds and the traffic block is simply ignored.
6. Derive the incumbent revision's weight from the candidate's — `weight: 100 - candidateWeight`
   — rather than setting both. Container Apps refuses a traffic block that does not total 100,
   and two independently edited numbers is how that is discovered mid-ramp.
7. Keep `minReplicas` at 1 or more on any revision that is a rollback target. A revision scaled
   to zero has to cold-start before it can serve, so shifting weight back to it is not a kill
   switch, it is a cold start with traffic pointed at it.
8. Declare all three probes — `Startup`, `Readiness`, `Liveness` — on separate paths. Traffic
   reaches a revision when readiness passes, so a readiness path that returns 200 before the
   dependencies are reachable moves the exposure decision from the wave plan to the first
   request. Give `Startup` a `failureThreshold` that covers the slowest honest cold start.
9. Derive `revisionSuffix` from the commit the digest was built from, never from a timestamp.
   A timestamped suffix makes redeploying the same digest produce a new revision, so the
   revision names in the rollout record stop matching anything that exists.
10. Deploy by digest. An image reference ending in a tag resolves to whatever that tag points at
    when the revision starts, which is not necessarily what was approved — see
    `navi-skill-azure-pipelines` for publishing the digest the deploy reads.
11. Reference secrets by Key Vault URL and the workload's identity, never as an inline value,
    and say so in `Rollback does not restore`: a revision resolves its references when it
    starts, so a secret rotated during the ramp is re-resolved on rollback rather than restored
    with the revision.
12. On App Service, list the settings marked `slotSetting: true` in the register. A swap returns
    every non-sticky setting and leaves every sticky one where it is, so a swap-back restores
    less than the person running it expects, and the difference is exactly that list.
13. Never deploy into the staging slot while the build in it is the rollback target. The slot is
    the only copy of the previous running build; deploying over it destroys the way back, and it
    is the thing someone does while trying to fix forward.
14. State the measured time of every kill switch on that service, taken from a rehearsal rather
    than from the documentation. A slot swap under load is not the same operation as a slot swap
    on an idle app, and the number that matters is the one this app produced.
15. Record in `## Not recoverable` every operation for which no rollback exists, with the
    control that replaces it and a person who owns it. An operation with no rollback and no
    named replacement control is one that will be performed on the assumption that there is one.
16. Treat Azure SQL's point-in-time restore as recovery, not rollback. It restores to a **new**
    database, takes minutes to hours, and the cutover is a second outage; so a destructive
    migration is governed by expand and contract — add the column, write both, migrate readers,
    and drop the old one in a separate change at least one release later — and never by the
    restore.

## Decision table

| Observed condition | Required action |
|---|---|
| A service has no row in `## Service exposure` | Add it, with all seven fields |
| `Rollback does not restore` is blank or `—` | Fill it; it is the column the incident turns on |
| A `ROLL-###` in `rollout.md` has no Azure mechanism | Bind it here; a percentage is not an operation |
| The kill switch is "redeploy the previous digest" | Replace it with a control-plane operation and record the measured time |
| A container app is in `activeRevisionsMode: 'Single'` | Change to `Multiple`; `Single` silently discards the traffic block |
| Both traffic weights are set independently | Derive the incumbent's as `100 - candidateWeight` |
| A rollback-target revision has `minReplicas: 0` | Raise it to 1; a cold start is not a kill switch |
| A probe type is missing | Declare all three, on separate paths |
| Readiness returns 200 before dependencies are reachable | Make it check them; traffic follows readiness |
| `revisionSuffix` comes from a timestamp | Derive it from the commit; redeploying a digest must give the same revision |
| An image is referenced by tag | Reference the digest |
| A secret is an inline value in the app definition | Use a Key Vault URL and the workload identity |
| An App Service swap is planned and no sticky settings are listed | List them; they do not travel back |
| A fix is being deployed into the staging slot during an incident | Stop; that slot is the rollback target |
| A kill switch's time comes from documentation | Rehearse it on this app under load and record the measurement |
| A migration drops a column in the same change as the code | Split it: expand, migrate, contract a release later |
| Point-in-time restore is being called the rollback plan | Record it in `## Not recoverable`; it restores to a new database |

## Template

Two files. Copy the first into `delivery/ops/azure/deployment-safety.md`:

```markdown
# Azure deployment safety — web-shell

What stopping a bad change and taking it back actually mean on each Azure service this estate
deploys to. The wave plan itself — the exposure, the soak, the halt condition and the blast
radius — is `delivery/changes/<name>/rollout.md` under `navi-skill-progressive-delivery`. This
file says which Azure primitive implements each wave, which call is the kill switch, and what
that call does not restore.

## Service exposure

| Service | Exposure mechanism | Health signal | Rollback action | Rollback restores | Rollback does not restore | Bounded by |
|---|---|---|---|---|---|---|
| Azure Container Apps | ingress traffic weights across revisions, in `activeRevisionsMode: Multiple` | the candidate revision's startup and readiness probes, then SLI-004 measured at the ingress | shift the ingress weight back to the incumbent revision | the previous image, its environment and its secret references, in seconds and with no redeploy | rows the candidate wrote, and any secret version it resolved at start — references are re-resolved, not restored | the inactive-revision retention limit, and the incumbent still being provisioned, which `minReplicas: 0` ends |
| Azure App Service | a swap between the `staging` and `production` deployment slots | the warm-up declared in `applicationInitialization`, which must return 200 before the swap completes | swap back | the previous site content and every app setting not marked sticky | settings and connection strings marked `slotSetting: true`, which stay with the slot, and anything the new build wrote to shared storage | the staging slot still holding the previous build; deploying into it again destroys the way back |
| Azure Functions, Elastic Premium | a swap between deployment slots, with the host pre-warmed | the function host reporting ready after the warm-up | swap back | the previous function app content and its non-sticky settings | messages already dequeued and acknowledged by the new version, and any checkpoint it advanced | the dequeue rate during the swap window |
| Azure Kubernetes Service | a rolling update bounded by `maxSurge` and `maxUnavailable`, or weighted ingress across two Deployments | the readiness probe per pod, then the ingress SLI | `kubectl rollout undo`, or re-apply the previous digest | the previous ReplicaSet's pods and their configuration | anything an init container or a Job applied — a schema migration, a CRD update, a seeded row | `revisionHistoryLimit`, and the PodDisruptionBudget, which can refuse to drain the new pods |
| Azure API Management | a revision carries a behaviour change and can be made current; a version is a contract a consumer chooses | the revision's own trace, then the gateway SLI | make the previous revision current | the previous policy, backend and operation set | a published version consumers have already adopted, which is a contract rather than a deployment | the revision still existing, and any consumer that pinned the new version |
| Azure Front Door | weighted or priority routing between origins | the per-origin health probe | set the origin weight back | which origin serves new requests | objects already cached at the edge, which keep serving until purged or expired | the cache TTL of the affected routes |
| Azure SQL schema change | none — a migration is applied, not exposed progressively | the migration's own verification query | none | nothing, once a column is dropped | the dropped column and every row in it | expand and contract is the control that replaces rollback; see `## Not recoverable` |

## Wave mechanisms

One row per `ROLL-###` in `delivery/changes/<name>/rollout.md`. The wave's exposure, soak and
halt condition live there; what is here is the Azure operation that implements it.

| ROLL-### | Service | Azure mechanism | Kill switch | Propagation |
|---|---|---|---|---|
| ROLL-001 | Azure Container Apps | the candidate revision carries the label `canary` and 0 ingress weight, so only the label's own URL reaches it | remove the label from the candidate revision | under 10 seconds, measured 2026-09-24 |
| ROLL-002 | Azure Container Apps | ingress traffic weight 5 on the candidate revision, 95 on the incumbent | set the candidate's weight to 0 | under 10 seconds, measured 2026-09-24 |
| ROLL-003 | Azure Container Apps | ingress traffic weight 50 on the candidate revision, 50 on the incumbent | set the candidate's weight to 0 | under 10 seconds, measured 2026-09-24 |
| ROLL-004 | Azure Container Apps | ingress traffic weight 100 on the candidate; the incumbent stays provisioned at `minReplicas: 1` until TASK-034 | set the incumbent's weight back to 100 | under 10 seconds, measured 2026-09-24, while the incumbent is still provisioned |

## Sticky settings

Settings marked `slotSetting: true` do not travel in a swap. These are the ones this estate has,
and they are the difference between what a swap-back restores and what the person running it
expects it to restore.

| App | Setting | Sticky because | Owner |
|---|---|---|---|
| none on web-shell | — | web-shell runs on Container Apps, which has no slot model | — |

## Not recoverable

| Operation | Why rollback does not exist | The control that replaces it | Owner |
|---|---|---|---|
| An Azure SQL schema change that drops a column | the data is gone when the statement commits, and no deployment artefact holds it; point-in-time restore produces a new database, takes minutes to hours, and the cutover is a second outage | expand and contract — add the new column, write both, migrate readers, and drop the old one in a separate change at least one release later | Dan Okafor |
| Purging a Key Vault secret | purge is immediate and permanent; soft delete is the only window | purge protection on every vault, under `navi-skill-azure-identity-and-secrets` | Priya Raman |
| A Container Apps revision past the inactive-revision retention limit | the revision record is deleted and its image reference with it, so there is no weight to shift to | the previous digest is pinned in the release record, so redeploying by digest is still possible when weight-shifting is not | Ana Costa |
| An object already cached at a Front Door edge | the origin changed and the cache did not | purge the affected routes as part of the kill switch, and state the cache TTL in `## Service exposure` | Ana Costa |
```

Copy the second into `infra/azure/app/containerapp.bicep`:

```bicep
// The production container app for web-shell. The candidate and the incumbent
// revision are both provisioned, and ingress weight decides what each serves.
// Register: delivery/ops/azure/deployment-safety.md.

targetScope = 'resourceGroup'

@description('Azure region the container app is created in.')
param location string = resourceGroup().location

@description('Resource id of the Container Apps managed environment.')
param environmentId string

@description('Resource id of the workload identity from infra/azure/identity/main.bicep.')
param workloadIdentityResourceId string

@description('Image digest to deploy, as sha256:... — a digest and never a tag, because a tag can be moved after the approval that let it through.')
param imageDigest string

@description('Revision suffix, derived from the commit the digest was built from, so that redeploying the same digest produces the same revision.')
param revisionSuffix string

@description('Share of ingress traffic the candidate revision takes, 0 to 100. The incumbent takes the complement.')
@minValue(0)
@maxValue(100)
param candidateWeight int = 0

@description('Name of the revision currently carrying production traffic.')
param incumbentRevisionName string

var appName = 'ca-webshell-prd-weu'
var vaultUri = 'https://kv-webshell-prd-weu.vault.azure.net'

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workloadIdentityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      // Multiple, not Single. Single deactivates the previous revision on every
      // deploy, which removes the canary and the weight-shift rollback at once,
      // and does it silently: the deploy succeeds and the traffic block below
      // is simply ignored.
      activeRevisionsMode: 'Multiple'
      maxInactiveRevisions: 100
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        traffic: [
          {
            revisionName: incumbentRevisionName
            // Derived, never set independently: Container Apps refuses a
            // traffic block whose weights do not total 100, and two numbers
            // edited by hand is how that is discovered mid-ramp.
            weight: 100 - candidateWeight
          }
          {
            revisionName: '${appName}--${revisionSuffix}'
            weight: candidateWeight
            label: 'canary'
          }
        ]
      }
      // Key Vault references resolved by the workload's own identity when the
      // revision starts. No value is held here, and none reaches the pipeline.
      secrets: [
        {
          name: 'sessions-signing-key'
          keyVaultUrl: '${vaultUri}/secrets/sessions-signing-key'
          identity: workloadIdentityResourceId
        }
        {
          name: 'upstream-api-token'
          keyVaultUrl: '${vaultUri}/secrets/upstream-api-token'
          identity: workloadIdentityResourceId
        }
      ]
      registries: [
        {
          server: 'crwebshellweu.azurecr.io'
          identity: workloadIdentityResourceId
        }
      ]
    }
    template: {
      revisionSuffix: revisionSuffix
      containers: [
        {
          name: 'web-shell'
          image: 'crwebshellweu.azurecr.io/web-shell@${imageDigest}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'SESSIONS_SIGNING_KEY'
              secretRef: 'sessions-signing-key'
            }
            {
              name: 'UPSTREAM_API_TOKEN'
              secretRef: 'upstream-api-token'
            }
          ]
          probes: [
            {
              // Covers the slowest honest cold start: 24 failures at 5s.
              type: 'Startup'
              httpGet: {
                path: '/healthz/started'
                port: 8080
              }
              periodSeconds: 5
              failureThreshold: 24
            }
            {
              // Traffic follows readiness, so this path checks the upstream and
              // the vault reference rather than returning 200 unconditionally.
              type: 'Readiness'
              httpGet: {
                path: '/healthz/ready'
                port: 8080
              }
              periodSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz/live'
                port: 8080
              }
              periodSeconds: 10
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        // Not zero. A revision scaled to zero has to cold-start before it can
        // serve, so shifting weight back to it is a cold start with traffic
        // pointed at it rather than a kill switch.
        minReplicas: 1
        maxReplicas: 20
      }
    }
  }
}

output candidateRevisionName string = '${appName}--${revisionSuffix}'
```

## Checklist

- [ ] `delivery/ops/azure/deployment-safety.md` exists, with all four sections
- [ ] Every service row carries all seven fields
- [ ] `Rollback does not restore` is filled on every row
- [ ] Every service whose `Rollback action` is `none` has a `## Not recoverable` row
- [ ] Every `ROLL-###` in `rollout.md` has a row in `## Wave mechanisms`
- [ ] Every kill switch is a control-plane operation, not a redeploy
- [ ] Every propagation figure names a measured time
- [ ] `activeRevisionsMode` is `'Multiple'`
- [ ] The incumbent's traffic weight is derived as `100 - candidateWeight`
- [ ] The traffic block names at least two revisions
- [ ] `minReplicas` is 1 or more
- [ ] All three probe types are declared, on separate paths
- [ ] The image is referenced by digest
- [ ] Every secret is a Key Vault URL with an identity, and none carries an inline value
- [ ] `revisionSuffix` comes from the commit, not from a timestamp
- [ ] Sticky App Service settings are listed, or the row says there are none and why
- [ ] Every `## Not recoverable` row names a replacement control and an owner

## Anti-patterns

**The canary that was never possible.**

```bicep
activeRevisionsMode: 'Single'
traffic: [ { revisionName: previous, weight: 95 }, { latestRevision: true, weight: 5 } ]
```

`Single` deactivates the previous revision on deploy. The traffic block is ignored, the deploy
succeeds, and 100% of users are on the new revision while the rollout record says 5%. Use
`Multiple`.

**The kill switch that is a redeploy.** `Rollback: redeploy the previous digest`. During the
incident the pipeline is queued behind two other runs and the agent pool is saturated, which is
when the four-minute figure becomes eleven. Shift the ingress weight: it is a control-plane
call and it does not need the pipeline to be healthy.

**The swap that left half of itself behind.** The swap-back is done and the app is still broken.
`APPINSIGHTS_CONNECTION_STRING` and the feature-flag endpoint were marked `slotSetting: true`,
so they stayed with production and the old build is now running against the new configuration.
List the sticky settings before the first swap.

**Deploying into the rollback target.** Production is bad, so a fix is pushed into the staging
slot to swap it in. The build that was going to be swapped back is now overwritten. The staging
slot is the rollback target: leave it alone and shift back first.

**Readiness that always passes.** `/healthz` returns `200 OK` from `app.listen`. The revision
reports ready, Container Apps gives it its share of the ingress, and every request fails on a
connection pool that has not been created yet. Make readiness check what serving a request
needs.

**The timestamped revision.** `revisionSuffix: utcNow('yyyyMMddHHmmss')`. Redeploying the same
digest produces `--20260930T1142` and then `--20260930T1203`, so the revision named in the
rollout record no longer exists, and `az containerapp revision` has four revisions of one
digest. Derive the suffix from the commit.

**The restore that was called a rollback.** `Rollback: point-in-time restore.` It restores to a
*new* database, takes between ten minutes and several hours depending on size, and then needs a
connection-string cutover that is itself an outage. It is recovery from data loss, not a way
back from a deploy. Record it in `## Not recoverable` and use expand and contract.

**Scale to zero on the way back.** `minReplicas: 0` saves money on the incumbent revision during
the ramp. The halt fires, the weight goes back, and the incumbent cold-starts under full
production traffic — which is the one load profile it was never tested at. Keep it at 1.

## Validation

```bash
# Every check reads files in this repository. None of them calls `az` and none needs a
# subscription: the artefacts under test are the exposure register, the wave bindings, and the
# container app definition.
#
# NOT CHECKABLE FROM FILES — these are properties of the running Azure resources, not of the
# repository, and this block deliberately does not pretend otherwise:
#   * which revision currently holds which share of the ingress traffic
#     (`az containerapp revision list`, authenticated, is the only answer)
#   * whether the readiness path really checks its dependencies, which is a property of the
#     application and is covered by its own tests, not by this definition
#   * whether an App Service setting is actually marked sticky in the live slot configuration
#   * the measured propagation time of a kill switch — that figure comes from a rehearsal and
#     is recorded here by the person who ran it
#   * whether a Front Door cache has been purged
# Those are review and rehearsal steps with a signed-in operator; the dates in ## Wave
# mechanisms are where their results land.

CHANGE=<name>
DS=delivery/ops/azure/deployment-safety.md
CA=infra/azure/app/containerapp.bicep

test -f "$DS" || echo "no $DS"
test -f "$CA" || echo "no $CA"

# The image is deployed by digest; a tag resolves to whatever it points at when the revision
# starts, which is not necessarily what was approved.
grep -nE "image: *'[^']*:[A-Za-z0-9_.-]+'" "$CA" 2>/dev/null \
  | sed 's/^/container image referenced by tag rather than digest: /'

# The revision suffix is derived from the commit, not from the clock
grep -nE "revisionSuffix.*(utcNow|dateTimeAdd|timestamp)" "$CA" 2>/dev/null \
  | sed 's/^/revisionSuffix derived from the clock, so redeploying a digest makes a new revision: /'

python3 - "$CHANGE" <<'PY'
import pathlib, re, sys

change_name = sys.argv[1]
DS = pathlib.Path("delivery/ops/azure/deployment-safety.md")
CA = pathlib.Path("infra/azure/app/containerapp.bicep")
ROLLOUT = pathlib.Path(f"delivery/changes/{change_name}/rollout.md")
if not (DS.exists() and CA.exists()):
    sys.exit(0)                        # the `test -f` lines above already said so

ds = DS.read_text(encoding="utf-8")
bicep = CA.read_text(encoding="utf-8")

def table(heading):
    out, on = [], False
    for line in ds.splitlines():
        if line.startswith("## "):
            on = line[3:].strip() == heading
            continue
        if on and line.startswith("|"):
            if re.match(r"^\|[\s:|-]+$", line):
                continue
            out.append([c.strip() for c in line.strip().strip("|").split("|")])
    if not out:
        print(f"deployment-safety.md has no '## {heading}' table")
        return []
    return out[1:]

def section(heading):
    out, on = [], False
    for line in ds.splitlines():
        if line.startswith("## "):
            on = line[3:].strip() == heading
            continue
        if on:
            out.append(line)
    return "\n".join(out)

services = table("Service exposure")
waves = table("Wave mechanisms")
sticky = table("Sticky settings")
unrecoverable = table("Not recoverable")
unrecoverable_text = section("Not recoverable")

FIELDS = ["Exposure mechanism", "Health signal", "Rollback action", "Rollback restores",
          "Rollback does not restore", "Bounded by"]
known_services = set()
for row in services:
    svc = row[0] if row else ""
    if not svc:
        continue
    known_services.add(svc)
    if len(row) < 7:
        print(f"'{svc}' has {len(row)} columns in '## Service exposure'; seven are required")
        continue
    for offset, field in enumerate(FIELDS, start=1):
        cell = row[offset]
        if not cell or cell in ("—", "-", "TBD", "tbd"):
            print(f"'{svc}' says nothing for '{field}' — the column left blank is the one "
                  f"the incident turns on")
    if row[3].strip().lower() == "none" and svc.split()[0:3]:
        stem = " ".join(svc.split()[:3])
        if stem not in unrecoverable_text:
            print(f"'{svc}' has no rollback action and nothing in '## Not recoverable' "
                  f"names it")

REDEPLOY = re.compile(r"(?i)redeploy|re-deploy|rebuild|through the pipeline|pipeline run")
TIME = re.compile(r"(?i)\b(second|minute|hour|ms|millisecond)")
bound_waves = set()
for row in waves:
    wave = row[0] if row else ""
    if not re.fullmatch(r"ROLL-\d{3,}", wave):
        print(f"wave mechanism row '{wave}' has no ROLL-### id")
        continue
    bound_waves.add(wave)
    if len(row) < 5:
        print(f"{wave} has {len(row)} columns in '## Wave mechanisms'; five are required")
        continue
    svc, mechanism, kill, propagation = row[1], row[2], row[3], row[4]
    if svc not in known_services:
        print(f"{wave} names service '{svc}', which has no row in '## Service exposure'")
    if not mechanism:
        print(f"{wave}: no Azure mechanism — a percentage is not an operation")
    if not kill:
        print(f"{wave}: no kill switch")
    elif REDEPLOY.search(kill):
        print(f"{wave}: kill switch '{kill}' is a redeploy — it takes the pipeline's "
              f"time-to-restore and needs the pipeline to be healthy, which is an assumption "
              f"during an incident")
    if not TIME.search(propagation or ""):
        print(f"{wave}: propagation '{propagation}' names no measured time")

if ROLLOUT.exists():
    for wave in sorted(set(re.findall(r"ROLL-\d{3,}", ROLLOUT.read_text(encoding="utf-8")))):
        if wave not in bound_waves:
            print(f"{wave} is a wave in {ROLLOUT} and has no row in '## Wave mechanisms' "
                  f"— its selector is a percentage and not yet an Azure operation")

for row in unrecoverable:
    if len(row) < 4:
        print(f"'## Not recoverable' row '{row[0] if row else ''}' has fewer than four columns")
        continue
    if not row[2] or row[2] == "—":
        print(f"'{row[0]}' has no replacement control — an operation with no rollback and no "
              f"named control is one that gets performed as though there were one")
    if not row[3] or row[3] == "—":
        print(f"'{row[0]}' has no owner")
if not sticky:
    print("deployment-safety.md has no '## Sticky settings' table (record `none` and why "
          "when the estate has no slot-based service)")

# --- the container app definition ----------------------------------------

def bracket(text, key):
    """The balanced [...] that follows `key:` in a Bicep file."""
    head = re.search(rf"\b{re.escape(key)}:\s*\[", text)
    if not head:
        return ""
    start = text.index("[", head.start())
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "[":
            depth += 1
        elif text[i] == "]":
            depth -= 1
            if depth == 0:
                return text[start + 1:i]
    return text[start + 1:]

mode = re.search(r"activeRevisionsMode:\s*'(\w+)'", bicep)
if not mode:
    print(f"{CA} declares no activeRevisionsMode")
elif mode.group(1) != "Multiple":
    print(f"{CA}: activeRevisionsMode is '{mode.group(1)}' — Single deactivates the previous "
          f"revision on every deploy, so the traffic block below it is ignored and both the "
          f"canary and the weight-shift rollback are gone")

traffic = bracket(bicep, "traffic")
revisions = re.findall(r"revisionName:", traffic)
if len(revisions) < 2:
    print(f"{CA}: the traffic block names {len(revisions)} revision(s); a weighted ramp and a "
          f"weight-shift rollback both need at least two")
if "weight: 100 -" not in traffic:
    print(f"{CA}: the traffic block does not derive the incumbent's weight from the "
          f"candidate's (`weight: 100 - <candidate>`), so the two can be set to anything but "
          f"100 between them")

replicas = re.search(r"minReplicas:\s*(\d+)", bicep)
if not replicas:
    print(f"{CA} declares no minReplicas")
elif int(replicas.group(1)) < 1:
    print(f"{CA}: minReplicas is {replicas.group(1)} — a revision scaled to zero cold-starts "
          f"before it can serve, so shifting weight back to it is not a kill switch")

probes = bracket(bicep, "probes")
declared = set(re.findall(r"type:\s*'(\w+)'", probes))
for required in ("Startup", "Readiness", "Liveness"):
    if required not in declared:
        print(f"{CA}: no {required} probe — traffic reaches a revision when readiness passes, "
              f"so the probe set is what decides exposure between waves")
paths = re.findall(r"path:\s*'([^']+)'", probes)
if len(set(paths)) != len(paths):
    print(f"{CA}: two probes share a path ({', '.join(paths)}); liveness restarting on a "
          f"readiness condition is a restart loop under load")

secrets = bracket(bicep, "secrets")
if secrets:
    names = len(re.findall(r"\bname:", secrets))
    refs = len(re.findall(r"\bkeyVaultUrl:", secrets))
    if names != refs:
        print(f"{CA}: {names} secret(s) declared and {refs} Key Vault reference(s) — a secret "
              f"with an inline value is held in the resource definition and in every "
              f"deployment of it")
    if re.search(r"^\s*value:", secrets, re.M):
        print(f"{CA}: a secret carries an inline value")
    if len(re.findall(r"\bidentity:", secrets)) != refs:
        print(f"{CA}: a Key Vault reference names no identity to resolve it with")
PY
```

Each command prints nothing when the rule holds. The wave-binding loop is the one to run before
the first wave: it is the only mechanical check that every `ROLL-###` somebody agreed has an
Azure operation behind it rather than a percentage.
