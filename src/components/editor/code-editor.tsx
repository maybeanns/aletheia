'use client';

import Editor, { OnMount } from '@monaco-editor/react';
import { useRef, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { TelemetryCollector } from '@/lib/telemetry/collector';

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
            // console.log('Flushing telemetry events:', events);
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
        <div className="h-full w-full border border-gray-200 rounded-lg overflow-hidden shadow-sm dark:border-gray-800">
            <Editor
                height="100%"
                defaultLanguage={language}
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
