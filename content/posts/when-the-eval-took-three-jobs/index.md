---
title: "When the Eval Kept Taking Jobs"
description: "The counter went from scoring to teaching to curating in three days. Three roles, three failure modes, one diagnostic instrument that was quietly under-reporting."
summary: "CodeHaiku: Part 4 of 4. This is where it all ends. Or begins?"
date: 2026-06-24
draft: false
tags: ["evals", "fine-tuning", "lgtm-575", "codehaiku"]
series: ["PR Reviews in Haiku, and the Eval That Mattered More"]
series_order: 4
series_label: "Part 4"
cover:
  image: "images/cover.svg"
  alt: "Scoreboard chart titled 'The verdict: v0.1 against the base floor,' with three panels. Form: a base bar at 14 percent and a shorter v0.1 bar at 7 percent, both far below a dashed 45-percent target line, tagged MISS. Relevance: base 0.321 and v0.1 0.394 clearing a dashed 0.37 target, tagged HIT. Category macro-F1: base 0.319 and v0.1 0.458 holding the committed gap, tagged HIT. Footnote: held-out 100, same decoding both sides; form change not significant, McNemar p=0.167."
  relative: true
---

{{< pullquote >}}
Know thy true limits  
each job a new way to err  
more roles, more to miss
{{< /pullquote >}}

## The shape of this audit

Part 3 audited the counter as an instrument. The two bugs (the punctuation and snake_case miscounts) were intrinsic to the counter's code: it miscounted certain tokens. Fix the code, the miscounts stop.

This post is about what happens after that. Between iterations, the same syllable counter went from scoring haikus to writing the next prompt to selecting the best candidate across a run. Three roles in three days. Each new role was a new way for the counter to be quietly wrong, with a separate failure mode underneath each one.

The thesis from Part 3 is still relevant here. Once an eval steers the loop, every error it makes is an error it then acts on. Part 3 was about errors in the measurement. This post is about errors in the roles the measurement was asked to play.

## Judge, teacher, curator: three roles in three days

Verified from git, first-add commits:

| Role                                         | Where                                      | Landed               | Failure mode it introduced                                         |
| -------------------------------------------- | ------------------------------------------ | -------------------- | ------------------------------------------------------------------ |
| Judge (scores output)                        | `harness/syllables.py`, `is_valid_haiku`   | 2026-06-01 (348e49c) | the counter itself miscounts (the punctuation and snake_case bugs) |
| Teacher (writes feedback for next iteration) | `scripts/teacher_loop.py`, `_revise_msg`   | 2026-06-03 (84c9e1b) | bad counts write bad instructions (the rudder effect, Part 3)      |
| Curator (selects best across candidates)     | `scripts/teacher_loop_v2.py`, the sort key | 2026-06-04 (ebe5c17) | the wrong candidate gets banked (the selection bug, this post)     |

Part 3 covered the first two: the judge miscounts, the teacher repeats the miscount into the next prompt. This post is the third.

## The curator's sort key

The v2 loop runs each row through several revision iterations, then banks the best candidate across them. The bug was in how it chose "best".

It broke ties on relevance. So among candidates that were faithful but not yet valid 5-7-5, a haiku three syllables from the target could beat one a single syllable away, as long as it scored a hair higher on relevance. A 0.02 relevance edge is noise, and it was deciding which haiku got banked; it banked the one that needed more surgery.

"Best" is a sort key, in `scripts/teacher_loop_v2.py`:

```python
def tier(valid, rel, rel0):
    not_drifted = rel >= rel0 - RELEVANCE_TOL
    if valid and not_drifted: return 3   # ideal
    if not_drifted:           return 2   # faithful, form not yet fixed
    if valid:                 return 1   # valid but drifted
    return 0                             # drifted and invalid

best_score = (tier(result.valid, rel, rel0), -_form_distance(result.counts), rel)
```

The key is a 3-tuple: faithfulness tier first, then negative form-distance, then relevance. The `-_form_distance` term is the fix. Before it, the key was just `(tier, rel)`: tier, then relevance as the only tiebreak, which is exactly what let the worse-form candidate win.

The code comment that landed with the fix names the bug exactly: "stops a worse-form candidate from winning on a noise-level relevance edge ... A 0.02 relevance edge is noise; a three-syllable surgery versus a one-syllable trim is real curation labor."

In tier 2 (the faithful-but-not-yet-valid bucket, where most mid-loop candidates live), the curator was tiebreaking the wrong way. A relevance score that fluctuates with token-level resampling was being trusted over a form distance that is deterministic.

## The 5-10-5 row (session-captured)

A flag before the example, because the framing matters. The v2 loop JSON saves the kept haiku per row (counts, valid, relevance, draft_relevance, tier, iterations) and discards the rejected candidates. The specific picks that exercised the selection bug live in the session log (captured in my notes at the time), not in a file that can be re-derived today. The example below is quoted as captured. The mechanism is in the code; the specific picks are in the log.

The case as recorded:

- Candidate A (kept, pre-fix): counts 5-10-5, relevance 0.67.
- Candidate B (rejected, pre-fix): counts 5-7-6, relevance 0.65.

Both are tier 2: both faithful, neither valid. Under the old sort key `(tier, rel)`, A wins on a +0.02 relevance edge. Under the new key `(tier, -_form_distance, rel)`, A's form distance is `|10-7| = 3` and B's is `|6-5| = 1`. B wins. The tiebreak now prefers B (one syllable from valid) over A (a three-syllable rewrite of the middle line).

In operational terms: A needs the middle line cut from 10 syllables to 7, which is a rewrite. B needs the last line cut from 6 to 5, which is a trim. A 0.02 relevance edge does not justify three syllables of rewriting labor over one syllable of trimming. The fix says so.

A second case from the same window: 6-7-7 at relevance 0.87 kept over 4-7-5 at 0.84. Form distance 2 vs 1, relevance edge 0.03. Same pattern, smaller numbers. Both examples are session-captured.

## The logging gap

The kept-line print, current:

```python
print(f"  kept   counts={best['counts']} rel={best['relevance']:.2f} [tag]")
```

The `counts=` is the fix. Before it, the kept-line log printed the haiku text and its tier tag but not its syllable counts. A kept 5-10-5 looked, in the log, like a faithful win. The verdict was tier 2; the haiku rendered fine; the counts were never shown.

That gap is why the selection bug first read like a counter bug. Skimming the live stream, kept lines looked correct because their counts were not in the log. The selection was misranking candidates and the log was not showing the input to the misranking. The loop was measuring correctly and reporting incompletely.

This is the diagnostic-instrument-of-the-instrument point. The counter scored correctly on the 5-10-5 candidate; 5-10-5 is not 5-7-5; the score was tier 2; the sort key then picked it; the kept-line log dropped the counts. Three different layers had to be working for the bug to be visible, and one of them (the log) was silently filtering.

Whether the log gap was caught in the same eyeballing pass as the counter bugs or separately is uncertain from artifacts; likely the same audit window when building this.

## What the escalation actually was

Each new role that the counter took on, was a new surface to be quietly wrong on. The pattern across the three:

- Judge can miscount (Part 3's punctuation and snake_case bugs).
- Teacher can misinstruct: when the judge miscounts and the teacher repeats the count into the next prompt, the model is steered on bad data. This is Part 3's rudder section.
- Curator can mis-select: even when judge and teacher are both correct, the curator can pick the wrong candidate out of the set the loop produced.

The failure modes nest. A counter that only scored could only miscount. A counter that also taught could miscount and write a wrong instruction. A counter that also curated could miscount, write a wrong instruction, and pick the wrong candidate from the set the wrong instructions produced.

The eval was carrying three responsibilities. The eval was not built to carry three responsibilities. When Part 3's audit closed the judge-level bugs, the rudder problem and the curator problem were both still there, because they were not bugs in counting. They were bugs in role assignment.

## A meta-beat the audit surfaces

Part 3 could not show the pre-fix and post-fix feedback strings for haikus 5 and 19; the v1 loop saved finals, not intermediates. This post cannot reproduce the 5-10-5 candidate set; the v2 loop saved kept haikus, not rejected ones. Same shape of gap in two different layers.

The gap is a small instance of the same thesis. The loop was busy doing its three jobs (scoring, teaching, curating) and not busy logging what it was doing. By the time the eyeballing pass caught the bugs, the data that would have made them cheaply reproducible was no longer there.

The fix for the next architecture is in two places. Persist intermediates: every iteration's feedback string, every candidate's counts, every selection decision. And separate the roles: if the same instrument is judge and teacher and curator, each role should at least be independently inspectable in the log.

## The verdict, and why it is the point

Part 3 and Part 4 were the eval auditing itself. This is where it finally turns back to the thing it was built to judge: the fine-tune.

v0.1 is a LoRA SFT on 113 (diff, haiku) pairs, scored against a base floor that was committed before any training, on the same held-out 100 with the same prompt and greedy decoding on both sides. Bench-drop discipline: same scorer, same set, both sides, so the comparison is valid by construction. The three golden numbers were committed before the SFT run itself, which is the only reason the scoreboard means anything; the project did not get to pick which metric moved after the fact.

| Metric                        | Base Gemma4 floor | v0.1 SFT | Golden number        | Verdict |
| ----------------------------- | ----------------- | -------- | -------------------- | ------- |
| #1 Form (valid 5-7-5)         | 14%               | 7%       | >= 45%               | Miss    |
| #3 Relevance (real-pair mean) | 0.321             | 0.394    | >= 0.37              | Hit     |
| #2 Category (macro-F1)        | 0.319             | 0.458    | hold gap (>= +0.139) | Hit     |

One miss, two hits. The miss is on the headline metric and the ambitious target. Form did not stall; it regressed, 14% to 7%, and the regression is not statistically significant (McNemar exact p=0.167, n_discordant=19: 13 rows lost validity under the fine-tune, 6 gained). The honest reading is "down, but indistinguishable from noise." A single LoRA pass on 113 pairs did not transfer the generate-check-revise loop's form skill into the weights. The loop knows how to count; SFT did not move that knowing across.

Relevance and category both cleared. Relevance rose 0.321 to 0.394, and its gap over the shuffle floor widened (+0.192 to +0.287), under the autonomous-reviewer framing that was chosen specifically to make relevance hard to game (the student sees only the diff, never the human comment). Category, the soft metric, more than doubled its gap over the majority baseline (+0.139 to +0.279).

One caveat the series owes its reader. The form numbers are counter-valid, scored by the same syllable counter Part 3 put on trial. The calibration set that would say how close the fixed counter now sits to the human ear (N=150 lines) was locked and never built. It is the only open harness debt, and it is on-thesis: the headline number of the whole series rests on an instrument whose agreement with the ear is still unmeasured.

The form miss has a specific hypothesis, and it points at the next architecture: _SFT cannot install an iterative loop-skill in one forward pass_, so v1.0's bet is to give the model reasoning tokens to carry the 5-7-5 constraint internally before it generates, instead of leaning on the loop to steer it after. Or maybe try a voice-generation model that has a better theoretical understanding of syllables and words. That is the next project, not this series.

---

{{< pullquote >}}
Starts the next journey  
The ruler taught all it could  
Now, the model learns
{{< /pullquote >}}

---

_Code, model, and training pairs: github.com/shahfazal/lgtm-575_
