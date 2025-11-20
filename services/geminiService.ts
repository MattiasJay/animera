import { GoogleGenAI, Type } from "@google/genai";
import { TripDetails } from "../types";

/**
 * Uses Gemini to interpret the user's location input (which could be vague)
 * into specific Coordinates and provides a fun summary of the trip.
 * 
 * We use Gemini 2.5 Flash for low latency.
 */
export const getTripDetails = async (start: string, end: string): Promise<TripDetails> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please provide a valid API Key.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Schema definition for structured JSON output
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      startLat: { type: Type.NUMBER, description: "Latitude of the start location" },
      startLng: { type: Type.NUMBER, description: "Longitude of the start location" },
      endLat: { type: Type.NUMBER, description: "Latitude of the destination" },
      endLng: { type: Type.NUMBER, description: "Longitude of the destination" },
      tripSummary: { type: Type.STRING, description: "A short, exciting 1-sentence summary of a road trip between these two places. Mention the approximate real-world distance." }
    },
    required: ["startLat", "startLng", "endLat", "endLng", "tripSummary"],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Jag bygger en resekarta. Jag behöver koordinaterna för en resa från "${start}" till "${end}". Ge mig också en kort, peppande sammanfattning på Svenska.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "Du är en geografisk assistent. Ge exakta koordinater för de efterfrågade städerna. Svara alltid på Svenska.",
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const data = JSON.parse(jsonText);

    return {
      startName: start,
      endName: end,
      startCoords: { lat: data.startLat, lng: data.startLng },
      endCoords: { lat: data.endLat, lng: data.endLng },
      summary: data.tripSummary,
    };

  } catch (error) {
    console.error("Gemini Service Error:", error);
    throw new Error("Misslyckades med att hämta platsinfo.");
  }
};