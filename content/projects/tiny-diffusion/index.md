---
title: "TinyDiffusion"
description: "Focus: Diffusion mechanics, made legible"
summary: "A diffusion model on 2D dots. 24,450 parameters, no images, no UNet, no GPU. The same maths that runs Stable Diffusion, stripped all the way down."
date: 2026-07-12
tags: ["Python", "PyTorch", "Diffusion", "Generative Models", "TinyDiffusion"]
cover:
  image: "images/cover.svg"
  alt: "TinyDiffusion project card: a five-panel filmstrip of real generated points running from pure Gaussian noise at t=99 to two clean crescent moons at t=0, above the line 100 tiny nudges, CPU, no UNet."
  relative: true
---

Another shot at simplifying things for myself (just like [TinyNet](/projects/tinynet/)) and this time around - understand Diffusion models. TinyNet stripped a neural network down to 23 parameters, so just forward, loss and backprop were the only things left on screen. TinyDiffusion does the same to diffusion.

The data is 2D points, and not generated images. "Generate out of nothing" means generating dots out of a Gaussian blob of noise, which means the entire data distribution and the entire generated distribution fit on one scatter plot. The whole model is a 24,450-parameter MLP that trains on a CPU in seconds.

What I learnt is that the diffusion maths is dimension-agnostic: the forward noising, the noise-prediction objective, the reverse sampling loop, the schedule and the time conditioning are identical whether the data is a 2D point or a 256x256 image. The only thing that changes with the data type is the denoiser, and images force a convolutional UNet, which is a large slab of machinery with nothing to do with diffusion. Strip away the machinery and diffusion is all that remains. The maths here is not a simplified stand-in. It is the real thing, running on dots.

Built as an evolutive process - generate a dot, then a line then 2 crescent moons. Read the [full write-up](/posts/tiny-diffusion/) for more learning!

## Resources

- [Code (GitHub)](https://github.com/shahfazal/tiny-diffusion)
- [Full write-up](/posts/tiny-diffusion/)
- [TinyDiffusion model weights]
