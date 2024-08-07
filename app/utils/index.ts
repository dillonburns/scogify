export function getDiscogsReleaseId(url: string) {
  const match = url.match(/\/(release)\/(\d+)/);

  if (!match) {
    return null; // No match found
  }

  const releaseType = match[1];
  const releaseId = match[2];

  return { releaseType, releaseId };
}

export function isDiscogsReleaseUrl(url: string) {
  const discogsUrlPattern = /^https?:\/\/(www\.)?discogs\.com\/(release)\/.+/i;

  return discogsUrlPattern.test(url);
}

export async function fetchDiscogsRelease(
  release_id: string,
  curr_abbr = "USD",
) {
  const API_URL = `https://api.discogs.com/releases/${release_id}?curr_abbr=${curr_abbr}`;

  // Replace with your actual Discogs credentials
  const API_KEY = `HibAomLPloXwLqksCxjY`;
  const API_SECRET = `OwhpHSUYZEfZqbCYyizfgATqaDEvCrXR`;

  const headers = new Headers({
    Authorization: `Discogs key=${API_KEY}, secret=${API_SECRET}`,
    "User-Agent": "YourAppName/1.0", // Required by Discogs API
  });

  const options = {
    method: "GET",
    headers: headers,
  };

  try {
    const response = await fetch(API_URL, options);
    if (!response.ok) {
      // Handle errors (e.g., not found, rate limiting)
      const errorData = await response.json();
      throw new Error(
        `Discogs API error: ${response.status} - ${errorData.message}`,
      );
    }

    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Error fetching Discogs release:", error);
    // Handle errors appropriately in your application
    throw error; // Re-throw the error to be handled by the calling code
  }
}
