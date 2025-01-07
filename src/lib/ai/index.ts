import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { experimental_wrapLanguageModel as wrapLanguageModel } from "ai";

import { env } from "@/lib/env";

import { customMiddleware } from "./custom-middleware";

const openRouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: openRouter(apiIdentifier),
    middleware: customMiddleware,
  });
};
