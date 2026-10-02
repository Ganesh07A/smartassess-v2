# Assessment Integrity & Proctoring Audit Trail

## 1. Overview
SmartAssess v2 records immutable, timestamped forensic events throughout an assessment session. Rather than relying on simple counters, the platform provides a complete audit trail that correlates student activity (tab switching, window blurring, clipboard operations, device tampering) directly with their answer submissions.

---

## 2. Event Taxonomy & Severity Mapping

| Event Type | Severity Level | Numeric | Description | Recommended Threshold / Action |
|---|---|---|---|---|
| `EXAM_STARTED` | Info | 0 | Candidate launched examination in fullscreen mode. | Audit baseline. |
| `EXAM_SUBMITTED` | Info | 0 | Normal voluntary submission completed by candidate. | Session sealed. |
| `TIME_EXTENDED` | Info | 0 | Accommodated extra time granted by instructor. | Teacher record logged. |
| `TEACHER_MESSAGE` | Info | 0 | Direct invigilator broadcast message delivered. | Confirmation recorded. |
| `TAB_BLUR` | Warning | 1 | Focus left the browser window (alt-tab, clicking away). | Warning displayed; screen blurred. |
| `FULLSCREEN_EXIT` | Violation | 2 | Candidate pressed ESC or exited fullscreen mode. | Screen blocked until re-entered. |
| `CLIPBOARD_ATTEMPT` | Violation | 2 | Candidate attempted to copy prompt or paste text. | Action blocked; flagged in audit log. |
| `HEARTBEAT_MISSED` | Warning | 1 | WebSocket / polling heartbeat missed for > 45s. | Evaluated against network drops. |
| `DUPLICATE_TAB` | Violation | 2 | Second browser tab or concurrent session initiated. | Session paused on secondary tab. |
| `IP_COLLISION` | Violation | 2 | Same IP shared concurrently by multiple candidates. | Flagged as duplicate IP on dashboard. |
| `DEVTOOLS_ATTEMPT` | Critical | 3 | Browser developer tools opened or inspect shortcut used. | Auto-violation logged. |
| `FORCE_SUBMITTED` | Critical | 3 | Invigilator or automated rule forcibly closed attempt. | Immediate session termination. |

---

## 3. Timeline Interleaving & Correlation Analysis

A single integer violation count does not reveal whether a student cheated. The **Integrity Console** provides an interleaved chronological stream:
- Proctor events (blur, clipboard, fullscreen exit) are timestamped with millisecond precision.
- Question submissions and code test runs are recorded with their exact submission timestamp and points earned.

**Example forensic correlation:**
- At `10:14:20`: Candidate triggers `TAB_BLUR` (duration: 35s).
- At `10:15:02`: Candidate submits 4 consecutive MCQ answers in under 12 seconds, earning full marks on complex questions.
- Invigilators can cross-reference this sequence with question difficulty to make evidence-based determinations.

---

## 4. Cryptographic Audit Verification (SHA-256)

When exporting an **Assessment Integrity Report** (PDF):
1. A canonical JSON payload is constructed containing:
   - Exam ID & Title
   - Student Identity (Name, masked PRN, Email)
   - Session metadata (Window start/end, Client IP, User Agent)
   - Chronological list of all proctor events with metadata
   - Chronological list of all submissions and awarded marks
2. The payload keys are normalized and deterministically sorted via `sortKeys()`.
3. A SHA-256 digest is computed using standard WebCrypto / Node.js cryptographic primitives.
4. The resulting 64-character hexadecimal hash is printed in the footer of every page of the generated PDF report.
5. In disciplinary proceedings, the printed PDF hash can be independently recomputed against database records to guarantee that the evidence has not been tampered with or modified.

---

## 5. Privacy, PII & Institutional Retention Guidelines

- **Institutional Purpose:** All telemetry, IP addresses, and user-agent strings are captured solely for institutional academic integrity and disciplinary reviews.
- **PRN Masking:** On public credential verification links (`/verify/[id]`), Student Registration Numbers (PRNs) are automatically masked (e.g. `PRN•••456`) to protect student privacy against unauthorized scraping.
- **Retention Period:** Disciplinary session logs should be retained for a minimum of 1 academic term following exam conclusion, or until any formal grade dispute is resolved, after which IP and user-agent strings may be anonymized.
