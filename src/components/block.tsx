import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from "ai";
import { formatDistance } from "date-fns";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import {
  type Dispatch,
  type SetStateAction,
  memo,
  useCallback,
  useEffect,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { useDebounceCallback, useWindowSize } from "usehooks-ts";

import { useBlock } from "@/hooks/use-block";
import type { Prompt, Suggestion, Vote } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

import { BlockActions } from "./block-actions";
import { BlockCloseButton } from "./block-close-button";
import { BlockMessages } from "./block-messages";
import { CodeEditor } from "./code-editor";
import { Console } from "./console";
import { DiffView } from "./diffview";
import { Editor } from "./editor";
import { MultimodalInput } from "./multimodal-input";
import { PromptSkeleton } from "./prompt-skeleton";
import { Toolbar } from "./toolbar";
import { useSidebar } from "./ui/sidebar";
import { VersionFooter } from "./version-footer";

export interface UIBlock {
  title: string;
  promptId: string;
  content: string;
  isVisible: boolean;
  status: "streaming" | "idle";
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface ConsoleOutput {
  id: string;
  status: "in_progress" | "completed" | "failed";
  content: string | null;
}

function PureBlock({
  chatId,
  input,
  setInput,
  handleSubmit,
  isLoading,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  reload,
  votes,
  isReadonly,
}: {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  votes: Array<Vote> | undefined;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
}) {
  const { block, setBlock } = useBlock();

  const {
    data: prompts,
    isLoading: isPromptFetching,
    mutate: mutatePrompts,
  } = useSWR<Array<Prompt>>(
    block.promptId !== "init" && block.status !== "streaming"
      ? `/api/prompt?id=${block.promptId}`
      : null,
    fetcher,
  );

  const { data: suggestions } = useSWR<Array<Suggestion>>(
    prompts && block && block.status !== "streaming"
      ? `/api/suggestions?promptId=${block.promptId}`
      : null,
    fetcher,
    {
      dedupingInterval: 5000,
    },
  );

  const [mode, setMode] = useState<"edit" | "diff">("edit");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [consoleOutputs, setConsoleOutputs] = useState<Array<ConsoleOutput>>(
    [],
  );

  const { open: isSidebarOpen } = useSidebar();

  useEffect(() => {
    if (prompts && prompts.length > 0) {
      const mostRecentPrompt = prompts.at(-1);

      if (mostRecentPrompt) {
        setPrompt(mostRecentPrompt);
        setCurrentVersionIndex(prompts.length - 1);
        setBlock((currentBlock) => ({
          ...currentBlock,
          content: mostRecentPrompt.content ?? "",
        }));
      }
    }
  }, [prompts, setBlock]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    mutatePrompts();
  }, [block.status, mutatePrompts]);

  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!block) return;

      mutate<Array<Prompt>>(
        `/api/prompt?id=${block.promptId}`,
        async (currentPrompts) => {
          if (!currentPrompts) return undefined;

          const currentPrompt = currentPrompts.at(-1);

          if (!currentPrompt || !currentPrompt.content) {
            setIsContentDirty(false);
            return currentPrompts;
          }

          if (currentPrompt.content !== updatedContent) {
            await fetch(`/api/prompt?id=${block.promptId}`, {
              method: "POST",
              body: JSON.stringify({
                title: block.title,
                content: updatedContent,
              }),
            });

            setIsContentDirty(false);

            const newPrompt = {
              ...currentPrompt,
              content: updatedContent,
              createdAt: new Date(),
            };

            return [...currentPrompts, newPrompt];
          }
          return currentPrompts;
        },
        { revalidate: false },
      );
    },
    [block, mutate],
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (prompt && updatedContent !== prompt.content) {
        setIsContentDirty(true);

        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          handleContentChange(updatedContent);
        }
      }
    },
    [prompt, debouncedHandleContentChange, handleContentChange],
  );

  function getPromptContentById(index: number) {
    if (!prompts) return "";
    if (!prompts[index]) return "";
    return prompts[index].content ?? "";
  }

  const handleVersionChange = (type: "next" | "prev" | "toggle" | "latest") => {
    if (!prompts) return;

    if (type === "latest") {
      setCurrentVersionIndex(prompts.length - 1);
      setMode("edit");
    }

    if (type === "toggle") {
      setMode((mode) => (mode === "edit" ? "diff" : "edit"));
    }

    if (type === "prev") {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === "next") {
      if (currentVersionIndex < prompts.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /*
   * NOTE: if there are no prompts, or if
   * the prompts are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    prompts && prompts.length > 0
      ? currentVersionIndex === prompts.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  return (
    <AnimatePresence>
      {block.isVisible && (
        <motion.div
          className="fixed left-0 top-0 z-50 flex h-dvh w-dvw flex-row bg-transparent"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="fixed h-dvh bg-background"
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{ width: windowWidth, right: 0 }}
              exit={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
            />
          )}

          {!isMobile && (
            <motion.div
              className="relative h-dvh w-[400px] shrink-0 bg-muted dark:bg-background"
              initial={{ opacity: 0, x: 10, scale: 1 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: {
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                  damping: 30,
                },
              }}
              exit={{
                opacity: 0,
                x: 0,
                scale: 1,
                transition: { duration: 0 },
              }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="absolute left-0 top-0 z-50 h-dvh w-[400px] bg-zinc-900/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex h-full flex-col items-center justify-between gap-4">
                <BlockMessages
                  chatId={chatId}
                  isLoading={isLoading}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  blockStatus={block.status}
                />

                <form className="relative flex w-full flex-row items-end gap-2 px-4 pb-4">
                  <MultimodalInput
                    chatId={chatId}
                    input={input}
                    setInput={setInput}
                    handleSubmit={handleSubmit}
                    isLoading={isLoading}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    append={append}
                    className="bg-background dark:bg-muted"
                    setMessages={setMessages}
                  />
                </form>
              </div>
            </motion.div>
          )}

          <motion.div
            className="fixed flex h-dvh flex-col overflow-y-scroll border-l border-zinc-200 bg-background dark:border-zinc-700 dark:bg-muted"
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: block.boundingBox.left,
                    y: block.boundingBox.top,
                    height: block.boundingBox.height,
                    width: block.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: block.boundingBox.left,
                    y: block.boundingBox.top,
                    height: block.boundingBox.height,
                    width: block.boundingBox.width,
                    borderRadius: 50,
                  }
            }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : "calc(100dvw)",
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: "spring",
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
                : {
                    opacity: 1,
                    x: 400,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth
                      ? windowWidth - 400
                      : "calc(100dvw-400px)",
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: "spring",
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: {
                delay: 0.1,
                type: "spring",
                stiffness: 600,
                damping: 30,
              },
            }}
          >
            <div className="flex flex-row items-start justify-between p-2">
              <div className="flex flex-row items-start gap-4">
                <BlockCloseButton />

                <div className="flex flex-col">
                  <div className="font-medium">
                    {prompt?.title ?? block.title}
                  </div>

                  {isContentDirty ? (
                    <div className="text-sm text-muted-foreground">
                      Saving changes...
                    </div>
                  ) : prompt ? (
                    <div className="text-sm text-muted-foreground">
                      {`Updated ${formatDistance(
                        new Date(prompt.createdAt),
                        new Date(),
                        {
                          addSuffix: true,
                        },
                      )}`}
                    </div>
                  ) : (
                    <div className="mt-2 h-3 w-32 animate-pulse rounded-md bg-muted-foreground/20" />
                  )}
                </div>
              </div>

              <BlockActions
                block={block}
                currentVersionIndex={currentVersionIndex}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                setConsoleOutputs={setConsoleOutputs}
              />
            </div>

            <div className="h-full !max-w-full items-center overflow-y-scroll bg-background px-4 py-8 pb-40 dark:bg-muted md:p-20">
              <div className="mx-auto flex max-w-[600px] flex-row">
                {isPromptFetching && !block.content ? (
                  <PromptSkeleton />
                ) : mode === "edit" ? (
                  <Editor
                    content={
                      isCurrentVersion
                        ? block.content
                        : getPromptContentById(currentVersionIndex)
                    }
                    isCurrentVersion={isCurrentVersion}
                    currentVersionIndex={currentVersionIndex}
                    status={block.status}
                    saveContent={saveContent}
                    suggestions={isCurrentVersion ? (suggestions ?? []) : []}
                  />
                ) : (
                  <DiffView
                    oldContent={getPromptContentById(currentVersionIndex - 1)}
                    newContent={getPromptContentById(currentVersionIndex)}
                  />
                )}

                {suggestions ? (
                  <div className="h-dvh w-12 shrink-0 md:hidden" />
                ) : null}

                <AnimatePresence>
                  {isCurrentVersion && (
                    <Toolbar
                      isToolbarVisible={isToolbarVisible}
                      setIsToolbarVisible={setIsToolbarVisible}
                      append={append}
                      isLoading={isLoading}
                      stop={stop}
                      setMessages={setMessages}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  prompts={prompts}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              <Console
                consoleOutputs={consoleOutputs}
                setConsoleOutputs={setConsoleOutputs}
              />
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Block = memo(PureBlock, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;

  return true;
});
