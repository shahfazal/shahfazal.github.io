---
title: "Nobody Tests the Steering Wheel"
description: "On finding evals by accident, and what happens when you let a Python script write your test cases."
date: 2026-04-03
tags: ["Evals", "Agent Evals", "LLM", "Python"]
cover:
  image: "/img/steering-wheel-cover.svg"
  alt: "Nobody Tests the Steering Wheel"
  relative: false
---

A few weeks ago I was handed a repo with a note: _"set this up as a skill and ask Claude to investigate a test failure."_

I did. Claude went off, called six different internal tools: bug tracking, code search, internal comms, documentation and came back with a plausible analysis. It felt like magic.

However, while Claude was doing its thing I noticed the token warnings. 12.5K tokens. 16K tokens. Per run.

I started digging. The skill was a `SKILL.md` file: English instructions telling Claude which tools to call and how. Loose instructions. So Claude interpreted them liberally and went wide on every search.

I tightened the params. Ran it again. Tighter still. After about six runs we had an 87% token reduction with the same quality of analysis.

Then a small voice: _what if we've drifted too far? What if the skill can't do what it was originally supposed to do?_

That's when I realised I was already doing evals, I just hadn't called it that.

---

The standard framing for agent evals goes something like: BFCL and τ-bench test the _model_ (fixed prompts, variable model). What I was doing was the opposite: fixed model, variable instructions. Testing the prompt, not the engine.

Most people don't make this distinction. They use Claude, Claude is good, so their agent is good. But Claude is just the engine. **The skill is the steering wheel. Nobody tests the steering wheel.**

---

We ended up with a Python harness that runs a skill, captures every tool call, and checks them against "golden numbers" invariants we'd codified from real runs. Change the `SKILL.md`, run the harness, see if anything regressed.

That's prompt regression testing. Same idea as unit tests for code, applied to English instructions.

But the interesting part came next.

When starting with a _new_ skill, one where we didn't yet know what "good" looked like, we couldn't write the invariants upfront. We had to watch first.

So we built an observer: run the skill loose, capture everything, let the output tell you what normal behaviour looks like. Then codify _those observations_ into your eval cases.

Observe before you eval.

---

The next step the one I'm currently designing is to close the loop further: given a `SKILL.md`, have a script read it, reason about the expected tool call sequence from the phase structure, and _propose the eval cases automatically_.

```
SKILL.md → observer script → proposed eval JSON → tighten → harness
```

A meta-skill that writes your evals for you.

I'm building the public version of this using the [data.gouv.fr MCP](https://github.com/datagouv/datagouv-mcp) as the skill under test a real public API, nothing proprietary, fully bloggable.

Full writeup coming once it's built.

---

This will become a three-part series:

1. **You eat what you Skill** demystifying SKILL.md, tools, and why loose instructions are expensive
2. **Observe before you eval** why you can't write good invariants until you've watched the skill run
3. **The eval-generator** a skill that reads a SKILL.md and writes your test cases

If this resonates or if you're already doing something similar I'd love to hear about it. Find me on [LinkedIn](https://linkedin.com/in/shahfazalmohammed) or
[GitHub](https://github.com/shahfazal).
