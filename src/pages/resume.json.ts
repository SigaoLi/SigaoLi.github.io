// /resume.json — JSON Resume (jsonresume.org) for recruiting agents.
// Public info only: no phone, no address, no birth data (PRD §12.2).
import type { APIRoute } from 'astro';
import { site } from '../lib/site';
import cv from '../data/cv.json';

export const GET: APIRoute = () => {
  const resume = {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: 'Sigao Li',
      label: 'AI Product Manager · Spatial Data Scientist',
      email: site.email,
      url: site.url,
      summary:
        'AI product manager with geospatial roots: six years of geographic analysis in Toronto, an MSc in Business Analytics in Bristol (incl. an IBM consulting engagement), now building AI products at Ebest Mobile in Shanghai. Director of GISource at GISphere.',
      location: { city: 'Shanghai', countryCode: 'CN' },
      profiles: [
        { network: 'GitHub', username: 'SigaoLi', url: site.socials.github },
        { network: 'LinkedIn', username: 'sigao-li', url: site.socials.linkedin },
      ],
    },
    work: [
      ...(cv.current
        ? [{
            name: cv.current.org,
            position: cv.current.title,
            location: cv.current.location,
            startDate: cv.current.start,
            highlights: cv.current.bullets,
          }]
        : []),
      ...cv.experience.map((e) => ({
        name: e.org,
        position: e.title,
        location: e.location,
        startDate: e.start,
        endDate: e.end === 'present' ? undefined : e.end,
        highlights: e.bullets,
      })),
    ],
    volunteer: cv.volunteering.map((v) => ({
      organization: v.org,
      position: v.title,
      startDate: v.start,
      endDate: v.end === 'present' ? undefined : v.end,
      highlights: v.bullets,
    })),
    education: cv.education.map((e) => ({
      institution: e.org,
      area: e.title,
      startDate: e.start,
      endDate: e.end,
    })),
    awards: cv.awards.map((a) => ({ title: a.title, date: a.year })),
    certificates: cv.certifications.map((c) => ({ name: c.title, issuer: c.org })),
    skills: [
      { name: 'Data & Engineering', keywords: cv.skills.data },
      { name: 'ML Frameworks', keywords: cv.skills.frameworks },
      { name: 'Tools', keywords: cv.skills.tools },
    ],
    projects: [
      { name: 'Intelligent Email Agent', url: `${site.url}/work/email-agent/` },
      { name: 'GISphere LLM Analysis', url: `${site.url}/work/gisphere-llm/` },
      { name: 'GISphere Data Platform', url: `${site.url}/work/gisphere-platform/` },
      { name: 'ESG Report Intelligence', url: `${site.url}/work/csr-scraper/` },
      { name: 'AI Financial Analysis Portal', url: `${site.url}/work/ibm-finance/` },
    ],
    languages: [
      { language: 'Chinese', fluency: 'Native speaker' },
      { language: 'English', fluency: 'Full professional proficiency' },
    ],
    meta: { canonical: `${site.url}/resume.json`, lastModified: new Date().toISOString().slice(0, 10) },
  };

  return new Response(JSON.stringify(resume, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
