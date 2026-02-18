import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export type Intent =
    | 'DIRECT_SOLUTION_SEEKING'
    | 'CONCEPTUAL_QUESTION'
    | 'DEBUGGING_HELP'
    | 'BRAINSTORMING'
    | 'IRRELEVANT';

const VALID_INTENTS: Intent[] = [
    'DIRECT_SOLUTION_SEEKING',
    'CONCEPTUAL_QUESTION',
    'DEBUGGING_HELP',
    'BRAINSTORMING',
    'IRRELEVANT',
];

/**
 * Keyword-based fast fallback classifier.
 * Used when Groq is unavailable or for instant local classification.
 */
function classifyByKeywords(prompt: string): Intent {
    const lower = prompt.toLowerCase();

    // Direct solution patterns
    const solutionPatterns = [
        'write me', 'write a', 'give me the code', 'solve this', 'solve it',
        'do it for me', 'complete this', 'finish this', 'give me a solution',
        'can you code', 'just give me', 'what is the answer', 'tell me the answer',
        'write the function', 'write the program', 'generate code', 'create code for',
    ];
    if (solutionPatterns.some(p => lower.includes(p))) {
        return 'DIRECT_SOLUTION_SEEKING';
    }

    // Debugging patterns
    const debugPatterns = [
        'doesn\'t work', 'not working', 'bug', 'error', 'exception', 'crash',
        'wrong output', 'unexpected', 'fails', 'failing', 'broken', 'fix this',
        'what\'s wrong', 'why is this', 'typeerror', 'referenceerror', 'syntaxerror',
        'null pointer', 'undefined', 'stack trace', 'segfault',
    ];
    if (debugPatterns.some(p => lower.includes(p))) {
        return 'DEBUGGING_HELP';
    }

    // Conceptual question patterns
    const conceptPatterns = [
        'what is', 'what are', 'how does', 'explain', 'difference between',
        'why does', 'why is', 'define', 'meaning of', 'concept of',
        'tell me about', 'how do', 'what does', 'understand', 'theory',
    ];
    if (conceptPatterns.some(p => lower.includes(p))) {
        return 'CONCEPTUAL_QUESTION';
    }

    // Brainstorming patterns
    const brainstormPatterns = [
        'how should i', 'approach', 'strategy', 'design', 'plan',
        'best way', 'how to start', 'where to begin', 'steps',
        'outline', 'architecture', 'structure', 'think about', 'idea',
    ];
    if (brainstormPatterns.some(p => lower.includes(p))) {
        return 'BRAINSTORMING';
    }

    // Default to conceptual for anything programming-related
    return 'CONCEPTUAL_QUESTION';
}

/**
 * LLM-powered intent classifier using Groq (LLaMA 3).
 * Falls back to keyword-based classification if Groq is unavailable.
 */
export async function classifyIntent(prompt: string): Promise<Intent> {
    // Fast path — if no Groq client, use keyword classifier
    if (!process.env.GROQ_API_KEY) {
        console.warn('[Classifier] Groq unavailable, using keyword fallback.');
        return classifyByKeywords(prompt);
    }

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a strict intent classifier for an educational AI platform.
Analyze the student's prompt and categorize it into EXACTLY one of these categories:

1. DIRECT_SOLUTION_SEEKING: Asking for code, answers, or completed work without showing effort. (e.g., "Write me a function...", "Solve this...", "Give me the code for...")
2. CONCEPTUAL_QUESTION: Asking about definitions, theory, or how things work. (e.g., "What is recursion?", "Explain how quicksort works")
3. DEBUGGING_HELP: Sharing code and asking why it doesn't work, or reporting errors.
4. BRAINSTORMING: Asking for ideas, approaches, or outlining a plan before implementation.
5. IRRELEVANT: Not related to programming, academics, or the assignment.

Reply ONLY with the category name. Do not add any explanation, punctuation, or extra text.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            model: 'llama3-8b-8192',
            temperature: 0,
            max_tokens: 30,
        });

        const raw = completion.choices[0]?.message?.content?.trim().toUpperCase() ?? '';

        // Extract a valid intent from the response (handles minor formatting issues)
        const matchedIntent = VALID_INTENTS.find(intent => raw.includes(intent));

        if (matchedIntent) {
            return matchedIntent;
        }

        console.warn(`[Classifier] Unknown intent: "${raw}". Using keyword fallback.`);
        return classifyByKeywords(prompt);

    } catch (error) {
        console.error('[Classifier] Groq API error, falling back to keywords:', error);
        return classifyByKeywords(prompt);
    }
}
