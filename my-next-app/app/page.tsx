import ChatInterface from '@/app/components/ChatInterface';

export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-100 py-8 px-4">
      {/* The ChatInterface itself will manage its max width and height */}
      <ChatInterface />
    </main>
  );
}
