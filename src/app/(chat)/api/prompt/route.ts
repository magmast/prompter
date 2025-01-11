import { auth } from "@/app/(auth)/auth";
import {
  deletePromptsByIdAfterTimestamp,
  getPromptsById,
  savePrompt,
} from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const prompts = await getPromptsById({ id });

  const [prompt] = prompts;

  if (!prompt) {
    return new Response("Not Found", { status: 404 });
  }

  if (prompt.userId !== session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json(prompts, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { content, title }: { content: string; title: string } =
    await request.json();

  if (session.user?.id) {
    const prompt = await savePrompt({
      id,
      content,
      title,
      userId: session.user.id,
    });

    return Response.json(prompt, { status: 200 });
  }
  return new Response("Unauthorized", { status: 401 });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const { timestamp }: { timestamp: string } = await request.json();

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const prompts = await getPromptsById({ id });

  const [prompt] = prompts;

  if (prompt.userId !== session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  await deletePromptsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return new Response("Deleted", { status: 200 });
}
