// This runs on the server (Vercel), never in the browser — so the API key
// stored in GEMINI_API_KEY is never exposed to anyone using the app.
export async function POST(request) {
  try {
    const { systemPrompt, messages } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "The AI Assistant isn't set up yet — no API key configured on the server." },
        { status: 500 }
      );
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "No message provided." }, { status: 400 });
    }

    // Gemini uses "model" for the assistant's turns, not "assistant".
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt || "" }] },
          contents,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      return Response.json({ error: `Gemini API error: ${response.status} ${errBody.slice(0, 200)}` }, { status: 502 });
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
      "I couldn't generate a response — please try again.";

    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: "Something went wrong reaching the assistant." }, { status: 500 });
  }
}
