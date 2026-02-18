import { NextRequest } from 'next/server';
import { classifyIntent } from '@/lib/ai/classifier';
import { generateSystemPrompt, SocraticContext } from '@/lib/ai/socratic-engine';
import { model } from '@/lib/ai/gemini';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Convert our frontend message format to Gemini's expected history format.
 * Gemini expects alternating user/model turns. We skip system messages
 * and collapse consecutive same-role messages.
 */
function buildGeminiHistory(messages: ChatMessage[]) {
    const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        const lastEntry = history[history.length - 1];

        // Gemini requires alternating roles — merge consecutive same-role messages
        if (lastEntry && lastEntry.role === geminiRole) {
            lastEntry.parts[0].text += '\n\n' + msg.content;
        } else {
            history.push({
                role: geminiRole,
                parts: [{ text: msg.content }],
            });
        }
    }

    // Gemini requires history to start with 'user' — prepend a synthetic user turn if needed
    if (history.length > 0 && history[0].role === 'model') {
        history.unshift({
            role: 'user',
            parts: [{ text: '[Conversation started]' }],
        });
    }

    // Gemini requires history to end with 'model' — remove trailing user message
    // (because we send the current user message separately via sendMessageStream)
    if (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
    }

    return history;
}

/**
 * POST /api/ai/chat
 *
 * Industry-grade Socratic chat endpoint with:
 * - Full conversation history (fixes memory loss)
 * - Streaming responses via ReadableStream
 * - Intent classification + Socratic Gateway
 * - AI Mode awareness (Brainstorming vs Exam)
 * - Current code context for relevant guidance
 */
export async function POST(req: NextRequest) {
    try {
        // Validate API key
        if (!process.env.GOOGLE_API_KEY) {
            return Response.json(
                { error: 'AI service is not configured. Please set GOOGLE_API_KEY.' },
                { status: 503 }
            );
        }

        const body = await req.json();
        const {
            messages,
            assignmentContext,
            codeConstraints,
            aiMode = 'BRAINSTORMING',
            currentCode,
        } = body;

        // Validate input
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return Response.json({ error: 'Messages are required.' }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user' || !lastMessage.content?.trim()) {
            return Response.json({ error: 'Last message must be a non-empty user message.' }, { status: 400 });
        }

        const userPrompt = lastMessage.content.trim();

        // ── Step 1: Classify Intent (Fast, LLaMA-3 via Groq) ──
        const intent = await classifyIntent(userPrompt);
        console.log(`[Socratic Gateway] Intent: ${intent} | Mode: ${aiMode}`);

        // ── Step 2: Generate Socratic System Prompt ──
        const context: SocraticContext = {
            assignmentContext,
            codeConstraints,
            aiMode,
            currentCode,
            conversationLength: messages.length,
        };
        const systemPrompt = generateSystemPrompt(intent, context);

        // ── Step 3: Build conversation history for Gemini ──
        // Include the system prompt as the first exchange, then replay the conversation 
        const previousMessages = messages.slice(0, -1) as ChatMessage[];
        const conversationHistory = buildGeminiHistory(previousMessages);

        // Prepend the Socratic system prompt as the opening exchange
        const fullHistory = [
            { role: 'user' as const, parts: [{ text: systemPrompt }] },
            { role: 'model' as const, parts: [{ text: 'Understood. I am Aletheia, operating as a Socratic Tutor. I will follow the response strategy provided.' }] },
            ...conversationHistory,
        ];

        // ── Step 4: Stream response from Gemini ──
        const chat = model.startChat({
            history: fullHistory,
        });

        const result = await chat.sendMessageStream(userPrompt);

        // Create a ReadableStream that pipes Gemini's chunks to the client
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            // SSE format: each chunk is a JSON line
                            const payload = JSON.stringify({ content: text, intent }) + '\n';
                            controller.enqueue(encoder.encode(payload));
                        }
                    }
                    // Send a final done signal
                    controller.enqueue(encoder.encode(JSON.stringify({ done: true, intent }) + '\n'));
                    controller.close();
                } catch (streamError) {
                    console.error('[Socratic Gateway] Stream error:', streamError);
                    const errPayload = JSON.stringify({
                        error: 'Stream interrupted. Please try again.',
                        intent,
                    }) + '\n';
                    controller.enqueue(encoder.encode(errPayload));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Intent': intent,
            },
        });

    } catch (error) {
        console.error('[Socratic Gateway] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('API key') || errorMessage.includes('API_KEY')) {
            return Response.json(
                { error: 'AI service authentication failed. Check your API key.' },
                { status: 503 }
            );
        }

        return Response.json(
            { error: 'The Socratic Engine encountered an issue. Please try again.' },
            { status: 500 }
        );
    }
}
