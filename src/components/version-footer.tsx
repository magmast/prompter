"use client";

import { isAfter } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { useWindowSize } from "usehooks-ts";

import { useBlock } from "@/hooks/use-block";
import type { Prompt } from "@/lib/db/schema";
import { getPromptTimestampByIndex } from "@/lib/utils";

import { LoaderIcon } from "./icons";
import { Button } from "./ui/button";

interface VersionFooterProps {
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  prompts: Array<Prompt> | undefined;
  currentVersionIndex: number;
}

export const VersionFooter = ({
  handleVersionChange,
  prompts: prompts,
  currentVersionIndex,
}: VersionFooterProps) => {
  const { block } = useBlock();

  const { width } = useWindowSize();
  const isMobile = width < 768;

  const { mutate } = useSWRConfig();
  const [isMutating, setIsMutating] = useState(false);

  if (!prompts) return;

  return (
    <motion.div
      className="absolute bottom-0 z-50 flex w-full flex-col justify-between gap-4 border-t bg-background p-4 lg:flex-row"
      initial={{ y: isMobile ? 200 : 77 }}
      animate={{ y: 0 }}
      exit={{ y: isMobile ? 200 : 77 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
    >
      <div>
        <div>You are viewing a previous version</div>
        <div className="text-sm text-muted-foreground">
          Restore this version to make edits
        </div>
      </div>

      <div className="flex flex-row gap-4">
        <Button
          disabled={isMutating}
          onClick={async () => {
            setIsMutating(true);

            mutate(
              `/api/prompt?id=${block.promptId}`,
              await fetch(`/api/prompt?id=${block.promptId}`, {
                method: "PATCH",
                body: JSON.stringify({
                  timestamp: getPromptTimestampByIndex(
                    prompts,
                    currentVersionIndex,
                  ),
                }),
              }),
              {
                optimisticData: prompts
                  ? [
                      ...prompts.filter((prompt) =>
                        isAfter(
                          new Date(prompt.createdAt),
                          new Date(
                            getPromptTimestampByIndex(
                              prompts,
                              currentVersionIndex,
                            ),
                          ),
                        ),
                      ),
                    ]
                  : [],
              },
            );
          }}
        >
          <div>Restore this version</div>
          {isMutating && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            handleVersionChange("latest");
          }}
        >
          Back to latest version
        </Button>
      </div>
    </motion.div>
  );
};
