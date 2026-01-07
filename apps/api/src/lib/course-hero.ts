/**
 * Utility for finding and extracting course hero images
 */

import Anthropic from '@anthropic-ai/sdk';
import { uploadCourseHeroImage } from './blob.js';

const anthropic = new Anthropic();

interface HeroImageResult {
  heroImageUrl: string | null;
  website: string | null;
}

/**
 * Searches for a golf course website and extracts a hero image
 * Runs asynchronously and updates the course record when complete
 */
export async function findAndExtractHeroImage(
  courseName: string,
  city: string | null,
  state: string | null,
  courseId: string,
  prisma: any
): Promise<HeroImageResult> {
  try {
    // Build search query
    const searchQuery = [courseName, city, state, 'golf course'].filter(Boolean).join(' ');

    // Use Claude to search for the course website and find a hero image
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Find the official website for this golf course and identify a hero image URL.

Golf Course: ${courseName}
Location: ${[city, state].filter(Boolean).join(', ') || 'Unknown'}

Search for the golf course's official website. Once found, look for:
1. The main hero/banner image on their homepage
2. An Open Graph (og:image) meta tag
3. A prominent course photo

Return ONLY a JSON object:
{
  "found": true,
  "website": "https://example-golf.com",
  "heroImageUrl": "https://example-golf.com/images/hero.jpg",
  "confidence": "high"
}

Or if not found:
{
  "found": false,
  "reason": "Could not find official website"
}

Important:
- Only return direct image URLs (ending in .jpg, .png, .webp, etc.)
- Prefer high-resolution landscape images
- The image should show the golf course (fairways, greens, scenery)
- Do NOT return placeholder or logo images`,
        },
      ],
    });

    // Extract response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in hero image search response');
      return { heroImageUrl: null, website: null };
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.found || !result.heroImageUrl) {
      console.log('Hero image not found:', result.reason);
      return { heroImageUrl: null, website: result.website || null };
    }

    // Download the image
    const imageResponse = await fetch(result.heroImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PressGolfBot/1.0)',
      },
    });

    if (!imageResponse.ok) {
      console.log('Failed to download hero image:', imageResponse.status);
      return { heroImageUrl: null, website: result.website };
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    // Validate it's actually an image and not too large
    if (buffer.length > 10 * 1024 * 1024) {
      console.log('Hero image too large, skipping');
      return { heroImageUrl: null, website: result.website };
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
        website: result.website,
      },
    });

    console.log(`Hero image saved for course ${courseId}: ${uploaded.url}`);
    return { heroImageUrl: uploaded.url, website: result.website };
  } catch (error) {
    console.error('Failed to find/extract hero image:', error);
    return { heroImageUrl: null, website: null };
  }
}
