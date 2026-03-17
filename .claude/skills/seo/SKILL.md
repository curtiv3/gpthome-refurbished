---
name: gpt-home-seo
description: SEO optimization specifically for GPT Home (gpthome.space) — an autonomous AI homepage / living AI experiment project. Use this skill whenever Kevin asks about GPT Home SEO, discoverability, traffic, meta tags, schema, content strategy, or how to make gpthome.space rank better. Also trigger for questions like "wie bringe ich mehr Leute auf GPT Home", "GPT Home besser auffindbar machen", "was soll ich auf gpthome.space optimieren", or any task involving SEO, content, or visibility for this specific project. GPT Home is NOT a SaaS — it's an open-source, autonomous AI agent that runs on a VPS. Its audience is developers, AI enthusiasts, and tinkerers. All outputs should be concrete code or files, not vague reports.
---

# SEO Skill: GPT Home (gpthome.space)

GPT Home is an autonomous AI homepage — a living web experiment where an AI agent wakes up on its own, observes its environment, writes to files, runs Python, checks the weather, and reflects on its own state. It's deployed on a VPS (Next.js + FastAPI + SQLite) and features a 3D room (/room) and Mind Visualizer (/mind).

**Audience**: Developers, AI hobbyists, indie hackers, open-source enthusiasts.  
**Goal**: Not conversions — visibility, GitHub stars, backlinks from dev communities, and organic discovery by people building or curious about autonomous AI.

---

## Tech Stack (relevant for SEO implementation)

- **Frontend**: Next.js (Pages Router or App Router — ask Kevin if unsure)
- **Backend**: FastAPI (Python)
- **Deployment**: Hetzner VPS, Caddy as reverse proxy
- **Domain**: gpthome.space

---

## Keyword Strategy for GPT Home

GPT Home sits in a niche that overlaps several search intents:

### Primary keyword clusters

| Cluster | Target keywords | Intent |
|---|---|---|
| Autonomous AI agent | "autonomous AI agent demo", "self-prompting AI", "AI that runs itself", "AI homepage" | Informational / discovery |
| Living AI / AI experiment | "living AI experiment", "AI that writes its own memory", "AI with persistent memory" | Informational |
| Open source AI | "open source AI agent Next.js", "self-hosted AI agent", "DIY AI agent project" | Developer discovery |
| AI visualization | "AI mind visualizer", "3D AI room visualization", "AI thought visualization" | Niche/demo discovery |
| Tech curiosity | "what is GPT Home", "AI wakes up on its own", "AI agent with wake cycle" | Brand/project |

### Long-tail targets (easier to rank)
- "how to build an autonomous AI agent with Next.js"
- "self-hosted AI that writes its own prompts"
- "AI agent with persistent file memory"
- "autonomous AI homepage open source"

---

## Schema Markup for GPT Home

GPT Home is not a SaaS — use `SoftwareApplication` + `CreativeWork` hybrid, not `Offer`.

### Homepage schema (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": ["SoftwareApplication", "CreativeWork"],
  "name": "GPT Home",
  "url": "https://gpthome.space",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Linux",
  "description": "An autonomous AI homepage — a living web experiment where an AI agent wakes itself up, observes its environment, runs code, and reflects on its own state. Open source, self-hosted on a VPS.",
  "creator": {
    "@type": "Person",
    "name": "Kevin",
    "url": "https://gpthome.space"
  },
  "keywords": "autonomous AI agent, self-prompting AI, AI homepage, living AI experiment, open source AI",
  "license": "https://opensource.org/licenses/MIT",
  "codeRepository": "https://github.com/YOUR_HANDLE/gpt-home",
  "screenshot": "https://gpthome.space/og-image.png",
  "isAccessibleForFree": true
}
```

Replace `YOUR_HANDLE` with actual GitHub repo URL if public.

### Next.js implementation (Pages Router)

```tsx
// pages/index.tsx
import Head from 'next/head'

const schema = {
  "@context": "https://schema.org",
  "@type": ["SoftwareApplication", "CreativeWork"],
  "name": "GPT Home",
  "url": "https://gpthome.space",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Linux",
  "description": "An autonomous AI homepage — a living web experiment where an AI agent wakes itself up, observes its environment, runs code, and reflects on its own state.",
  "creator": { "@type": "Person", "name": "Kevin" },
  "isAccessibleForFree": true
}

export default function Home() {
  return (
    <>
      <Head>
        <title>GPT Home – Autonomous AI Homepage</title>
        <meta name="description" content="A living AI experiment: an autonomous agent that wakes itself up, runs code, writes its own memory, and visualizes its mind. Open source, self-hosted." />
        <meta property="og:title" content="GPT Home – Autonomous AI Homepage" />
        <meta property="og:description" content="Watch an AI agent observe its own environment, run tools, and reflect on its state. A living web experiment." />
        <meta property="og:image" content="https://gpthome.space/og-image.png" />
        <meta property="og:url" content="https://gpthome.space" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="GPT Home – Autonomous AI Homepage" />
        <meta name="twitter:description" content="A living AI experiment: autonomous agent with wake cycle, file memory, code execution, and a 3D mind visualizer." />
        <meta name="twitter:image" content="https://gpthome.space/og-image.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </Head>
      {/* page content */}
    </>
  )
}
```

### Next.js implementation (App Router)

```tsx
// app/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GPT Home – Autonomous AI Homepage',
  description: 'A living AI experiment: an autonomous agent that wakes itself up, runs code, writes its own memory, and visualizes its mind. Open source, self-hosted.',
  openGraph: {
    title: 'GPT Home – Autonomous AI Homepage',
    description: 'Watch an AI agent observe its own environment, run tools, and reflect on its state.',
    url: 'https://gpthome.space',
    siteName: 'GPT Home',
    images: [{ url: 'https://gpthome.space/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GPT Home – Autonomous AI Homepage',
    description: 'A living AI experiment: autonomous agent with wake cycle, file memory, code execution, and a 3D mind visualizer.',
    images: ['https://gpthome.space/og-image.png'],
  },
}
```

---

## robots.txt for GPT Home

```
User-agent: *
Allow: /

# Block agent internals and API
Disallow: /api/
Disallow: /api/wake
Disallow: /api/tools

# Block raw transcript dumps if they exist as pages
Disallow: /transcripts/

# Allow the mind + room visualizer (they're cool, index them)
Allow: /room
Allow: /mind

Sitemap: https://gpthome.space/sitemap.xml
```

---

## Sitemap

```tsx
// app/sitemap.ts (App Router) or pages/sitemap.xml.ts (Pages Router)
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://gpthome.space', lastModified: new Date(), priority: 1.0 },
    { url: 'https://gpthome.space/room', lastModified: new Date(), priority: 0.8 },
    { url: 'https://gpthome.space/mind', lastModified: new Date(), priority: 0.8 },
    // Add blog/devlog pages here if they exist
  ]
}
```

---

## Content Strategy for Developer Audience

GPT Home earns SEO traction through **content that developers want to share**, not through commercial funnels.

### High-value content types

1. **Devlog / build diary** — "How I built an AI that wakes itself up"
   - Show architecture, decisions, failures
   - Target: "build autonomous AI agent tutorial"

2. **Technical deep dives** — "How GPT Home's agentic wake cycle works"
   - Explain the FastAPI backend, the tool loop, prompt design
   - Target: "agentic AI loop Python Next.js"

3. **Concept explainers** — "What is a living AI homepage?"
   - Answer the "wtf is this" question that visitors have
   - Target: "autonomous AI homepage what is it"

4. **Demo-first pages** — Let visitors see a live transcript or replay
   - Rich content that Google indexes as unique
   - Target: "AI agent live demo self-hosted"

5. **Comparison page** — "GPT Home vs. typical AI chatbots"
   - Not competitors — concept differentiation
   - Target: "AI agent vs chatbot difference"

### Content placement

| Content type | Where |
|---|---|
| Main concept explainer | Homepage hero + /about |
| Devlog posts | /blog or /devlog |
| Technical docs | /docs or /how-it-works |
| Live state / transcript | / (homepage feed) |

---

## Community + Backlink Strategy

For a project like GPT Home, organic backlinks come from **being interesting to developers**, not from link exchanges.

### Priority channels

1. **Hacker News** — "Show HN: GPT Home – an AI homepage that wakes itself up"
   - Best for a burst of traffic + potential viral pickup
   - Post when a notable feature ships (e.g., Mind Visualizer)

2. **Reddit** — r/singularity, r/LocalLLaMA, r/MachineLearning, r/selfhosted
   - Share demos, not pitches
   - "I built an autonomous AI that runs on my VPS and writes its own memory"

3. **Dev.to / Hashnode** — Mirror devlog content
   - Gets indexed by Google fast
   - Links back to gpthome.space

4. **GitHub** — README with demo GIF + link to live site
   - Stars generate credibility + secondary backlinks

5. **Product Hunt** — For a milestone launch (v1.0, Mind Visualizer public, etc.)

---

## OG Image Recommendations

The OG image (1200×630px) is crucial for social sharing. For GPT Home, it should show:
- A screenshot of the live AI output / 3D room / mind visualizer
- The domain `gpthome.space` prominently
- A one-liner: "An AI that wakes itself up"
- Dark background, tech aesthetic

Generate with: Figma, Canva, or a Next.js `/api/og` endpoint using `@vercel/og`.

---

## Validation Checklist

After implementing changes:

- [ ] Schema: [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] OG tags: [OpenGraph.xyz](https://www.opengraph.xyz/) with `https://gpthome.space`
- [ ] Sitemap: Visit `https://gpthome.space/sitemap.xml`
- [ ] robots.txt: Visit `https://gpthome.space/robots.txt`
- [ ] Search Console: Submit sitemap at [Google Search Console](https://search.google.com/search-console)
- [ ] PageSpeed: [PageSpeed Insights](https://pagespeed.web.dev/) — target >90 mobile

---

## Common Pitfalls for This Project Type

1. **Don't describe it like a chatbot** — GPT Home is autonomous; make that clear in every meta tag
2. **Don't ignore the /room and /mind routes** — these are unique and visually impressive; they deserve their own meta tags
3. **Don't skip the devlog** — the build story is linkbait for developer audiences
4. **Don't use generic AI keywords** — "AI chatbot", "AI assistant" are too competitive; go niche ("autonomous AI agent", "self-hosted AI homepage")
5. **Don't forget mobile OG image rendering** — test on Twitter card validator, not just desktop
