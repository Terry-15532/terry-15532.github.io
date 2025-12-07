import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Singleton instance
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateMissionFlavorText = async (
  roundNumber: number,
  agentNames: string[]
): Promise<string> => {
  if (!ai) {
    return `Mission ${roundNumber}: Operations underway.`;
  }

  try {
    const prompt = `
      Write a single, tense, dramatic sentence describing a covert spy mission (Mission #${roundNumber}) for agents: ${agentNames.join(', ')}.
      The setting should be sci-fi or cyberpunk noir. Do not reveal the outcome.
      Keep it under 30 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || `Mission ${roundNumber} initiated.`;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Mission ${roundNumber}: Classified operations in progress.`;
  }
};
