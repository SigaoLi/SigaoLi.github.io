---
title: "GISphere Data Platform"
tagline: "From automation pipeline to BI dashboards and team KPIs — an end-to-end data product for a global volunteer organization."
year: "2025–2026"
role: "lead"
org: "GISphere"
tags: ["geo", "biz"]
repoUrl: "https://github.com/SigaoLi/GISPHERE_GOOGLE_SHEET"
featured: true
order: 3
metrics:
  - { label: "task time reduced by the ETL pipeline", value: "80%" }
  - { label: "reads across 50+ published blogs", value: "50k+" }
  - { label: "visualization dimensions in the dashboard", value: "10+" }
---

## Challenge

GISphere curates GIS graduate-program and job-market information for a worldwide audience, run entirely by volunteers. The operation lived in spreadsheets: manual data entry, manual WeChat publishing, no view of the job market the team was documenting, and no way to see whether the team itself was healthy.

As Director of GISource, I led the build-out of the data infrastructure — three systems that together form one product.

## Approach

**Ingestion & publishing automation.** A Python pipeline syncs Google Sheets into MySQL, selects content via an 80/10/10 priority algorithm, auto-detects new universities, validates required fields, generates WeChat-ready content and sends notifications — with Gmail→QQmail automatic fallback and failure logs on disk. Built cross-platform with a modular 8-component architecture.

**Market analytics dashboard.** A Streamlit + Plotly dashboard reads the merged MySQL + Google Sheets data and exposes the global GIS academic job market across 10+ visualization dimensions — time series, heatmaps, maps, Sankey flows, radar charts — with interactive multi-window slicing.

**Team KPI system.** A third layer matches human-annotated sheet data to the database via composite keys (URL + deadline), computes lead-time metrics with sensible rules for fuzzy deadlines ("Soon" → 30 days), and surfaces member contribution rankings, daily trends and geographic coverage.

## Impact

The Azure-based ETL pipeline, built with a team of four using agile methods, cut routine task time by 80%. Editorial output reached 50+ published blogs with 50k+ cumulative reads. More than the parts, the whole demonstrates product thinking: one data model serving operations, analytics and management — for an organization that runs on volunteer hours, the difference between a chore and a mission.

**Stack:** Python · MySQL · Google Sheets/Docs API · Streamlit · Plotly · Pandas · Azure · APScheduler
