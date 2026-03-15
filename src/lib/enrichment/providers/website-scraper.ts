// ---------------------------------------------------------------------------
// Fund Website Scraper — Extract portfolio, team, thesis from fund websites
// Free. Requires knowing the fund's website URL.
// ---------------------------------------------------------------------------

import type { EnrichmentProvider, EnrichmentProviderResult, EnrichmentField } from '../types';

export const websiteScraperProvider: EnrichmentProvider = {
  id: 'website_scraper',
  name: 'Fund Website Scraper',
  type: 'free',
  description: 'Scrapes fund websites for portfolio companies, team members, investment thesis, and contact information. Requires website URL in existing data.',
  fields_provided: ['strategy', 'people', 'portfolio', 'contact'],
  requires_api_key: false,
  rate_limit_per_minute: 10,

  isConfigured() { return true; },

  async enrich(investorName: string, existingData?: Record<string, string>): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();

    // We need a website URL to scrape
    const websiteUrl = existingData?.website || existingData?.website_url;

    if (!websiteUrl) {
      // Try to construct a likely URL
      const slug = investorName.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/\s+/g, '');
      const guesses = [
        `https://www.${slug}.com`,
        `https://${slug}.com`,
        `https://www.${slug}.vc`,
        `https://${slug}.vc`,
      ];

      // Try each guess
      for (const guess of guesses) {
        try {
          const testRes = await fetch(guess, {
            method: 'HEAD',
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),});
          if (testRes.ok) {
            fields.push({
              field_name: 'discovered_website',
              field_value: guess,
              category: 'contact',
              confidence: 0.6,});
            return await scrapeWebsite(guess, fields, now);
          }
        } catch { /* not reachable */ }
      }

      return { source_id: 'website_scraper', success: true, fields, fetched_at: now };
    }

    return await scrapeWebsite(websiteUrl, fields, now);
  },};

async function scrapeWebsite(
  baseUrl: string,
  fields: EnrichmentField[],
  now: string
): Promise<EnrichmentProviderResult> {
  try {
    // Fetch main page
    const mainRes = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RaiseApp/1.0; fundraise-enrichment)',
        'Accept': 'text/html',},
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),});

    if (!mainRes.ok) {
      return { source_id: 'website_scraper', success: false, fields, error: `HTTP ${mainRes.status}`, fetched_at: now };
    }

    const html = await mainRes.text();

    // Extract meta description
    const metaDesc = html.match(/<meta\s+(?:name|property)="(?:description|og:description)"\s+content="([^"]*?)"/i);
    if (metaDesc?.[1]) {
      fields.push({
        field_name: 'website_description',
        field_value: metaDesc[1],
        category: 'strategy',
        confidence: 0.85,
        source_url: baseUrl,});
    }

    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch?.[1]) {
      fields.push({
        field_name: 'website_title',
        field_value: titleMatch[1].trim(),
        category: 'identity',
        confidence: 0.9,
        source_url: baseUrl,});
    }

    // Extract social links
    const linkedinMatch = html.match(/href="(https?:\/\/(?:www\.)?linkedin\.com\/company\/[^"]*?)"/i);
    if (linkedinMatch?.[1]) {
      fields.push({
        field_name: 'linkedin_url',
        field_value: linkedinMatch[1],
        category: 'contact',
        confidence: 0.95,
        source_url: baseUrl,});
    }

    const twitterMatch = html.match(/href="(https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"]*?)"/i);
    if (twitterMatch?.[1]) {
      fields.push({
        field_name: 'twitter_url',
        field_value: twitterMatch[1],
        category: 'contact',
        confidence: 0.95,
        source_url: baseUrl,});
    }

    // Extract email addresses
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      const uniqueEmails = [...new Set(emailMatches)].filter(e =>
        !e.includes('example') && !e.includes('sentry') && !e.includes('webpack'));
      for (const email of uniqueEmails.slice(0, 3)) {
        fields.push({
          field_name: `email_${email.replace(/[@.]/g, '_')}`,
          field_value: email,
          category: 'contact',
          confidence: 0.8,
          source_url: baseUrl,});
      }}

    // Find portfolio/team page links
    const portfolioLinks = html.match(/href="([^"]*(?:portfolio|companies|investments)[^"]*)"/gi) || [];
    const teamLinks = html.match(/href="([^"]*(?:team|people|about)[^"]*)"/gi) || [];

    // Try scraping portfolio page
    if (portfolioLinks.length > 0) {
      const portfolioHref = portfolioLinks[0]?.match(/href="([^"]*)"/)?.[1];
      if (portfolioHref) {
        const portfolioUrl = portfolioHref.startsWith('http') ? portfolioHref :
          new URL(portfolioHref, baseUrl).toString();

        try {
          const portfolioRes = await fetch(portfolioUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RaiseApp/1.0; fundraise-enrichment)',
              'Accept': 'text/html',},
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),});

          if (portfolioRes.ok) {
            const portfolioHtml = await portfolioRes.text();
            // Extract company names from portfolio page (basic heuristic)
            // Look for common patterns: card titles, h3 tags, company name divs
            const companyMatches = portfolioHtml.match(/<(?:h[2-4]|a)[^>]*class="[^"]*(?:company|portfolio|card-title|name)[^"]*"[^>]*>([^<]+)</gi);
            if (companyMatches) {
              for (const match of companyMatches.slice(0, 20)) {
                const name = match.replace(/<[^>]*>/g, '').trim();
                if (name && name.length > 2 && name.length < 100) {
                  fields.push({
                    field_name: `portfolio_${name.replace(/\s+/g, '_').toLowerCase().slice(0, 50)}`,
                    field_value: name,
                    category: 'portfolio',
                    confidence: 0.7,
                    source_url: portfolioUrl,});
                }}
            }}
        } catch { /* portfolio page not accessible */ }
      }}

    // Try scraping team page
    if (teamLinks.length > 0) {
      const teamHref = teamLinks[0]?.match(/href="([^"]*)"/)?.[1];
      if (teamHref) {
        const teamUrl = teamHref.startsWith('http') ? teamHref :
          new URL(teamHref, baseUrl).toString();

        try {
          const teamRes = await fetch(teamUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RaiseApp/1.0; fundraise-enrichment)',
              'Accept': 'text/html',},
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),});

          if (teamRes.ok) {
            const teamHtml = await teamRes.text();
            // Extract person names and titles
            const personMatches = teamHtml.match(/<(?:h[2-4]|span|div)[^>]*class="[^"]*(?:name|person|member|team)[^"]*"[^>]*>([^<]+)</gi);
            if (personMatches) {
              for (const match of personMatches.slice(0, 15)) {
                const name = match.replace(/<[^>]*>/g, '').trim();
                if (name && name.length > 3 && name.length < 60 && name.split(' ').length >= 2) {
                  fields.push({
                    field_name: `team_${name.replace(/\s+/g, '_').toLowerCase().slice(0, 50)}`,
                    field_value: name,
                    category: 'people',
                    confidence: 0.65,
                    source_url: teamUrl,});
                }}
            }}
        } catch { /* team page not accessible */ }
      }}

    return { source_id: 'website_scraper', success: true, fields, fetched_at: now };
  } catch (error) {
    return {
      source_id: 'website_scraper',
      success: false,
      fields,
      error: error instanceof Error ? error.message : 'Unknown error',
      fetched_at: now,};
  }}
