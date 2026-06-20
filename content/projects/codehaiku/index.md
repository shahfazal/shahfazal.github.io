---
title: "CodeHaiku"
date: 2026-06-09
summary: "PR review comments distilled into 5-7-5 haiku. A Gemma 4 E4B fine-tune where the eval harness, not the model, is the deliverable."
tags: ["AI", "LLM Evals", "Fine-tuning", "CodeHaiku", "Open Source"]
cover:
  image: "images/codehaiku_project_card.svg"
  alt: "CodeHaiku project card: PR review comments distilled into 5-7-5 haiku, a Gemma 4 E4B fine-tune with an eval-first methodology."
  relative: true
---

CodeHaiku fine-tunes a small open-weights model (Gemma 4 E4B) to rewrite a PR review comment as a 5-7-5 haiku. A Qwen3-30B teacher distills the training pairs; the student learns to find the issue in a diff and phrase it in the form. The haiku is the toy, but building the eval is where I found the most fun.

The real deliverable is the eval. Format-constrained generation is a domain where loss curves lie: a model can drive loss to the floor and still miss 5-7-5, or hit the form and quietly drift off the issue. So the project builds the honest, deterministic eval first, and uses it to decide whether the fine-tune did anything at all. The answer was mixed, and reported in full: scored against a floor committed before training, v0.1 missed on form and cleared on content. The eval is the only part of the project whose conclusion you can trust. That is the through-line of the series, and the claim in its title: the eval mattered more than the model.

**Status:** v0.1 shipped June 2026. v1.0 (reasoning-token architecture) in progress.

## The series

Four posts: building the eval, then turning it on itself.

{{< series-list series="PR Reviews in Haiku, and the Eval That Mattered More" data="codehaiku" >}}

## Resources

- [Code and eval harness (GitHub)](https://github.com/shahfazal/lgtm-575)
- [Model v0.1 (HuggingFace)](https://huggingface.co/shahfazal/lgtm-575-gemma4-e4b-v0.1)
- [Training pairs v0.1 (HuggingFace)](https://huggingface.co/datasets/shahfazal/lgtm-575-training-pairs-v0.1)
