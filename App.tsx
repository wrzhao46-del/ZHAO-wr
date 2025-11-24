import React, { useState } from 'react';
import { SpeakingSession } from './components/SpeakingSession';
import { Mic, BookOpen, GraduationCap } from 'lucide-react';

enum ViewState {
  HOME = 'HOME',
  SESSION = 'SESSION'
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.HOME);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button 
              onClick={() => setView(ViewState.HOME)}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              <div className="bg-primary-600 p-1.5 rounded-lg text-white">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">IELTS Prep AI</span>
            </button>
            
            <div className="flex gap-4">
               {view === ViewState.SESSION && (
                 <button 
                   onClick={() => setView(ViewState.HOME)}
                   className="text-sm font-medium text-slate-500 hover:text-slate-800"
                 >
                   Exit Session
                 </button>
               )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === ViewState.HOME ? (
          <div className="flex flex-col items-center text-center space-y-12 py-12 md:py-20 animate-in fade-in duration-700">
            <div className="space-y-6 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium border border-primary-100">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                Now with Real-time Voice Interaction
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-slate-900 tracking-tight leading-tight">
                Master the IELTS <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-400">
                  Speaking Test
                </span>
              </h1>
              
              <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Practice with an AI Examiner that listens, responds, and simulates a real exam environment. 
                Cover Part 1, 2, and 3 anytime, anywhere.
              </p>
            </div>

            <button
              onClick={() => setView(ViewState.SESSION)}
              className="group relative px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-primary-200 hover:bg-primary-700 hover:scale-105 transition-all duration-300 flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <Mic className="w-6 h-6 relative z-10" />
              <span className="relative z-10">Start Speaking Practice</span>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl pt-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Full Exam Simulation</h3>
                <p className="text-slate-500 text-sm">Experience the flow of Parts 1, 2, and 3 with strict timing and varied topics.</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
                  <Mic className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Voice-First Interface</h3>
                <p className="text-slate-500 text-sm">No typing required. Just talk naturally with our low-latency AI examiner.</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Realistic Feedback</h3>
                <p className="text-slate-500 text-sm">Get comfortable answering unexpected questions and managing your time.</p>
              </div>
            </div>
          </div>
        ) : (
          <SpeakingSession />
        )}
      </main>
    </div>
  );
};

export default App;
