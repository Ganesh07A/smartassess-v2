# Psychometrics, Item Analysis & Topic Mastery

## 1. Overview
SmartAssess v2 replaces naive heuristics (e.g. "success > 80% = Easy") with psychometric item analysis grounded in classical test theory (CTT). Examiners can pinpoint defective questions (incorrect answer keys, ambiguous wording), identify non-functioning distractors, evaluate exam reliability, and assess cohort topic mastery.

---

## 2. Statistical Formulas

Let $N$ = completed sessions, $k$ = number of test items, $x_{ij}$ = score earned by session $j$ on item $i$, $m_i$ = maximum points for item $i$, and $T_j$ = total exam score of session $j$.

### 2.1 Facility Index (Observed Difficulty, $p$)
$$p_i = \frac{\bar{x}_i}{m_i} = \frac{\sum_{j=1}^N x_{ij}}{N \cdot m_i}$$
- **Range:** $0.00$ to $1.00$. Higher values denote easier items.
- Unattempted items are treated as 0 earned.
- Attempt count is reported alongside facility so teachers can distinguish between an item nobody could solve and an item nobody reached.

### 2.2 Corrected Item-Total Correlation (Discrimination $r$)
$$r_{i(T-i)} = \text{Pearson } r(x_i, T - x_i)$$
- **Range:** $-1.00$ to $+1.00$.
- Correlates performance on item $i$ with performance on the **rest** of the test $(T_j - x_{ij})$.
- By removing the item's own contribution from the total score, the rest-score correlation eliminates spurious self-correlation.
- Naturally supports partial credit on coding questions and continuous scoring without bifurcated point-biserial formulas.
- Returns `null` when $N < 10$ or when item score variance is 0.

### 2.3 Upper–Lower Discrimination Index ($D$)
$$D = \frac{\sum x_{i,\text{upper}} - \sum x_{i,\text{lower}}}{n_{\text{group}} \cdot m_i}$$
- **Group Fraction:** Top 27% and bottom 27% of students sorted by total score.
- **Group Guarding:** Returns `null` unless:
  1. $N \ge 10$
  2. $n_{\text{group}} \ge 3$
  3. $2 \cdot n_{\text{group}} \le N$ (strict non-overlapping groups)
- For small sample sizes, groups overlap and render $D$ mathematically meaningless.

### 2.4 Distractor Analysis (MCQ)
For each distractor option (non-key option $C$):
- Option selection counts are tabulated across all students and within the top 27% and bottom 27% score groups.
- **Dead Distractor:** Chosen by 0 students. Suggests the option was too obvious or implausible.
- **Inverted Distractor:** Chosen by **more** students in the upper group than in the lower group. Suggests misleading wording or a partially correct distractor.

### 2.5 Cronbach's Alpha ($\alpha$, Internal Consistency Reliability)
$$\alpha = \left(\frac{k}{k - 1}\right) \left(1 - \frac{\sum_{i=1}^k \sigma_i^2}{\sigma_T^2}\right)$$
- Measures the extent to which items measure the same underlying construct.
- Note: Both population variance and sample variance produce the exact same ratio $\frac{\sum \sigma_i^2}{\sigma_T^2}$.
- **Interpretation:**
  - $\alpha \ge 0.80$: Good reliability.
  - $0.70 \le \alpha < 0.80$: Acceptable reliability.
  - $0.60 \le \alpha < 0.70$: Questionable reliability.
  - $\alpha < 0.60$: Low — test results are noisy.

---

## 3. Thresholds & Configuration (`lib/analytics/thresholds.ts`)

| Parameter | Value | Meaning |
|---|---|---|
| `MIN_N_FOR_PSYCHOMETRICS` | `10` | Minimum completed sessions needed before computing discrimination and alpha. |
| `FACILITY_TOO_EASY` | `0.85` | Facility $\ge 0.85$ flagged as `TOO_EASY`. |
| `FACILITY_TOO_HARD` | `0.25` | Facility $\le 0.25$ flagged as `TOO_HARD`. |
| `DISCRIMINATION_MIN` | `0.10` | Correlation $r < 0.10$ flagged as `WEAK_DISCRIMINATION`. |
| `DISCRIMINATION_NEGATIVE` | `0.00` | Correlation $r < 0.00$ flagged as `NEGATIVE_DISCRIMINATION` (high-priority broken item signal). |
| `ALPHA_ACCEPTABLE` | `0.70` | Standard threshold for acceptable internal reliability. |
| `UPPER_LOWER_FRACTION` | `0.27` | Kelley's 27% group fraction for upper/lower group discrimination. |
| `MAX_SESSIONS_FOR_ANALYSIS` | `2000` | Computational boundary cap for single-pass matrix calculation. |

---

## 4. The Minimum-N Policy

Computing discrimination or reliability on sample sizes $N < 10$ leads to misleading conclusions. A single student's lucky guess can invert an item's correlation.
- When $N < 10$, the analytics dashboard renders only raw observed facility and provides an advisory banner:
  > *"Only X students have completed this exam. Difficulty and reliability statistics need at least 10."*
- Fabricated or statistically invalid numbers are strictly prevented.

---

## 5. Advisory Flags & Human Review Policy

**SmartAssess never automatically modifies questions, alters answer keys, or drops items.**
- All psychometric flags are advisory signals displayed for teacher review.
- High-priority warnings (e.g. `NEGATIVE_DISCRIMINATION`) provide plain-language explanations:
  > *"Students who scored well overall got this question wrong more often than struggling students — check the answer key or wording."*
- Direct links allow examiners to open the question bank editor to make informed academic updates.

---

## 6. Topic Mastery Breakdown

- **Cohort Topic Mastery:** Displays average score percentage and the count of students below 50% for each curriculum topic. Sorted weakest-first to highlight areas requiring lecture reinforcement.
- **Untagged Items:** Items without an assigned topic are aggregated under `"Untagged"` so curriculum blind spots are never omitted.
- **Student Weakness Analysis:** Individual students receive a personal topic breakdown on their result page. Topics with $< 3$ questions are labeled *"Low Confidence"* to prevent a single missed question from misrepresenting student competence.
