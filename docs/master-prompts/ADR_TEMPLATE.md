# ADR-[NNN]: [Short decision title]

- ADR ID: ADR-[NNN]
- Status: proposed | accepted | rejected | superseded
- Date: [YYYY-MM-DD]
- Owner: [name / role]
- Related project: [project name]
- Related files: [file paths]
- Related requirement IDs: [IDs or N/A]
- Supersedes: [ADR-ID or N/A]
- Superseded by: [ADR-ID or N/A]

---

## 1. Context
Describe the situation that requires a decision.

Include only relevant facts:
- current system state;
- project constraints;
- scope boundaries;
- repo/runtime evidence if available;
- risks or limitations that matter.

Do not include vague background that does not affect the decision.

---

## 2. Decision
State the chosen decision in one clear paragraph.

This section must answer:
- what is being chosen;
- where it applies;
- what is explicitly allowed;
- what is explicitly not allowed.

Example structure:
"We will use [X] for [Y] in [scope], and we will not use [alternative] because [reason]."

---

## 3. Decision drivers
List the factors that materially influenced the decision.

Typical drivers:
- security
- simplicity
- delivery speed
- maintainability
- rollback safety
- hosting limits
- compliance
- cost
- performance
- team capability

---

## 4. Alternatives considered
Document serious alternatives only.

### Alternative A — [name]
- Summary:
- Pros:
- Cons:
- Why not chosen:

### Alternative B — [name]
- Summary:
- Pros:
- Cons:
- Why not chosen:

Add more only if truly relevant.

---

## 5. Consequences
Describe expected outcomes of the decision.

### Positive consequences
- [item]
- [item]

### Negative consequences
- [item]
- [item]

### Operational consequences
- new dependency?
- migration needed?
- docs to update?
- monitoring needed?
- handoff impact?

---

## 6. Security and compliance impact
State whether this decision affects:
- auth
- permissions
- secrets
- data exposure
- SSRF / XXE / XML handling
- external integrations
- logging/privacy
- user data retention
- regulated flows

Required format:
- Security impact: none | low | medium | high
- Compliance impact: none | low | medium | high
- Notes: [text]

---

## 7. Rollback impact

- Can this be rolled back? yes | no | partial
- Rollback method: [text]
- Rollback risk: low | medium | high
- Backup required before rollout: yes | no
- Data migration impact: none | reversible | irreversible

---

## 8. Evidence
List the evidence that supports this decision.

Allowed evidence:
- repository facts
- config files
- dependency manifests
- runtime behavior
- measured constraints
- stakeholder-approved scope
- incidents or failures already observed

- Evidence item 1:
- Evidence item 2:
- Evidence item 3:

If evidence is weak, say so explicitly.

---

## 9. Implementation notes
Only include execution-relevant notes.

Examples:
- exact package to add
- config area affected
- feature flag needed
- infra dependency
- environment variable changes
- test updates needed
- docs that must be updated

Do not turn this into a full build plan.

---

## 10. Acceptance conditions
This ADR is considered implemented only when all applicable items are true:

- [ ] code/config reflects the decision
- [ ] affected docs updated
- [ ] tests or verify steps updated
- [ ] release risk reviewed
- [ ] rollback path documented if needed
- [ ] handoff updated if operational impact exists

---

## 11. Final statement
One sentence summary.

Example:
"This ADR allows [decision] within [scope] under the constraints listed above."

---

## 12. Approval
- Proposed by: [name]
- Reviewed by: [name]
- Accepted by: [name]
- Acceptance date: [YYYY-MM-DD]
