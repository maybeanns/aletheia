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

export async function classifyIntent(prompt: string): Promise<Intent> {
    if (!process.env.GROQ_API_KEY) {
        console.warn('GROQ_API_KEY is not set. Defaulting to CONCEPTUAL_QUESTION.');
        return 'CONCEPTUAL_QUESTION';
    }

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a strict intent classifier for an educational AI platform. 
          Analyze the student's prompt and categorize it into EXACTLY one of these categories:
          
          1. DIRECT_SOLUTION_SEEKING: Asking for code, answers, or completed work without showing effort. (e.g., "Write me a function...", "Solve this...")
          2. CONCEPTUAL_QUESTION: Asking about definitions, theory, or how things work. (e.g., "What is recursion?", "Explain how quicksort works")
          3. DEBUGGING_HELP: Provide code and asking why it doesn't work.
          4. BRAINSTORMING: Asking for ideas, approaches, or outlining a plan.
          5. IRRELEVANT: Not related to programming or the assignment.

          Reply ONLY with the category name. Do not add any explanation.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            model: 'llama3-8b-8192',
            temperature: 0,
        });

        const intent = completion.choices[0]?.message?.content?.trim().toUpperCase();

        // Validate that the returned intent is one of our valid types
        const validIntents: Intent[] = [
            'DIRECT_SOLUTION_SEEKING',
            'CONCEPTUAL_QUESTION',
            'DEBUGGING_HELP',
            'BRAINSTORMING',
            'IRRELEVANT'
        ];

        if (validIntents.includes(intent as Intent)) {
            return intent as Intent;
        }

        console.warn(`Unknown intent received: ${intent}. Defaulting to CONCEPTUAL_QUESTION.`);
        return 'CONCEPTUAL_QUESTION';

    } catch (error) {
        console.error('Error classifying intent:', error);
        return 'CONCEPTUAL_QUESTION'; // Fail safe
    }
}
