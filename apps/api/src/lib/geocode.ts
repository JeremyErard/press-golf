/**
 * Geocoding utility using OpenStreetMap Nominatim API (free, no API key required)
 * Rate limit: 1 request per second, so we add a delay
 */

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Geocode an address (city, state, country) to lat/lng coordinates
 * Uses OpenStreetMap Nominatim API
 */
export async function geocodeAddress(
  city?: string | null,
  state?: string | null,
  country: string = 'USA'
): Promise<GeocodeResult | null> {
  // Build search query
  const parts = [city, state, country].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const query = parts.join(', ');

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: {
        // Nominatim requires a valid User-Agent
        'User-Agent': 'PressGolfApp/1.0 (contact@pressgolf.app)',
      },
    });

    if (!response.ok) {
      console.error('Geocoding request failed:', response.status);
      return null;
    }

    const results: NominatimResponse[] = await response.json();

    if (results.length === 0) {
      console.warn('No geocoding results for:', query);
      return null;
    }

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
