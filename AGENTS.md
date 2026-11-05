## Agent allocation (W-08)

- Split a large task with independent parts across parallel agents or subagents instead of running it all in one agent. Do small or tightly coupled work yourself.
- Pick the smallest capable model tier: small/fast for search, lookups and mechanical sweeps (e.g. Haiku); mid for routine build slices with a clear brief and a check (e.g. Sonnet); large for design judgement, plans and anything Irene reviews (e.g. Opus).
- At most 3 agents at once unless Irene asks for more, and never two agents on the same files.
- Brief each agent like a peer: the goal, the files, what is ruled out, what "done" means. Spot-check results at the seam; don't redo delegated work.
- In the final report, list which agents and models ran and why.

## Lessons (W-09)

- Before starting, read `LESSONS.md` at the repo root (and the global lessons file, locally `~/.claude/lessons.md`) and follow them.
- Before reporting done, reflect: did I make a mistake, a wrong assumption, a wasted step, or need a correction from Irene?
- If yes, append a dated entry to `LESSONS.md`: what went wrong, why, and the one-line rule that prevents it next time. Keep it short, update an existing entry instead of duplicating, and never include secrets, tokens or private data.
- Lessons that apply across all repos go in the global lessons file instead.
- Say in the final report whether a lesson was recorded.
