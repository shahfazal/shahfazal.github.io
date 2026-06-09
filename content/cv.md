---
title: "Shahfazal Mohammed"
layout: "page"
url: "/cv/"
hidemeta: true
comments: false
---

_Lead Software Engineer · Eval-gelist · Learning and Building in Public_

<div class="cv-contact">
<a href="mailto:shahfazal@gmail.com">Email</a>
<a href="https://github.com/shahfazal" target="_blank" rel="noopener noreferrer">GitHub</a>
<a href="https://linkedin.com/in/shahfazalmohammed" target="_blank" rel="noopener noreferrer">LinkedIn</a>
<a class="cv-download" href="/cv.pdf" target="_blank" rel="noopener noreferrer">Download PDF</a>
</div>

## Summary

Lead Software Engineer with 20+ years building enterprise software, now pivoting into AI tooling, agent evals, and reliable ML systems. Practical experience with the core problem of non-deterministic systems: deterministic verification layers that ground LLM outputs against source data, and eval frameworks that test the prompts and skills rather than the model. Active across the open-source AI ecosystem (Unsloth, French data.gouv MCP).

## Core Skills

- **Languages:** Java, Python, JavaScript/TypeScript.
- **AI/ML:** LLM tool use, agent architectures, eval framework design, fine-tuning (Unsloth, TRL, PEFT/LoRA), prompt engineering, PyTorch, NumPy.
- **Engineering:** Cloud architecture (AWS, Modal, Hyperforce), test automation, observability, regression detection, MCP integrations.
- **Domains:** Service Cloud, accessibility (ARIA, screen readers), open data analysis, civic tech.

## Experience

### Salesforce / Lead Software Engineer

_April 2011 to Present · New York_

15+ years delivering mission-critical Service Cloud features across Omni-Channel, Einstein Bots, and Core Infrastructure. Active contributor to Salesforce's internal AI-tooling community: building agents, eval frameworks, and MCP integrations for developer productivity and product reliability.

**AI Tooling & Agent Evals**

- **Skillomatic (internal eval harness):** Built end-to-end eval harness for Salesforce AI skills and agents. Observe-mode capture, generate-mode case proposal, LLM-as-judge evaluation, regression test loop. Used internally to validate skill and agent behavior across deployments.
- **Claude Skill eval framework with token optimization:** Built eval harness for a bug-investigation skill, validating its tool-call shape (parameter envelopes, context limits, banned terms) rather than the model's prose output. This framework helped reduce token usage by 85% (115K to 14K in benchmark case). Python stdlib only, zero dependencies.
- **Ops automation agents:** Built deflection agent for automated PagerDuty response (eliminating manual intervention on 4-5 alerts/day) and continuous SLO compliance monitor for 8+ services (replacing ~2.5 hours/day of manual dashboard checks across the team).
- **Visual Analyzer for Messaging Sessions:** Built tool converting Splunk logs into entity-flow diagrams, enabling Support and CCE teams to isolate root causes faster than parsing raw logs.

**Omni-Channel (Service Cloud) · Lead Developer (2021 to Present)**

- Leading Enhanced Omni-Channel for Salesforce on Alibaba Cloud (China data-residency requirements); designed Org Migration for Hyperforce (cross-instance customer data migration APIs); led Omni-Channel Home and Raise Flag features (centralized configuration empowering partner teams).

**Einstein Bots (Chatbot Integrations) · Lead Developer (2018 to 2021)**

- Founding member of Chatbot Integrations and Analytics. Built core integrations between Salesforce Core and Chatbot Runtime; established Functional Integration Testing (FIT) framework. Work fed forward into Agentforce.

**Service Cloud · Lead & Senior Quality Engineer (2011 to 2018)**

- Defined Quality strategy for Customer Service Infrastructure. Owned automation for the Macros feature (Java, Selenium, TestNG).

### IBM / Staff Software Engineer

_July 2004 to April 2011 · San Francisco Bay Area_

- Progressed from intern to Staff Engineer across Test, Quality, and Client Technical Resolution. Specialized in Java performance analysis and SOA implementations (BPEL, SCA, ESB). Multiple IBM BRAVO Awards.

## Public Projects & Open Source

### CodeHaiku · PR Reviews in Haiku (June 2026)

[GitHub](https://github.com/shahfazal/lgtm-575) · [Project page](/projects/codehaiku/) · [Writeup (Part 1 of 4)](/posts/the-eval-before-the-model/)

- Eval-first fine-tuning methodology, applied to a Gemma 4 E4B fine-tune that writes PR review comments as 5-7-5 haiku. Built the eval harness before any training. Used the same harness to curate training data and to gate the teacher loop.
- Deterministic syllable checker (pyphen with snake_case decomposition, acronym overrides, and low-confidence flags) catches form failures that loss curves cannot see. Generate-check-revise loop wrapped around Qwen3-30B-A3B teacher; converged 7 of 20 outright on the probe set, remaining cases land within one syllable per line of valid.
- Four-part blog series documenting the methodology. Part 1 shipped June 2026; Parts 2-4 in progress. Open source, MIT.

### CivicInsight · Kaggle Gemma 4 Good Hackathon (May 2026)

[GitHub](https://github.com/shahfazal/civicinsight) · [Project page](/projects/civicinsight/) · [Writeup](/posts/engineering-for-systems-that-lie/)

- ARIA-ready descriptions for civic data visualizations. Fine-tuned Gemma 4 E4B paired with a deterministic verification layer that grounds numeric claims against source CSV. Treats model outputs as claims to verify, not tokens to trust. Open source, MIT, runs locally on commodity GPU.
- **Upstream reports:** Filed two reproducible vision DPO bugs in Unsloth ([unslothai/unsloth#5196](https://github.com/unslothai/unsloth/pull/5196)) with workarounds; fixes merged into main April 2026.

### Claudio · Session Browser for Claude Code

[GitHub](https://github.com/shahfazal/claudio) · [Project page](/projects/claudio/)

- Open-source observability tool for Claude Code: five shipped versions covering session browser, memory browser, compaction analysis, resilience (health checks, graceful degradation), and a D3-based stats dashboard.
- Stack: Python, Flask, Jinja2, D3.js, pytest. MIT licensed, fully local, zero network calls. Cost-estimation via token counts and per-model pricing.

### Élections Municipales 2026 · French Open Data

[GitHub](https://github.com/shahfazal/elections-municipales-2026) · [Project page](/projects/elections-municipales-2026/) · [Live demo](/elections-municipales-2026/)

- Submitted to an April 2026 open data challenge on French municipal elections (data.gouv.fr). 5 interactive visualizations with full keyboard navigation and 70+ ARIA attributes. Cross-referenced 838 French communes' 2024-2025 property prices with municipal election results.

### data.gouv.fr MCP Server · French Open Data Infrastructure

[GitHub](https://github.com/datagouv/datagouv-mcp)

- **[#100](https://github.com/datagouv/datagouv-mcp/pull/100) (merged):** Contributed a deep-health-check endpoint exercising the full MCP handshake plus a real tool call. Catches integration failures that surface-level health checks miss. Plus a CLI dev script collapsing a three-curl integration test into a single command, improving maintainer ergonomics. First merged PR on French government open-source infrastructure.
- **[#115](https://github.com/datagouv/datagouv-mcp/pull/115) (merged):** Found and fixed a correctness bug where search_datasets reported the same resource count for every result: the v2 API returns the resources field as a metadata link object rather than a list, so the client was counting the wrong thing. Diagnosed against the live API, locked with a regression test, and verified end-to-end through the MCP tool loop. Shipped in release 0.2.26.

## Writing

- [Trained in America, Wrong in Paris](/posts/trained-in-america-wrong-in-paris/) (May 2026). Empirical study of LLM pretraining priors on civic data visualizations. Tested five frontier models against the same Paris election choropleth; found systematic US-bias substitution across the field.
- [Engineering for Systems That Lie](/posts/engineering-for-systems-that-lie/) (May 2026). CivicInsight retrospective on fine-tuning, verification, and what 61 examples can and cannot teach a model.
- [Nobody Tests the Steering Wheel](/posts/nobody-tests-the-steering-wheel/) (2026). Methodology piece on prompt and skill evaluation. The conceptual precursor to the verification work above.

## Education

- **Masters in Computer Science**, University of Louisiana at Lafayette
- **B.Tech in Computer Science**, Jawaharlal Nehru Technological University
