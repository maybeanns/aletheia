'use client';

import Editor, { OnMount } from '@monaco-editor/react';
import { useRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { TelemetryCollector } from '@/lib/telemetry/collector';

// Comprehensive list of languages supported by Monaco Editor
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

interface CodeEditorProps {
    initialContent?: string;
    language?: string;
    onChange?: (value: string | undefined) => void;
    onTelemetry?: (events: any[]) => void;
    readOnly?: boolean;
}

export default function CodeEditor({
    initialContent = '// Start coding here...',
    language = 'javascript',
    onChange,
    onTelemetry,
    readOnly = false
}: CodeEditorProps) {
    const editorRef = useRef<any>(null);
    const { theme } = useTheme();

    // Initialize telemetry collector
    const telemetry = useMemo(() => {
        return new TelemetryCollector((events) => {
            if (onTelemetry) {
                onTelemetry(events);
            }
        });
    }, [onTelemetry]);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        editor.onKeyDown((e) => {
            telemetry.log('keystroke', {
                code: e.code,
                keyCode: e.keyCode,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                metaKey: e.metaKey,
                timestamp: Date.now()
            });
        });

        editor.onDidPaste((e) => {
            telemetry.log('paste', {
                range: e.range,
                languageId: editor.getModel()?.getLanguageId(),
                timestamp: Date.now()
            });
        });
    };

    function handleEditorChange(value: string | undefined, event: any) {
        if (onChange) {
            onChange(value);
        }
    }

    return (
        <div className="h-full w-full border border-border rounded-lg overflow-hidden shadow-sm">
            <Editor
                height="100%"
                language={language}
                defaultValue={initialContent}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                onMount={handleEditorDidMount}
                onChange={handleEditorChange}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    padding: { top: 16, bottom: 16 },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly: readOnly,
                }}
            />
        </div>
    );
}
