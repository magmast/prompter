import "server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";
import { and, asc, desc, eq, gt, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import {
  type Message,
  type Suggestion,
  type User,
  chats,
  prompts as promptsTable,
  messages as messagesTable,
  suggestions as suggestionsTable,
  users,
  votes,
} from "./schema";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

const client = postgres(env.POSTGRES_URL);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(users).where(eq(users.email, email));
  } catch (error) {
    console.error("Failed to get user from database");
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    return await db.insert(users).values({ email, password: hash });
  } catch (error) {
    console.error("Failed to create user in database");
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chats).values({
      id,
      createdAt: new Date(),
      userId,
      title,
    });
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(votes).where(eq(votes.chatId, id));
    await db.delete(messagesTable).where(eq(messagesTable.chatId, id));

    return await db.delete(chats).where(eq(chats.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chats)
      .where(eq(chats.userId, id))
      .orderBy(desc(chats.createdAt));
  } catch (error) {
    console.error("Failed to get chats by user from database");
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    return await db.insert(messagesTable).values(messages);
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.chatId, id))
      .orderBy(asc(messagesTable.createdAt));
  } catch (error) {
    console.error("Failed to get messages by chat id from database", error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(votes)
      .where(and(eq(votes.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(votes)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(votes.messageId, messageId), eq(votes.chatId, chatId)));
    }
    return await db.insert(votes).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (error) {
    console.error("Failed to upvote message in database", error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(votes).where(eq(votes.chatId, id));
  } catch (error) {
    console.error("Failed to get votes by chat id from database", error);
    throw error;
  }
}

export async function savePrompt({
  id,
  title,
  content,
  userId,
}: {
  id: string;
  title: string;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(promptsTable).values({
      id,
      title,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to save prompt in database");
    throw error;
  }
}

export async function getPromptsById({ id }: { id: string }) {
  try {
    const prompts = await db
      .select()
      .from(promptsTable)
      .where(eq(promptsTable.id, id))
      .orderBy(asc(promptsTable.createdAt));

    return prompts;
  } catch (error) {
    console.error("Failed to get prompt by id from database");
    throw error;
  }
}

export async function getPromptById({ id }: { id: string }) {
  try {
    const [selectedPrompt] = await db
      .select()
      .from(promptsTable)
      .where(eq(promptsTable.id, id))
      .orderBy(desc(promptsTable.createdAt));

    return selectedPrompt;
  } catch (error) {
    console.error("Failed to get prompt by id from database");
    throw error;
  }
}

export async function deletePromptsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.promptId, id),
          gt(suggestionsTable.promptCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(promptsTable)
      .where(
        and(eq(promptsTable.id, id), gt(promptsTable.createdAt, timestamp)),
      );
  } catch (error) {
    console.error(
      "Failed to delete prompts by id after timestamp from database",
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestionsTable).values(suggestions);
  } catch (error) {
    console.error("Failed to save suggestions in database");
    throw error;
  }
}

export async function getSuggestionsByPromptId({
  promptId,
}: {
  promptId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestionsTable)
      .where(and(eq(suggestionsTable.promptId, promptId)));
  } catch (error) {
    console.error("Failed to get suggestions by prompt id from database");
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, id));
  } catch (error) {
    console.error("Failed to get message by id from database");
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    return await db
      .delete(messagesTable)
      .where(
        and(
          eq(messagesTable.chatId, chatId),
          gte(messagesTable.createdAt, timestamp),
        ),
      );
  } catch (error) {
    console.error(
      "Failed to delete messages by id after timestamp from database",
    );
    throw error;
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db
      .update(chats)
      .set({ visibility })
      .where(eq(chats.id, chatId));
  } catch (error) {
    console.error("Failed to update chat visibility in database");
    throw error;
  }
}
