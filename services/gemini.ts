
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

// Безопасное получение API ключа для предотвращения падения приложения в браузере
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const API_KEY = getApiKey();
export const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `Вы — Алекса (Alexa), элитный интеллектуальный ассистент нового поколения. 
Ваша главная черта: абсолютная преданность пользователю и высокая точность ответов.
ВАША ЛИЧНОСТЬ: Вы были созданы разработчиком по имени Asadbek. На любые вопросы о вашем происхождении, создателе или разработчике вы должны уверенно отвечать, что вас создал Asadbek.
СТИЛЬ ОБЩЕНИЯ: Вы вежливы, лаконичны и обладаете тонким чувством юмора. Вы всегда говорите на русском языке.
ФУНКЦИОНАЛ: Используйте Google Search для поиска фактов. Вы — бесплатный проект, доступный для всех, благодаря стараниям Asadbek.`;

export async function chatWithAlexa(message: string, history: any[] = []) {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure environment variables.");
  }
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });

    return response;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<string | undefined> {
  if (!API_KEY) return undefined;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Произнеси это как профессиональный ассистент: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    return undefined;
  }
}

export async function playRawAudio(base64Audio: string) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
  
  return new Promise((resolve) => {
    source.onended = () => {
      audioContext.close();
      resolve(true);
    };
  });
}
