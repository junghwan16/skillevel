# examples

Four eval suites, in rough order of realism. Two of them target real,
widely-installed community skills and were produced by **dogfooding skillevel
end-to-end** — `skillevel new <skill>` → real cases → `skillevel lint` → paid
`claude -p` runs — not hand-waved. The friction that dogfooding surfaced drove
the "v-next" section of [../DESIGN.md](../DESIGN.md).

| file                       | target skill    | kind                    | needs the skill installed? |
| -------------------------- | --------------- | ----------------------- | -------------------------- |
| `code-review.eval.yaml`    | `code-review`   | **real, executed**      | yes (to run)               |
| `writing-skills.eval.yaml` | `writing-skills` + `skill-eval` | **real, executed** | yes (to run)     |
| `commit-style.eval.yaml`   | `commit-style` (made-up) | illustrative / reading | no — didactic only |
| `smoke.eval.yaml`          | `__none__`      | runner self-check       | no — no skill at all       |

## The real ones

**`code-review.eval.yaml`** — 4 happy / 4 near-miss negatives / 2 routing
cases. Shows a repo-context skill: it only fires when there's actually a diff
to review, so it's a good demonstration of why triggering is cwd-sensitive
(see the caveat in the file header). `happy-review-branch` triggered 1/1 in a
git repo with a real diff; the negatives stayed out.

**`writing-skills.eval.yaml`** — the `expect_skill` showcase. It pins the
boundary between two easily-confused sibling skills: **writing-skills** (help
me _author_ a SKILL.md) vs **skill-eval** (help me _test_ one). The two
`expect_skill: skill-eval` cases pass only if skill-eval actually fires _and_
writing-skills stays out — so a green routing case proves the boundary, not
just that the target kept quiet. `route-eval-1` ran 2/2 green.

Both were run with `-m sonnet`. Full run transcripts and the exact friction
log live in the git history of the commit that added them.

## Running them

The runner tests the **installed** skill (`~/.claude/skills`, project
`.claude/skills`, plugins) — so these only _run_ if you have those community
skills installed. If you don't, read them as examples of well-shaped suites:
real prompts, near-miss negatives, a benchable `judge` case, and routing.

```bash
# from anywhere the skill is discoverable:
npx skillevel code-review        # or writing-skills
npx skillevel bench code-review  # does the skill actually help?

# always runnable — no skill needed, cheapest end-to-end check:
npx skillevel examples/smoke.eval.yaml
```

> Bounding cost on a **run**: trials come from the YAML `trials:` field — the
> run command has no `--trials` flag (that's `bench`-only). Lower `trials:` in
> the file to run cheaper. This is one of the papercuts DESIGN.md's v-next
> section proposes to fix.
