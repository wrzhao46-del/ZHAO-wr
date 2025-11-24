import React from 'react';

export const ChatInterface: React.FC = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto items-center justify-center p-8 text-center space-y-4">
      <h2 className="text-2xl font-bold text-slate-400">Component Deprecated</h2>
      <p className="text-slate-500">
        The Gardening Chat Assistant is no longer available in this version of the application.
        Please refer to the IELTS Speaking Simulator.
      </p>
    </div>
  );
};