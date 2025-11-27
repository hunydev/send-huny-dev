import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string | undefined => {
  return process.env.API_KEY;
};

export const generateFileSummary = async (file: File): Promise<string> => {
  const key = getApiKey();
  if (!key) {
    console.warn("No API Key found for Gemini summary.");
    return "AI Summary unavailable (No API Key).";
  }

  try {
    const textContent = await file.text();
    // Truncate if too large to avoid token limits for this demo
    const safeContent = textContent.slice(0, 10000); 

    const ai = new GoogleGenAI({ apiKey: key });
    
    // We use gemini-2.5-flash for speed and efficiency on text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a helpful file assistant. Summarize the following file content in 2 sentences or less, highlighting the key purpose of the document. 
      
      File Name: ${file.name}
      Content Snippet:
      ${safeContent}`,
    });

    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate summary.";
  }
};