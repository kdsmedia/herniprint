
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export const extractShippingData = async (base64Image: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: 'Extract shipping info into JSON: toName, toPhone, toAddress.' }
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

  return JSON.parse(response.text || '{}');
};

export const extractReceiptData = async (base64Image: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: 'Extract items as JSON array with name, price, qty.' }
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

  return JSON.parse(response.text || '[]');
};
