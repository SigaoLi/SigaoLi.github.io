---
title: "Intelligent Email Agent"
tagline: "An LLM email copilot living in Feishu — summaries, translations, replies and memory in one interactive card."
year: "2026"
role: "personal"
tags: ["ai"]
repoUrl: "https://github.com/SigaoLi/INTELLIGENT_EMAIL_AGENT"
featured: true
order: 1
metrics:
  - { label: "LLM wait time cut by parallel processing", value: "~50%" }
  - { label: "steps unified in one accumulating card", value: "3" }
  - { label: "memory dimensions that keep learning", value: "3" }
---

## Challenge

Working across languages means every email costs twice: once to read it, once to answer it. Existing clients offer no summarization, no contextual translation, and no memory of who writes what — and switching between a mailbox, a translator and a chat tool breaks flow dozens of times a day.

The goal: handle the entire read–draft–send loop without leaving Feishu, with an AI that remembers correspondents and preferences over time — and never sends anything without human review.

## Approach

**One card, not ten notifications.** The agent monitors the inbox over IMAP with incremental tracking, and pushes each new email into a single Feishu interactive card. Reading, reply generation and review/send happen as three steps inside the same card — completed steps fold away automatically, so a busy thread never floods the chat.

**Parallel LLM pipeline.** Summarization (Chinese digest) and full translation run as parallel LangChain tasks against Qwen-plus, cutting perceived wait time roughly in half compared to sequential calls. Slow operations are dispatched asynchronously so the card always responds instantly.

**Memory that compounds.** Built on mem0 with a ChromaDB vector store, the agent maintains three memory dimensions: contact profiles (who they are, how they write), cross-email context (what this thread is really about), and user preferences (tone, sign-offs, decisions). Every interaction refines the next draft.

**Unglamorous correctness.** Full `In-Reply-To`/`References` header maintenance keeps threads intact in every client; an HTML-extraction fallback handles Outlook-style HTML-only bodies; APScheduler drives polling; SQLite tracks state across restarts.

## Impact

The agent turns a multi-tool, multi-language chore into a three-tap review flow — with a human always in the loop before send. As a product, it demonstrates the full stack of applied-AI craft: latency engineering, interaction design under platform constraints, and a memory architecture that makes the system measurably better in week four than in week one.

**Stack:** Python · LangChain · Qwen-plus · mem0 + ChromaDB · Feishu WebSocket · IMAP/SMTP · APScheduler · SQLite
