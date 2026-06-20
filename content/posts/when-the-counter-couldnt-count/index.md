---
title: "When the Counter Couldn't Count Itself"
description: "Auditing the syllable counter that judged the lgtm-575 model. Three bugs, two error directions, one already-published number corrected."
summary: "CodeHaiku: Part 3 of 4. The syllable counter was the deterministic anchor under the whole eval but two bugs that inflated its own headline, and how data volume really matters."
date: 2026-06-22
draft: false
tags: ["evals", "fine-tuning", "lgtm-575", "codehaiku"]
series: ["PR Reviews in Haiku, and the Eval That Mattered More"]
series_order: 3
series_label: "Part 3"
cover:
  image: "images/cover.svg"
  alt: "Bar chart titled 'What 20 rows hid that 200 didn't.' A tiny bar labeled 1, for the 20-row probe, sits beside a tall amber bar labeled 23, for the 200-row pool: the same counter bug flipped one syllable-validity verdict on the small probe but twenty-three on the full pass. Footnote: 118 lines disagreed; 94 of 200 haiku touched."
  relative: true
---

{{< pullquote >}}
How high the head sits  
the ruler reads one mark more  
and cannot tell so
{{< /pullquote >}}

## The shape of the audit

Part 2 was about the eye. The relevance metric, which read sober and clinical in isolation, played analyst on rows it should have flagged. The form metric (the syllable counter) was supposed to be the deterministic anchor underneath all of that.

This post is what happened when I turned the same audit on the counter (the Ruler).

Thesis to hold through what follows: an eval that participates in the loop measures itself as much as it measures the model. Once it steers the loop, every error it makes is an error it then acts on.

The audit turned up three bugs in the Ruler, pointing in two directions.

## Two counting bugs

The counter's one job is to count the syllables in a line. On the 200-row pass it was overcounting, in two small and specific ways.

**Bug A.** A word-final period made pyphen hyphenate the trailing dot as its own chunk. So a token like `scans.` came back with two syllables instead of one.

| token               | pre-fix count         | human ear |
| ------------------- | --------------------- | --------- |
| `scans.`            | 2 (read as `scan-s.`) | 1         |
| `checks.`           | 2                     | 1         |
| `scans` (no period) | 1                     | 1         |

**Bug B.** A lone punctuation token, an em-dash or ellipsis standing between words, counted as a syllable in its own right.

| token              | pre-fix | post-fix |
| ------------------ | ------- | -------- |
| `—` (lone em-dash) | 1       | 0        |

Both bugs overcount, and overcounting is the dangerous direction. An overcounted line clears the 5-7-5 bar when the ear says it should not, so the failure mode is false positives: a line a beat too long, certified as on target by the instrument built to catch exactly that.

How the bugs were caught is the awkwardly funny part. During the 200-row pass over `train_pool_haikus.json` [[file](https://github.com/shahfazal/lgtm-575/blob/main/data/train_pool_haikus.json)], I was watching the terminal live stream and noticed counts that did not match what the lines looked like. This project was supposed to be the one where I stopped eyeballing the form check. The eye caught the counter anyway.

The fix was one [commit](https://github.com/shahfazal/lgtm-575/commit/075524a05be27111d21ded19ed227e0b41e1c287) (`075524a`) and simple enough: before counting a token, strip its edge punctuation, and drop any token that is nothing but punctuation.
That single change closed both miscounts.

## What 20 rows hid that 200 did not

The 20-row probe I was running in Part 1 and Part 2 looked like a small version of the same thing the 200-row pool would later show. It was not. It was a different, easier distribution that happened to dodge the bug.

Re-scoring under the old counter against the new counter on the 200-row pool:

| corpus            | line disagreements | haikus touched | validity verdicts flipped |
| ----------------- | ------------------ | -------------- | ------------------------- |
| 20-row probe (v1) | small              | a few          | 0                         |
| 20-row probe (v2) | small              | a few          | 1                         |
| 200-row pool      | 118                | 94 of 200      | 23 of 200                 |

The bug existed the whole time. The probe rarely produced a token like `scans.` or a haiku with a lone em-dash in line 2, because the probe was 20 PR comments I had hand-picked for diversity in domain, not for diversity in punctuation. The 200-row pool was wider, messier, and full of code symbols. It surfaced the bug because it surfaced everything.

{{< pullquote >}}
Probes are useful for iteration speed; they are not useful for the question "does my instrument work on the distribution I care about."
{{< /pullquote >}}

A probe that does not flip on a counter bug is not telling you the counter is fine; it is telling you the probe does not contain the inputs that exercise the bug. I held the published v2 number, 5/20 auto-valid, on the strength of the probe.

## The number that moved after the fact

Before the punctuation fix, the v2 auto-valid rate was 5/20, and that number was in a finding I had already written up. Re-scored on the fixed counter the v2 rate is 4/20. One haiku reclassified.

```
Container can't join
network — name or state wrong
`network_name` issue
```

Line 2 counts 7 under the old counter and 6 under the new one. The lone em-dash, sitting between `network` and `name`, was the phantom seventh syllable. A single character of punctuation moved a number I had already published into a finding.

This is the part of the audit I want to keep honest about. The 5/20 figure was not a guess. It was a reported result, and a bug in the instrument inflated it by one. The correction is now 4/20, and the HF model card carries the post-fix number. The historical record is fixed on the artifact side, not just the live counter.

The bug was small enough that I might have caught the haiku 1 line the next time I read v2's output by eye. Or I might not. The point of writing a counter was to take that judgment off the eye. You cannot afford to rely on the counter to be correct on the first shot.

## Ruler and rudder: same fix, two effects

The punctuation fix did two different things to two different runs. They are separate mechanisms, easy to conflate.

**The ruler effect, on v2.** Re-scoring v2's existing output under the fixed counter changed one verdict. 5/20 became 4/20. The model output did not change; the score on the model output changed. This is the counter acting as a ruler: measure again with a better ruler, get a different measurement.

**The rudder effect, on v1.** If you recall from Part 1, we were using the counter to teach the teacher to fix its output. Now, if the counter itself was mis-counting, the teacher was being directed incorrectly as well and with the v2 fix, course corrected.

## The deferral, audited

The snake_case bug is the other one. It is opposite in direction and different in story.

In the snake_case branch of `count_line`, the counter splits an identifier on underscores and counts each part with pyphen, without consulting the acronym table. So `api_key` came back as 2 (`api`=1 from pyphen plus `key`=1), even though `api` standalone comes back as 3 from the acronym table. A known acronym inside a snake_case identifier was silently undercounted.

Counts after the fix: `api_key` = 4 (`api` 3 + `key` 1). Intended, and now actual.

The interesting beat is not the fix. It is what happened to the deferral.

In Part 1, this bug was filed and deferred on principle. The principle was bench-drop discipline: do not quietly edit a metric whose numbers you have already published, even to make those numbers more accurate. Park it, fix it as part of the v1.0 architecture work, and be loud about the change when it lands.

What I did this pass was audit the deferral itself. The question was small: what is the actual blast radius of the bug across the data we have already scored? The answer was one row. The base floor was unchanged at 14/100. The v1 and v2 probes were unchanged (5/20, then 4/20 after the punctuation fix). v0.1 moved from 8/100 to 7/100 on form, because haiku 83's `json_validated_response` line had scored valid only because `json` was undercounted. The 200-row pass moved 44 to 43.

That changed the call. A one-row blast radius does not justify leaving a known bug in for the lifetime of an architecture rewrite. The fix landed on `fix-d013-snakecase-acronym`, scoring-only. Nothing was re-generated. The loop did not re-run, so the rudder concern does not apply for v0.1; the counter changed, the same outputs were re-scored, and McNemar p stayed at 0.167 with n_discordant 19. The conclusion is unchanged: form is not the place v0.1 separates from base.

## Two directions of wrong

The punctuation bugs overcount. The snake_case bug undercounts. The audit did not surface one systematic bias in the counter. It surfaced two opposite ones, on different code paths, with different fix dates and different blast radii.

The intuition I had been carrying ("the counter probably runs a little lenient, since pyphen errs short on technical words") was wrong twice over. One error made the counter generous, the other made it strict, and the two had been canceling unevenly across the corpus. Only the row-level audit shows which way each row was wrong; the aggregate hides the cancellation.

## What Part 4 is about

This post audited the counter as an instrument. There is a second audit underneath it. The instrument has intrinsic bugs (the punctuation and snake_case miscounts); the loop then puts that instrument to extra uses, each with its own failure mode. The counter that scores can also write the next prompt (the rudder effect, surfaced here). It also scored each candidate in v2 and picked the best one, and the picking had its own bug.

That is the next post: the loop's escalation of the counter into judge, teacher, and curator, and what went wrong at each step.

[Closing haiku placeholder. Directional sketch: the ruler measuring the ruler. Or the punctuation mark that was a syllable. Faz to replace once prose is fresh.]

---

{{< pullquote >}}
Count with faithfulness  
the measure too is measured  
by a truer eye
{{< /pullquote >}}

---

_Part 4: When the eval kept taking jobs._

_Code, model, and training pairs: github.com/shahfazal/lgtm-575_

_Composing haiku is hard._
