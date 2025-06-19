import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, ChatSession, Content } from '@google/generative-ai'; // Removed HarmCategory, HarmBlockThreshold

// Helper function to transform messages to Gemini format (remains the same)
function transformMessagesForGemini(messages: { role: string; content: string }[]): { history: Content[], lastUserMessage: string } {
  if (!messages || messages.length === 0) {
    throw new Error("Message list cannot be empty.");
  }
  let lastUserMessage = "";
  const history: Content[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const role = message.role === 'assistant' ? 'model' : 'user';
    if (i === messages.length - 1) {
      if (role !== 'user') {
        throw new Error("Last message must be from the user for Gemini API.");
      }
      lastUserMessage = message.content;
    } else {
      history.push({ role: role, parts: [{ text: message.content }] });
    }
  }
  if (!lastUserMessage && messages.length > 0 && messages[messages.length - 1].role === 'user') {
    lastUserMessage = messages[messages.length - 1].content;
  } else if (!lastUserMessage) {
    throw new Error("Could not determine last user message. Ensure the last message is from the user.");
  }
  return { history, lastUserMessage };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const originalMessages: { role: string; content: string }[] = body.messages;

    if (!originalMessages || originalMessages.length === 0) {
      return NextResponse.json({ error: 'Missing messages in request body' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Gemini API key not found. Make sure GEMINI_API_KEY environment variable is set.');
      return NextResponse.json({ error: 'API key not configured for Gemini.' }, { status: 500 });
    }

    const { history, lastUserMessage } = transformMessagesForGemini(originalMessages);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest", // Or "gemini-pro"
      // safetySettings: [ ... ] // Optional
    });

    const chat: ChatSession = model.startChat({
      history: history,
      // generationConfig: { maxOutputTokens: 200 }, // Optional
    });

    // Use sendMessageStream for streaming
    const streamResult = await chat.sendMessageStream(lastUserMessage);

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of streamResult.stream) {
            // Check for promptFeedback, which might indicate an issue before any text is generated
            if (chunk.promptFeedback && chunk.promptFeedback.blockReason) {
                console.error(`Gemini stream blocked: ${chunk.promptFeedback.blockReason}`, chunk.promptFeedback);
                const errorMessage = JSON.stringify({ error: `Request blocked by Gemini: ${chunk.promptFeedback.blockReason}` });
                controller.enqueue(encoder.encode(errorMessage));
                controller.close(); // Close stream after sending error
                return; // Stop further processing
            }

            const content = chunk.text();
            // Gemini stream might send empty strings or just whitespace,
            // filter them out if they are not meaningful.
            if (content && content.trim()) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error: any) {
          console.error('Error during Gemini stream processing:', error);
          try {
            const errorMessage = JSON.stringify({ error: "Error during streaming from Gemini: " + error.message });
            controller.enqueue(encoder.encode(errorMessage));
          } catch (e) {
            console.error("Failed to enqueue error message to Gemini stream:", e);
          }
        } finally {
          controller.close();
        }
      },
      cancel() {
        console.log("Stream cancelled by client (Gemini route).");
        // Logic to potentially signal abortion to Gemini if their SDK supports it for ongoing streams.
      }
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
       },
    });

  } catch (error: any) {
    console.error('Error processing Gemini chat request (pre-stream):', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    } else if (error.message.includes("Last message must be from the user") || error.message.includes("Could not determine last user message")) {
      return NextResponse.json({ error: `Message formatting error for Gemini: ${error.message}` }, { status: 400 });
    }
    // General errors before stream starts
    return NextResponse.json({ error: error.message || 'Internal Server Error with Gemini before streaming' }, { status: 500 });
  }
}
