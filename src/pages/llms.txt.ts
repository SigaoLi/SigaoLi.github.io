// /llms.txt — llmstxt.org site overview, generated from the same content as the pages.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../lib/site';
import cv from '../data/cv.json';

export const GET: APIRoute = async () => {
  const cases = (await getCollection('cases')).sort((a, b) => a.data.order - b.data.order);
  const research = (await getCollection('research')).sort((a, b) => a.data.order - b.data.order);

  const body = `# Sigao Li

> AI Product Manager at Ebest Mobile (Shanghai), with a geospatial analysis background
> (Toronto Metropolitan University) and an MSc in Business Analytics (University of Bristol).
> Director of GISource at GISphere. From maps to models, and the products in between.

Contact: ${site.email} · GitHub: ${site.socials.github} · LinkedIn: ${site.socials.linkedin}
Machine-readable resume: ${site.url}/resume.json
Full site content in one file: ${site.url}/llms-full.txt
中文版站点: ${site.url}/zh/

## AI interfaces (interactive)

- MCP server (Streamable HTTP, no auth): ${site.api}/mcp — tools: get_profile, list_experience, get_case_study. Server card: ${site.url}/.well-known/mcp.json
- Chat about Sigao (SSE, POST {lang, messages}): ${site.api}/chat — also available as a widget on every page
- Knowledge pack behind both (JSON, bilingual): ${site.url}/knowledge.json

## Case studies (what he has built)

${cases.map((c) => `- [${c.data.title}](${site.url}/work/${c.id}/): ${c.data.tagline} (${c.data.year}${c.data.org ? `, ${c.data.org}` : ''})`).join('\n')}

## Research interests

${research.map((r) => `- [${r.data.title}](${site.url}/work/#research): ${r.data.summary}`).join('\n')}

## Pages

- [Home](${site.url}/): identity, career narrative, selected work
- [Work](${site.url}/work/): all case studies, research and project index
- [CV](${site.url}/cv/): full curriculum vitae (PDF: ${site.url}/files/pdf/CV__Sigao_Li.pdf)
- [Through My Lens](${site.url}/photography/): ${'travel photography across 6 countries'}

## Current role

${cv.current ? `${cv.current.title} at ${cv.current.org}, ${cv.current.location}, since ${cv.current.start}.` : ''}
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
