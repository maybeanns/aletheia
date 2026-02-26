'use client';

/**
 * CodeEditor – powered by CodeMirror 6 via @uiw/react-codemirror
 *
 * Why CodeMirror instead of Monaco?
 *  – Monaco ships the entire VS Code language stack (~5 MB gzipped).
 *  – CodeMirror 6 is modular; we only load what we need (~120–300 kB).
 *  – CodeMirror exposes the same keystroke / paste telemetry we need via
 *    its EditorView dispatch hooks, so there is no loss of observability.
 *
 * Telemetry captured:
 *  – keystroke   → key code + timestamp (for IKI analysis)
 *  – paste       → character count + language id + timestamp
 *  – selection   → range length (detects large copy-paste patterns)
 */

import { useCallback, useMemo, useRef } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { sass } from '@codemirror/lang-sass';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTheme } from 'next-themes';
import { TelemetryCollector } from '@/lib/telemetry/collector';

// ---------------------------------------------------------------------------
// Language registry
// ---------------------------------------------------------------------------

export const SUPPORTED_LANGUAGES = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'php', label: 'PHP' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'scala', label: 'Scala' },
    { value: 'r', label: 'R' },
    { value: 'perl', label: 'Perl' },
    { value: 'lua', label: 'Lua' },
    { value: 'dart', label: 'Dart' },
    { value: 'elixir', label: 'Elixir' },
    { value: 'clojure', label: 'Clojure' },
    { value: 'haskell', label: 'Haskell' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'scss', label: 'SCSS' },
    { value: 'less', label: 'Less' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' },
    { value: 'yaml', label: 'YAML' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'sql', label: 'SQL' },
    { value: 'shell', label: 'Shell / Bash' },
    { value: 'powershell', label: 'PowerShell' },
    { value: 'dockerfile', label: 'Dockerfile' },
    { value: 'graphql', label: 'GraphQL' },
    { value: 'plaintext', label: 'Plain Text' },
];

/** Maps language IDs to their CodeMirror language extension factories */
function getLanguageExtension(lang: string) {
    switch (lang) {
        case 'javascript': return javascript({ jsx: true });
        case 'typescript': return javascript({ typescript: true, jsx: true });
        case 'python': return python();
        case 'java': return java();
        case 'c':
        case 'cpp':
        case 'csharp': return cpp();
        case 'go': return go();
        case 'rust': return rust();
        case 'php': return php();
        case 'sql': return sql();
        case 'html': return html();
        case 'css':
        case 'less': return css();
        case 'scss': return sass();
        case 'json': return json();
        case 'xml': return xml();
        case 'yaml': return yaml();
        case 'markdown': return markdown();
        default: return javascript(); // fallback
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CodeEditorProps {
    initialContent?: string;
    language?: string;
    onChange?: (value: string | undefined) => void;
    onTelemetry?: (events: any[]) => void;
    /** Called once on mount with the internal TelemetryCollector instance */
    onCollectorReady?: (collector: TelemetryCollector) => void;
    readOnly?: boolean;
}

export default function CodeEditor({
    initialContent = '// Start coding here...',
    language = 'javascript',
    onChange,
    onTelemetry,
    onCollectorReady,
    readOnly = false,
}: CodeEditorProps) {
    const { resolvedTheme } = useTheme();
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    // Initialise telemetry collector once and expose it to the parent
    const telemetry = useMemo(() => {
        const collector = new TelemetryCollector((events) => {
            if (onTelemetry) onTelemetry(events);
        });
        // Defer so the parent ref is set after the first render
        if (onCollectorReady) {
            setTimeout(() => onCollectorReady(collector), 0);
        }
        return collector;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty: collector must be stable across re-renders

    // ── Keystroke telemetry via DOM keydown on the editor wrapper ──────────
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            // Skip pure modifier key presses - they don't represent typed characters
            if (['Control', 'Alt', 'Meta', 'Shift'].includes(e.key)) return;

            telemetry.log('keystroke', {
                code: e.code,
                key: e.key,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                metaKey: e.metaKey,
                shiftKey: e.shiftKey,
                timestamp: Date.now(),
            });
        },
        [telemetry]
    );

    // ── Paste telemetry via DOM paste event on the editor wrapper ──────────
    const handlePaste = useCallback(
        (e: React.ClipboardEvent<HTMLDivElement>) => {
            const text = e.clipboardData?.getData('text/plain') ?? '';
            telemetry.log('paste', {
                characterCount: text.length,
                languageId: language,
                timestamp: Date.now(),
                isSuspicious: text.length > 50,
            });
        },
        [telemetry, language]
    );

    // ── CodeMirror extensions ──────────────────────────────────────────────
    const extensions = useMemo(() => [
        getLanguageExtension(language),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.theme({
            '&': { height: '100%', fontSize: '14px' },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, monospace)' },
            '.cm-content': { padding: '16px 0' },
        }),
    ], [language]);

    const themeExtensions = useMemo(() => {
        return resolvedTheme === 'dark' ? [oneDark] : [];
    }, [resolvedTheme]);

    // ── Change handler ─────────────────────────────────────────────────────
    const handleChange = useCallback(
        (value: string) => {
            if (onChange) onChange(value);
        },
        [onChange]
    );

    return (
        <div
            className="h-full w-full border border-border rounded-lg overflow-hidden shadow-sm"
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
        >
            <CodeMirror
                ref={editorRef}
                value={initialContent}
                height="100%"
                extensions={[...extensions, ...themeExtensions]}
                onChange={handleChange}
                editable={!readOnly}
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    history: true,
                    foldGutter: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    syntaxHighlighting: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: false,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    searchKeymap: true,
                }}
                style={{ height: '100%' }}
            />
        </div>
    );
}
