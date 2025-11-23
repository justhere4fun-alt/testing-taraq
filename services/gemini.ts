import { GoogleGenAI } from "@google/genai";

// Initialize API Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANIME_TROPES = [
  "running late with toast in mouth",
  "wearing oversized dramatic sunglasses",
  "with intense magical girl sparkles",
  "looking shockingly confused",
  "wearing a cute cat onesie",
  "with a tiny dragon on their head",
  "channeling intense shonen protagonist energy",
  "sleeping while standing up",
  "holding a giant spoon menacingly",
  "surrounded by floating math equations",
  "wearing a cardboard box helmet",
  "winking aggressively",
  "drinking boba tea with determination",
  "crying anime tears of joy",
  "surrounded by gloomy depression lines",
  "with a futuristic sci-fi visor"
];

export const generateAvatar = async (playerName: string): Promise<string | null> => {
  try {
    // Pick a random trope to ensure variety even for similar names
    const randomTrope = ANIME_TROPES[Math.floor(Math.random() * ANIME_TROPES.length)];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a funny, colorful, chibi-style anime avatar for a character named "${playerName}". 
            The character is ${randomTrope}. 
            Art style: Thick outlines, vibrant colors, exaggerated facial expression. 
            Solid color background.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Avatar generation failed:", error);
    return null;
  }
};

export const generateGameCommentary = async (
  actorName: string,
  targetName: string,
  action: 'ADD' | 'REMOVE',
  amount: number,
  targetRemainingHearts: number,
  isSelf: boolean,
  isDeath: boolean
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    
    let prompt = `
      You are a witty, slightly dark, and sarcastic announcer for a game called "Taraq".
      In this game, players roll dice to add or remove hearts. If you reach -5 hearts, you die.
      
      The Move:
      - Player "${actorName}" rolled a ${amount}.
      - They decided to ${action} ${amount} hearts ${isSelf ? "to/from themselves" : `to/from "${targetName}"`}.
      - "${targetName}" now has ${targetRemainingHearts} hearts.
    `;

    if (isDeath) {
      prompt += `\nCRITICAL: "${targetName}" has died (reached -5 or lower)! Make a funny eulogy or roast them for losing.`;
    } else {
      prompt += `\nMake a short, punchy, one-sentence comment on this strategic choice. Be sarcastic.`;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are a cynical game show host. Keep it under 30 words.",
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for faster response
      }
    });

    return response.text || "The fates remain silent...";
  } catch (error) {
    console.error("Gemini commentary failed:", error);
    return "";
  }
};

export const generateWinnerToast = async (winnerName: string, rounds: number): Promise<string> => {
  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Player "${winnerName}" won the game Taraq after ${rounds} turns! Congratulate them as the supreme survivor in a slightly ominous way. Max 1 sentence.`,
    });
    return response.text || `All hail ${winnerName}, the last survivor!`;
  } catch (e) {
    return `All hail ${winnerName}!`;
  }
}