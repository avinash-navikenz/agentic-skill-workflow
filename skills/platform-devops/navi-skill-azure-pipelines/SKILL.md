---
name: navi-skill-azure-pipelines
description: >
  Use when the delivery pipeline is an Azure DevOps YAML pipeline and the question is which
  ADO object carries a guarantee `navi-skill-pipeline-automation` already requires — which
  stage, which `deployment:` job, which environment holds the approval, which service
  connection reaches which resource group, which variable group may be linked. Defines
  `.azure/azure-pipelines.yml`, the stage template, the bindings file that maps each ADO stage
  to a `STAGE-###`, and the three expression syntaxes and when each one is evaluated.
  Trigger phrases include: Azure Pipelines, Azure DevOps, ADO pipeline, azure-pipelines.yml,
  YAML pipeline, pipeline template, stage template, deployment job, ADO environment, approval
  gate, pre-deployment approval, service connection, variable group, AzureCLI@2, pipeline
  parameters, runOnce, lockBehavior, queue-time variable.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: platform-devops
  lifecycle_phases: [5, 7]
  used_by_agents: [navi-agent-devops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "devops, azure, azure-devops, pipelines, yaml, environments, approvals, service-connections, g7"
  model: sonnet
---

## When to use

The delivery pipeline is being written or repaired in Azure DevOps; a deploy step runs outside
a `deployment:` job and therefore outside every approval the project believes it has; a stage
ran in parallel with the one it was supposed to follow; a condition never fires because it was
written in macro syntax; a service connection scoped to a whole subscription is being used from
a build stage; or `delivery/ops/delivery-pipeline.md` names stages that nothing in the YAML
corresponds to.

## Rules

1. Write the pipeline at `.azure/azure-pipelines.yml` and every reusable fragment under
   `.azure/templates/`, and bind it at `delivery/ops/azure/pipeline-bindings.md`: one row per
   ADO stage naming the `STAGE-###` that `delivery/ops/delivery-pipeline.md` already defines.
   `navi-skill-pipeline-automation` says what a stage must guarantee; this file says which ADO
   object provides it, and the binding is what lets a reader check the two have not drifted.
2. Give every `- stage:` an id, a `displayName` and — on every stage after the first — an
   explicit `dependsOn`. A stage with no `dependsOn` does not run after the previous stage; it
   runs *in parallel with it*, which is how a deploy starts before its own tests finish and
   still shows green.
3. Run every step that reaches a deployable environment inside a `deployment:` job that names
   an `environment:`. Approvals, branch control, the exclusive lock and the deployment history
   are properties of the ADO environment object; a plain `job:` has none of them, and a
   pipeline whose deploy lives in a `job:` has no approval however many approvers the project
   has configured.
4. Record every environment in `## Environments` with its approvers, its checks and its branch
   control. Name people, not a group: ADO allows a member of an approving group to approve
   their own run unless *Approvers must not approve their own runs* is set, so the group is not
   the control the row appears to describe.
5. Give every environment its own service connection, scoped to that environment's resource
   group, and never reference a `deploy`-role connection from outside a `deployment:` job. One
   connection reused across environments means the staging pipeline holds production rights;
   `navi-skill-azure-identity-and-secrets` owns how that connection authenticates and to what.
6. Link only variable groups that hold no secret values, and record each one in
   `## Variable groups` with `Holds secrets: no`. A group's values are readable by every
   pipeline in the project that links it, and by anyone with Edit on that group;
   `navi-skill-azure-identity-and-secrets` owns what may never reach one and where it goes
   instead.
7. Pin every `task:` to an explicit major version — `AzureCLI@2`, not `AzureCLI` — and every
   `pool: vmImage:` to a dated image (`ubuntu-22.04`), never `ubuntu-latest`. Microsoft rolls
   the `*-latest` images and deprecates task majors on its own schedule, so an unpinned
   pipeline changes under a repository nobody committed to.
8. Type every template parameter. `parameters:` entries with no `type:` accept any string, so a
   caller that passes `resourceGroup` where `appName` was meant fails at `az` time in the
   deploy step rather than at template expansion, after the approval has been given.
9. Never write `$()` macro syntax inside a `condition:`. Conditions are evaluated before macro
   expansion, so `condition: eq('$(Build.Reason)', 'Manual')` compares the literal nine
   characters `$(Build.` and friends and is false forever. Use
   `eq(variables['Build.Reason'], 'Manual')`.
10. Choose the expression syntax by when the value has to exist: `${{ }}` is expanded at
    compile time and sees template parameters and statically-declared variables only; `$[ ]` is
    evaluated when the job starts and sees `dependencies` and `stageDependencies` outputs;
    `$()` is substituted at step execution and sees variable-group and runtime values. A
    variable-group value read with `${{ }}` expands to the empty string, silently, and the step
    runs against nothing.
11. Deploy every environment through the same steps template, parameterised. Two ADO stages
    bound to the same `STAGE-###` must `template:` the same file: the moment production has a
    template of its own, the path that reaches users is the one path nobody rehearsed.
12. Set `persistCredentials: false` on `checkout` — it is the default, and writing it is how a
    reviewer sees it was decided. A job that keeps `System.AccessToken` on disk gives every
    later step in that job, third-party tasks included, write access to the repository.
13. Resolve the image digest once in the build stage, publish it as a stage output variable
    (`##vso[task.setvariable variable=imageDigest;isOutput=true]`), and read it downstream with
    `$[ stageDependencies.<stage>.<job>.outputs['<step>.imageDigest'] ]`. A downstream stage
    that re-resolves a tag deploys whatever that tag points at now, which is the Azure spelling
    of the rebuild `navi-skill-pipeline-automation` forbids.
14. Make rollback a stage on the same `environment:` as the deploy it reverses, taking the
    digest to restore as a typed pipeline `parameters:` value. On the environment, it inherits
    the approval; as a separate pipeline or a manual portal action, it does not, and the one
    operation performed under the most pressure becomes the one with no record.
15. Set `lockBehavior: sequential` on every stage that carries a `deployment:` job. ADO runs
    two queued runs against the same environment concurrently by default, and two deploys
    interleaving is an outage whose cause is in neither run's log.
16. Keep the YAML the only definition. A classic release pipeline, a variable edited in the UI,
    or a variable marked *Settable at queue time* makes a run unreproducible from the
    repository. Record every one that must exist in `## Queue-time variables` with the task that
    removes it, and `none` when there are none.

## Decision table

| Observed condition | Required action |
|---|---|
| A stage after the first has no `dependsOn` | Add it; ADO runs an undeclared stage in parallel, not in sequence |
| A deploy step sits in a `job:` | Move it into a `deployment:` job with `environment:`; approvals live on the environment |
| A `deployment:` job names no `environment:` | Name one; without it the job has no approval, no lock and no history |
| An environment's approvers are a group | Name people, and set *Approvers must not approve their own runs* |
| One service connection is used by staging and production | Split it per environment, scoped to that environment's resource group |
| A `deploy`-role connection is referenced outside a `deployment:` job | Move the step inside the deployment job, or give it a `build`-role connection |
| A linked variable group holds a secret value | Unlink it; see `navi-skill-azure-identity-and-secrets` for where the value goes |
| A `task:` has no `@<major>` | Pin the major version; task majors are deprecated on Microsoft's schedule |
| `vmImage:` ends in `-latest` | Pin a dated image; `*-latest` rolls under you |
| A template parameter has no `type:` | Type it; untyped parameters accept any string and fail after the approval |
| A `condition:` contains `$(` | Rewrite with `variables['...']`; conditions evaluate before macro expansion |
| A variable-group value is read with `${{ }}` | Read it with `$()`; `${{ }}` expanded before the group was linked and produced empty |
| Production has a deploy template of its own | Collapse both stages onto one template with parameters |
| A downstream stage resolves an image tag | Publish the digest as a stage output and read it with `$[ stageDependencies... ]` |
| Rollback is a separate pipeline or a portal action | Make it a stage on the same environment, taking the digest as a typed parameter |
| Two runs can deploy the same environment at once | Set `lockBehavior: sequential` on the stage |
| A variable is settable at queue time | Record it in `## Queue-time variables` with the task that removes it |
| An ADO stage has no `STAGE-###` in the bindings file | Bind it, or delete the stage; an unbound stage is outside the pipeline of record |

## Template

Three files. Copy the first into `.azure/azure-pipelines.yml`:

```yaml
# Azure DevOps pipeline for web-shell.
# Each stage is bound to a STAGE-### of delivery/ops/delivery-pipeline.md in
# delivery/ops/azure/pipeline-bindings.md. That file, not this one, is where a
# reviewer checks the ADO objects against the pipeline of record.

parameters:
  - name: rollbackDigest
    displayName: Digest to restore (rollback_production only)
    type: string
    default: none

trigger:
  branches:
    include:
      - main

pr:
  branches:
    include:
      - main

variables:
  # Non-secret only. See ## Variable groups in pipeline-bindings.md.
  - group: web-shell-common
  - name: imageRepository
    value: web-shell

stages:
  # --- STAGE-001 -----------------------------------------------------------
  - stage: build
    displayName: Build once and publish the digest
    jobs:
      - job: build_image
        displayName: Build and push to ACR
        pool:
          vmImage: ubuntu-22.04
        steps:
          - checkout: self
            fetchDepth: 1
            persistCredentials: false
          - task: AzureCLI@2
            name: publish
            displayName: Build, push, and emit the digest
            inputs:
              azureSubscription: sc-web-shell-build
              scriptType: bash
              scriptLocation: inlineScript
              inlineScript: |
                set -euo pipefail
                az acr build \
                  --registry crwebshellweu \
                  --image "$(imageRepository):$(Build.SourceVersion)" \
                  --file Dockerfile .
                DIGEST=$(az acr repository show \
                  --name crwebshellweu \
                  --image "$(imageRepository):$(Build.SourceVersion)" \
                  --query digest --output tsv)
                echo "##vso[task.setvariable variable=imageDigest;isOutput=true]$DIGEST"

  # --- STAGE-002 -----------------------------------------------------------
  - stage: test
    displayName: Unit and contract tests
    dependsOn: build
    jobs:
      - job: unit
        displayName: npm test
        pool:
          vmImage: ubuntu-22.04
        steps:
          - checkout: self
            persistCredentials: false
          - task: Npm@1
            displayName: Install
            inputs:
              command: ci
          - task: Npm@1
            displayName: Test
            inputs:
              command: custom
              customCommand: test

  # --- STAGE-003 -----------------------------------------------------------
  - stage: scan
    displayName: Dependency and secret scan
    dependsOn: build
    jobs:
      - job: scan
        displayName: Advisory and credential scan
        pool:
          vmImage: ubuntu-22.04
        steps:
          - checkout: self
            persistCredentials: false
          - task: Npm@1
            displayName: Audit
            inputs:
              command: custom
              customCommand: audit --audit-level=high --omit=dev

  # --- STAGE-004, staging half --------------------------------------------
  - stage: deploy_staging
    displayName: Promote the digest to staging
    dependsOn:
      - test
      - scan
    lockBehavior: sequential
    variables:
      - name: imageDigest
        value: "$[ stageDependencies.build.build_image.outputs['publish.imageDigest'] ]"
    jobs:
      - deployment: staging
        displayName: Deploy to staging
        environment: web-shell-staging
        pool:
          vmImage: ubuntu-22.04
        strategy:
          runOnce:
            deploy:
              steps:
                - template: templates/deploy-stage.yml
                  parameters:
                    serviceConnection: sc-web-shell-staging
                    resourceGroup: rg-webshell-stg-weu
                    appName: ca-webshell-stg-weu
                    imageDigest: $(imageDigest)

  # --- STAGE-004, production half -----------------------------------------
  - stage: deploy_production
    displayName: Promote the same digest to production
    dependsOn: deploy_staging
    condition: succeeded()
    lockBehavior: sequential
    variables:
      - name: imageDigest
        value: "$[ stageDependencies.build.build_image.outputs['publish.imageDigest'] ]"
    jobs:
      - deployment: production
        displayName: Deploy to production
        environment: web-shell-prod
        pool:
          vmImage: ubuntu-22.04
        strategy:
          runOnce:
            deploy:
              steps:
                - template: templates/deploy-stage.yml
                  parameters:
                    serviceConnection: sc-web-shell-prod
                    resourceGroup: rg-webshell-prd-weu
                    appName: ca-webshell-prd-weu
                    imageDigest: $(imageDigest)

  # --- STAGE-005 -----------------------------------------------------------
  - stage: rollback_production
    displayName: Restore the previous digest in production
    dependsOn: []
    lockBehavior: sequential
    jobs:
      - deployment: rollback
        displayName: Redeploy a recorded digest
        environment: web-shell-prod
        pool:
          vmImage: ubuntu-22.04
        strategy:
          runOnce:
            deploy:
              steps:
                - template: templates/deploy-stage.yml
                  parameters:
                    serviceConnection: sc-web-shell-prod
                    resourceGroup: rg-webshell-prd-weu
                    appName: ca-webshell-prd-weu
                    imageDigest: ${{ parameters.rollbackDigest }}
```

Copy the second into `.azure/templates/deploy-stage.yml` — the one deploy path both
environments take:

```yaml
# The single deploy path. deploy_staging, deploy_production and
# rollback_production all expand this file; nothing about an environment is
# expressed here except through a typed parameter.

parameters:
  - name: serviceConnection
    type: string
  - name: resourceGroup
    type: string
  - name: appName
    type: string
  - name: imageDigest
    type: string
  - name: healthPath
    type: string
    default: /healthz
  - name: healthTimeoutSeconds
    type: number
    default: 120

steps:
  - task: AzureCLI@2
    displayName: Deploy ${{ parameters.appName }} by digest
    inputs:
      azureSubscription: ${{ parameters.serviceConnection }}
      scriptType: bash
      scriptLocation: inlineScript
      inlineScript: |
        set -euo pipefail
        test "${{ parameters.imageDigest }}" != "none"
        az containerapp update \
          --name "${{ parameters.appName }}" \
          --resource-group "${{ parameters.resourceGroup }}" \
          --image "crwebshellweu.azurecr.io/web-shell@${{ parameters.imageDigest }}"

  - task: AzureCLI@2
    displayName: Health check before the revision takes traffic
    inputs:
      azureSubscription: ${{ parameters.serviceConnection }}
      scriptType: bash
      scriptLocation: inlineScript
      inlineScript: |
        set -euo pipefail
        FQDN=$(az containerapp show \
          --name "${{ parameters.appName }}" \
          --resource-group "${{ parameters.resourceGroup }}" \
          --query properties.configuration.ingress.fqdn --output tsv)
        DEADLINE=$(( $(date +%s) + ${{ parameters.healthTimeoutSeconds }} ))
        until curl --fail --silent "https://$FQDN${{ parameters.healthPath }}"; do
          test "$(date +%s)" -lt "$DEADLINE"
          sleep 5
        done
```

Copy the third into `delivery/ops/azure/pipeline-bindings.md`:

```markdown
# Azure DevOps bindings — web-shell

The pipeline of record is `delivery/ops/delivery-pipeline.md`, which says what each
`STAGE-###` must guarantee. The YAML that runs it is `.azure/azure-pipelines.yml`. This file is
the join: one row per ADO stage, naming the Azure objects that carry the guarantee. A stage in
one and not the other is drift, and it is visible here and nowhere else.

ADO project: `navikenz/web-shell`. Agent pool: Microsoft-hosted, `ubuntu-22.04`.

## Stage bindings

| ADO stage | STAGE-### | Deploy template | Service connection | Environment | Variable group |
|---|---|---|---|---|---|
| build | STAGE-001 | — | sc-web-shell-build | — | web-shell-common |
| test | STAGE-002 | — | — | — | web-shell-common |
| scan | STAGE-003 | — | — | — | web-shell-common |
| deploy_staging | STAGE-004 | templates/deploy-stage.yml | sc-web-shell-staging | web-shell-staging | web-shell-common |
| deploy_production | STAGE-004 | templates/deploy-stage.yml | sc-web-shell-prod | web-shell-prod | web-shell-common |
| rollback_production | STAGE-005 | templates/deploy-stage.yml | sc-web-shell-prod | web-shell-prod | web-shell-common |

`deploy_staging` and `deploy_production` are both STAGE-004 and both expand the same template.
That is the point: the path to production is the path staging rehearsed.

## Service connections

| Connection | Role | Scope | Owner |
|---|---|---|---|
| sc-web-shell-build | build | rg-webshell-build-weu | Ana Costa |
| sc-web-shell-staging | deploy | rg-webshell-stg-weu | Ana Costa |
| sc-web-shell-prod | deploy | rg-webshell-prd-weu | Dan Okafor |

How each one authenticates, and what it is allowed to do inside its scope, is recorded in
`delivery/ops/azure/identity.md`.

## Environments

| Environment | Approvers | Checks | Branch control |
|---|---|---|---|
| web-shell-staging | Ana Costa | approval; self-approval disallowed | refs/heads/main |
| web-shell-prod | Dan Okafor, Priya Raman | approval; self-approval disallowed; exclusive lock; business-hours window | refs/heads/main |

Whether these checks are actually configured on the environment objects in the ADO project
cannot be read from this repository — see `## Validation`.

## Variable groups

| Group | Holds secrets | Linked by | Backed by |
|---|---|---|---|
| web-shell-common | no | every stage | — |

## Queue-time variables

| Variable | Why it exists | Owner | Removed by |
|---|---|---|---|
| none | — | — | — |
```

## Checklist

- [ ] `.azure/azure-pipelines.yml` exists and `delivery/ops/azure/pipeline-bindings.md` has a row per ADO stage
- [ ] Every `STAGE-###` in the bindings is defined in `delivery/ops/delivery-pipeline.md`
- [ ] Every stage after the first declares `dependsOn`
- [ ] Every stage carries a `displayName`
- [ ] Every deploy step runs in a `deployment:` job with `environment:`
- [ ] Every environment has a row naming people as approvers, its checks and its branch control
- [ ] Every service connection has a row with a role, a scope and an owner
- [ ] No `deploy`-role connection is referenced outside a `deployment:` job
- [ ] Every linked variable group is recorded `Holds secrets: no`
- [ ] Every `task:` carries an explicit `@<major>`
- [ ] No `vmImage:` ends in `-latest`
- [ ] Every template parameter has a `type:`
- [ ] No `condition:` contains `$(`
- [ ] Stages bound to the same `STAGE-###` expand the same template
- [ ] `checkout` sets `persistCredentials: false`
- [ ] The rollback stage sits on the same `environment:` as the deploy it reverses
- [ ] Every stage carrying a `deployment:` job sets `lockBehavior: sequential`
- [ ] `## Queue-time variables` exists, and says `none` when there are none

## Anti-patterns

**The approval that is not on the path.** The project has an environment called
`web-shell-prod` with two approvers, and the deploy runs in `- job: deploy` with an
`AzureCLI@2` step. The approval is configured, visible in the portal, and never consulted —
checks fire when a `deployment:` job targets the environment, and this is not one. Move the
step into `- deployment:` with `environment: web-shell-prod`.

**The stage that was never sequential.**

```yaml
- stage: test
- stage: deploy_production      # no dependsOn
```

Both start at once. The deploy finishes first on a good day, and the test failure arrives after
production is already serving the change. Write `dependsOn: test`.

**The condition that is always false.** `condition: eq('$(Build.Reason)', 'Manual')` on the
rollback stage. Conditions are evaluated before macro expansion, so the comparison is against
the literal text; the stage never runs, including during the incident it exists for. Write
`condition: eq(variables['Build.Reason'], 'Manual')`.

**The empty secret.** `- script: ./deploy.sh ${{ variables.apiEndpoint }}` where
`apiEndpoint` comes from a linked variable group. `${{ }}` is expanded at compile time, before
the group is read, so the script runs with an empty argument and deploys against the default
endpoint. Use `$(apiEndpoint)`.

**One connection, every environment.** `sc-web-shell` is Contributor on the subscription and is
used by build, staging and production. Any pull request that can edit the pipeline can now
deploy to production from a branch. Split per environment, scope to the resource group, and
record which is which.

**Production's own template.** `deploy_staging` expands `templates/deploy-stage.yml`;
`deploy_production` expands `templates/deploy-prod.yml`, added because production needed one
extra flag. The flag is the only thing staging now fails to rehearse, and it is the flag the
next incident is about. Parameterise the one template.

**The tag that moved.** The build stage pushes `web-shell:$(Build.SourceVersion)`; the deploy
stage pulls `web-shell:latest`. Two different artefacts, one pipeline run, and the release
record names the wrong one. Publish the digest as a stage output and read it with `$[ ]`.

**The queue-time escape hatch.** `environmentName` is marked *Settable at queue time* so an
engineer can deploy a branch to production once. It stays. Six months later nobody can tell
from the repository which environment a given run touched. Record it, with the task that
removes it.

## Validation

```bash
# Every check here reads files in this repository. None of them calls `az` and none needs a
# subscription: the artefact under test is the pipeline definition, not the tenant.
#
# NOT CHECKABLE FROM FILES — these are properties of the Azure DevOps project, not of the
# repository, and this block deliberately does not pretend otherwise:
#   * whether the approvals and checks named in ## Environments are actually configured on the
#     environment objects  (`az pipelines environment show`, authenticated, would be needed)
#   * whether a service connection's scope in Azure matches the Scope column
#   * whether a variable group really holds no secret values
#   * whether `Settable at queue time` is set on any variable
# The rows in pipeline-bindings.md are the declared intent; confirming them against the project
# is a review step with a signed-in operator, recorded in the G7 evidence index.

PIPE=.azure/azure-pipelines.yml
BIND=delivery/ops/azure/pipeline-bindings.md

test -f "$PIPE" || echo "no $PIPE"
test -f "$BIND" || echo "no $BIND"

# Task majors are pinned
grep -rnE '^[[:space:]]*-?[[:space:]]*task:' .azure/ 2>/dev/null \
  | grep -vE 'task:[[:space:]]*[A-Za-z0-9_.-]+@[0-9]+[[:space:]]*$' \
  | sed 's/^/task reference with no pinned major version: /'

# Pool images are dated, not rolling
grep -rn 'vmImage:.*-latest' .azure/ 2>/dev/null \
  | sed 's/^/floating pool image: /'

# The job token is not left on disk
grep -rn 'persistCredentials:[[:space:]]*true' .azure/ 2>/dev/null \
  | sed 's/^/checkout leaves System.AccessToken on disk: /'

# Conditions are evaluated before macro expansion
grep -rn 'condition:.*\$(' .azure/ 2>/dev/null \
  | sed 's/^/macro syntax in a condition, evaluated before macro expansion: /'

# Structure, and the bindings against the pipeline of record
python3 - <<'PY'
import pathlib, re, sys
try:
    import yaml
except ImportError:
    sys.exit("pyyaml is not installed, so the pipeline structure checks did not run "
             "(python3 -m pip install pyyaml)")

PIPE = pathlib.Path(".azure/azure-pipelines.yml")
BIND = pathlib.Path("delivery/ops/azure/pipeline-bindings.md")
NEUTRAL = pathlib.Path("delivery/ops/delivery-pipeline.md")
if not (PIPE.exists() and BIND.exists()):
    sys.exit(0)                      # the `test -f` above already said so

bind_text = BIND.read_text(encoding="utf-8")

def rows(heading):
    out, on = [], False
    for line in bind_text.splitlines():
        if line.startswith("## "):
            on = line[3:].strip() == heading
            continue
        if on and line.startswith("|"):
            if re.match(r"^\|[\s:|-]+$", line):
                continue
            out.append([c.strip() for c in line.strip().strip("|").split("|")])
    if not out:
        print(f"pipeline-bindings.md has no '## {heading}' table")
        return []
    return out[1:]

stage_rows = rows("Stage bindings")
conn_rows = rows("Service connections")
env_rows = rows("Environments")
grp_rows = rows("Variable groups")
if "## Queue-time variables" not in bind_text:
    print("pipeline-bindings.md has no '## Queue-time variables' section "
          "(write `none` when there are none)")

bound = {r[0]: r for r in stage_rows if r and r[0]}
conn_role = {r[0]: r[1] for r in conn_rows if len(r) > 1}
conn_scope = {r[0]: r[2] for r in conn_rows if len(r) > 2}
env_row = {r[0]: r for r in env_rows if r and r[0]}
grp_secrets = {r[0]: r[1] for r in grp_rows if len(r) > 1}

neutral = NEUTRAL.read_text(encoding="utf-8") if NEUTRAL.exists() else ""
for row in stage_rows:
    sid = row[1] if len(row) > 1 else ""
    if not re.fullmatch(r"STAGE-\d{3,}", sid):
        print(f"stage binding for '{row[0]}' names no STAGE-###")
        continue
    if f"### {sid} " not in neutral:
        print(f"{sid} is named in pipeline-bindings.md but not defined in "
              f"delivery/ops/delivery-pipeline.md")

# Stages bound to the same STAGE-### must expand the same template
by_stage_id = {}
for row in stage_rows:
    if len(row) > 2 and re.fullmatch(r"STAGE-\d{3,}", row[1]):
        by_stage_id.setdefault(row[1], set()).add(row[2])
for sid, templates in sorted(by_stage_id.items()):
    real = {t for t in templates if t and t != "—"}
    if len(real) > 1:
        print(f"{sid} is bound to {len(real)} different deploy templates "
              f"({', '.join(sorted(real))}) — production must take the path staging rehearsed")

CONN_KEYS = {"azureSubscription", "serviceConnection", "connectedServiceName",
             "azureSubscriptionEndpoint", "azureResourceManagerConnection"}

def walk(node):
    if isinstance(node, dict):
        for k, v in node.items():
            yield k, v
            yield from walk(v)
    elif isinstance(node, list):
        for item in node:
            yield from walk(item)

def strings(node, keys):
    return {v for k, v in walk(node)
            if k in keys and isinstance(v, str) and "${{" not in v and "$(" not in v}

doc = yaml.safe_load(PIPE.read_text(encoding="utf-8"))
stages = (doc or {}).get("stages") or []
if not stages:
    print(f"{PIPE} declares no stages")

for index, stage in enumerate(stages):
    stage_name = stage.get("stage")
    if not stage_name:
        print(f"stage #{index + 1} has no `stage:` id — ADO autonames it and every "
              f"dependsOn that points at it breaks silently")
        continue
    if not stage.get("displayName"):
        print(f"{stage_name}: no displayName")
    if index and "dependsOn" not in stage:
        print(f"{stage_name}: no dependsOn — ADO runs a stage with no dependsOn in parallel "
              f"with the one before it, not after it")
    if stage_name not in bound:
        print(f"{stage_name}: ADO stage with no row in '## Stage bindings' of pipeline-bindings.md")

    jobs = stage.get("jobs") or []
    environments = set()
    if any("deployment" in j for j in jobs) and stage.get("lockBehavior") != "sequential":
        print(f"{stage_name}: carries a deployment job and no `lockBehavior: sequential` — two "
              f"queued runs deploy the same environment concurrently by default")
    for job in jobs:
        if "deployment" in job:
            env = job.get("environment")
            if not env:
                print(f"{stage_name}/{job['deployment']}: deployment job that names no environment "
                      f"— approvals, locks and history live on the environment object")
            else:
                environments.add(env if isinstance(env, str) else env.get("name", ""))
    for conn in sorted(strings(stage, CONN_KEYS)):
        if conn not in conn_role:
            print(f"{stage_name}: service connection '{conn}' has no row in "
                  f"'## Service connections' of pipeline-bindings.md")
            continue
        if conn_role[conn] == "deploy" and not environments:
            print(f"{stage_name}: uses deploy-role connection '{conn}' outside any deployment job "
                  f"with an environment — nothing approves this step")
    for env in sorted(e for e in environments if e):
        row = env_row.get(env)
        if not row:
            print(f"{stage_name}: environment '{env}' has no row in '## Environments'")
            continue
        approvers = row[1] if len(row) > 1 else ""
        checks = row[2] if len(row) > 2 else ""
        if not approvers or approvers == "—":
            print(f"environment '{env}': no approvers recorded")
        elif re.search(r"(?i)\bteam\b|\bgroup\b|@", approvers):
            print(f"environment '{env}': approvers '{approvers}' is a group, not people — "
                  f"a group member can approve their own run")
        if not checks or checks == "—":
            print(f"environment '{env}': no checks recorded")

for group in sorted(strings(doc, {"group"})):
    if group not in grp_secrets:
        print(f"pipeline links variable group '{group}', which has no row in "
              f"'## Variable groups' of pipeline-bindings.md")
    elif grp_secrets[group].lower() != "no":
        print(f"variable group '{group}' is recorded as holding secrets and is linked anyway")

for conn, scope in sorted(conn_scope.items()):
    if not scope or scope == "—":
        print(f"service connection '{conn}': no scope recorded")

# Every template the pipeline expands exists, and every parameter it declares is typed
seen = set()
for key, value in walk(doc):
    if key == "template" and isinstance(value, str):
        seen.add(value.split("@")[0])
for rel in sorted(seen):
    path = PIPE.parent / rel
    if not path.exists():
        print(f"pipeline expands '{rel}', which is not a file under {PIPE.parent}/")
        continue
    tpl = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    for param in tpl.get("parameters") or []:
        if isinstance(param, dict) and "type" not in param:
            print(f"{rel}: parameter '{param.get('name')}' has no type — an untyped "
                  f"parameter accepts any string and fails after the approval, not before it")
PY
```

Each command prints nothing when the rule holds. The structural block is the one to run before
G7: it is the only mechanical check that the ADO stages and the `STAGE-###` entries
`delivery/ops/delivery-pipeline.md` records have not drifted apart.
