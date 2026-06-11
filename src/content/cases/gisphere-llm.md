---
title: "GISphere LLM Analysis"
tagline: "A multimodal LLM system that reads webpages, PDFs and screenshots to structure the world's GIS academic opportunities."
year: "2026"
role: "lead"
org: "GISphere (GIS-Info)"
tags: ["ai", "geo"]
repoUrl: "https://github.com/GIS-Info/GISPHERE_LLM_Analysis"
featured: true
order: 2
metrics:
  - { label: "input source types unified", value: "5" }
  - { label: "stage LLM analysis pipeline", value: "3" }
  - { label: "min auto-cooldown on failing API keys", value: "30" }
---

## Challenge

GISphere volunteers track academic opportunities — PhD openings, faculty positions, funding calls — scattered across university pages, PDF flyers, WeChat screenshots and shared spreadsheets. Turning that chaos into a clean, structured database meant hours of manual reading and copy-pasting per week, with quality depending entirely on who did the typing.

As the lead designer and developer, I set out to make the pipeline read anything a volunteer could throw at it.

## Approach

**Read anything.** The system ingests five source types — webpages, PDFs, screenshots, local Excel and Google Sheets. Web extraction uses Playwright for dynamic rendering with trafilatura for clean text; documents fall through a chain of PyMuPDF → pdfplumber → Tesseract OCR → vision-language model, so even a scanned flyer ends as structured text.

**Three-stage analysis.** Extracted content passes through a staged LLM pipeline that identifies the opportunity, classifies it across GIS sub-disciplines (Physical Geo, Human Geo, Urban, GIS, RS, GNSS), and fills the structured schema — deadlines, funding, contacts — directly into the team's sheet.

**Engineered for unreliable infrastructure.** A model-chain gateway falls back across GPT, Gemini and Claude; API keys that return 401/403 enter a 30-minute circuit-breaker cooldown; partially successful rows keep their completed fields instead of failing whole; and batch runs resume from where they stopped. Search verification cross-checks claims via DuckDuckGo/Bing before data lands.

## Impact

Released as an MIT-licensed project under the GIS-Info organization, the system replaces the most tedious volunteer workflow with a supervised pipeline — humans verify instead of transcribe. It is the intelligence layer of the broader GISphere data platform, and a working study in production LLM engineering: graceful degradation, multimodal fallbacks, and failure isolation as first-class design requirements.

**Stack:** Python · multi-model gateway (GPT / Gemini / Claude) · Playwright · trafilatura · PyMuPDF · Tesseract OCR · VLM · Google Sheets API
