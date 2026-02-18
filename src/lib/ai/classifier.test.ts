
const mockCreate = jest.fn();

jest.mock('groq-sdk', () => {
    return {
        __esModule: true,
        default: class MockGroq {
            chat = {
                completions: {
                    create: mockCreate
                }
            };
            constructor(options: any) { }
        }
    };
});

// Import MUST happen after mock
import { classifyIntent } from './classifier';

describe('classifyIntent', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, GROQ_API_KEY: 'test-key' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should classify "Write me code" as DIRECT_SOLUTION_SEEKING', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: { content: 'DIRECT_SOLUTION_SEEKING' }
            }]
        });

        const intent = await classifyIntent("Write me code for a linked list");

        expect(intent).toBe('DIRECT_SOLUTION_SEEKING');
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should classify "What is recursion?" as CONCEPTUAL_QUESTION', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: { content: 'CONCEPTUAL_QUESTION' }
            }]
        });

        const intent = await classifyIntent("What is recursion?");

        expect(intent).toBe('CONCEPTUAL_QUESTION');
    });

    it('should default to CONCEPTUAL_QUESTION on API error', async () => {
        mockCreate.mockRejectedValueOnce(new Error('API Failure'));

        const intent = await classifyIntent("Hello world");

        expect(intent).toBe('CONCEPTUAL_QUESTION');
    });

    it('should use keyword fallback when API key is missing', async () => {
        delete process.env.GROQ_API_KEY;

        const intent = await classifyIntent("test");
        expect(intent).toBe('CONCEPTUAL_QUESTION');
    });

    it('should extract valid intent even with extra text in response', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: { content: '  debugging_help  ' }
            }]
        });

        const intent = await classifyIntent("My code returns undefined");

        expect(intent).toBe('DEBUGGING_HELP');
    });

    // Keyword fallback tests
    describe('keyword fallback', () => {
        beforeEach(() => {
            delete process.env.GROQ_API_KEY;
        });

        it('should detect solution seeking keywords', async () => {
            const intent = await classifyIntent("Write me a function to sort an array");
            expect(intent).toBe('DIRECT_SOLUTION_SEEKING');
        });

        it('should detect debugging keywords', async () => {
            const intent = await classifyIntent("My code is not working, I get a TypeError");
            expect(intent).toBe('DEBUGGING_HELP');
        });

        it('should detect conceptual keywords', async () => {
            const intent = await classifyIntent("What is a binary search tree?");
            expect(intent).toBe('CONCEPTUAL_QUESTION');
        });

        it('should detect brainstorming keywords', async () => {
            const intent = await classifyIntent("How should I approach this problem?");
            expect(intent).toBe('BRAINSTORMING');
        });
    });
});
