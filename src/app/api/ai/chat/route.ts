import { NextRequest, NextResponse } from 'next/server';
import { classifyIntent } from '@/lib/ai/classifier';
import { generateSystemPrompt } from '@/lib/ai/socratic-engine';
import { model } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
    try {
        // Check for required API keys
        if (!process.env.GOOGLE_API_KEY) {
            console.error('GOOGLE_API_KEY is not configured');
            return NextResponse.json(
                { error: 'AI service is not configured. Please set GOOGLE_API_KEY in environment variables.' },
                { status: 503 }
            );
        }

        const body = await req.json();
        const { messages, assignmentContext, codeConstraints } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1];
        const userPrompt = lastMessage.content;

        // 1. Classify Intent (Fast, LLaMA-3 via Groq)
        const intent = await classifyIntent(userPrompt);
        console.log(`Classified intent: ${intent}`);

        // 2. Generate System Prompt (Socratic Logic)
        const systemPrompt = generateSystemPrompt(intent, {
            assignmentContext,
            codeConstraints
        });

        // 3. Call Reasoning Engine (Gemini)
        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood. I am ready to act as a Socratic Tutor.' }],
                }
            ],
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });

        // Send the actual user message
        const result = await chat.sendMessage(userPrompt);
        const response = result.response;
        const text = response.text();

        return NextResponse.json({
            role: 'assistant',
            content: text,
            intent: intent // Returning intent for debugging/UI feedback
        });

    } catch (error) {
        console.error('Error in chat API:', error);

        // Provide more specific error information
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('API key') || errorMessage.includes('API_KEY')) {
            return NextResponse.json(
                { error: 'AI service authentication failed. Please check your API key configuration.' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'Internal Server Error. The AI service encountered an issue processing your request.' },
            { status: 500 }
        );
    }
}
