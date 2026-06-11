---
title: "ESG Report Intelligence"
tagline: "A local-LLM scraping system that finds, validates and analyzes corporate sustainability reports — air-gapped, on consumer hardware."
year: "2025"
role: "personal"
org: "University of Bristol (Research Assistant)"
tags: ["ai", "biz"]
repoUrl: "https://github.com/SigaoLi/UB_RA_CSR"
featured: true
order: 4
metrics:
  - { label: "reports targeted across 49 companies", value: "150" }
  - { label: "company-match precision via strict fuzzy matching", value: "99%+" }
  - { label: "faster on trusted-platform fast paths", value: "80–90%" }
---

## Challenge

Sustainability research needs a decade of CSR/ESG reports (2015–2024) for dozens of public companies — but the reports hide behind redesigned investor-relations sites, cookie walls, lookalike company names and scanned PDFs. Manual collection doesn't scale; naive scraping collects the wrong company's reports with confidence.

Built as a research assistant on the University of Bristol's sustainable development project, the system had one more constraint: run fully local, with zero API cost.

## Approach

**Two local models, divided labor.** Served via Ollama: DeepSeek-R1 8B handles text reasoning and search-query generation; Qwen2.5-VL 3B handles vision. Scanned or image-heavy PDFs route through a pure-vision pipeline — pages rendered to images and read by the VLM — breaking the classic scanned-document deadlock.

**Trust, but verify — at 99%.** Company identity is validated by LLM-driven fuzzy matching tuned for extreme strictness (99%+ similarity required), pushing mismatch rates below 0.1%. PDFs from trusted report platforms skip the full filter chain, an 80–90% speedup on the common path.

**A scraper that behaves like a researcher.** Playwright-driven navigation handles cookie banners and follows up to five hops of multi-level pages; GPU-accelerated deduplication (CuPy) keeps the corpus clean; every decision is logged for audit.

## Impact

The system industrializes what was a graduate-student-hours problem — locating and validating 150 reports across 49 companies — into a supervised batch process on a single consumer GPU. Methodologically, it shows that careful engineering lets small local models do trustworthy data-collection work that's usually thrown at expensive hosted APIs.

**Stack:** Python · Ollama · DeepSeek-R1 8B · Qwen2.5-VL 3B · Playwright · PyMuPDF · CuPy
