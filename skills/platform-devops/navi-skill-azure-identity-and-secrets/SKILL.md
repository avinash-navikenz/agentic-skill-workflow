---
name: navi-skill-azure-identity-and-secrets
description: >
  Use when something in Azure has to prove who it is, or when a value that must not be read is
  about to be put somewhere readable. Defines the identity register, workload identity
  federation for Azure DevOps service connections so no client secret exists to rotate, the
  managed identity a workload uses to read its own secrets, role assignments scoped to a
  resource group with the reason for that scope written down, the Key Vault settings, and the
  list of what must never reach an Azure DevOps variable group.
  Trigger phrases include: managed identity, user-assigned identity, system-assigned identity,
  workload identity federation, federated credential, OIDC to Azure, service principal, client
  secret, app registration, Key Vault, RBAC authorization, purge protection, role assignment,
  least privilege, Azure RBAC scope, variable group secret, secret rotation, listKeys,
  connection string, shared key access, Entra ID.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: platform-devops
  lifecycle_phases: [5, 7]
  used_by_agents: [navi-agent-devops-engineer, navi-agent-security-engineer]
  owner: avinash.negi@navikenz.com
  tags: "devops, azure, identity, managed-identity, federated-credentials, key-vault, rbac, least-privilege, secrets"
  model: sonnet
---

## When to use

An Azure DevOps service connection is being created and the dialogue is offering a client
secret; a workload needs to read a secret and someone is about to pass it in from the pipeline;
a role assignment is being made and the quickest scope is the subscription; a Key Vault is being
created and the defaults are being accepted; a connection string is about to be added to a
variable group; or a secret has to be rotated and nobody knows which of fourteen places holds a
copy.

## Rules

1. Record every principal at `delivery/ops/azure/identity.md` as `ID-###` with its type, what
   uses it, a person as owner and a review date. A principal nobody has written down is a
   principal nobody removes, and a managed identity costs nothing and is invisible, so the
   estate accumulates standing grants that no workload is behind.
2. Authenticate every Azure DevOps service connection by workload identity federation. There is
   then no client secret: nothing to store, nothing to leak, nothing to rotate, and no expiry
   date to be surprised by during a release. A connection created with a secret is an expiry
   nobody has diarised.
3. Give every federated credential a specific `subject`, naming the organisation, the project
   and the connection — `sc://<org>/<project>/<connection>`. A wildcard subject lets any
   pipeline in the organisation obtain that identity's token, which is the whole of the
   boundary this mechanism exists to draw.
4. Give every Azure workload a user-assigned managed identity, named by the landing zone's
   convention and deployed in the same template as its role assignments. A system-assigned
   identity disappears with the resource and takes its role assignments with it, so a rebuild
   silently loses access it was never recorded as having.
5. Never create an app registration with a client secret or a certificate for an Azure-to-Azure
   call. Every Azure service that can be called supports Entra ID authentication, and a stored
   credential adds an expiry, a store and a rotation to something that needed none of them.
6. Scope every role assignment to a resource group or narrower, and record it as `RBAC-###`
   with the role, the scope and **why that scope** — the narrowest one that lets the work
   happen. A scope chosen for speed is a scope nobody revisits.
7. Never assign `Owner` or `User Access Administrator` to a workload or a pipeline at any scope.
   Both carry the right to grant further rights, so an assignment of either is not a permission
   but a permission to acquire permissions, and no audit of the role assignments will show what
   it was used for.
8. Never assign `Contributor` above a resource group. Contributor on a subscription includes
   every resource group in it, including the ones that belong to other workloads and the one the
   landing zone put the registry in.
9. Turn on RBAC authorization on every Key Vault and never use access policies. Access policies
   are a second, parallel permission model with no inheritance, no PIM, and no `az role
   assignment list` to audit; two models means a vault whose real access is the union of both.
10. Turn on soft delete and purge protection on every vault, with 90 days of retention. Without
    purge protection a deletion is permanent and immediate, so the fastest route to destroying a
    production secret is one command that nobody can undo.
11. Disable public network access on every vault holding a production secret and reach it
    through a private endpoint. A vault whose RBAC is correct and whose firewall is open is one
    leaked token away from being read from anywhere.
12. Let the workload read its own secrets at runtime, through its own managed identity — a
    Container Apps secret reference, a Key Vault reference in App Service, or the CSI driver on
    AKS. A secret the pipeline reads is a secret in the pipeline's scope, which means it is in
    reach of every task in that job and every person who can edit the pipeline.
13. Reference a secret by name without a version, so a new version is picked up by the next
    revision. Where a version must be pinned, record the task that unpins it: a pinned reference
    makes rotation a code change, and a rotation that needs a release is a rotation that waits.
14. Never put a value in an Azure DevOps variable group that would matter if it were read.
    `## Never in a variable group` lists the classes. Marking a variable `secret` is not a
    control: it masks the value in the log by string match, and any pipeline in the project that
    links the group can read it, transform it, and print the transform.
15. Never fetch a key where Entra ID authentication exists — no `listKeys()`, no
    `listAccountSas()`, no account connection string — and disable shared key access on the
    storage account so the route is closed rather than merely unused.
16. Record every exception — a scope above a resource group, a stored client secret, a vault
    reachable from the internet — in `## Exceptions` with who accepted it, why, and the date it
    ends. An exception with no end date is the new standard.

## Decision table

| Observed condition | Required action |
|---|---|
| A service connection is being created with a client secret | Use workload identity federation; there is then nothing to store or rotate |
| A federated credential's subject contains `*` | Narrow it to `sc://<org>/<project>/<connection>` |
| A workload uses a system-assigned identity | Move to user-assigned, deployed with its role assignments |
| An app registration with a secret calls an Azure service | Replace it with a managed identity |
| A role assignment is scoped to a subscription | Re-scope to the resource group, or record a dated exception |
| `Owner` or `User Access Administrator` is assigned to a workload | Remove it; it is a permission to acquire permissions |
| `Contributor` is assigned above a resource group | Re-scope; it covers every other workload's groups too |
| A Key Vault uses access policies | Turn on `enableRbacAuthorization` and remove the policies |
| A vault has no purge protection | Enable it, with 90 days of soft-delete retention |
| A production vault allows public network access | Disable it and add a private endpoint |
| The pipeline reads a secret and passes it to the workload | Let the workload read it, through its own identity, at runtime |
| A secret reference pins a version | Unpin it, or record the task that will |
| A value that would matter if read is in a variable group | Move it to Key Vault; marking it `secret` is not a control |
| `listKeys()` or a connection string appears in a template | Use Entra ID authentication and disable shared key access |
| A secret has no rotation owner or no last-rotated date | Add both; a person, and a date |
| A principal has no review date, or nothing uses it | Add the date, or delete the principal and its assignments |
| An exception has no end date | Give it one, or it is the new standard |

## Template

Three files. Copy the first into `delivery/ops/azure/identity.md`:

```markdown
# Azure identity and secrets — web-shell

Every principal this workload runs as, everything each one is allowed to do, and where each
secret lives. The deployable form is `infra/azure/identity/main.bicep`. The Azure DevOps side
of it — which connection is used by which stage — is in
`delivery/ops/azure/pipeline-bindings.md`; this file says how each one authenticates.

## Principals

| Id | Principal | Type | Used by | Owner | Review by |
|---|---|---|---|---|---|
| ID-001 | id-webshell-prd-weu | user-assigned managed identity | ca-webshell-prd-weu at runtime, and the production service connection | Dan Okafor | 2027-03-31 |
| ID-002 | sc-web-shell-prod | workload identity federation | deploy_production and rollback_production | Dan Okafor | 2027-03-31 |
| ID-003 | sc-web-shell-staging | workload identity federation | deploy_staging | Ana Costa | 2027-03-31 |
| ID-004 | sc-web-shell-build | workload identity federation | build | Ana Costa | 2027-03-31 |

No principal in this workload holds a client secret or a certificate, so there is nothing here
with an expiry date and nothing here to rotate on a schedule.

## Federated credentials

| Principal | Issuer | Subject | Audience | For |
|---|---|---|---|---|
| id-webshell-prd-weu | the Entra ID issuer of the navikenz Azure DevOps organisation | sc://navikenz/web-shell/sc-web-shell-prod | api://AzureADTokenExchange | the production service connection |

The subject names one connection in one project. Widening it to the project, or to the
organisation, would let any pipeline anyone can create obtain this identity's token.

## Role assignments

| Id | Principal | Role | Scope | Why this scope | Review by |
|---|---|---|---|---|---|
| RBAC-001 | id-webshell-prd-weu | Key Vault Secrets User | kv-webshell-prd-weu | the workload reads its own secrets and nothing else; the vault is the narrowest scope that allows it | 2027-03-31 |
| RBAC-002 | id-webshell-prd-weu | AcrPull | rg-webshell-bld-weu | the registry is shared across workloads and lives in the platform subscription; the group holding it is the narrowest scope reachable from here | 2027-03-31 |
| RBAC-003 | sc-web-shell-prod | Contributor | rg-webshell-prd-weu | the deploy replaces the container app's image and reads its revision state; Contributor on this one group is what that needs and no more | 2027-03-31 |

## Key Vaults

| Vault | Resource group | RBAC authorization | Purge protection | Soft-delete days | Read by |
|---|---|---|---|---|---|
| kv-webshell-prd-weu | rg-webshell-prd-weu | enabled | enabled | 90 | id-webshell-prd-weu |

## Secrets

| Secret | Vault | Read by | How it reaches the workload | Rotation owner | Last rotated |
|---|---|---|---|---|---|
| sessions-signing-key | kv-webshell-prd-weu | ca-webshell-prd-weu | a Container Apps secret reference, unversioned, resolved by id-webshell-prd-weu when a revision starts | Dan Okafor | 2026-09-12 |
| upstream-api-token | kv-webshell-prd-weu | ca-webshell-prd-weu | a Container Apps secret reference, unversioned, resolved by id-webshell-prd-weu when a revision starts | Priya Raman | 2026-08-30 |

Neither value is ever read by a pipeline. The deploy sets a reference; the platform resolves it
at revision start as the workload's own identity, so no release has ever had either value in
its scope.

## Never in a variable group

An Azure DevOps variable group is readable by every pipeline in the project that links it and by
everyone with Edit on the group. Marking a variable `secret` masks it in the log by string
match; it does not stop a pipeline from reading it. None of the following goes in one, in any
form, masked or not:

- a Key Vault secret's value
- a storage account key, a SAS token, or any connection string containing `AccountKey=`,
  `SharedAccessSignature` or a password
- a service principal client secret or a certificate, including its base64 form
- a personal access token for Azure DevOps, GitHub, Jira or Confluence
- a database password or any credential that would still work if it were printed
- an SSH or signing private key

What goes there instead: names and identifiers that are not secret — a registry name, a vault
name, an image repository, a health path. The values above live in
`kv-webshell-prd-weu` and are read by the workload's own identity at runtime, so no pipeline
ever holds one.

## Exceptions

| Id | What | Accepted by | Reason | Expires |
|---|---|---|---|---|
| none | — | — | — | — |
```

Copy the second into `infra/azure/identity/main.bicep`:

```bicep
// Identity and secret handling for the web-shell workload.
// Register: delivery/ops/azure/identity.md.

targetScope = 'resourceGroup'

@description('Azure region the resources are created in.')
param location string = resourceGroup().location

@description('Entra ID issuer of the Azure DevOps organisation, read from the ADO project settings.')
param adoIssuer string

@description('Name of the shared container registry the workload pulls images from.')
param registryName string = 'crwebshellweu'

@description('Resource group, in the platform subscription, that holds the shared registry.')
param registryResourceGroup string = 'rg-webshell-bld-weu'

// Built-in role definition ids. These are the same in every Azure tenant, so
// they are not the tenant-specific GUIDs the landing zone forbids in a template.
var roles = {
  keyVaultSecretsUser: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  acrPull: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
}

// User-assigned, not system-assigned: the role assignments below outlive any
// rebuild of the container app, and a system-assigned identity would take them
// with it the first time the app was recreated.
resource workloadIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-webshell-prd-weu'
  location: location
}

// The Azure DevOps service connection authenticates as this identity. No client
// secret is created, stored, or rotated, because none exists.
resource adoFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: workloadIdentity
  name: 'ado-sc-web-shell-prod'
  properties: {
    issuer: adoIssuer
    subject: 'sc://navikenz/web-shell/sc-web-shell-prod'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-webshell-prd-weu'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: registryName
  scope: resourceGroup(registryResourceGroup)
}

// RBAC-001. Scoped to the vault, not the resource group: the workload reads its
// own secrets and has no reason to read anything else in the group.
resource secretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, workloadIdentity.id, roles.keyVaultSecretsUser)
  properties: {
    roleDefinitionId: roles.keyVaultSecretsUser
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// RBAC-002. AcrPull only: the workload pulls images and never pushes one.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, workloadIdentity.id, roles.acrPull)
  properties: {
    roleDefinitionId: roles.acrPull
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output workloadIdentityResourceId string = workloadIdentity.id
output vaultUri string = vault.properties.vaultUri
```

Copy the third into `.azure/variable-groups.yml` — the review surface for what the Azure DevOps
variable groups contain:

```yaml
# The declared contents of every Azure DevOps variable group this project links.
# Azure DevOps holds the live values; this file is where a reviewer sees what a
# group is for without needing Edit rights on it, and where a pull request shows
# a variable being added.
#
# No group here holds a secret. See ## Never in a variable group in
# delivery/ops/azure/identity.md for what that means and where those values live.

groups:
  - name: web-shell-common
    kind: plain
    holdsSecrets: false
    owner: Ana Costa
    linkedBy: .azure/azure-pipelines.yml
    variables:
      - name: imageRepository
        value: web-shell
      - name: registryName
        value: crwebshellweu
      - name: healthPath
        value: /healthz
      - name: vaultName
        value: kv-webshell-prd-weu
      - name: containerAppProduction
        value: ca-webshell-prd-weu
      - name: containerAppStaging
        value: ca-webshell-stg-weu
```

## Checklist

- [ ] `delivery/ops/azure/identity.md` exists, with all seven sections
- [ ] Every service connection in `pipeline-bindings.md` has an `ID-###` row
- [ ] Every service connection's type is `workload identity federation`
- [ ] Every federated credential's subject names one connection, with no wildcard
- [ ] The subject in the register and the subject in the Bicep are the same string
- [ ] No principal holds a client secret or a certificate, or an `## Exceptions` row says why
- [ ] Every `RBAC-###` names a role, a scope and why that scope
- [ ] No `Owner` or `User Access Administrator` is assigned to a workload or a pipeline
- [ ] No role assignment is scoped above a resource group
- [ ] Every vault has `enableRbacAuthorization`, `enableSoftDelete` and `enablePurgeProtection` true
- [ ] Every vault has 90 days of soft-delete retention and `publicNetworkAccess: 'Disabled'`
- [ ] No template calls `listKeys()`, `listAccountSas()` or reads a connection string
- [ ] Every secret says how it reaches the workload, and it is not through a pipeline
- [ ] Every secret has a person as rotation owner and a last-rotated date
- [ ] `.azure/variable-groups.yml` declares every linked group, and none holds a secret
- [ ] No credential-shaped literal is anywhere under `.azure/` or `infra/azure/`
- [ ] Every principal and every assignment has a review date
- [ ] Every exception has an expiry date

## Anti-patterns

**The connection with an expiry.** The service connection was created the quick way, with a
client secret, two years ago. It expires on a Friday. The first symptom is every deployment
failing with an authentication error nobody changed anything to cause, and the fix needs
someone with App Registration rights who is on leave. Use workload identity federation: there
is no secret and no expiry.

**The wildcard subject.**

```
subject: sc://navikenz/*
```

Any pipeline anyone can create in that organisation now obtains this identity's token, and the
identity is Contributor on production. Name the one connection.

**Contributor on the subscription.** The deploy needed to update one container app, and
Contributor at subscription scope was one click instead of three. It now also covers the
platform resource group holding the registry and the vault, and the audit log cannot
distinguish what the pipeline used from what it could use. Scope to the resource group.

**Owner, because something was failing.** The deploy failed on a permission, `Owner` fixed it,
and nobody went back. Owner includes the right to assign roles, so from this point the
pipeline's effective permissions are unbounded and no review of the role assignments will show
it. Find the missing permission and assign that.

**The vault with access policies.** RBAC was configured, carefully, and the vault still has the
access policies it was created with. Real access is the union of both models, one of which does
not appear in `az role assignment list`. Turn on `enableRbacAuthorization` and remove the
policies.

**The pipeline that fetches the secret.**

```yaml
- task: AzureKeyVault@2
  inputs:
    KeyVaultName: kv-webshell-prd-weu
    SecretsFilter: sessions-signing-key
```

The value is now a pipeline variable, in reach of every later task in that job, including any
third-party task, and of anyone who can edit the pipeline. Let the container app resolve the
reference itself, as its own identity.

**The connection string in the variable group.** `storageConnectionString`, marked `secret`, in
`web-shell-common`. The mask is a string match on the log; a step that base64-encodes the value
prints it unmasked, and every pipeline in the project that links the group can do that. Put the
value in the vault and give the workload `Key Vault Secrets User` on it.

**`listKeys()` because it was quicker.**

```bicep
var key = listKeys(storage.id, '2023-01-01').keys[0].value
```

The template now materialises a credential into a deployment output, where it is retained in the
deployment history. Use a managed identity, and set `allowSharedKeyAccess: false` so the route
is closed rather than merely unused.

**The pinned secret version.** The reference names version `a7f3...` because a rotation once
broke a revision. Rotation is now a code change, a pull request and a release, so it stops
happening. Reference by name, and let the next revision pick the new version up.

## Validation

```bash
# Every check reads files in this repository. None of them calls `az` and none needs a tenant:
# the artefacts under test are the identity register, the Bicep, and the declared contents of
# the Azure DevOps variable groups.
#
# NOT CHECKABLE FROM FILES — these are properties of the Entra ID tenant and the Azure DevOps
# project, not of the repository, and this block deliberately does not pretend otherwise:
#   * whether a service connection in the ADO project is really federated, or was re-created
#     with a client secret after this file was written
#   * what a variable group actually contains, including variables marked `secret`
#   * role assignments made outside these templates — in the portal, or by a user with
#     User Access Administrator (`az role assignment list --all` would be needed)
#   * whether a Key Vault still has access policies alongside RBAC
#   * whether a secret's live version matches the Last rotated date
# Reconciling the register against the tenant is a review step with a signed-in operator, and
# it is what the review dates in this file are for.

ID=delivery/ops/azure/identity.md
IDBICEP=infra/azure/identity/main.bicep
VG=.azure/variable-groups.yml

test -f "$ID" || echo "no $ID"
test -f "$IDBICEP" || echo "no $IDBICEP"
test -f "$VG" || echo "no $VG"

# A credential-shaped literal anywhere in the Azure definitions
grep -rnE "(AccountKey=|SharedAccessSignature=|-----BEGIN [A-Z ]*PRIVATE KEY|[Pp]assword=[^ \"']|&sig=|ghp_[A-Za-z0-9]{20,}|ATATT[A-Za-z0-9]{10,})" \
  .azure/ infra/azure/ 2>/dev/null \
  | sed 's/^/credential-shaped literal in an Azure definition: /'

# A key fetched where Entra ID authentication exists
grep -rnE "list(Keys|AccountSas|ServiceSas|ConnectionStrings|Credentials)\(" infra/azure/ 2>/dev/null \
  | sed 's/^/template fetches a key with listKeys(, where a managed identity would do: /'

python3 - <<'PY'
import pathlib, re, sys
try:
    import yaml
except ImportError:
    sys.exit("pyyaml is not installed, so the variable-group checks did not run "
             "(python3 -m pip install pyyaml)")

ID = pathlib.Path("delivery/ops/azure/identity.md")
IDBICEP = pathlib.Path("infra/azure/identity/main.bicep")
VG = pathlib.Path(".azure/variable-groups.yml")
BIND = pathlib.Path("delivery/ops/azure/pipeline-bindings.md")
LZ = pathlib.Path("delivery/ops/azure/landing-zone.md")
if not (ID.exists() and IDBICEP.exists() and VG.exists()):
    sys.exit(0)                        # the `test -f` lines above already said so

idtext = ID.read_text(encoding="utf-8")
bicep = IDBICEP.read_text(encoding="utf-8")

def tables(text, heading):
    out, on = [], False
    for line in text.splitlines():
        if line.startswith("## "):
            on = line[3:].strip() == heading
            continue
        if on and line.startswith("|"):
            if re.match(r"^\|[\s:|-]+$", line):
                continue
            out.append([c.strip() for c in line.strip().strip("|").split("|")])
    return out[1:] if out else []

def rows(heading):
    got = tables(idtext, heading)
    if not got:
        print(f"identity.md has no '## {heading}' table")
    return got

principals = rows("Principals")
feds = rows("Federated credentials")
rbac = rows("Role assignments")
vaults = rows("Key Vaults")
secrets = rows("Secrets")
exceptions = tables(idtext, "Exceptions")
if "## Never in a variable group" not in idtext:
    print("identity.md has no '## Never in a variable group' section")

DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
PERSON_NOT = re.compile(r"(?i)\bteam\b|\bsquad\b|\brota\b|@")

by_principal = {}
for row in principals:
    if len(row) < 6:
        print(f"principal row '{row[0] if row else ''}' has fewer than six columns")
        continue
    pid, principal, ptype, used_by, powner, review = row[:6]
    by_principal[principal] = ptype
    if not re.fullmatch(r"ID-\d{3,}", pid):
        print(f"principal '{principal}' has no ID-### id")
    if "secret" in ptype.lower() or "certificate" in ptype.lower():
        print(f"{pid}: '{principal}' authenticates by '{ptype}' — a stored credential adds an "
              f"expiry, a store and a rotation to something that needed none of them")
    if not used_by:
        print(f"{pid}: nothing is recorded as using '{principal}'")
    if not powner or PERSON_NOT.search(powner):
        print(f"{pid}: owner '{powner}' is not a person")
    if not DATE.fullmatch(review):
        print(f"{pid}: review date '{review}' is not a date")

# Every Azure DevOps service connection the pipeline uses is a registered principal
if BIND.exists():
    for row in tables(BIND.read_text(encoding="utf-8"), "Service connections"):
        conn = row[0] if row else ""
        if not conn:
            continue
        if conn not in by_principal:
            print(f"service connection '{conn}' is in pipeline-bindings.md and has no "
                  f"ID-### row in identity.md")
        elif by_principal[conn] != "workload identity federation":
            print(f"service connection '{conn}' authenticates by "
                  f"'{by_principal[conn]}' rather than workload identity federation")

# Federated subjects are specific, and the register and the template agree
bicep_subjects = set(re.findall(r"subject:\s*'([^']+)'", bicep))
for row in feds:
    if len(row) < 5:
        print(f"federated credential row '{row[0] if row else ''}' has fewer than five columns")
        continue
    principal, issuer, subject, audience, purpose = row[:5]
    if "*" in subject:
        print(f"federated credential for '{principal}': subject contains a wildcard "
              f"({subject}) — any pipeline in that scope can obtain this identity's token")
    elif subject not in bicep_subjects:
        print(f"federated credential for '{principal}': subject '{subject}' is in identity.md "
              f"and not in {IDBICEP}")
    if not issuer:
        print(f"federated credential for '{principal}': no issuer")
    if not audience:
        print(f"federated credential for '{principal}': no audience")
for subject in sorted(bicep_subjects):
    if subject not in {row[2] for row in feds if len(row) > 2}:
        print(f"{IDBICEP} declares federated subject '{subject}', which has no row in "
              f"'## Federated credentials'")

NEVER_ANY_SCOPE = {"owner", "user access administrator"}
PRIVILEGED = NEVER_ANY_SCOPE | {"contributor"}
for row in rbac:
    if len(row) < 6:
        print(f"role assignment row '{row[0] if row else ''}' has fewer than six columns")
        continue
    rid, principal, role, scope, why, review = row[:6]
    if not re.fullmatch(r"RBAC-\d{3,}", rid):
        print(f"role assignment for '{principal}' has no RBAC-### id")
    if role.lower() in NEVER_ANY_SCOPE:
        print(f"{rid} grants '{role}' to '{principal}' — a role that carries the right to "
              f"grant further rights is not a permission, it is a permission to acquire them")
    above_rg = scope.startswith("sub-") or scope.startswith("mg-") or scope.startswith("/subscriptions/")
    if above_rg:
        print(f"{rid} is scoped to '{scope}', which is above a resource group")
        if role.lower() in PRIVILEGED:
            print(f"{rid} grants '{role}' above a resource group, which covers every other "
                  f"workload's resource groups in that scope")
    if "*" in scope:
        print(f"{rid} has a wildcard scope ('{scope}')")
    if not why or len(why) < 20:
        print(f"{rid}: 'Why this scope' does not say why ('{why}')")
    if not DATE.fullmatch(review):
        print(f"{rid}: review date '{review}' is not a date")
    if principal not in by_principal:
        print(f"{rid} assigns a role to '{principal}', which has no ID-### row")

# The vault settings, read from the template rather than asserted in prose
flags = {
    "enableRbacAuthorization": "true",
    "enableSoftDelete": "true",
    "enablePurgeProtection": "true",
    "softDeleteRetentionInDays": "90",
    "publicNetworkAccess": "'Disabled'",
}
for key, want in flags.items():
    found = re.search(rf"^\s*{key}:\s*(\S+)\s*$", bicep, re.M)
    if not found:
        print(f"{IDBICEP}: no Key Vault setting '{key}'")
    elif found.group(1) != want:
        print(f"{IDBICEP}: {key} is {found.group(1)}, not {want}")
if re.search(r"^\s*accessPolicies:", bicep, re.M):
    print(f"{IDBICEP}: the vault declares accessPolicies — real access is then the union of "
          f"two permission models, one of which no role-assignment audit shows")

declared_vaults = {row[0] for row in vaults if row}
for vault_name in sorted(set(re.findall(r"name: '(kv-[A-Za-z0-9-]+)'", bicep))):
    if vault_name not in declared_vaults:
        print(f"{IDBICEP} creates vault '{vault_name}', which has no row in '## Key Vaults'")

for row in secrets:
    if len(row) < 6:
        print(f"secret row '{row[0] if row else ''}' has fewer than six columns")
        continue
    secret, vault_name, read_by, how, rotator, rotated = row[:6]
    if vault_name not in declared_vaults:
        print(f"secret '{secret}' names vault '{vault_name}', which has no row in "
              f"'## Key Vaults'")
    if re.search(r"(?i)variable group|pipeline|build agent", how):
        print(f"secret '{secret}' reaches the workload through '{how}' — a secret a pipeline "
              f"reads is in reach of every task in that job")
    if re.search(r"(?i)version", how) and not re.search(r"(?i)unversioned", how):
        print(f"secret '{secret}' pins a version, which makes rotation a code change")
    if not rotator or PERSON_NOT.search(rotator):
        print(f"secret '{secret}': rotation owner '{rotator}' is not a person")
    if not DATE.fullmatch(rotated):
        print(f"secret '{secret}': 'Last rotated' is '{rotated}', which is not a date")

# Variable groups: what is declared, and what nothing may declare
SECRETISH = re.compile(r"(?i)(secret|password|passwd|pwd|token|apikey|api_key|"
                       r"connectionstring|conn_str|privatekey|certificate|credential|sas)")
vg = yaml.safe_load(VG.read_text(encoding="utf-8")) or {}
declared_groups = set()
for group in vg.get("groups") or []:
    gname = group.get("name")
    if not gname:
        print(f"{VG}: a group has no name")
        continue
    declared_groups.add(gname)
    if group.get("holdsSecrets") is not False:
        print(f"variable group '{gname}' is not declared holdsSecrets: false — a group any "
              f"pipeline in the project can link is not a place for a value that matters")
    if not group.get("owner"):
        print(f"variable group '{gname}': no owner")
    for var in group.get("variables") or []:
        vname = var.get("name", "")
        if SECRETISH.search(vname):
            print(f"variable '{vname}' in variable group '{gname}' is named for a value that "
                  f"would matter if it were read — marking it secret masks the log, it does "
                  f"not stop a pipeline reading it")
if BIND.exists():
    for row in tables(BIND.read_text(encoding="utf-8"), "Variable groups"):
        gname = row[0] if row else ""
        if gname and gname not in declared_groups:
            print(f"pipeline-bindings.md links variable group '{gname}', whose contents are "
                  f"not declared in {VG}")

# Names in the identity template follow the landing zone's own convention
if LZ.exists():
    patterns = {}
    for row in tables(LZ.read_text(encoding="utf-8"), "Naming"):
        if len(row) >= 3 and row[1]:
            patterns[row[1]] = row[2].strip("`")
    # Only hyphenated prefixes are checked: a prefix with no separator ('st', 'cr')
    # cannot be told from an ordinary word at the start of a literal.
    for literal in sorted(set(re.findall(r"name: '([A-Za-z0-9][A-Za-z0-9-]*)'", bicep))):
        prefix = literal.split("-")[0]
        if "-" in literal and prefix in patterns:
            if not re.fullmatch(patterns[prefix], literal):
                print(f"{IDBICEP} names '{literal}', which does not match the {prefix} "
                      f"pattern {patterns[prefix]} in landing-zone.md")

for row in exceptions:
    if len(row) >= 5 and row[0] not in ("none", "—", ""):
        if not DATE.fullmatch(row[4]):
            print(f"exception '{row[0]}' expires '{row[4]}', which is not a date — an "
                  f"exception with no end date is the new standard")
PY
```

Each command prints nothing when the rule holds. The role-assignment loop is the one to run
before a release: it is the only mechanical check that the scope somebody chose under pressure
was narrowed again afterwards.
