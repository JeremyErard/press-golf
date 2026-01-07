/**
 * Utility for finding and extracting course hero images
 * Uses actual web fetching to find og:image from course websites
 */

import { uploadCourseHeroImage } from './blob.js';

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
    `https://www.${normalized}golf.com`,
    `https://www.${normalized}golfclub.com`,
    `https://www.${normalized}cc.com`,
    `https://www.${withHyphens}-golf.com`,
    `https://${normalized}golf.com`,
    `https://${normalized}.com`,
  ];
}

/**
 * Extract og:image or other hero image from HTML
 */
function extractHeroImage(html: string, baseUrl: string): string | null {
  // Try og:image first (most reliable)
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

  if (ogImageMatch) {
    let imageUrl = ogImageMatch[1];
    // Make relative URLs absolute
    if (imageUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      imageUrl = `${url.protocol}//${url.host}${imageUrl}`;
    }
    return imageUrl;
  }

  // Try twitter:image
  const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterImageMatch) {
    let imageUrl = twitterImageMatch[1];
    if (imageUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      imageUrl = `${url.protocol}//${url.host}${imageUrl}`;
    }
    return imageUrl;
  }

  return null;
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
    }

    // Add generated URLs as fallback
    possibleUrls.push(...generatePossibleUrls(courseName));
    console.log(`[HeroImage] Trying URLs:`, possibleUrls);

    let foundWebsite: string | null = null;
    let heroImageUrl: string | null = null;

    // Try each possible URL
    for (const url of possibleUrls) {
      try {
        console.log(`[HeroImage] Trying: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          redirect: 'follow',
        });

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

        // Extract hero image
        const imageUrl = extractHeroImage(html, url);
        if (imageUrl) {
          foundWebsite = url;
          heroImageUrl = imageUrl;
          console.log(`[HeroImage] Found image at ${url}: ${imageUrl}`);
          break;
        }
      } catch (err) {
        console.log(`[HeroImage] Error fetching ${url}:`, err);
        continue;
      }
    }

    if (!heroImageUrl) {
      console.log(`[HeroImage] No hero image found for: ${courseName}`);
      return { heroImageUrl: null, website: foundWebsite };
    }

    // Download the image
    console.log(`[HeroImage] Downloading: ${heroImageUrl}`);
    const imageResponse = await fetch(heroImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.log(`[HeroImage] Failed to download image: ${imageResponse.status}`);
      return { heroImageUrl: null, website: foundWebsite };
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Make sure it's actually an image
    if (!contentType.includes('image')) {
      console.log(`[HeroImage] Not an image: ${contentType}`);
      return { heroImageUrl: null, website: foundWebsite };
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    // Validate size
    if (buffer.length > 10 * 1024 * 1024) {
      console.log(`[HeroImage] Image too large: ${buffer.length} bytes`);
      return { heroImageUrl: null, website: foundWebsite };
    }

    if (buffer.length < 1000) {
      console.log(`[HeroImage] Image too small (probably a placeholder): ${buffer.length} bytes`);
      return { heroImageUrl: null, website: foundWebsite };
    }

    // Determine extension from content type
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('gif')) extension = 'gif';

    // Upload to Vercel Blob
    const uploaded = await uploadCourseHeroImage(buffer, courseId, extension);

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
