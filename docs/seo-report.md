# Tranqly SEO Report

Updated: July 17, 2026

## Canonical domain

- Production origin: `https://tranqly.app`
- Sitemap: `https://tranqly.app/sitemap.xml`
- Robots: `https://tranqly.app/robots.txt`
- The canonical origin is defined once in `src/lib/site.ts` and does not depend on a deployment environment variable.
- `/coming-soon` is excluded from the sitemap and marked `noindex` because it duplicates the homepage landing experience.
- `/app`, `/admin`, and `/api` are excluded from crawling.

## Search intent map

| Route | Primary intent |
| --- | --- |
| `/` | Tranqly product and daily reflection app |
| `/ai-reflection-journal` | AI reflection journal with personalized insights |
| `/daily-reflection-prompts` | Useful daily reflection questions and prompts |
| `/voice-journal` | Short voice journal and voice-to-text reflection |
| `/weekly-reflection` | Weekly reflection summaries and questions |
| `/sanctuary-journal` | Reflection journal with visual sanctuary progression |
| `/how-tranqly-works` | Product workflow, first week, and feature explanation |

## Research notes

Research was reviewed on July 17, 2026. Current product pages consistently emphasize daily prompts, AI context, voice entry, weekly summaries, privacy, and pattern recognition. Tranqly's truthful positioning gap is its combination of one-minute reflection, interpretation rather than recap, and sanctuary progression based on lifetime reflection days instead of streak pressure.

Sources:

- [Google Search Central: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google Search Central: Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Reflection app listing](https://play.google.com/store/apps/details?id=app.reflection.reflection)
- [Intura AI reflection journal](https://www.intura.app/)
- [Dayarc AI journal](https://dayarc.app/)

## Content guardrails

- No invented ratings, user counts, testimonials, or medical claims.
- Tranqly is described as a reflection companion, not therapy or professional advice.
- Pricing reflects the current monthly and yearly plans.
- FAQ structured data exactly matches visible FAQ content.
