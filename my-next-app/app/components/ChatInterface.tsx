"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, MessageCircle } from 'lucide-react'; // Import icons

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

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: currentMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`${selectedModel} API Error:`, errorData.error || response.statusText);
        const assistantErrorMessage: Message = {
          role: 'assistant',
          content: `Error from ${selectedModel}: ${errorData.error || response.statusText}`,
          isError: true, // Mark as error
        };
        setMessages(prevMessages => [...prevMessages, assistantErrorMessage]);
        setIsLoading(false); // Already set in finally, but good for clarity
        return;
      }

      const data = await response.json();
      const assistantMessage: Message = data.response; // API should return { role, content }
      setMessages(prevMessages => [...prevMessages, assistantMessage]);

    } catch (error)
    {
      console.error(`Fetch Error (${selectedModel}):`, error);
      const assistantErrorMessage: Message = {
        role: 'assistant',
        content: `Error: Could not connect to the ${selectedModel} server. Please ensure it's running and reachable.`,
        isError: true, // Mark as error
      };
      setMessages(prevMessages => [...prevMessages, assistantErrorMessage]);
    } finally {
      setIsLoading(false);
      console.log("Fetching complete.");
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl h-screen max-h-[90vh] p-4 sm:p-6 bg-white font-sans rounded-xl shadow-2xl">
      {/* Model Selection UI */}
      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
        <div className="flex justify-center items-center space-x-2 sm:space-x-4">
          <span className="text-sm sm:text-base text-slate-700 font-medium">Select Model:</span>
          <button
            onClick={() => handleModelChange('openai')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 ease-in-out
                        ${selectedModel === 'openai' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-50' : 'bg-slate-200 text-slate-700 hover:bg-blue-100 hover:text-blue-700'}`}
          >
            OpenAI
          </button>
          <button
            onClick={() => handleModelChange('gemini')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 ease-in-out
                        ${selectedModel === 'gemini' ? 'bg-green-600 text-white shadow-md ring-2 ring-green-400 ring-offset-1 ring-offset-slate-50' : 'bg-slate-200 text-slate-700 hover:bg-green-100 hover:text-green-700'}`}
          >
            Gemini
          </button>
        </div>
         <p className="text-xs text-center text-slate-500 mt-2">Currently selected: <span className="font-semibold tracking-wider">{selectedModel.toUpperCase()}</span></p>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow mb-4 p-4 bg-slate-100 border border-slate-200 rounded-lg shadow-inner overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <MessageCircle size={48} className="text-slate-400 mb-3" />
            <p className="text-slate-500 text-center text-sm sm:text-base">No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`flex items-start p-2.5 rounded-xl shadow-sm clear-both max-w-[80%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white float-right ml-auto'
                : msg.isError
                  ? 'bg-red-100 text-red-700 float-left mr-auto ring-1 ring-red-200' // Error style
                  : 'bg-slate-200 text-slate-800 float-left mr-auto' // Normal assistant style
            }`}>
              {msg.role === 'assistant' && msg.isError && (
                <AlertTriangle size={20} className="mr-2 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex flex-col">
                <strong className="text-xs sm:text-sm font-semibold mb-0.5 text-opacity-90">
                  {msg.role === 'user' ? 'You' : `Assistant (${selectedModel})`}
                </strong>
                <span className="text-sm sm:text-base whitespace-pre-wrap">{msg.content}</span>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center justify-center p-2 text-slate-600 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-600 mr-2"></div>
            Assistant is thinking...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex items-center p-1.5 bg-slate-50 border border-slate-300 rounded-lg shadow-sm">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          className="flex-grow p-2.5 text-sm sm:text-base border-none bg-slate-50 rounded-l-md focus:outline-none focus:ring-2 focus:ring-opacity-50
                     ${selectedModel === 'openai' ? 'focus:ring-blue-500' : 'focus:ring-green-500'}"
          placeholder={`Chat with ${selectedModel.toUpperCase()}...`}
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          className={`p-2.5 text-white rounded-r-md focus:outline-none focus:ring-2 ring-offset-1 ring-offset-slate-50 focus:ring-opacity-75 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-150
                      ${selectedModel === 'openai' ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500' : 'bg-green-500 hover:bg-green-600 focus:ring-green-500'}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.062A28.896 28.896 0 003.105 2.289z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
