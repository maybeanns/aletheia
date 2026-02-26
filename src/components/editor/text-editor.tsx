'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useMemo } from 'react';
import { TelemetryCollector } from '@/lib/telemetry/collector';
import { cn } from '@/lib/utils/cn';
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Minus,
} from 'lucide-react';

interface TextEditorProps {
    initialContent?: string;
    onChange?: (value: string | undefined) => void;
    onTelemetry?: (events: any[]) => void;
    readOnly?: boolean;
}

function ToolbarButton({
    onClick,
    isActive,
    children,
    title,
}: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={cn(
                'p-1.5 rounded-md transition-colors hover:bg-accent',
                isActive && 'bg-accent text-accent-foreground'
            )}
        >
            {children}
        </button>
    );
}

function EditorToolbar({ editor }: { editor: any }) {
    if (!editor) return null;

    return (
        <div className="flex items-center gap-0.5 p-2 border-b border-border bg-muted/30 flex-wrap">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold"
            >
                <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic"
            >
                <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Strikethrough"
            >
                <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive('code')}
                title="Inline Code"
            >
                <Code className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-border mx-1" />

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
            >
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
            >
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
            >
                <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-border mx-1" />

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
            >
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Ordered List"
            >
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Blockquote"
            >
                <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
            >
                <Minus className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-border mx-1" />

            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                title="Undo"
            >
                <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                title="Redo"
            >
                <Redo className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
}

export default function TextEditor({
    initialContent = '<p>Start writing here...</p>',
    onChange,
    onTelemetry,
    readOnly = false,
}: TextEditorProps) {
    const telemetry = useMemo(() => {
        return new TelemetryCollector((events) => {
            if (onTelemetry) {
                onTelemetry(events);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const editor = useEditor({
        extensions: [StarterKit],
        content: initialContent,
        editable: !readOnly,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getHTML());
            }
            telemetry.log('keystroke', {
                type: 'text-edit',
                timestamp: Date.now(),
            });
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 text-foreground',
            },
            handlePaste: () => {
                telemetry.log('paste', {
                    timestamp: Date.now(),
                });
                return false;
            },
        },
    });

    return (
        <div className="h-full w-full border border-border rounded-lg overflow-hidden shadow-sm flex flex-col bg-background">
            {/* Toolbar — only renders when editor is ready */}
            {!readOnly && <EditorToolbar editor={editor} />}

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto">
                {editor ? (
                    <EditorContent editor={editor} className="h-full" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        Loading editor...
                    </div>
                )}
            </div>
        </div>
    );
}
