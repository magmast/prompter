import {
  type Dispatch,
  type SetStateAction,
  memo,
  startTransition,
  useCallback,
  useState,
} from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

import { cn, generateUUID } from "@/lib/utils";

import type { ConsoleOutput, UIBlock } from "./block";
import { ClockRewind, CopyIcon, PlayIcon, RedoIcon, UndoIcon } from "./icons";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface BlockActionsProps {
  block: UIBlock;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: "read-only" | "edit" | "diff";
  setConsoleOutputs: Dispatch<SetStateAction<Array<ConsoleOutput>>>;
}

export function RunCodeButton({
  block,
  setConsoleOutputs,
}: {
  block: UIBlock;
  setConsoleOutputs: Dispatch<SetStateAction<Array<ConsoleOutput>>>;
}) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const [pyodide, setPyodide] = useState<any>(null);
  const isPython = true;
  const codeContent = block.content;

  const updateConsoleOutput = useCallback(
    (runId: string, content: string | null, status: "completed" | "failed") => {
      setConsoleOutputs((consoleOutputs) => {
        const index = consoleOutputs.findIndex((output) => output.id === runId);

        if (index === -1) return consoleOutputs;

        const updatedOutputs = [...consoleOutputs];
        updatedOutputs[index] = {
          id: runId,
          content,
          status,
        };

        return updatedOutputs;
      });
    },
    [setConsoleOutputs],
  );

  const loadAndRunPython = useCallback(async () => {
    const runId = generateUUID();

    setConsoleOutputs((consoleOutputs) => [
      ...consoleOutputs,
      {
        id: runId,
        content: null,
        status: "in_progress",
      },
    ]);

    let currentPyodideInstance = pyodide;

    if (isPython) {
      if (!currentPyodideInstance) {
        // @ts-expect-error - pyodide is not defined
        const newPyodideInstance = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
        });

        setPyodide(newPyodideInstance);
        currentPyodideInstance = newPyodideInstance;
      }

      try {
        await currentPyodideInstance.runPythonAsync(`
            import sys
            import io
            sys.stdout = io.StringIO()
          `);

        await currentPyodideInstance.runPythonAsync(codeContent);

        const output: string = await currentPyodideInstance.runPythonAsync(
          "sys.stdout.getvalue()",
        );

        updateConsoleOutput(runId, output, "completed");
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      } catch (error: any) {
        updateConsoleOutput(runId, error.message, "failed");
      }
    }
  }, [pyodide, codeContent, setConsoleOutputs, updateConsoleOutput]);

  return (
    <Button
      variant="outline"
      className="h-fit px-2 py-1.5 dark:hover:bg-zinc-700"
      onClick={() => {
        startTransition(() => {
          loadAndRunPython();
        });
      }}
      disabled={block.status === "streaming"}
    >
      <PlayIcon size={18} /> Run
    </Button>
  );
}

function PureBlockActions({
  block,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
}: BlockActionsProps) {
  const [_, copyToClipboard] = useCopyToClipboard();

  return (
    <div className="flex flex-row gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "!pointer-events-auto h-fit p-2 dark:hover:bg-zinc-700",
              {
                "bg-muted": mode === "diff",
              },
            )}
            onClick={() => {
              handleVersionChange("toggle");
            }}
            disabled={block.status === "streaming" || currentVersionIndex === 0}
          >
            <ClockRewind size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View changes</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="!pointer-events-auto h-fit p-2 dark:hover:bg-zinc-700"
            onClick={() => {
              handleVersionChange("prev");
            }}
            disabled={currentVersionIndex === 0 || block.status === "streaming"}
          >
            <UndoIcon size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View Previous version</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="!pointer-events-auto h-fit p-2 dark:hover:bg-zinc-700"
            onClick={() => {
              handleVersionChange("next");
            }}
            disabled={isCurrentVersion || block.status === "streaming"}
          >
            <RedoIcon size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View Next version</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="h-fit p-2 dark:hover:bg-zinc-700"
            onClick={() => {
              copyToClipboard(block.content);
              toast.success("Copied to clipboard!");
            }}
            disabled={block.status === "streaming"}
          >
            <CopyIcon size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy to clipboard</TooltipContent>
      </Tooltip>
    </div>
  );
}

export const BlockActions = memo(PureBlockActions, (prevProps, nextProps) => {
  if (prevProps.block.status !== nextProps.block.status) return false;
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
    return false;
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;

  return true;
});
