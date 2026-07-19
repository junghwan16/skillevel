# skillevel — design

A test runner for **Claude Code skills**. Think `vitest`, but a "test" is a
prompt and the thing under test is whether a skill fires (and behaves) the way
its author intended.

## Why

Skills are prompt-triggered and non-deterministic. Before shipping or editing
one, two things matter:

1. **Triggering** — does it fire on the prompts it should, and stay out of the
   near-misses it shouldn't (over/under-firing)?
2. (later) **Task quality** — does the skill actually make the output better?

`skillevel` v1 nails **#1** — cheap, fast, the highest-frequency need. v2
ships **#2** as `skillevel bench`: the same cases, run with and without the
skill, graded, reported as lift.

## Positioning

- A **standalone `npx` CLI** — not a Claude Code skill, not tied to one repo.
- It **adopts the community `evals/cases.yaml` schema** (from the `skill-eval`
  skill) rather than inventing one. Cases stay portable; skillevel is just the
  most ergonomic runner + scaffolder for them.
- Mental model: **vitest for skills**. Auto-discovery, `trials` = built-in
  flake handling, `--ci` = regression gate.

## Commands

```
skillevel                    # discover & run every eval (**/*.eval.yaml, evals/cases.yaml)
skillevel sql                # filter to a skill or a file
skillevel -t "negative"      # filter by case id/substring
skillevel --ci               # non-zero exit on any regression / unwritten case
skillevel --json out.json    # machine-readable results alongside the grid
skillevel bench sql          # A/B with vs without the skill; report the lift
skillevel new sql            # scaffold what's missing: sql/SKILL.md and/or sql.eval.yaml
skillevel lint [target...]   # validate SKILL.md files (errors) + guidance heuristics (warnings)
skillevel fmt [--check]      # conservative SKILL.md frontmatter/whitespace normalizer
```

Deliberately **not** in the surface (cut for real-repo ergonomics): `--watch`
(every re-run costs real dollars and minutes — an accidental save mid-edit
should not start a run) and the `dot`/`junit` reporters (the grid serves
humans, `--json` serves machines; nothing consumed the others).

## Case format (adopted from skill-eval)

```yaml
skill: sql # leaf name; must match the Skill tool's skill name
trials: 5 # runs per case (variance); per-case override allowed
# model: sonnet          # optional
# triggerThreshold: 0.8  # case is green if pass-rate >= this (default 0.8)
cases:
  - id: happy-1
    prompt: "..."
    should_trigger: true
    expect: # optional extra asserts, on top of the trigger check
      - triggered
      - match: "SELECT" # case-insensitive regex in the response
      - absent: "DELETE" # regex must NOT appear
      # - judge: "is the query read-only and correctly scoped?"  # LLM-graded
  - id: neg-1
    prompt: "..."
    should_trigger: false
    expect: [not_triggered]
```

- `should_trigger` is the **primary check**: did the target skill fire?
- `expect_skill: <name>|none` is the routing form of the primary check: the
  named skill must win. Naming the suite's own skill ≡ `should_trigger: true`;
  naming a sibling asserts the collision lands there (sibling fires, target
  stays out); `none` asserts no skill fires. The loader derives
  `should_trigger` from it, so both forms share the runner machinery.
- `triggered` / `not_triggered` in `expect` are redundant shorthands (validated
  against `should_trigger`); `match` / `absent` / `judge` add output checks.
- A **placeholder prompt** (contains `<...>`) marks the case as _unwritten_ — it
  is reported as TODO and fails `--ci`, so `new` output can't silently pass.

## `new` — one on-ramp; scaffold, don't generate

There is a single scaffolding command. `skillevel new <skill>` creates
whatever the skill is missing and skips what already exists:

- **`<skill>/SKILL.md`** — only when no skill by that name exists (locally or
  installed). A starter whose placeholders are honest TODOs and whose
  authoring guidance (triggering description, 500-line limit, progressive
  disclosure) rides along as a deletable comment.
- **`<skill>.eval.yaml`** — the cases file. It reads the target `SKILL.md`
  (dev copy in cwd if present, else installed), pre-fills `skill:`, writes
  example happy + near-miss-negative cases as clearly-marked placeholders with
  the authoring principles inline, and pulls the skill's own **trigger
  keywords verbatim** into a comment as a hint.

(An earlier split — `init` for the cases file, `new` for the skill — asked
users to remember which creation verb made which artifact; one idempotent
command removes the distinction.)

Everything is **offline and deterministic** — it does NOT ask an LLM to invent
cases or content (auto-generated cases plant plausible-but-wrong tests). The
human writes the real cases — ideally from real usage/production traces.

## Authoring toolchain — `lint` / `fmt`

The same philosophy: **offline and deterministic**, templates and guidance
only — never LLM-invented content.

- `lint` splits its findings by authority: **errors** are the packaging /
  validation rules (ported from skill-creator's `quick_validate.py` — a skill
  that fails them won't install cleanly); **warnings** are authoring guidance
  (unwritten descriptions, leftover placeholders, broken `references/` paths,
  over-length bodies) — judgement calls, so they never fail the exit code.
- `fmt` is deliberately conservative: it normalises frontmatter key order and
  whitespace, and when it can't parse the frontmatter it returns the file
  untouched — the linter reports the problem; the formatter never destroys
  content.

## Run mechanism

For each case × trial, shell out to:

```
claude -p "<prompt>" --output-format stream-json --verbose [--model M] [--max-turns N]
```

Parse the NDJSON stream: a `tool_use` block named `Skill` carries the fired
skill in `input.skill`; the terminating `result` event carries the final text
and `total_cost_usd`. (Schema verified on Claude Code 2.1.x.)

**Early-exit** (cost saver, borrowed from skill-creator's `run_eval.py`): when a
case has only trigger checks,

- `should_trigger: true` → kill the process the moment the target skill fires
  (fast pass);
- `should_trigger: false` → kill the moment _any_ skill fires (fast fail);
  otherwise run to completion (needed for `match`/`absent`/`judge`), with a low
  `--max-turns` to bound negatives.

## Scoring

- A **trial** passes if the trigger direction matches `should_trigger` and every
  `expect` assert passes.
- A **case**'s score is `passes / trials`; it is green when
  `>= triggerThreshold` (default 0.8), so a single flake doesn't fail it.
- `--ci` exits non-zero if any case is below threshold or unwritten.

## Which version of the skill is tested (limitation)

Runs test whatever `claude -p` **already discovers** (installed
`~/.claude/skills`, project `.claude/skills`, plugins). To test a working-copy
edit, install/symlink it. **Roadmap:** `--skill-dir <path>` sets up an isolated
temp project (`.claude/skills/<name>` + `--bare`) so you can eval an uncommitted
SKILL.md reproducibly.

## Non-goals

- Multi-harness (Cursor/Codex/Gemini) — `claude -p` only.
- HTML report — terminal + JSON first.

---

# v2 — task-quality A/B (does the skill actually help?) — SHIPPED

v1 answers _does it trigger_. v2 answers _does it improve the output_ — the
question that decides whether a skill is worth its tokens, and whether an edit
made it better. This is the ablation `skill-eval` describes and the A/B loop the
official `skill-creator` runs, packaged as one command: `skillevel bench`.

## The idea

For each case, run the **same prompt twice** — once with the skill available,
once without — grade both outputs, and report the **lift**:

```
$ skillevel bench sql

sql  ./sql.eval.yaml
  case                    with   without    lift
  aggregate-revenue        3/3       1/3   +67pp
  safe-delete              3/3       3/3     0pp     ← model already handles this
  ...

▲ skill lift: +34pp   (48% → 82%)   4 benched   $1.10
```

- lift ≫ 0 → the skill earns its place.
- lift ≈ 0 across the board → **retire candidate** (the model already does it);
  keep the cases as a regression guard, per `skill-eval`.

## Cases

No new file format — a v2 case is a v1 case whose `expect` carries **output**
assertions instead of (or on top of) the trigger check:

```yaml
- id: aggregate-revenue
  prompt: "What was revenue by month last quarter?"
  should_trigger: true
  expect:
    - judge: "Produces a correct GROUP BY month aggregate, read-only"
    - match: "GROUP BY"
```

`judge` is graded PASS/FAIL by an LLM (burden of proof on the assertion, no
partial credit). Benchable = `should_trigger: true` **and** at least one output
check: trigger-only cases have nothing to compare, and a "must not fire" case
is identical in both arms — both are reported as skipped.

## The "without skill" arm — the hard part, honestly

The shipped baseline is the **blunt** one: `--disallowedTools Skill` blocks
_all_ skills. Cheap and reliable, but it measures "this skill vs no skills",
not "vs this one skill removed" — fine when the case wouldn't pull in a
sibling anyway. **Roadmap (v2.1):** an isolated temp project whose
`.claude/skills/` contains everything _except_ the skill under test, for true
per-skill ablation.

Both arms run **interleaved in the same batch** (as `skill-creator` does) so
time-of-day and model drift hit both equally, with no early exit — bench needs
the full output.

## CLI surface

```
skillevel bench [target]           # with vs without, report lift
  --trials <n>                     # per arm; defaults to 3 (each case = 2× runs + grading)
  --min-lift <pp>                  # CI gate: exit non-zero when lift drops below this
  --json <file>                    # full A/B results for machines
```

Discovery, `-t` filter, `-m`/`-c`, and the suite `model` carry over from the
eval runner unchanged. `--min-lift` is how a skill edit that quietly regresses
quality fails the build.

## Roadmap / open questions

- **Isolated ablation (v2.1)** — see above; also unlocks evaling an
  uncommitted SKILL.md reproducibly (`--skill-dir`).
- **Old-vs-new comparison** (`--vs <ref>`) — point the baseline arm at a
  snapshotted SKILL.md instead of "no skill".
- Judge variance — grade N times and vote, or trust one call with evidence?
- Comparator vs per-output grader — a blind A/B "which is better" can be more
  discriminating than independent PASS/FAIL, but is harder to threshold in CI.

---

# v-next — dogfooding findings (2026-07-20)

Source: we built the two real suites in `examples/` (`code-review`,
`writing-skills` ↔ `skill-eval`) by driving skillevel end-to-end as a
first-time user — `new` → real cases → `lint` → paid `claude -p` runs. The
loop works and the report format lands (the `fired: none` / `fired: <skill>`
diagnostic is exactly right). These are the papercuts that cost a newcomer the
most, ranked by how badly they make a _correct_ suite look wrong.

## Papercuts (small surface, high leverage)

1. **Run-level `--trials` override.** A `bench` takes `--trials`; a plain run
   does not — `skillevel code-review --trials 2` errors `unknown option`. So
   the only lever to bound a run's cost is editing the YAML `trials:` field,
   which is heavy mid-iteration. Add `--trials <n>` to the run command
   (overrides the suite value); it mirrors `bench` and removes the single most
   common first-run error. Until then, the error should name the YAML key
   instead of a bare "unknown option".

2. **Triggering is cwd/repo-state sensitive — say so.** The same happy prompt
   fired `none` in an empty scratch dir and triggered 1/1 inside a git repo
   with a real diff (`code-review`, and any repo-context skill: `tdd`,
   `changelog`, `diagnosing-bugs`). A newcomer testing in a throwaway dir
   concludes their skill is broken. `runClaude` already plumbs `options.cwd` —
   so the cheap win is a per-suite/per-case **`cwd:`** (or fixture-repo)
   knob plus a line in "Good to know" that repo context affects triggering,
   not just _which_ skill is under test.

3. **Cost undercounts on early-exit.** A trigger-only case that passes fast is
   `SIGKILL`ed the instant the skill fires (`claude.js`), before the terminating
   `result` event that carries `total_cost_usd` — so those cases report `$0`
   and the summary total is a lower bound, not the real spend. Options: print
   it as `≥ $X`, estimate from `num_turns`, or let the fast path drain the
   final event. At minimum, stop claiming the summary "prints what each run
   actually cost" when the fast path structurally can't.

4. **`lint` false-positives on command templates.** The angle-bracket
   placeholder check runs on prose with _fenced_ blocks stripped, but not
   _inline_ code — so a legit `git diff <fixed-point>...HEAD` in prose or a
   backticked span trips `warning placeholder`. Strip inline code spans too,
   matching the fence-protection `fmt` already promises.

## Newcomer-legibility

5. **Zero-match `-t` filter reports "no eval suites found."** When a suite
   loads fine but the case filter excludes everything, the runner prints the
   same "no files discovered" message and exits 0 — indistinguishable from a
   missing file. Say "1 suite discovered · 0 cases match filter `X`" so the
   author knows the file _was_ found.

6. **No offline way to validate a suite.** `lint` only targets `SKILL.md`;
   there is no cheap check that an eval YAML is well-formed (bad regex, unknown
   `expect` key, malformed `expect_skill`) — every real invocation costs
   tokens and minutes. Add `skillevel validate [target]` (or a run `--dry-run`)
   that parses suites offline and prints a **cost preview** — "N cases × M
   trials ≈ X runs" — before any paid call. This is the offline pre-flight the
   `lint`/`fmt` half of the tool already models, extended to cases files.

## Scaffolding (`new`) — trigger-hint extraction

7. **Keyword extraction misses most real skills.** `resolve.js` scans only the
   `description` field for the literal English word "trigger(s)". It therefore
   misses (a) i18n markers (`트리거 —` in the Korean `tidy-first`/`db-query`
   skills), (b) trigger lists that live in the SKILL.md **body** rather than the
   description, and (c) skills whose triggers are implicit in description prose.
   The honest fallback ("no explicit trigger list — read its description") is
   correct when there's truly nothing, but fires far too often. Broaden to scan
   description **+ body**, recognise localized markers, and — failing an
   explicit list — surface the salient noun phrases from the description.

## Already closed by this pass

- **`expect_skill` semantics were invisible.** That a green routing case
  requires the sibling to _actually fire_ (not just the target to stay out) was
  only discoverable by reading `assert.js`. Now stated in the README and in
  `examples/writing-skills.eval.yaml`.
- **`examples/` was orphaned** — unreferenced by docs, and its only "skill"
  case (`commit-style`) targeted a skill that exists nowhere, so a bare
  `skillevel` at the repo root misfired every case. Now: two real executed
  suites, an `examples/README.md`, and a link from the main README.
