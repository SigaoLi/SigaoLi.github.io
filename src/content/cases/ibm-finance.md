---
title: "AI Financial Analysis Portal"
tagline: "Upload an annual report, get SWOT, MOST and PESTLE analyses with sentiment — built with IBM."
year: "2025"
role: "team"
org: "IBM × University of Bristol"
tags: ["ai", "biz", "finance"]
repoUrl: "https://github.com/SigaoLi/UB_CP_IBM_Finance_Portal"
featured: true
order: 5
metrics:
  - { label: "strategy frameworks automated", value: "3" }
  - { label: "analysis modes — guided & custom", value: "2" }
  - { label: "industry partner", value: "IBM" }
---

## Challenge

Consultants spend their first days on any engagement extracting strategy signals from annual reports — hundreds of pages per company, repeated across every comparable. The IBM-partnered consulting project asked: how much of that first-pass analysis can a web portal automate without losing analytical structure?

## Approach

**Frameworks, not just summaries.** The portal accepts a PDF annual report and generates structured SWOT, MOST and PESTLE analyses — the actual artifacts a consultant would draft — alongside sentiment analysis across the report, related tweets and responses, and word-cloud visualizations for fast scanning.

**Two modes for two audiences.** A guided mode runs the standard analysis battery for a quick first pass; a custom mode takes detailed user requirements and develops implementation strategies against them. An integrated chat interface walks users through upload and analysis.

**Pragmatic full-stack build.** Python NLP backend with a JavaScript/HTML front end, designed and delivered by a Business Analytics consulting team working to IBM's brief over a four-month engagement.

## Impact

The portal compresses the first-pass strategic read of an annual report from days to minutes, while keeping outputs in the frameworks analysts actually use — making it a review-and-refine tool rather than a black box. As an industry collaboration, it was equal parts NLP engineering and consulting-grade requirement translation.

**Stack:** Python · NLP/sentiment pipeline · JavaScript · HTML/CSS · Flask-style web portal
