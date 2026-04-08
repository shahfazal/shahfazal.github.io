---
title: "Claudio: A Local Session Browser for Claude Code"
description: "I lost a Claude Code session. So I built a tool to find it."
date: 2026-04-03
tags: ["Python", "Flask", "Claude Code", "Open Source"]
cover:
  image: "img/claudio-tiles.png"
  alt: "Claudio in tiles mode"
  relative: false
---

Earlier today I couldn't find a Claude Code session I knew existed.
The worktree was deleted, the project folder was gone. All I had
was a vague memory of a session called sad-gagarin.

Turns out it was sitting in ~/.claude/projects/ the whole time,
buried under a UUID with no human-readable label.

So I built [Claudio](https://github.com/shahfazal/claudio).

## What it does

Claudio is a local web app that reads `~/.claude/` (the same directory Claude
Code writes to) and presents all your sessions as a browsable, searchable list.

No cloud. No sync. No accounts. It never makes a network call.

Sessions are grouped by project path, sorted newest-first, and titled
automatically using a priority chain:

1. **Compact summary**: when Claude Code compacts a long session it writes a
   structured summary. Claudio extracts the "Primary Request and Intent" line.
2. **ai-title event**: Claude Code occasionally writes a clean title directly
   into the session file.
3. **First user message**: cleaned, stripped of markdown, truncated at 80 chars.
4. **Session \<date\>**: last resort for empty sessions.

All four sources are already in the JSONL. Zero API calls.

## Transcript view

![Claudio transcript view](/img/claudio-session.png)

## Finding sad-gagarin

The session I was looking for, 6MB of conversation about contributing to the
[data.gouv.fr MCP](https://github.com/datagouv/datagouv-mcp), showed up
immediately once Claudio was running. Worktree gone, session intact.

![Claudio finding the lost session](/img/sad-gagarin.png)

## Stack

- Python, Flask, uv
- Zero external dependencies beyond Flask
- Dark / light / system theme, tile or row layout, live search, click-to-copy project path header
- `uv run claudio` - that's it

## Get it

```bash
git clone https://github.com/shahfazal/claudio
cd claudio
uv run claudio
```

Open `http://127.0.0.1:5000`

[GitHub →](https://github.com/shahfazal/claudio)
