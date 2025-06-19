"use client";

import React, { useState, useEffect, useRef } from 'react'; // Added useRef for ScrollArea
import { AlertTriangle, MessageCircle, Send } from 'lucide-react'; // Added Send, kept AlertTriangle, MessageCircle
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Removed CardDescription, CardFooter
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Added Alert components
import { ScrollArea } from "@/components/ui/scroll-area"; // Added ScrollArea
import { Skeleton } from "@/components/ui/skeleton"; // Added Skeleton

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean; // Optional flag for error messages
}

type Model = 'openai' | 'gemini';

const ChatInterface: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model>('openai');
  const scrollAreaRef = useRef<HTMLDivElement>(null); // For auto-scrolling ScrollArea

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleModelChange = (model: Model) => {
    setSelectedModel(model);
    console.log(`Switched to ${model} model`);
    // Optional: Clear messages or add a system message about model switch
    // setMessages([]);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    const newUserMessage: Message = { role: 'user', content: inputValue };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    const currentMessages = [...messages, newUserMessage];
    setInputValue('');
    setIsLoading(true);
    console.log(`Fetching response from ${selectedModel} API...`);

    const apiEndpoint = selectedModel === 'openai' ? '/api/chat/openai' : '/api/chat/gemini';

    // Create a placeholder for the assistant's message BEFORE the fetch call.
    // This placeholder will be updated incrementally with streamed content.
    const assistantMessagePlaceholder: Message = {
      role: 'assistant',
      content: '', // Start with empty content
      isError: false,
    };
    setMessages(prevMessages => [...prevMessages, assistantMessagePlaceholder]);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: currentMessages }), // Send the history up to the new user message
      });

      if (!response.ok) {
        let errorContent = `Error from ${selectedModel}: ${response.statusText}`;
        try {
          // Try to parse the error response as JSON, which our backend sends for pre-stream errors
          const errorData = await response.json();
          errorContent = `Error from ${selectedModel}: ${errorData.error || response.statusText}`;
        } catch (e) {
          // If JSON parsing fails, try to get plain text
          try {
            errorContent = `Error from ${selectedModel}: ${await response.text()}`;
          } catch (e2) { /* Fallback to status text already set */ }
        }
        // Update the placeholder with the error
        setMessages(prevMessages => prevMessages.map(msg =>
          msg === assistantMessagePlaceholder ? { ...msg, content: errorContent, isError: true } : msg
        ));
        return; // Exit early
      }

      if (!response.body) {
        throw new Error("Response body is null, streaming not possible.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        accumulatedContent += decoder.decode(value, { stream: true });

        // Attempt to parse if it's a JSON error message (from backend's in-stream error reporting)
        // This is more likely to happen in the first few chunks if the backend sends a quick error.
        if (firstChunk || accumulatedContent.trim().startsWith("{")) {
           try {
            const potentialError = JSON.parse(accumulatedContent);
            if (potentialError && potentialError.error) {
              setMessages(prevMessages => prevMessages.map(msg =>
                msg === assistantMessagePlaceholder ? { ...msg, content: `Error from ${selectedModel}: ${potentialError.error}`, isError: true } : msg
              ));
              return; // Stop further processing of this stream
            }
          } catch (e) {
            // Not a JSON error, or incomplete JSON. Continue accumulating.
            // If it was a false positive (not an error), the content will just be displayed.
          }
        }
        firstChunk = false;

        // Update the assistant's message content incrementally
        setMessages(prevMessages => prevMessages.map(msg =>
          msg === assistantMessagePlaceholder ? { ...msg, content: accumulatedContent, isError: false } : msg
        ));
      }

      // Final decode call to flush any remaining characters
      const finalDecodedContent = decoder.decode(undefined, { stream: false });
      if (finalDecodedContent) {
          accumulatedContent += finalDecodedContent;
           setMessages(prevMessages => prevMessages.map(msg =>
            msg === assistantMessagePlaceholder ? { ...msg, content: accumulatedContent, isError: false } : msg
          ));
      }


    } catch (error: any) {
      console.error(`Fetch/Stream Error (${selectedModel}):`, error);
      // Update the placeholder with the fetch/network error
      setMessages(prevMessages => prevMessages.map(msg =>
        msg === assistantMessagePlaceholder ? { ...msg, content: `Network or streaming error with ${selectedModel}: ${error.message || 'Unknown error'}.`, isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
      console.log(`Fetching/Streaming from ${selectedModel} complete.`);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl h-screen max-h-[90vh] p-4 sm:p-6 bg-white font-sans rounded-xl shadow-2xl">
      {/* Model Selection UI */}
      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
        <div className="flex justify-center items-center space-x-2 sm:space-x-4">
          <span className="text-sm sm:text-base text-slate-700 font-medium">Select Model:</span>
          <Button
            variant={selectedModel === 'openai' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModelChange('openai')}
            className={`${selectedModel === 'openai' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
          >
            OpenAI
          </Button>
          <Button
            variant={selectedModel === 'gemini' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModelChange('gemini')}
            className={`${selectedModel === 'gemini' ? 'bg-green-600 hover:bg-green-700' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
          >
            Gemini
          </Button>
        </div>
         <p className="text-xs text-center text-slate-500 mt-2">Currently selected: <span className="font-semibold tracking-wider">{selectedModel.toUpperCase()}</span></p>
      </div>

      {/* Chat Messages Area */}
      <ScrollArea className="flex-grow mb-4 p-4 bg-slate-100 border border-slate-200 rounded-lg shadow-inner" ref={scrollAreaRef}>
        <div className="space-y-3"> {/* Added a div wrapper for space-y styling within ScrollArea */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-10"> {/* Added py-10 for some spacing */}
            <MessageCircle size={48} className="text-slate-400 mb-3" />
            <p className="text-slate-500 text-center text-sm sm:text-base">No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            if (msg.isError) {
              return (
                <Alert variant="destructive" key={index} className="max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] mr-auto">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Assistant Error ({selectedModel})</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap">
                    {msg.content}
                  </AlertDescription>
                </Alert>
              );
            }
            return (
              <Card
                key={index}
                className={`max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] rounded-xl shadow-sm clear-both ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-primary-foreground float-right ml-auto' // Using primary-foreground for white text on blue
                    : 'bg-slate-200 text-slate-900 float-left mr-auto' // Adjusted assistant message background
                }`}
              >
                <CardHeader className="p-2 pb-1"> {/* Compact header */}
                  <CardTitle className="text-xs sm:text-sm font-semibold">
                    {msg.role === 'user' ? 'You' : `Assistant (${selectedModel})`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0 text-sm sm:text-base whitespace-pre-wrap">
                  {msg.content}
                </CardContent>
              </Card>
            );
          })
        )}
        {isLoading && messages.length > 0 && messages[messages.length -1].role === 'user' && ( // Show skeleton only when user just sent a message
          <Card className="max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] float-left mr-auto bg-slate-200 rounded-xl shadow-sm">
            <CardHeader className="p-2 pb-1">
              <CardTitle className="text-xs sm:text-sm font-semibold">
                Assistant ({selectedModel})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="flex items-center p-1.5 bg-slate-50 border border-slate-300 rounded-lg shadow-sm">
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          className={`flex-grow p-2.5 text-sm sm:text-base border-none bg-slate-50 rounded-l-md focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0
                     ${selectedModel === 'openai' ? 'focus-visible:ring-blue-500' : 'focus-visible:ring-green-500'}`} // Adjusted focus style for shadcn Input
          placeholder={`Chat with ${selectedModel.toUpperCase()}...`}
          disabled={isLoading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading}
          size="icon"
          className={`p-2.5 rounded-l-none rounded-r-md focus:ring-offset-slate-50
                      ${selectedModel === 'openai' ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500' : 'bg-green-500 hover:bg-green-600 focus:ring-green-500'}`}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default ChatInterface;
