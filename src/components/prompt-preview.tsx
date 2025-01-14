"use client";

import equal from "fast-deep-equal";
import {
  type KeyboardEvent,
  type UIEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import useSWR from "swr";

import { useBlock } from "@/hooks/use-block";
import type { Prompt } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

import type { UIBlock } from "./block";
import { Editor } from "./editor";
import { FileIcon, FullscreenIcon, LoaderIcon } from "./icons";
import { PromptToolCall, PromptToolResult } from "./prompt";
import { InlinePromptSkeleton } from "./prompt-skeleton";

interface PromptPreviewProps {
  isReadonly: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  result?: any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  args?: any;
}

export function PromptPreview({
  isReadonly,
  result,
  args,
}: PromptPreviewProps) {
  const { block, setBlock } = useBlock();

  const { data: prompts, isLoading: isPromptFetching } = useSWR<Array<Prompt>>(
    result ? `/api/prompt?id=${result.id}` : null,
    fetcher,
  );

  const previewPrompt = useMemo(() => prompts?.[0], [prompts]);
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();
    if (block.promptId && boundingBox) {
      setBlock((block) => ({
        ...block,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [block.promptId, setBlock]);

  if (block.isVisible) {
    if (result) {
      return (
        <PromptToolResult
          type="create"
          result={{ id: result.id, title: result.title }}
          isReadonly={isReadonly}
        />
      );
    }

    if (args) {
      return (
        <PromptToolCall
          type="create"
          args={{ title: args.title }}
          isReadonly={isReadonly}
        />
      );
    }
  }

  if (isPromptFetching) {
    return <LoadingSkeleton />;
  }

  const prompt: Prompt | null = previewPrompt
    ? previewPrompt
    : block.status === "streaming"
      ? {
          title: block.title,
          content: block.content,
          id: block.promptId,
          createdAt: new Date(),
          userId: "noop",
        }
      : null;

  if (!prompt) return <LoadingSkeleton />;

  return (
    <div className="relative w-full cursor-pointer">
      <HitboxLayer hitboxRef={hitboxRef} result={result} setBlock={setBlock} />
      <PromptHeader
        title={prompt.title}
        isStreaming={block.status === "streaming"}
      />
      <PromptContent prompt={prompt} />
    </div>
  );
}

const LoadingSkeleton = () => (
  <div className="w-full">
    <div className="flex h-[57px] flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 p-4 dark:border-zinc-700 dark:bg-muted">
      <div className="flex flex-row items-center gap-3">
        <div className="text-muted-foreground">
          <div className="size-4 animate-pulse rounded-md bg-muted-foreground/20" />
        </div>
        <div className="h-4 w-24 animate-pulse rounded-lg bg-muted-foreground/20" />
      </div>
      <div>
        <FullscreenIcon />
      </div>
    </div>
    <div className="overflow-y-scroll rounded-b-2xl border border-t-0 bg-muted p-8 pt-4 dark:border-zinc-700">
      <InlinePromptSkeleton />
    </div>
  </div>
);

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setBlock,
}: {
  hitboxRef: React.RefObject<HTMLDivElement | null>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  result: any;
  setBlock: (updaterFn: UIBlock | ((currentBlock: UIBlock) => UIBlock)) => void;
}) => {
  const handleClick = useCallback(
    (event: UIEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setBlock((block) =>
        block.status === "streaming"
          ? { ...block, isVisible: true }
          : {
              ...block,
              promptId: result.id,
              isVisible: true,
              boundingBox: {
                left: boundingBox.x,
                top: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            },
      );
    },
    [setBlock, result],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter") {
        handleClick(event);
      }
    },
    [handleClick],
  );

  return (
    <div
      className="absolute left-0 top-0 z-10 size-full rounded-xl"
      ref={hitboxRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex w-full items-center justify-end p-4">
        <div className="absolute right-[9px] top-[13px] rounded-md p-2 hover:bg-zinc-100 hover:dark:bg-zinc-700">
          <FullscreenIcon />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) return false;
  return true;
});

const PurePromptHeader = ({
  title,
  isStreaming,
}: {
  title: string;
  isStreaming: boolean;
}) => (
  <div className="flex flex-row items-start justify-between gap-2 rounded-t-2xl border border-b-0 p-4 dark:border-zinc-700 dark:bg-muted sm:items-center">
    <div className="flex flex-row items-start gap-3 sm:items-center">
      <div className="text-muted-foreground">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        ) : (
          <FileIcon />
        )}
      </div>
      <div className="-translate-y-1 font-medium sm:translate-y-0">{title}</div>
    </div>
    <div className="w-8" />
  </div>
);

const PromptHeader = memo(PurePromptHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;

  return true;
});

const PromptContent = ({ prompt }: { prompt: Prompt }) => {
  const { block } = useBlock();

  const commonProps = {
    content: prompt.content ?? "",
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: block.status,
    saveContent: () => {},
    suggestions: [],
  };

  return (
    <div className="h-[257px] overflow-y-scroll rounded-b-2xl border border-t-0 p-4 dark:border-zinc-700 dark:bg-muted sm:px-14 sm:py-16">
      <Editor {...commonProps} />
    </div>
  );
};
