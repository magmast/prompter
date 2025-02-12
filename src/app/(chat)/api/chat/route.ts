import {
  type Message,
  convertToCoreMessages,
  createDataStreamResponse,
  streamObject,
  streamText,
} from "ai";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { customModel } from "@/lib/ai";
import { models } from "@/lib/ai/models";
import {
  createPromptPrompt,
  systemPrompt,
  updatePromptPrompt,
} from "@/lib/ai/prompts";
import {
  deleteChatById,
  getChatById,
  getPromptById,
  saveChat,
  savePrompt,
  saveMessages,
  saveSuggestions,
} from "@/lib/db/queries";
import type { Suggestion } from "@/lib/db/schema";
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from "@/lib/utils";

import { generateTitleFromUserMessage } from "../../actions";

export const maxDuration = 60;

type AllowedTools = "createPrompt" | "updatePrompt" | "requestSuggestions";

const allTools: AllowedTools[] = [
  "createPrompt",
  "updatePrompt",
  "requestSuggestions",
];

export async function POST(request: Request) {
  const {
    id,
    messages,
    modelId,
  }: { id: string; messages: Array<Message>; modelId: string } =
    await request.json();

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response("Model not found", { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({
      message: userMessage,
    });
    await saveChat({ id, userId: session.user.id, title });
  }

  const userMessageId = generateUUID();

  await saveMessages({
    messages: [
      { ...userMessage, id: userMessageId, createdAt: new Date(), chatId: id },
    ],
  });

  return createDataStreamResponse({
    execute: (dataStream) => {
      dataStream.writeData({
        type: "user-message-id",
        content: userMessageId,
      });

      const result = streamText({
        model: customModel(model.apiIdentifier),
        system: systemPrompt,
        messages: coreMessages,
        maxSteps: 5,
        experimental_activeTools: allTools,
        tools: {
          createPrompt: {
            description:
              "Create a prompt. This tool will call other functions that will generate the contents of the prompt based on the description.",
            parameters: z.object({
              title: z.string().describe("Prompt title shown to the user"),
              description: z
                .string()
                .describe(
                  "The description of the prompt that other AI agent will use to create the prompt",
                ),
            }),
            execute: async ({ title, description }) => {
              const id = generateUUID();
              let draftText = "";
              dataStream.writeData({
                type: "id",
                content: id,
              });
              dataStream.writeData({
                type: "title",
                content: title,
              });
              dataStream.writeData({
                type: "clear",
                content: "",
              });
              const { fullStream } = streamText({
                model: customModel(model.apiIdentifier),
                system: createPromptPrompt,
                prompt: description,
              });
              for await (const delta of fullStream) {
                const { type } = delta;
                if (type === "text-delta") {
                  const { textDelta } = delta;
                  draftText += textDelta;
                  dataStream.writeData({
                    type: "text-delta",
                    content: textDelta,
                  });
                }
              }
              dataStream.writeData({ type: "finish", content: "" });
              if (session.user?.id) {
                await savePrompt({
                  id,
                  title,
                  content: draftText,
                  userId: session.user.id,
                });
              }
              return {
                id,
                title,
                content: "A prompt was created and is now visible to the user.",
              };
            },
          },
          updatePrompt: {
            description: "Update a prompt with the given description.",
            parameters: z.object({
              id: z.string().describe("The ID of the prompt to update"),
              description: z
                .string()
                .describe("The description of changes that need to be made"),
            }),
            execute: async ({ id, description }) => {
              const prompt = await getPromptById({ id });
              if (!prompt) {
                return {
                  error: "Prompt not found",
                };
              }
              const { content: currentContent } = prompt;
              let draftText = "";
              dataStream.writeData({
                type: "clear",
                content: prompt.title,
              });
              const { fullStream } = streamText({
                model: customModel(model.apiIdentifier),
                system: updatePromptPrompt(currentContent),
                prompt: description,
                experimental_providerMetadata: {
                  openai: {
                    prediction: {
                      type: "content",
                      content: currentContent,
                    },
                  },
                },
              });
              for await (const delta of fullStream) {
                const { type } = delta;
                if (type === "text-delta") {
                  const { textDelta } = delta;
                  draftText += textDelta;
                  dataStream.writeData({
                    type: "text-delta",
                    content: textDelta,
                  });
                }
              }
              dataStream.writeData({ type: "finish", content: "" });
              if (session.user?.id) {
                await savePrompt({
                  id,
                  title: prompt.title,
                  content: draftText,
                  userId: session.user.id,
                });
              }
              return {
                id,
                title: prompt.title,
                content: "The prompt has been updated successfully.",
              };
            },
          },
          requestSuggestions: {
            description: "Request suggestions for a prompt",
            parameters: z.object({
              promptId: z
                .string()
                .describe("The ID of the prompt to request edits"),
            }),
            execute: async ({ promptId }) => {
              const prompt = await getPromptById({ id: promptId });
              if (!prompt || !prompt.content) {
                return {
                  error: "Prompt not found",
                };
              }
              const suggestions: Array<
                Omit<Suggestion, "userId" | "createdAt" | "promptCreatedAt">
              > = [];
              const { elementStream } = streamObject({
                model: customModel(model.apiIdentifier),
                system:
                  "You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.",
                prompt: prompt.content,
                output: "array",
                schema: z.object({
                  originalSentence: z
                    .string()
                    .describe("The original sentence"),
                  suggestedSentence: z
                    .string()
                    .describe("The suggested sentence"),
                  description: z
                    .string()
                    .describe("The description of the suggestion"),
                }),
              });
              for await (const element of elementStream) {
                const suggestion = {
                  originalText: element.originalSentence,
                  suggestedText: element.suggestedSentence,
                  description: element.description,
                  id: generateUUID(),
                  promptId,
                  isResolved: false,
                };
                dataStream.writeData({
                  type: "suggestion",
                  content: suggestion,
                });
                suggestions.push(suggestion);
              }
              if (session.user?.id) {
                const userId = session.user.id;
                await saveSuggestions({
                  suggestions: suggestions.map((suggestion) => ({
                    ...suggestion,
                    userId,
                    createdAt: new Date(),
                    promptCreatedAt: prompt.createdAt,
                  })),
                });
              }
              return {
                id: promptId,
                title: prompt.title,
                message: "Suggestions have been added to the prompt",
              };
            },
          },
        },
        onFinish: async ({ response }) => {
          if (session.user?.id) {
            try {
              const responseMessagesWithoutIncompleteToolCalls =
                sanitizeResponseMessages(response.messages);

              await saveMessages({
                messages: responseMessagesWithoutIncompleteToolCalls.map(
                  (message) => {
                    const messageId = generateUUID();

                    if (message.role === "assistant") {
                      dataStream.writeMessageAnnotation({
                        messageIdFromServer: messageId,
                      });
                    }

                    return {
                      id: messageId,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  },
                ),
              });
            } catch (error) {
              console.error("Failed to save chat");
            }
          }
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: "stream-text",
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
