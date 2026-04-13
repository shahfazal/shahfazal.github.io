---
title: "Claude Gatekeep You Yet?"
date: 2026-04-13
draft: false
tags: ["AI", "Software Engineering", "Building in Public", "Claude Code"]
description: "Adding a design-before-code gate to prevent agents from outsourcing your architectural thinking"
cover:
  image: "/img/challenge-cover.png"
  alt: "Claude code challenging with a design quiz"
  relative: false
---

## The Trigger

A code review comment on my datagouv MCP PR: "I don't know if you're using a coding agent..."

Fair. When an agent can output hundreds of lines in seconds, the architectural decisions can get lost in the velocity.

A few weeks ago I wrote about my own version of [Claudemaxxing](https://www.linkedin.com/posts/shahfazalmohammed_github-shahfazalclaudio-browse-your-claude-activity-7446294437355479040-1hEA) - floating between projects, delegating work to agents. "Must go fast."

This is the other side of that coin: forcing yourself to slow down at the right moment.

## The Gate

I added a hard stop to my Claude Code setup: no implementation until I can explain the design back in my own words.

Before any code, Claude quizzes me things like:

- **Files:** Which files will this touch, and why each one?
- **Backend or Frontend:** Where does the design live, what is the input/output ?
- **UI:** How does the UI update, and will this follow the existing pattern ?
- **Tests:** What kind of tests would this need for regression, future-proofing ?

Here's my actual `~/.claude/CLAUDE.md` snippet:

```markdown
## Design Challenge Before Any Code

Before writing a single line, quiz shahfazal on the design: what files will be
touched, why, what the function signature looks like, what the test verifies and
which layer it belongs to

He must be able to explain decisions back in his own words before
implementation starts
```

## This Isn't quite Spec-Driven Development

You might be thinking: "This is just writing specs before code. We already do that."

Not quite.

Spec-driven development assumes the spec is correct. You could be methodical about the spec, you refine them and you write the requirements, the agent implements them, done.

The gate assumes **you might not fully understand your own spec yet.** It forces you to verbalize the design decisions - files, layers, test boundaries - before velocity takes over. The quiz catches the gap between "I wrote it down" and "I can defend why it belongs here and not there."

In the cumulative cost chart example, I had a spec. The spec said "aggregate by week for >90 days." But I hadn't actually decided _how_ to determine the bucketing threshold, or _where_ that logic would live. The gate surfaced that gap before I wrote any code.

Writing a spec is documentation. The gate is interrogation.

## The Gate in Action

Here's what happened when I tried to design and implement a cumulative cost chart for [Claudio](https://github.com/shahfazal/claudio):

**The Challenge**
![Claude first challenge](/img/challenge.png)

**And then comes the grading**
![Claude grading design answers](/img/follow-up-1.png)

Claude doesn't just check that I answered - it grades the answers.

**Caught three design issues before any code was written:**

1. **Wrong test layer:** I said `test_templates.py`. Claude caught it: "The cumulative calculation is pure JS, so the only thing testable from Python is that the data payload is correctly structured and that the HTML element exists." Corrected to `test_routes.py`.

2. **Vague parser answer:** I said "costs and dates come from the parser code." Claude pushed back: "Partially right but needs refinement. The cumulative calculation happens in the stats route in app.py. The parser doesn't need to change."

3. **Unresolved spec detail:** Even after I passed the initial quiz, Claude flagged: "The week bucket for >90 days was in the spec, but the user hasn't addressed that." Fixed the bucketing logic in the design before writing a line.

![Bucketing follow-up question](/img/follow-up-bucket.png)

## What the Gate Enabled

Clean implementation. No mid-stream rewrites. 110 tests passing (was 108, +2 new).

![Implementation summary](/img/impl-summary.png)

The design decisions were locked in before velocity took over:

- **Data flow:** `sessions_raw` already has `ts_ms` and `cost_usd` - no backend changes needed
- **Bucketing:** Local date components (`new Date(year, month, date)`), timezone-safe, week alignment for >90 day ranges
- **D3 not Chart.js:** Already loaded for heatmap, can eventually replace Chart.js entirely
- **Tests:** Route test for data structure in `test_routes.py`, no template test (pure JS calculation)

## The Cost

The gate adds friction. It slows you down. That's the point.

If you're not forcing your tools to challenge your design, you're outsourcing your thinking.

---

**Working with agents?** How are you keeping the human in the loop sharp? I'd love to hear what safeguards or processes you've built - drop a comment or reach out on [LinkedIn](https://linkedin.com/in/shahfazal).
