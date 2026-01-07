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

// US state codes for detection
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
  // Full state names
  'ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO',
  'CONNECTICUT', 'DELAWARE', 'FLORIDA', 'GEORGIA', 'HAWAII', 'IDAHO',
  'ILLINOIS', 'INDIANA', 'IOWA', 'KANSAS', 'KENTUCKY', 'LOUISIANA',
  'MAINE', 'MARYLAND', 'MASSACHUSETTS', 'MICHIGAN', 'MINNESOTA',
  'MISSISSIPPI', 'MISSOURI', 'MONTANA', 'NEBRASKA', 'NEVADA',
  'NEW HAMPSHIRE', 'NEW JERSEY', 'NEW MEXICO', 'NEW YORK', 'NORTH CAROLINA',
  'NORTH DAKOTA', 'OHIO', 'OKLAHOMA', 'OREGON', 'PENNSYLVANIA',
  'RHODE ISLAND', 'SOUTH CAROLINA', 'SOUTH DAKOTA', 'TENNESSEE', 'TEXAS',
  'UTAH', 'VERMONT', 'VIRGINIA', 'WASHINGTON', 'WEST VIRGINIA',
  'WISCONSIN', 'WYOMING'
]);

/**
 * Check if a state value is a US state
 */
function isUSState(state: string | null | undefined): boolean {
  if (!state) return false;
  return US_STATES.has(state.toUpperCase().trim());
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
  // Smart country detection: only use USA if state is a valid US state
  // Otherwise, let Nominatim figure out the country
  let effectiveCountry: string | null = country;
  if (state && !isUSState(state)) {
    // State doesn't match US - this is likely an international course
    // Let Nominatim handle country detection
    effectiveCountry = null;
  }

  // Build search query
  const parts = [city, state, effectiveCountry].filter(Boolean);
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
