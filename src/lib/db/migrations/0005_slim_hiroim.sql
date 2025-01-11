ALTER TABLE "Chat" RENAME TO "chats";--> statement-breakpoint
ALTER TABLE "Message" RENAME TO "messages";--> statement-breakpoint
ALTER TABLE "Document" RENAME TO "prompts";--> statement-breakpoint
ALTER TABLE "Suggestion" RENAME TO "suggestions";--> statement-breakpoint
ALTER TABLE "User" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "Vote" RENAME TO "votes";--> statement-breakpoint
ALTER TABLE "suggestions" RENAME COLUMN "documentId" TO "promptId";--> statement-breakpoint
ALTER TABLE "suggestions" RENAME COLUMN "documentCreatedAt" TO "promptCreatedAt";--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT "Chat_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "prompts" DROP CONSTRAINT "Document_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "Message_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "suggestions" DROP CONSTRAINT "Suggestion_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "suggestions" DROP CONSTRAINT "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk";
--> statement-breakpoint
ALTER TABLE "votes" DROP CONSTRAINT "Vote_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "votes" DROP CONSTRAINT "Vote_messageId_Message_id_fk";
--> statement-breakpoint
ALTER TABLE "prompts" DROP CONSTRAINT "Document_id_createdAt_pk";--> statement-breakpoint
ALTER TABLE "suggestions" DROP CONSTRAINT "Suggestion_id_pk";--> statement-breakpoint
ALTER TABLE "votes" DROP CONSTRAINT "Vote_chatId_messageId_pk";--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_id_createdAt_pk" PRIMARY KEY("id","createdAt");--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_id_pk" PRIMARY KEY("id");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_chatId_messageId_pk" PRIMARY KEY("chatId","messageId");--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chatId_chats_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_promptId_promptCreatedAt_prompts_id_createdAt_fk" FOREIGN KEY ("promptId","promptCreatedAt") REFERENCES "public"."prompts"("id","createdAt") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_chatId_chats_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_messageId_messages_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;