
import { GoogleGenAI, Type } from "@google/genai";

// Inisialisasi di dalam fungsi agar tidak menyebabkan crash saat modul di-import
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const extractShippingData = async (base64Image: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: 'Extract shipping information from this image into a clean JSON format. Focus on recipient details.' }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          toName: { type: Type.STRING },
          toPhone: { type: Type.STRING },
          toAddress: { type: Type.STRING },
          fromName: { type: Type.STRING },
          courier: { type: Type.STRING },
        },
        required: ['toName', 'toAddress']
      }
    }
  });

  const jsonStr = response.text?.trim() || '{}';
  return JSON.parse(jsonStr);
};

export const extractReceiptData = async (base64Image: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: 'Extract list of items, quantities, and prices from this receipt image. Return an array of objects.' }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            price: { type: Type.NUMBER },
            qty: { type: Type.NUMBER },
          },
          required: ['name', 'price', 'qty']
        }
      }
    }
  });

  const jsonStr = response.text?.trim() || '[]';
  return JSON.parse(jsonStr);
};
