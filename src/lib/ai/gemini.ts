import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.warn('GOOGLE_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// Safety settings tuned for an educational platform
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

// Primary reasoning model for Socratic conversations
export const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    safetySettings,
    generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
    },
});

// Lightweight model for quick tasks (summaries, follow-ups)
export const flashModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    safetySettings,
    generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
    },
});
