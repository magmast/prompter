import { auth } from "@/app/(auth)/auth";
import { getSuggestionsByPromptId } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const promptId = searchParams.get("promptId");

  if (!promptId) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const suggestions = await getSuggestionsByPromptId({
    promptId,
  });

  const [suggestion] = suggestions;

  if (!suggestion) {
    return Response.json([], { status: 200 });
  }

  if (suggestion.userId !== session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json(suggestions, { status: 200 });
}