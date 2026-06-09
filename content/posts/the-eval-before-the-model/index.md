---
title: "The Eval Before the Model"
date: 2026-06-09
draft: false
tags: ["ai", "llm", "evaluation", "fine-tuning", "haiku", "codehaiku"]
description: "Part 1 of 4 in the series PR Reviews in Haiku, and the Eval That Mattered More"
summary: "Before any training a model to output haikus, I built the eval. I ran a 30-billion-parameter teacher against it. Zero of twenty outputs were valid 5-7-5 haikus. This is what the eval taught me."
cover:
  image: "images/row_17_oscillation.png"
  alt: "line graph of the syllable count of a haiku oscillating"
  relative: true
---

> Stones forget themselves  
> Mountains grind away to dust  
> Before long silence

Now imagine code reviews written in this form, in haiku.

I wanted to fine-tune a small open-weights model to write PR review comments as 5-7-5 haiku. Before I touched any training code, I asked myself: how would I know if the model got it right?
You might ask: couldn't I just read them and count syllables myself? I could, slowly. Not reliably, and not at scale.

For most fine-tuning tasks, the answer is a loss curve. You watch it descend, you check eval loss against held-out, you ship when the numbers settle. But 5-7-5 is a hard syntactic constraint. Loss can be very small and form can still be wrong. The relevance might be off axis. A haiku that violates 5-7-5 looks fine token-by-token to a language model's training signal.

So I committed to a discipline before opening a notebook. Build the eval harness before any training. Put it to use from the beginning when we start building our training corpus itself.

The first measuring stick I needed was the one I expected to be easiest. Count syllables.

## What the counter could and could not see

`pyphen` is the standard Python library for syllabic hyphenation. I reached for it expecting a clean win. It is not a syllable counter. It is a hyphenator. Hyphenation is for line-breaking; syllabification is for the ear. They are not the same thing.

Some words match across both definitions. Some do not.

```python
>>> import pyphen
>>> d = pyphen.Pyphen(lang='en_US')

>>> d.inserted('memory')
'mem-o-ry'        # 3 syllables, matches the ear

>>> d.inserted('syllable')
'syl-la-ble'      # 3 syllables, matches

>>> d.inserted('library')
'li-brary'        # pyphen says 2, the ear says 3 (li•bra•ry)

>>> d.inserted('validator')
'val-ida-tor'     # pyphen says 3, the ear says 4 (val•i•da•tor)

>>> d.inserted('jupyter')
'jupyter'         # pyphen gives up. The ear says 3 (ju•pi•ter)
```

I had a choice. Either find a different library, or define the limitations and live with it.

I took the second route. The syllable counter in the harness is not "ground truth syllables." It is "pyphen, plus augmentations for the cases pyphen cannot handle, plus a clear indication of where it still disagrees with a person."

## When the words don't speak English

Then I hit the next problem: code-flavored haiku contain things pyphen has never seen.

The dataset (`ronantakizawa/codereview-bench` [link](https://huggingface.co/datasets/ronantakizawa/codereview-bench)) is real PR review comments on real open-source projects. The reviews I want the model to compress often reference a specific variable, a function, an API. The haiku, if it preserves the issue, often does too. So the counter has to handle tokens like `parse_user_input`, `nlayers`, `api_key`. Pyphen on those returns nonsense.

The fix was to split on `_` and count each part. `parse_user_input` becomes `parse` + `user` + `input`, each scored by pyphen. That handles snake_case identifiers, which is most of what Python developers actually write.

The leftovers are acronyms. Pyphen does not know that `api` is three syllables in human ear, `url` is three, `json` is two. So the harness keeps an override table:

```python
ACRONYMS = {
    "api": 3, "url": 3, "id": 2, "io": 2, "db": 2, "cli": 3,
    "sql": 3, "json": 2, "html": 2, "css": 3, "uri": 3,
}
```

The table is incomplete and always will be. Unknown acronyms are silent failures. The model will inevitably produce a haiku with some identifier the table has never heard of, and the counter will quietly miscount it.

I needed the counter to tell me when it was unsure. So `count_line` returns a `LineCount` object with two fields:

```python
@dataclass
class LineCount:
    syllables: int
    low_confidence: list = field(default_factory=list)
```

Any token that is not `snake_case`, not in the override table, and not a known English word ends up in `low_confidence`. So, with the counter itself, I'm starting to get an idea of the quality of the haiku. (A subtle wrinkle here: the `snake_case` branch does not consult the acronym table either. `api_key` counts as 2, not 4. I will come back to this in a later post.)

## Zero of twenty

With the counter in place and an honest record of its own limits, I ran the first real probe.

The setup was small. Twenty rows from `ronantakizawa/codereview-bench`, Python subset, filtered for length. For each row, I gave the source review to `Qwen3-30B-A3B-Instruct`, the open-weights teacher, and asked it to compress the review into a 5-7-5 haiku that preserves the specific issue. I ran this on a A100-80GB Modal container, just poking around.

```
SYSTEM_PROMPT = """You are an expert Python code reviewer. You will be given a code diff (before and after) and a human reviewer's comment about it. Distill that reviewer's comment into a haiku: three lines of 5, 7, and 5 syllables, in English.

Rules:
- Preserve the specific issue the reviewer raised. Point at the same problem, not a generic observation and not a new issue you noticed.
- Use the diff only as context to understand the comment. Do not invent problems that are not in the comment.
- You may include at most one code identifier (a variable, function, or API name), wrapped in `backticks`, and only if naming it keeps the issue specific.
- Aim for the 5-7-5 form, but prioritize keeping the issue intact over hitting the exact syllable count.
- Output only the three lines of the haiku. Nothing else."""

```

Zero of twenty outputs were valid 5-7-5.

Per-line syllable counts ran from four to thirteen against a 5-7-5 target. Not one of them cleared the form.

But the failures had two shapes. Read the haikus and they look like fine little code-review poems. By the rule I actually cared about (does the haiku capture the issue, where a syllable miss is editable and a content miss is a drop) about seventeen of twenty were content-faithful. The teacher understood the reviews. It just could not write haiku about them.

Issue nailed, form broken (counts 6 / 8 / 5):

```
List indexing copies
triggers performance hit, watch it
`geoms_T[geom.idx]`
```

The technical observation in the source review (list indexing on a tensor triggers a copy and slows inference) is captured precisely. Line lengths are wrong.

Issue lost, form also broken (counts 7 / 12 / 11):

```
Sorted: true to sort by key
Sort key defaults to "name", can be id, date, tags
List order changes only if sorted is True
```

The model gave up on compression entirely. The "haiku" expanded into documentation. Three lines that read like a docstring, with line lengths none of which match the target.

The crux is the gap between these and the counter's verdict. Read them with your eyes; they look fine. The checker says none of them are. The model cannot reliably count its own syllables. That is exactly the capability the format demands. Without the deterministic check, a naive pipeline ships either of these and never knows the difference.

This is the project's thesis, observed on day one of generation, quantified before any fine-tuning question is even asked. The eval is for catching things the model is confident about and wrong on.

## Fifty lines, sort of

The teacher could not write haiku alone. The checker could not write them either; it could only tell you when one was wrong. But maybe, together, they could.

The pattern was simple. During the probe, the teacher drafts a haiku. The checker scores each line. If any line is off, the checker formats the failure as a revision prompt: "line 1 is 8 syllables, fix to 5; line 2 is OK; line 3 is 4 syllables, fix to 5." The teacher gets the original prompt plus the previous attempt plus the feedback. It revises. The checker scores again. Three rounds maximum; if the haiku never converges, keep the closest attempt.

The orchestration is about a dozen lines:

```python
haiku = generate(messages)
result = is_valid_haiku(haiku)
history = [haiku]
it = 0
while not result.valid and it < max_revisions:
    messages.append({"role": "assistant", "content": haiku})
    messages.append({"role": "user", "content": _revise_msg(haiku, result)})
    haiku = generate(messages)
    result = is_valid_haiku(haiku)
    history.append(haiku)
    it += 1
if not result.valid:
    haiku = min(history, key=score)
    result = is_valid_haiku(haiku)
```

The rest of the script (the Modal setup, the prompts, the feedback message construction) is just scaffolding. A deterministic checker that can count steers a stochastic model that cannot.

I re-ran the same twenty-row probe through the loop.

Seven of twenty converged to valid 5-7-5. Sixteen of twenty ended within one syllable per line of valid, with the source issue intact. Two example traces are the most honest evidence I have of what the loop could and could not do.

Row 13 (one-shot success):

```
draft  counts=[6, 8, 5]
rev 1  counts=[5, 7, 5]  OK
```

Final haiku:

```
List indexing copies
triggers performance hit, watch it
`geoms_T[geom.idx]`
```

Same source review as the issue-nailed-form-broken example earlier. One round of feedback was enough. The model trimmed one syllable from line 1 and one from line 2, kept the technical content, and landed.

Row 17 (did not converge):

```
draft  counts=[6, 11, 9]
rev 1  counts=[4, 10, 5]
rev 2  counts=[6, 8, 5]
rev 3  counts=[4, 7, 5]
best   counts=[4, 7, 5]
```

Line 1 went 6, 4, 6, 4. Target was 5. The model received explicit feedback each round naming the target. It overshot to 4, then snapped back to 6, then overshot to 4 again. Four iterations, no landing.

Final haiku:

```
`api_key` not enough
use `x-oasst-user` header
ensure uniqueness now
```

The content is right. The form is one syllable short on line 1º. The model literally could not subtract one syllable when told to.

This is the deeper finding. The deterministic checker measures the gap perfectly. It cannot _install_ the capability to close it. The checker can say "line 1 needs to be 5"; the model can say "OK" and produce 4 or 6 anyway. A human handles the last mile, by trimming or padding by one syllable, with the content kept intact.

The eval stopped being only a judge somewhere in that loop. The checker became a teacher with a limit.

º A note on row 17's final haiku, since the counts may not square with the syllables you hear in your head. The counter returns 4 for api_key not enough because api_key takes the snake_case path (2) and pyphen reads enough as one syllable (1), plus not (1). A human reading the same line aloud arrives at six or seven. Both numbers are "right" in their own frame, and neither is the full story. The line is not 5-7-5 either way, which is the question the loop was actually asking. The deeper question of what counts as a valid syllable count belongs to the audit post later in this series.

## What the eval taught me before the model did

If you've followed along so far, I have not _trained_ anything yet.

Before opening a training notebook, before generating a single piece of training data, the eval had already told me three things. The model could write content that read like a code review. It could not reliably hold a 5-7-5 form on its own. Wrapped in a feedback loop, it could close most of the way to form, but not the last syllable.

That is not a finding I would have gotten from a loss curve. It came from a deterministic checker that admits what it does not know, an honest probe of the teacher's capabilities, and a loop that wraps the checker around the model. Roughly a dozen lines of orchestration and a couple of small Python modules. The infrastructure that mattered was the smallest in the project.

I expect this to be the pattern for the rest of the build. The small deterministic things are the load-bearing things. They are not the showpieces. They are not what gets pushed to Hugging Face. They are the measuring sticks I get to trust against whatever the model decides to do next.

The next thing the model decided to do, of course, was to get content wrong while the form was being fixed. That part deserves its own post.

---

> Lost, the models are  
> Narrow the art is mostly  
> tokens not meter

---

_Part 2: When the eval became the analyst, and the analyst was wrong._

_Both haiku composed by yours-truly for this post. Apologies to actual haiku poets._

_Code: [github.com/shahfazal/lgtm-575](https://github.com/shahfazal/lgtm-575)_
