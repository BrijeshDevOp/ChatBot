import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, apiKey, model = "llama-3.3-70b-versatile" } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful, harmless, and honest AI assistant. You provide clear, accurate, and thoughtful responses. Use markdown formatting when appropriate — for code blocks, lists, headers, and emphasis — to make your responses easy to read.",
          },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => ({}));
      const errMsg =
        (errData as { error?: { message?: string } })?.error?.message ||
        `Groq API error: ${groqResponse.status}`;
      return NextResponse.json({ error: errMsg }, { status: groqResponse.status });
    }

    // Stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            const chunk = decoder.decode(value, { stream: true });
            // Check for the [DONE] signal
            if (chunk.includes("data: [DONE]")) break;
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
