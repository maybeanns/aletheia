import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.warn('GOOGLE_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// Using the latest Gemini model
export const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
