import { PlaceResult } from "../types";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";

export const searchPlaces = async (query: string): Promise<PlaceResult[]> => {
  if (!query || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "5",
      featuretype: "city" // prioritize cities
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Place search error:", error);
    return [];
  }
};
