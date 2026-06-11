// /llms-full.txt — the site's full core content as one markdown document,
// so an LLM can ingest everything in a single fetch.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../lib/site';
import cv from '../data/cv.json';

const fmtEntry = (e: { title: string; org: string; location?: string; start: string; end: string; bullets: string[] }) =>
  `### ${e.title} — ${e.org} (${e.start} to ${e.end}${e.location ? `, ${e.location}` : ''})\n${e.bullets.map((b) => `- ${b}`).join('\n')}`;

export const GET: APIRoute = async () => {
  const cases = (await getCollection('cases')).sort((a, b) => a.data.order - b.data.order);
  const research = (await getCollection('research')).sort((a, b) => a.data.order - b.data.order);

  const body = `# Sigao Li — full site content
# Source: ${site.url} · Contact: ${site.email}
# This file mirrors the site's content for LLM ingestion. Generated at build time.

# Case studies

${cases
  .map(
    (c) => `## ${c.data.title} (${c.data.year})
${c.data.tagline}
Role: ${c.data.role}${c.data.org ? ` · Organization: ${c.data.org}` : ''} · Source: ${c.data.repoUrl}
Key metrics: ${c.data.metrics.map((m) => `${m.value} ${m.label}`).join(' · ')}

${c.body}`
  )
  .join('\n\n---\n\n')}

# Research interests

${research
  .map(
    (r) => `## ${r.data.title}
${r.data.summary}

${r.data.projects.map((p) => `- **${p.title}**: ${p.abstract}`).join('\n')}`
  )
  .join('\n\n')}

# Curriculum vitae

## Current role
${cv.current ? fmtEntry(cv.current) : ''}

## Experience
${cv.experience.map(fmtEntry).join('\n\n')}

## Research experience
${cv.research.map(fmtEntry).join('\n\n')}

## Education
${cv.education.map(fmtEntry).join('\n\n')}

## Volunteering
${cv.volunteering.map(fmtEntry).join('\n\n')}

## Honors & awards
${cv.awards.map((a) => `- ${a.year}: ${a.title}`).join('\n')}

## Skills
- Data & engineering: ${cv.skills.data.join(', ')}
- ML frameworks: ${cv.skills.frameworks.join(', ')}
- Tools: ${cv.skills.tools.join(', ')}

## Certifications
${cv.certifications.map((c) => `- ${c.title} — ${c.org}`).join('\n')}
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
