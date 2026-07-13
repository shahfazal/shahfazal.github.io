---
title: "TinyDiffusion: the story of a hundred tiny nudges"
description: "Building a diffusion model on 2D dots, on a CPU, in 24,450 parameters. The same math that runs Stable Diffusion, with nothing else on screen."
summary: "TinyNet made backpropagation legible. TinyDiffusion does the same - this time demystifying diffusion: just the mechanism, a hundred tiny denoising nudges"
date: 2026-07-12
tags:
  [
    "diffusion",
    "generative-models",
    "pytorch",
    "building-in-public",
    "TinyDiffusion",
  ]
cover:
  image: "images/cover.svg"
  alt: "TinyDiffusion project card: a five-panel filmstrip of real generated points running from pure Gaussian noise at t=99 to two clean crescent moons at t=0, above the line 100 tiny nudges, CPU, no UNet."
  relative: true
---

## You already know TinyNet

[TinyNet](/projects/tinynet/) was a 23-parameter network whose only job was to make backpropagation legible. It was deliberately built at the bare minimum - in public - as a learning exercise for myself. TinyDiffusion is the same move, this time aimed at the diffusion process.

TinyNet trained on a 2x2 grid and guessed if the input was a horizontal or a vertical line.

TinyDiffusion generates artifacts, out of nothing and not actual images. "Generate out of nothing" means generating dots out of a Gaussian blob of noise. At scale, the whole model is 24,450 parameters and it trains on a CPU in under 2 minutes.

## Demystifying Diffusion

If you strip diffusion of its mystique, here is all of it:

1. Take a shape you already have. A tight blob of dots, say.
2. Add noise to it, bit by bit, over T steps, until there is nothing left but noise.
3. Because **you** added the noise over T steps, you know exactly what noise at step `t` was. That hands you free labelled examples: _(a noisy point, which step it is on) -> (the noise inside it)_.
4. Train a small network on those pairs. Its only skill: given a noisy point and a step number, predict the noise.
5. Now run it backwards. Start with a fresh batch of pure noise. Ask the net "what is the noise in this?", subtract a little, ask again, subtract again. T times.
6. A shape falls out.

That's it - math and a very clever approach. That is the whole thing. All that Midjourney and Stable Diffusion do is this, plus conditioning, at ridiculous scale.

Notice _where_ step 5 begins: exactly where step 2 finished. **The end of the noising is the start of the generating. They are the same place, and they have to be.** Step 2 hands the shape over as pure noise; step 5 picks pure noise up. Hold onto that one, it is the thing that breaks later.

## Unlearning my own mind

{{< pullquote >}}
"Hand the model a prompt, it hands back a picture."
{{< /pullquote >}}

This is how I pictured Diffusion in general - a single act of creation. And through the act of building TinyDiffusion, I actually learnt it does not work like that; the reality is far less mystical.

All the model ever knows is to tell/predict what _noise_ is at a particular step `t` - it doesn't generate anything more substantial. **The model never hands you a dot.** It only ever hands you _noise_. Every single time you ask, it returns its best guess at the noise vector sitting inside the point you showed it. **You** are the one who subtracts, till the noise just goes away and the shape falls out.

Just like TinyNet, there are tiny nudges, each one barely moving the point, and the sum of them is the difference between a random speck and a shape.

Which is also why "the AI imagined it" is the wrong verb. Nothing imagines anything. A noise-remover, trained on a task so easy it is almost trivial, is run backwards T times, and the shape is the residue.

Watch it all for yourself, actually happening. Out of just pure noise, over a hundred "denoising" steps, two crescents come into existence:

{{< video src="videos/resolve.mp4" poster="videos/resolve.jpg" alt="The reverse process on two moons: 100 steps of pure Gaussian noise being denoised one step at a time. Almost nothing appears to change for roughly the first seventy steps, then two crescent moons snap into existence in the last quarter." >}}

**Nothing happens for about two thirds of that animation.** The points shuffle around, the cloud stays a cloud, and then the moons arrive almost all at once at the end. That is not a rendering artefact and it is not the model being lazy. It is a flaw in the schedule I copied without thinking, and I did not notice it until I watched the thing move instead of looking at still frames.

We'll come back to it in a bit.

## Why 2D and not images, like cats

{{< pullquote >}}
The diffusion math is dimension-agnostic.
{{< /pullquote >}}

The obvious question: dots are not images, so what does TinyDiffusion do at all?

The forward noising, the training objective, the reverse sampling loop, the schedule, the time conditioning: all of it is _identical_ whether your data is a 2D point or a 256x256 image. A point and an image are both just tensors. The equations do not care about the shape of the box.

The only thing that changes with the data type is the **denoiser**, the one network doing the predicting. Actual Images force a convolutional UNet, which is a large slab of machinery with nothing to do with diffusion.

So TinyDiffusion uses a small MLP instead, and the diffusion becomes the only thing you can see.

The math in this post is not a simplified stand-in for the real thing. It **is** the real thing. It is the formulation that Stable Diffusion 1.5 and SDXL ran on, and the one the newer systems (SD3, Flux) are a reparameterisation of - more on that at the end. Nothing here has been dumbed down for the model.

## Let's math

So, we're "adding noise". Everything hangs off **one number**, `alpha_bar_t`, which slides from **1 to 0** as you add noise. It is the fraction of the original signal still surviving after `t` steps of noising.

**Forward (destroy the data):**

```
x_t = sqrt(alpha_bar_t) * x_0  +  sqrt(1 - alpha_bar_t) * noise
```

That equation is the entire forward process, and here is what it looks like running. Same two moons, noise being added and pushed through `t = 0` to `t = 99`:

{{< video src="videos/dissolve.mp4" poster="videos/dissolve.jpg" alt="The forward process: two crescent moons being noised step by step until they are an indistinguishable Gaussian blob. The shape is already unrecognisable about a third of the way through the schedule." >}}

(Again, hold your questions about how much time is spent in just noise till v0.1.1)

No model involved. No learning. Just that one line, applied a hundred times. This is the half of diffusion that is pure arithmetic, and it is the half that manufactures the training data.

**The loss (learn to undo it):**

```
loss = mean( (predicted_noise - actual_noise) ** 2 )
```

**Reverse (generate):** start at noise, subtract the predicted noise, step down, repeat.

That is the entire model. Three lines.

### The square roots are not arbitrary

This is what hurt my head much, so let me save you the same bruise. You do not memorise those square roots. You _derive_ them, from one constraint.

You want to mix signal and noise: `x_t = a * x_0 + b * noise`. And you insist that the **total variance stays at 1** the whole way (your data is normalised to variance 1, and Gaussian noise has variance 1). That forces:

```
a^2 + b^2 = 1
```

Now just _name_ `alpha_bar_t` as "the fraction of the variance that is still signal". Then `a^2 = alpha_bar_t` and `b^2 = 1 - alpha_bar_t`, and therefore:

```
a = sqrt(alpha_bar_t)          b = sqrt(1 - alpha_bar_t)
```

The square roots are the only choice that keeps the variance pinned at 1 while the signal fraction melts from 1 to 0. Nothing to memorise. Breathe and read through it carefully and it stops being scary.

## Building it

### Downscaling really means related knobs needs turning also

The noise schedule decides how much noise gets added at each step. The canonical DDPM setting is a linear ramp from `beta = 1e-4` to `beta = 0.02`, and I copied it without a second thought, over `T = 100` steps.

And the final number that matters, `alpha_bar_T`, the fraction of signal left at the very end - it should be approximately **zero**. If it is not, your data never fully dissolves, and the whole premise collapses.

It came back **0.36**.

| beta_T | alpha_bar_T | where my dot at (2,2) actually ended up           |
| ------ | ----------- | ------------------------------------------------- |
| 0.02   | 0.36        | (1.21, 1.21). Still 60% signal. Not noise.        |
| 0.10   | 0.0056      | (0.15, 0.15). Basically the origin. Actual noise. |

**`0.02` is tuned for `T = 1000`.** I had dropped `T` to 100 to be realistic, kept the beta range, and thereby injected a tenth of the total noise. My forward process was stopping two thirds of the way to its destination.

Why that is fatal rather than merely untidy: at generation time you _start_ from a standard Gaussian centred on the origin. If your forward process ends somewhere else, at (1.21, 1.21), then you are handing the trained model a starting point it has never once seen.

**`T` and the beta range are coupled. You cannot change one and keep the other.** Nothing warns you. The loss will not tell you. The only reason I caught it was that I printed a number just to address my curiousity.

### The denoiser is TinyNet plus one idea

The network is very familiar: two hidden layers, a smooth activation, in at one end and out at the other. If you have written an MLP, you have written this.

There is exactly **one** new idea for diffusion:

**The model has to be told how noisy its input is.**

Feed it only the point and the problem is unsolvable. The same coordinate could be a barely-noised point that started right there, or a heavily-noised point that started far away. Identical input, completely different noise inside. So you pass the timestep `t` in alongside the point, encoded as a vector and concatenated on.

Two inputs, fused, then a bog-standard MLP. That is the whole architecture.

It is not a cheap addition, either. At width 64, **a third of my parameters existed purely to read the clock.**

### What _can_ be trained

"Generate a shape out of nothing" is not a trainable objective. There is no label. There is nothing to be wrong about.

Diffusion's real cleverness is not in the network. It is in the setup.

So the forward process manufactures one. You take a real point, add noise you chose yourself, and now you have a supervised regression problem with a known answer: _here is a noisy point, tell me the noise I put in it._ That is an ordinary problem, and an ordinary MLP with an ordinary MSE loss solves it, using the ordinary backprop you already know.

**We write our own homework and we mark it ourselves.** An impossible generative problem is laundered into a trivial regression, and then run backwards to undo what we ourselves did.

## The ladder: dot, line, moons

The rule I gave myself was to not skip ahead. Three rungs, each a sanity gate on the plumbing before the next.

1. **The dot.** A single tight Gaussian blob. No structure at all, which is exactly the point: it proves the schedule, the forward process, the loss and the sampler are wired correctly.
2. **The line.** A thin diagonal band. Now `x` and `y` are _correlated_: knowing one tells you the other.
3. **The moons.** Two interleaving crescents.

And here is what the ladder was built to demonstrate. Between rungs, **exactly one word changes**:

```python
losses = train(model_dot,   sample_dot)
losses = train(model_line,  sample_line)
losses = train(model_moons, sample_moons)
```

Same schedule. Same forward process. Same network class. Same loss. Same sampler. The diffusion never once knew whether it was looking at a blob, a line, or a pair of crescents. That is "dimension-agnostic" subbing-in as a function signature.

## The surprise in the moons

The dot and line were the easier part. The moons needed more than the others: a wider net, five times the training. Fine. But the way I found that out is the part worth writing down.

My first attempt produced a blurry smear. My second, after widening the network and training longer, produced two clean crescents.

The loss plateaued at **~0.35** in both runs.

| run                  | loss plateau | what actually came out |
| -------------------- | ------------ | ---------------------- |
| width 64, 3k steps   | ~0.35        | a blurry smear         |
| width 128, 15k steps | ~0.35        | two clean crescents    |

Identical loss curves. Utterly different results.

If I had been tuning by the loss, I would have looked at those two flat lines, concluded the second run had changed nothing, and moved on. Visually, I could tell right away.

The loss floors climb across the ladder, too. Dot around 0.06, line around 0.27, moons around 0.35. All three rungs _succeeded_. The floor is set by how much genuine uncertainty remains about the original point given the noisy one, and a _perfect_ model would still hit those exact numbers.

So the loss cannot be compared across datasets, and inside a single dataset it cannot tell a smear from a crescent.

**The training loss measures how hard the problem is, not how good the answer is.** They are not the same thing, and in 2D you can see the gap with your own eyes.

## v0.1.1: the schedule was wasting two thirds of itself

Back to the thing that was wrong with that first animation.

At step `t`, a point is `sqrt(alpha_bar) * shape + sqrt(1 - alpha_bar) * noise`. Compare those two coefficients and you have a signal-to-noise ratio. Once it drops below 1, the noise has drowned the shape and there is genuinely nothing left to look at.

For the linear schedule I copied, **that happens at step 37.** and then on steps 38 to 99 are noise-dominated. **Sixty-two of the hundred steps are spent shuffling static.** All the destruction is crammed into the first third, and on the way back the shape does not fade in gradually, it snaps into being at the end. That is what you were watching.

The standard fix is a **cosine schedule** (Nichol and Dhariwal, _Improved DDPM_). It defines `alpha_bar` directly from a cosine curve and derives the betas backwards from it, which is the opposite of how you build the linear one. The effect is to destroy the signal more evenly across the trajectory instead of dumping it all up front.

It widens the useful window from **37 steps to 49**.

Here they are side by side, from the _same_ starting noise. Points are grey while noise-dominated and amber once the signal clears the floor:

Watch the right panel go amber (signal is above noise) roughly a dozen steps before the left one does. That is the extra window, and at the end the cosine crescents are noticeably tighter.

{{< video src="videos/schedule-compare.mp4" poster="videos/schedule-compare.jpg" alt="Linear and cosine schedules denoising the same starting noise, side by side. The cosine panel crosses the noise floor and turns amber around step 39, while the linear panel is still grey static. By the final frame both produce moons, but the cosine crescents are visibly tighter." >}}

So far, so tidy. Then I measured it.

| schedule  | training loss | off-manifold error | both moons covered? |
| --------- | ------------- | ------------------ | ------------------- |
| real data | -             | 0.014              | 50%                 |
| linear    | **0.330**     | 0.046              | 47.8%               |
| cosine    | **0.404**     | **0.038**          | 48.8%               |

(Averaged over three seeds. Off-manifold error is the mean distance from each generated point to the nearest real one: how far off the crescents we landed.)

**Cosine produces 18% better samples. And it scores 22% worse on the loss.**

Every seed. No overlap between the two groups.

The reason is not mysterious once you see it. Cosine keeps more signal alive for longer, so in the middle of the trajectory the model is being asked a genuinely _harder_ question: more of the original is still recoverable, so there is more to get wrong. Higher loss, better model. The floor moved because the **problem** moved.

And that's a wrap. Diffusion demystification dealt with. Everything above is 24,450 parameters generating dots on a laptop. The interesting question comes next.

## So what does a prompt like "A zebra walking through a church" need?

The obvious question is what separates TinyDiffusion from the thing that paints you a zebra.

![Two images generated from the same prompt, side by side. The churches differ: the left is a dim stone parish church with a flagstone aisle, the right a bright vaulted cathedral with a wooden floor. Both are photorealistic, both have a congregation in the pews and stained glass overhead, and both contain an unmistakable zebra in the centre aisle.](images/zebra-church.webp)

Five bolt-ons (and with advancing technology, much more than just these five):

- **A UNet** instead of the MLP, because pixels have spatial structure and a plain MLP cannot see it.
- **A latent space**, so the diffusion happens in a compressed 64x64 code rather than a million raw pixels. Cheaper room, same maths.
- **Text conditioning**, where the prompt becomes vectors that steer the noise prediction. This is the _same move_ as passing in the timestep: another thing concatenated in, another input the denoiser is conditioned on.
- **Guidance**, predicting the noise twice, once with the prompt and once without, then extrapolating to exaggerate whatever the prompt was pulling towards.
- **The objective itself.** Modern systems (SD3, Flux) swapped noise-prediction for flow matching: instead of "what noise is in this point," the net learns "which direction is this point travelling." It is a reparameterisation of the same idea, and everything above still holds. What I built is the formulation it is a variation of.

Now look at where all five of them actually land. Every one is a modification of, or around, a single line:

```python
eps = model(x, t)
```

The UNet is just a bigger `model`. Conditioning adds an argument to it. Guidance calls it **twice** and blends the two answers. Latents change what `x` even _is_, and wrap an encoder round the outside. Flow matching changes what the model is asked to predict.

Not one of them touches the skeleton:

{{<pullquote>}}
Corrupt the data. Learn to reverse one step of it. Start from noise, and iterate.
{{</pullquote>}}

That is the same three moves in TinyDiffusion and in a billion-dollar image model. A bigger denoiser, run in a smaller room, steered by a prompt, trained on a reparameterised objective - and underneath all of it, the same three moves.

And in case you are wondering whether it really understands your sentence: it does not, evenly. Nouns are learned strongly, because there are millions of captioned zebras and churches. Verbs and spatial relations, the _walking_ and the _through_, are learned weakly. You will reliably get a zebra and a church. Whether the zebra is convincingly walking _through_ anything is more of a coin toss. A few more follow up prompts and the model started placing the zebra(s) _outside_ the church door.

![Two more images from the same prompt, side by side, this time from outside a flint country church with a graveyard and onlookers by the gate. In the left image a single zebra steps out through the open porch doorway onto the flagstones. In the right image two zebras walk through the same porch, one behind the other. In both, the zebra is passing through the doorway.](images/zebra-church-through.webp)

_All images generated through Google Gemini Flash 3.5_

## What I actually walked away with

The code is on [GitHub](https://github.com/shahfazal/tiny-diffusion). It is one notebook, and if you have written an MLP before you will read the whole thing in twenty minutes.

But the thing I would want you to take is not the code.

It is that when scaled down **there isn't any magic in the box.** There is a small network that got very good at one narrow, boring task, a schedule of numbers that has to actually reach zero, and a loop that runs the boring task a hundred times.

A hundred tiny nudges. That is all creation turned out to be.
