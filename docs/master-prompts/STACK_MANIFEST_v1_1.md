# STACK_MANIFEST

## 1. Package identity
- Package name: RU Stack System
- Package version: vNext-bootstrap-1
- Manifest version: v1.1
- Status: active
- Owner: Сергей (CTO)
- Last updated: 2026-03-09

---

## 2. Purpose
This file is the canonical index of the package.
It defines:
- which files are active;
- which file versions are current;
- which files are deprecated;
- which files must stay in sync;
- the rule precedence used across the package;
- the minimum local development baseline for a clean Ubuntu workstation.

If any other file conflicts with this manifest, this manifest wins unless the conflict is explicitly resolved by `RU_STACK_LOCK.md`.

---

## 3. Rule precedence
Order of authority:

1. Repository facts and verified runtime evidence
2. `RU_STACK_LOCK.md`
3. This `STACK_MANIFEST.md`
4. Active stage prompt or active mode file
5. Artifact-specific template or checklist
6. Local style / formatting preferences

Conflict resolution rules:
- Verified repo facts override assumptions.
- Explicit project scope overrides defaults.
- Security and release safety override speed and convenience.
- Unsupported or invented commands are forbidden.
- If a rule is duplicated in several files, the canonical source defined in this manifest wins.

---

## 4. Active files
| File | Version | Status | Role | Canonical responsibility |
|---|---:|---|---|---|
| `RU_STACK_LOCK.md` | v1.5 | active | baseline | engineering constraints, safety baseline, repo-truth discipline |
| `MASTER_PROMPT_ELITE_RU_STACKLOCK_PROD.md` | v3.1 | active | execution core | main execution logic until replaced by a slimmer core |
| `PROMPT_IDEA_TO_TZ.md` | v2.0 | active | stage | idea → implementation-ready TZ |
| `PROMPT_TZ_TO_BUILD_PLAN.md` | v1.6 | active | stage | TZ → build plan |
| `PROMPT_TZ_TO_ESTIMATE.md` | v1.1 | active | utility | TZ → estimate |
| `PROJECT_STATE_TEMPLATE.md` | v1.0 | active | control artifact | current state, stage, blockers, risks, next step |
| `PROMPT_PROJECT_HANDOFF.md` | v1.0 | active | stage | handoff package |
| `AI_PROJECT_CHECKLIST.md` | v2.0 | active | checklist | AI-specific release and safety checks |
| `ADR_TEMPLATE.md` | v1.0 | active | governance artifact | formal architecture decision record |
| `STACK_MANIFEST.md` | v1.1 | active | governance | canonical index, precedence, sync groups, workstation baseline |

---

## 5. Planned replacements
| Current file | Planned replacement | Status |
|---|---|---|
| `MASTER_PROMPT_ELITE_RU_STACKLOCK_PROD.md` | `MASTER_CORE_PROMPT.md` + mode overlays | planned |
| duplicated precedence sections across prompts | manifest precedence block | planned cleanup |

---

## 6. Sync groups
These files must be reviewed together when one changes.

### Sync group A — execution governance
- `RU_STACK_LOCK.md`
- `MASTER_PROMPT_ELITE_RU_STACKLOCK_PROD.md`
- `STACK_MANIFEST.md`

### Sync group B — planning flow
- `PROMPT_IDEA_TO_TZ.md`
- `PROMPT_TZ_TO_BUILD_PLAN.md`
- `PROJECT_STATE_TEMPLATE.md`

### Sync group C — release and delivery
- `PROMPT_PROJECT_HANDOFF.md`
- `AI_PROJECT_CHECKLIST.md`
- `RU_STACK_LOCK.md`

### Sync group D — architecture decisions
- `ADR_TEMPLATE.md`
- `RU_STACK_LOCK.md`
- `STACK_MANIFEST.md`

---

## 7. Change policy
A file version must be bumped when:
- rule meaning changes;
- output contract changes;
- a required section is added or removed;
- precedence or scope interpretation changes.

A patch bump is enough for:
- wording cleanup;
- formatting cleanup;
- non-semantic examples.

A minor bump is required for:
- new required sections;
- changed behavioral rules;
- changed output structure;
- changed acceptance criteria.

A major bump is required for:
- breaking compatibility with downstream files;
- changed package architecture;
- changed precedence or baseline policy.

---

## 8. ADR policy
An ADR is required when any of the following is true:
- a baseline rule is intentionally overridden;
- a new dependency or external service is introduced;
- security, auth, payments, storage, queueing, or integration design is changed;
- an exception to stack-lock is requested;
- a release-risk tradeoff is accepted on purpose;
- multiple valid technical options exist and one is selected.

No item may be marked `ALLOWED BY ADR` unless an ADR exists with a valid ADR ID.

Format source: `ADR_TEMPLATE.md`

---

## 9. Usage policy
For normal work, the minimum file set to actively open is:

1. `RU_STACK_LOCK.md`
2. `STACK_MANIFEST.md`
3. one current stage file
4. `PROJECT_STATE_TEMPLATE.md` when state tracking is needed

Open additional files only when their stage or artifact is actually in use.

This package should stay operationally small.
If a new file is proposed, it must justify:
- what ambiguity it removes;
- why the content cannot live inside an existing canonical file;
- who will maintain it in real projects.

---

## 10. Local Development Baseline (Ubuntu)
For a clean Ubuntu workstation, assume the following minimum local tooling baseline unless the repository explicitly requires otherwise.

### Required
- Git
- OpenSSH client
- curl
- ca-certificates
- gnupg
- build-essential
- Python 3
- python3-venv
- python3-pip
- Node.js LTS
- npm
- pnpm
- VS Code
- a modern browser for local testing

### Optional but recommended
- Cursor
- jq
- ripgrep
- fd
- tree
- htop

### Rules
- Exact versions must be taken from repository manifests, lockfiles, tool-version files, and project docs.
- Do not invent project-specific tools not confirmed by the repository.
- If the environment is clean, the system should first output the minimum required local setup before proposing implementation steps.
- If the repository requires additional tools, the repository requirements override this baseline.
- VS Code is the default editor baseline; Cursor is optional and may be used as an additional AI-assisted editor.

---

## 11. Deprecation policy
A file may be marked `deprecated` when:
- its rules are fully absorbed by another canonical file;
- it duplicates existing guidance without adding control value;
- it is no longer used in live project flow.

Deprecated files must remain listed here until fully removed.

---

## 12. Current open cleanup items
- Extract duplicated precedence rules into this manifest only
- Introduce ADR usage across files that reference architecture exceptions
- Reduce repeated procedural paragraphs across stage prompts
- Decide whether master prompt remains monolithic or splits into core + modes

---

## 13. Approval
- Approved by: Сергей (CTO)
- Approval date: 2026-03-09
