import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});

export type User = InferSelectModel<typeof users>;

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chats>;

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chats.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type Message = InferSelectModel<typeof messages>;

export const votes = pgTable(
  "votes",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chats.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messages.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof votes>;

export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Prompt = InferSelectModel<typeof prompts>;

export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid("id").notNull().defaultRandom(),
    promptId: uuid("promptId").notNull(),
    promptCreatedAt: timestamp("promptCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    promptRef: foreignKey({
      columns: [table.promptId, table.promptCreatedAt],
      foreignColumns: [prompts.id, prompts.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestions>;
