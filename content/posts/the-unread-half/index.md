---
title: "The Unread Half Is Unverified"
date: 2026-06-11
draft: false
tags: ["llm", "evals", "agent", "prompting"]
summary: "The unread half of a long model response is not wrong, it is unverified. The reading habit, and the convention, that keep me from accepting it by omission."
cover:
  image: "images/header.svg"
alt: "Diagram of a model response drawn as a vertical stack of six paragraphs. The top two are marked read; the bottom four are shaded and bracketed as unread and unverified, labeled accepted by omission. A read-cursor marker sits just after the second paragraph where the reader stopped, while a separate thread-pointer marker sits below the full response where the next message will land. An arrow notes that sending moves only the thread pointer, not the read cursor."
caption: "The read cursor and the thread pointer are not the same place. Sending advances only the second, and the half you skipped goes unverified."
relative: true
---

I noticed a habit. A coding agent or a chat model hands me a long response, four, five, six paragraphs, and I read it the way I read a diff, line by line. Two paras in, something catches: a claim I want to contest, a term I need defined, an assumption I am not sure holds. I draft a reply quoting that one line. Then I hesitate, because if I send it the conversation swings to follow my question and the other 60% I have not read yet just sits there. Unread, with a small nagging feeling attached: "Did I miss something more in the rest of the response? Or is the agent considering this me stamping _all_ of it OK?"

Where I grew up in India (in Andhra Pradesh), in the local language "Telugu", there's a saying: "మౌనం అర్ధాంగీకారం" - basically meaning "Silence is half-acceptance". An unread half of a response feels like exactly that: claims I have accepted by omission. I did not verify them. I did not even read them. I let them stand because the interface moved on. So the nagging feeling is a manifestation of that. It is my own verification instinct, instead of a test harness, firing on a conversation. The core of how I evaluate models is that an output is a set of claims to be checked, not tokens to be trusted.

I think the problem is basically a mismatch between _how_ one reads and what the medium allows. Reading is parallel. Every sentence is a potential branch point, and as I read I accumulate several of them. There are really two "cursors" in play: a read cursor, sitting wherever I have actually read to, and a thread pointer, which jumps to the end the moment I hit send. The rest of the thread is then "stamped" OK.

The question that resolves most of it is whether the sentence that stopped me is something important or conclusive. If it is an assumption the rest of the response depends on, I should clarify first, because the answer might invalidate the remaining half and reading it would be wasted effort. If it is a conclusion or a detail the rest does not hang on, I should read on, because the question usually answers itself two paragraphs later.

So I worked out a system. Whatever "hang on a sec" moment I have, I prefix this message with `PARK:`. It means answer this one question narrowly, do not reorient around it, the response you were giving is still the live document and I am still reading it. It decouples the cursors. I get my answer in the margin without surrendering my place.

It matters more with a coding agent than in chat. Interrupt an agent mid-task with a clarifying question and the default is to treat it as a new instruction and divert to it. Whether that divert actually costs the main task, a lost thread, an abandoned step, a regression, or whether the agent just answers and recovers cleanly, I have not measured, so I will not claim it derails. `PARK:` is the cheap hedge either way, for one token: answer in the margin, stay on task, do not read the question as a redirect in the first place.

On surfaces that ship the primitive natively, this already exists as a first-class feature. Claude Code's `/btw` forks an isolated, read-only side context, answers from the current session, and never writes the exchange back into the main thread. `PARK:` is the portable version of the same idea, the convention you fall back on everywhere the surface gives you nothing but a text box.

That is the whole thing. Not a methodology, a reading habit and a self-imposed convention. If you're interested, the full `PARK:` protocol prompt is [linked here](https://gist.github.com/shahfazal/80b86e9d39795d1391b0301f3cc446c1)
