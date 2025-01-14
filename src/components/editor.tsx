"use client";

import { exampleSetup } from "prosemirror-example-setup";
import { inputRules } from "prosemirror-inputrules";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import React, { memo, useEffect, useRef } from "react";

import type { Suggestion } from "@/lib/db/schema";
import {
  promptSchema,
  handleTransaction,
  headingRule,
} from "@/lib/editor/config";
import {
  buildContentFromPrompt,
  buildPromptFromContent,
  createDecorations,
} from "@/lib/editor/functions";
import {
  projectWithPositions,
  suggestionsPlugin,
  suggestionsPluginKey,
} from "@/lib/editor/suggestions";

interface EditorProps {
  content: string;
  saveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Array<Suggestion>;
}

function PureEditor({
  content,
  saveContent,
  suggestions,
  status,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  // NOTE: we only want to run this effect once
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildPromptFromContent(content),
        plugins: [
          ...exampleSetup({ schema: promptSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
          suggestionsPlugin,
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        dispatchTransaction: (transaction) => {
          handleTransaction({ transaction, editorRef, saveContent });
        },
      });
    }
  }, [saveContent]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromPrompt(
        editorRef.current.state.doc,
      );

      if (status === "streaming") {
        const newPrompt = buildPromptFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newPrompt.content,
        );

        transaction.setMeta("no-save", true);
        editorRef.current.dispatch(transaction);
        return;
      }

      if (currentContent !== content) {
        const newPrompt = buildPromptFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newPrompt.content,
        );

        transaction.setMeta("no-save", true);
        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  useEffect(() => {
    if (editorRef.current?.state.doc && content) {
      const projectedSuggestions = projectWithPositions(
        editorRef.current.state.doc,
        suggestions,
      ).filter(
        (suggestion) => suggestion.selectionStart && suggestion.selectionEnd,
      );

      const decorations = createDecorations(
        projectedSuggestions,
        editorRef.current,
      );

      const transaction = editorRef.current.state.tr;
      transaction.setMeta(suggestionsPluginKey, { decorations });
      editorRef.current.dispatch(transaction);
    }
  }, [suggestions, content]);

  return (
    <div className="prose relative dark:prose-invert" ref={containerRef} />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content &&
    prevProps.saveContent === nextProps.saveContent
  );
}

export const Editor = memo(PureEditor, areEqual);
