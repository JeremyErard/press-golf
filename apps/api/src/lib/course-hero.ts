/**
 * Utility for finding and extracting course hero images
 * Uses actual web fetching to find og:image from course websites
 */

import https from 'https';
import http from 'http';
import { uploadCourseHeroImage } from './blob.js';

// Create HTTPS agent that ignores SSL certificate errors
// This is safe for fetching public images from golf course websites
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Fetch a URL with optional SSL bypass for expired certificates
 */
async function fetchWithSSLBypass(url: string, options: RequestInit = {}): Promise<Response> {
  const urlObj = new URL(url);

  // For HTTPS URLs, use our custom agent that ignores SSL errors
  if (urlObj.protocol === 'https:') {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        agent: insecureAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ...options.headers as Record<string, string>,
        },
      }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchWithSSLBypass(res.headers.location, options).then(resolve).catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
            status: res.statusCode || 0,
            headers: {
              get: (name: string) => res.headers[name.toLowerCase()] as string || null,
            },
            text: async () => body.toString('utf-8'),
            arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
          } as unknown as Response);
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });
  }

  // For HTTP URLs, use standard http module
  return new Promise((resolve, reject) => {
    const req = http.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...options.headers as Record<string, string>,
      },
    }, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchWithSSLBypass(res.headers.location, options).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
          status: res.statusCode || 0,
          headers: {
            get: (name: string) => res.headers[name.toLowerCase()] as string || null,
          },
          text: async () => body.toString('utf-8'),
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        } as unknown as Response);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

interface HeroImageResult {
  heroImageUrl: string | null;
  website: string | null;
}

/**
 * Generate possible website URLs for a golf course
 */
function generatePossibleUrls(courseName: string): string[] {
  // Normalize the name for URL generation
  const normalized = courseName
    .toLowerCase()
    .replace(/golf\s*(club|course|links)?/gi, '')
    .replace(/country\s*club/gi, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '');

  const withHyphens = courseName
    .toLowerCase()
    .replace(/golf\s*(club|course|links)?/gi, '')
    .replace(/country\s*club/gi, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  // Common patterns for golf course websites
  return [
    // .com variants
    `https://www.${normalized}golf.com`,
    `https://www.${normalized}golfclub.com`,
    `https://www.${normalized}cc.com`,
    `https://www.${withHyphens}-golf.com`,
    `https://${normalized}golf.com`,
    `https://${normalized}.com`,
    // .org variants (many country clubs use .org)
    `https://www.${normalized}cc.org`,
    `https://www.${normalized}golfclub.org`,
    `https://www.${normalized}.org`,
    `https://${normalized}cc.org`,
    // .net variants
    `https://www.${normalized}golf.net`,
    `https://www.${normalized}cc.net`,
  ];
}

/**
 * Check if an image URL looks like a logo (to avoid)
 */
function looksLikeLogo(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('logo') ||
    lowerUrl.includes('crest') ||
    lowerUrl.includes('badge') ||
    lowerUrl.includes('emblem') ||
    lowerUrl.includes('icon') ||
    lowerUrl.includes('seal') ||
    lowerUrl.includes('shield');
}

/**
 * Check if an image URL looks like a course photo (preferred)
 */
function looksLikeCoursePhoto(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('course') ||
    lowerUrl.includes('hole') ||
    lowerUrl.includes('fairway') ||
    lowerUrl.includes('green') ||
    lowerUrl.includes('aerial') ||
    lowerUrl.includes('landscape') ||
    lowerUrl.includes('hero') ||
    lowerUrl.includes('banner') ||
    lowerUrl.includes('slider') ||
    lowerUrl.includes('bg') ||
    lowerUrl.includes('background');
}

/**
 * Extract hero image candidates from HTML, preferring course photos over logos
 * Returns multiple candidates sorted by score so we can try alternatives if first fails
 */
function extractHeroImageCandidates(html: string, baseUrl: string): string[] {
  const candidates: { url: string; score: number }[] = [];
  const seenUrls = new Set<string>();

  // Helper to make URLs absolute
  const makeAbsolute = (imageUrl: string): string => {
    if (imageUrl.startsWith('//')) {
      return 'https:' + imageUrl;
    }
    if (imageUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      return `${url.protocol}//${url.host}${imageUrl}`;
    }
    if (!imageUrl.startsWith('http')) {
      const url = new URL(baseUrl);
      return `${url.protocol}//${url.host}/${imageUrl}`;
    }
    return imageUrl;
  };

  // Helper to add candidate without duplicates
  const addCandidate = (imageUrl: string, bonus: number) => {
    const url = makeAbsolute(imageUrl);
    if (seenUrls.has(url)) return;
    seenUrls.add(url);

    let score = bonus;
    if (looksLikeLogo(url)) score -= 100; // Heavily penalize logos
    if (looksLikeCoursePhoto(url)) score += 50; // Prefer course photos
    // Prefer larger image paths (often have dimensions in name)
    if (url.match(/\d{3,4}x\d{3,4}/) || url.match(/large|big|full|hd|high/i)) score += 20;
    // Prefer jpg/jpeg (usually photos vs png logos)
    if (url.match(/\.jpe?g/i)) score += 10;
    // Bonus for banner/portlet images (common in CMS systems)
    if (url.toLowerCase().includes('banner') || url.toLowerCase().includes('portlet')) score += 35;

    candidates.push({ url, score });
  };

  // Try og:image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImageMatch) {
    addCandidate(ogImageMatch[1], 30); // Bonus for og:image
  }

  // Try twitter:image
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterMatch) {
    addCandidate(twitterMatch[1], 25);
  }

  // Look for hero/banner images in HTML
  const heroPatterns = [
    /<img[^>]*class=["'][^"']*hero[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*hero[^"']*["']/gi,
    /<div[^>]*class=["'][^"']*hero[^"']*["'][^>]*style=["'][^"']*url\(['"]?([^"')]+)['"]?\)/gi,
    /<img[^>]*class=["'][^"']*banner[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*class=["'][^"']*slider[^"']*["'][^>]*src=["']([^"']+)["']/gi,
  ];

  for (const pattern of heroPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      addCandidate(match[1], 40); // Bonus for hero class
    }
  }

  // Look for large background images
  const bgPattern = /background(?:-image)?:\s*url\(['"]?([^"')]+)['"]?\)/gi;
  let bgMatch;
  while ((bgMatch = bgPattern.exec(html)) !== null) {
    addCandidate(bgMatch[1], 15);
  }

  // Look for large images in <img> tags (fallback for when og:image is broken)
  // Match images with banner, portlet, hero in their path, or from /documents/ paths (CMS)
  const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const src = imgMatch[1];
    // Only add if it looks like a potential hero image
    if (src.match(/banner|portlet|hero|slider|featured|main/i) ||
        src.match(/\/documents\//i) ||
        src.match(/\.(jpg|jpeg)$/i)) {
      addCandidate(src, 10);
    }
  }

  // Sort by score
  candidates.sort((a, b) => b.score - a.score);

  console.log('[HeroImage] Candidates:', candidates.slice(0, 5).map(c => ({ url: c.url.substring(0, 80), score: c.score })));

  // Return URLs only, filtered to exclude logos
  return candidates
    .filter(c => !looksLikeLogo(c.url))
    .map(c => c.url);
}

/**
 * Searches for a golf course website and extracts a hero image
 * Runs asynchronously and updates the course record when complete
 * @param extractedWebsite - Optional website URL extracted from scorecard (highest priority)
 */
export async function findAndExtractHeroImage(
  courseName: string,
  city: string | null,
  state: string | null,
  courseId: string,
  prisma: any,
  extractedWebsite?: string | null
): Promise<HeroImageResult> {
  try {
    console.log(`[HeroImage] Starting search for: ${courseName}`);
    if (extractedWebsite) {
      console.log(`[HeroImage] Using extracted website: ${extractedWebsite}`);
    }

    // Build list of URLs to try - prioritize extracted website
    const possibleUrls: string[] = [];

    // Add extracted website first (highest priority)
    if (extractedWebsite) {
      // Ensure it has protocol
      let url = extractedWebsite.trim();
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      possibleUrls.push(url);

      // Also try www variant if not present
      if (!url.includes('www.')) {
        const urlObj = new URL(url);
        possibleUrls.push(`${urlObj.protocol}//www.${urlObj.host}${urlObj.pathname}`);
      }

      // For .com domains, also try .co.uk (common for UK/Scottish courses)
      if (url.includes('.com')) {
        const coUkVariant = url.replace('.com', '.co.uk');
        possibleUrls.push(coUkVariant);
        // Also try www variant of .co.uk
        if (!coUkVariant.includes('www.')) {
          const urlObj = new URL(coUkVariant);
          possibleUrls.push(`${urlObj.protocol}//www.${urlObj.host}${urlObj.pathname}`);
        }
      }
    }

    // Add generated URLs as fallback
    possibleUrls.push(...generatePossibleUrls(courseName));
    console.log(`[HeroImage] Trying URLs:`, possibleUrls);

    let foundWebsite: string | null = null;
    let imageCandidates: string[] = [];

    // Try each possible URL to find the course website
    for (const url of possibleUrls) {
      try {
        console.log(`[HeroImage] Trying: ${url}`);
        const response = await fetchWithSSLBypass(url);

        if (!response.ok) {
          console.log(`[HeroImage] ${url} returned ${response.status}`);
          continue;
        }

        const html = await response.text();

        // Check if this looks like a golf course website
        const lowerHtml = html.toLowerCase();
        if (!lowerHtml.includes('golf') && !lowerHtml.includes('course') && !lowerHtml.includes('tee')) {
          console.log(`[HeroImage] ${url} doesn't appear to be a golf site`);
          continue;
        }

        // Extract hero image candidates (returns multiple sorted by score)
        const candidates = extractHeroImageCandidates(html, url);
        if (candidates.length > 0) {
          foundWebsite = url;
          imageCandidates = candidates;
          console.log(`[HeroImage] Found ${candidates.length} candidates at ${url}`);
          break;
        }
      } catch (err) {
        console.log(`[HeroImage] Error fetching ${url}:`, err);
        continue;
      }
    }

    if (imageCandidates.length === 0) {
      console.log(`[HeroImage] No hero image found for: ${courseName}`);
      return { heroImageUrl: null, website: foundWebsite };
    }

    // Try downloading each candidate until one succeeds
    let downloadedBuffer: Buffer | null = null;
    let contentType: string = 'image/jpeg';
    let successfulImageUrl: string | null = null;

    for (const imageUrl of imageCandidates.slice(0, 5)) { // Try up to 5 candidates
      try {
        console.log(`[HeroImage] Downloading: ${imageUrl}`);
        const imageResponse = await fetchWithSSLBypass(imageUrl);

        if (!imageResponse.ok) {
          console.log(`[HeroImage] Failed to download image: ${imageResponse.status}`);
          continue;
        }

        contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Make sure it's actually an image
        if (!contentType.includes('image')) {
          console.log(`[HeroImage] Not an image: ${contentType}`);
          continue;
        }

        const buffer = Buffer.from(await imageResponse.arrayBuffer());

        // Validate size
        if (buffer.length > 10 * 1024 * 1024) {
          console.log(`[HeroImage] Image too large: ${buffer.length} bytes`);
          continue;
        }

        if (buffer.length < 1000) {
          console.log(`[HeroImage] Image too small (probably a placeholder): ${buffer.length} bytes`);
          continue;
        }

        // Success!
        downloadedBuffer = buffer;
        successfulImageUrl = imageUrl;
        console.log(`[HeroImage] Successfully downloaded: ${imageUrl} (${buffer.length} bytes)`);
        break;
      } catch (err) {
        console.log(`[HeroImage] Error downloading ${imageUrl}:`, err);
        continue;
      }
    }

    if (!downloadedBuffer || !successfulImageUrl) {
      console.log(`[HeroImage] All download attempts failed for: ${courseName}`);
      return { heroImageUrl: null, website: foundWebsite };
    }

    // Determine extension from content type
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('gif')) extension = 'gif';

    // Upload to Vercel Blob
    const uploaded = await uploadCourseHeroImage(downloadedBuffer, courseId, extension);

    // Update the course record
    await prisma.course.update({
      where: { id: courseId },
      data: {
        heroImageUrl: uploaded.url,
        website: foundWebsite,
      },
    });

    console.log(`[HeroImage] Saved for course ${courseId}: ${uploaded.url}`);
    return { heroImageUrl: uploaded.url, website: foundWebsite };
  } catch (error) {
    console.error('[HeroImage] Failed:', error);
    return { heroImageUrl: null, website: null };
  }
}
