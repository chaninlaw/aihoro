import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages) {
      return NextResponse.json({ error: 'Missing messages in request body' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found. Make sure OPENAI_API_KEY environment variable is set.');
      // For streaming, we can't easily return a JSON error if the stream has started.
      // This check happens before stream setup, so JSON response is fine.
      return NextResponse.json({ error: 'API key not configured for OpenAI.' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      stream: true,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
            // Check for finish reason if needed, e.g., chunk.choices[0]?.finish_reason === 'stop'
            if (chunk.choices[0]?.finish_reason) {
              console.log("OpenAI stream finished with reason:", chunk.choices[0]?.finish_reason);
            }
          }
        } catch (error) {
          console.error('Error during OpenAI stream processing:', error);
          // Try to enqueue an error message if the stream is still open
          // This is a simplistic approach; a more robust solution might involve a structured error format.
          try {
            const errorMessage = JSON.stringify({ error: "Error during streaming from OpenAI." });
            controller.enqueue(encoder.encode(errorMessage));
          } catch (e) {
            // If enqueueing fails, controller might be closed or in a bad state.
            console.error("Failed to enqueue error message to stream:", e);
          }
        } finally {
          controller.close();
        }
      },
      cancel() {
        console.log("Stream cancelled by client (OpenAI route).");
        // You might want to signal the OpenAI stream to abort if possible,
        // though the `for await...of` loop should naturally exit if the underlying stream is closed.
      }
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff', // Optional: for security
      },
    });

  } catch (error: any) {
    // This outer catch handles errors before the stream starts (e.g., JSON parsing, initial API key check)
    // or errors during the initial call to openai.chat.completions.create if it fails before returning a stream.
    console.error('Error processing OpenAI chat request (pre-stream):', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    } else if (error.response) { // Handle OpenAI API errors (non-streaming part)
      console.error('OpenAI API Error (pre-stream):', error.response.status, error.response.data);
      return NextResponse.json({ error: error.response.data?.error?.message || 'OpenAI API error' }, { status: error.response.status });
    } else if (error.code === 'ENOENT') {
        return NextResponse.json({ error: 'Network error communicating with OpenAI' }, { status: 503 });
    }
    // For errors caught here, it's safe to return JSON
    return NextResponse.json({ error: 'Internal Server Error before streaming' }, { status: 500 });
  }
}
