import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'; // For .toBeInTheDocument()
import ChatInterface from './ChatInterface';

// Mock global.fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.close(); // Immediately close the stream for mock purposes
      }
    }),
    json: () => Promise.resolve({}), // For non-streaming error parsing
    text: () => Promise.resolve(''), // For non-streaming error parsing
  })
) as jest.Mock;

// Mock matchMedia for components that might use it (like some shadcn/ui components under the hood)
// or for responsive design tests if we were doing them.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollTo for HTMLDivElement in JSDOM
if (typeof HTMLDivElement !== 'undefined') { // Check if HTMLDivElement is defined (it should be in JSDOM)
  HTMLDivElement.prototype.scrollTo = jest.fn();
}


describe('ChatInterface', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders the chat interface and key static elements', () => {
    render(<ChatInterface />);

    // Check for model selection buttons
    expect(screen.getByRole('button', { name: /OpenAI/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gemini/i })).toBeInTheDocument();

    // Check for the input placeholder (default model is OpenAI)
    // The placeholder text is dynamic based on the selected model, e.g., "Chat with OPENAI..."
    expect(screen.getByPlaceholderText(/Chat with OPENAI.../i)).toBeInTheDocument();

    // Check for the initial "No messages yet" text
    expect(screen.getByText(/No messages yet. Start a conversation!/i)).toBeInTheDocument();

    // The main container check by role="main" was removed as the component doesn't set this role.
    // The presence of the above elements is a good initial smoke test.
  });

  // Add more tests here:
  // - Test model switching and placeholder update
  // - Test sending a message (mocking fetch response)
  // - Test displaying user and assistant messages
  // - Test error display
  // - Test loading state
});
