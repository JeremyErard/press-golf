import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExtractedCourseData {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  tees?: {
    name: string;
    color?: string;
    slopeRating?: number;
    courseRating?: number;
    totalYardage?: number;
  }[];
  holes?: {
    holeNumber: number;
    par: number;
    handicapRank: number;
    yardages?: { teeName: string; yardage: number }[];
  }[];
}

const EXTRACTION_PROMPT = `You are a golf course data extraction assistant. Given the HTML content of a golf course website, extract structured course information.

Extract the following data if available:
1. Course name
2. Location (city, state, country)
3. Tee boxes with their names, colors, slope rating, course rating, and total yardage
4. Hole-by-hole information: par, handicap/stroke index, and yardages for each tee

Common tee names: Championship/Black, Blue, White, Gold/Senior, Red/Forward

Return ONLY a valid JSON object with this structure (omit fields if data not found):
{
  "name": "Course Name",
  "city": "City",
  "state": "CA",
  "country": "USA",
  "tees": [
    {
      "name": "Blue",
      "color": "#2563EB",
      "slopeRating": 125,
      "courseRating": 72.5,
      "totalYardage": 6800
    }
  ],
  "holes": [
    {
      "holeNumber": 1,
      "par": 4,
      "handicapRank": 7,
      "yardages": [
        { "teeName": "Blue", "yardage": 425 }
      ]
    }
  ]
}

Color hex codes to use:
- Black/Championship: #000000
- Blue: #2563EB
- White: #FFFFFF
- Gold/Senior: #EAB308
- Red/Forward: #DC2626
- Green: #16A34A

Important:
- Return ONLY the JSON object, no other text
- Use 2-letter state abbreviations for US states
- If you can't find certain data, omit that field
- Handicap rank should be 1-18 (stroke allocation)
- Make sure all numbers are actual numbers, not strings`;

export async function extractCourseData(htmlContent: string, url: string): Promise<ExtractedCourseData> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Truncate HTML if too long (Claude has context limits)
  const maxLength = 100000;
  const truncatedHtml = htmlContent.length > maxLength
    ? htmlContent.substring(0, maxLength) + '... [truncated]'
    : htmlContent;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Extract golf course data from this website (${url}):\n\n${truncatedHtml}`,
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  // Extract text from response
  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // Parse JSON from response
  try {
    // Try to find JSON in the response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const data = JSON.parse(jsonMatch[0]) as ExtractedCourseData;

    // Add the original URL
    data.website = url;

    return data;
  } catch (parseError) {
    console.error('Failed to parse Claude response:', responseText);
    throw new Error('Failed to parse course data from response');
  }
}

export async function fetchWebpage(url: string): Promise<string> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new Error('Invalid URL format');
  }

  // Fetch the webpage
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PressGolfApp/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Basic HTML cleaning - remove scripts, styles, and excessive whitespace
  const cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedHtml;
}

// Find scorecard PDF links in HTML
export function findScorecardLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];

  // Look for links containing scorecard, score-card, or .pdf
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:scorecard|score card|course info|yardage)[^<]*)<\/a>/gi;
  const pdfRegex = /<a[^>]+href=["']([^"']*\.pdf[^"']*)["']/gi;

  let match;

  // Find scorecard text links
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[1]);
  }

  // Find PDF links that might be scorecards
  while ((match = pdfRegex.exec(html)) !== null) {
    const href = match[1].toLowerCase();
    if (href.includes('score') || href.includes('card') || href.includes('yardage')) {
      links.push(match[1]);
    }
  }

  // Convert relative URLs to absolute
  const base = new URL(baseUrl);
  return links.map(link => {
    try {
      return new URL(link, base).toString();
    } catch {
      return link;
    }
  });
}

// Fetch PDF and convert to base64
export async function fetchPdf(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PressGolfApp/1.0)',
      },
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('pdf')) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return { data: base64, mediaType: 'application/pdf' };
  } catch {
    return null;
  }
}

// Extract course data from PDF using Claude's vision
export async function extractCourseDataFromPdf(
  pdfBase64: string,
  url: string
): Promise<ExtractedCourseData> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: `Extract golf course scorecard data from this PDF. This is from: ${url}`,
          },
        ],
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const data = JSON.parse(jsonMatch[0]) as ExtractedCourseData;
    data.website = url;
    return data;
  } catch (parseError) {
    console.error('Failed to parse Claude PDF response:', responseText);
    throw new Error('Failed to parse course data from PDF');
  }
}
