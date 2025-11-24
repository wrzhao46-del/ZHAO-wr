import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Square, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SessionStatus, TranscriptItem } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { createPcmBlob, base64Decode, decodeAudioData } from '../services/audioUtils';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Helper to keep track of audio timing
let nextStartTime = 0;

export const SpeakingSession: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Audio Contexts & Nodes
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Logic Refs
  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');
  const sessionRef = useRef<any>(null); // To hold the live session
  const streamRef = useRef<MediaStream | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopSession();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, status]);

  const startSession = async () => {
    setError(null);
    setStatus(SessionStatus.CONNECTING);
    nextStartTime = 0;

    try {
      // 1. Initialize Audio Contexts
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // 2. Setup Analysers
      inputAnalyserRef.current = inputContextRef.current.createAnalyser();
      outputAnalyserRef.current = outputContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current.fftSize = 256;

      // 3. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // 4. Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config = {
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
          systemInstruction: `You are Mr. Sterling, a professional, strict but fair IELTS Speaking Examiner. 
          Conduct a full IELTS speaking test which has 3 parts.
          
          PART 1: Introduction & Interview (4-5 minutes). Ask about the user (home, work, studies) and then 1-2 familiar topics.
          PART 2: Individual Long Turn. Give the user a topic. Tell them they have 1 minute to think. IMPORTANT: You must simulate silence for 1 minute while they think, then ask them to speak for 2 minutes. Stop them if they go over.
          PART 3: Two-way Discussion (4-5 minutes). Ask abstract questions related to Part 2.
          
          Guidelines:
          - Only speak audio.
          - Keep your turns relatively short to allow the student to speak.
          - Be encouraging but formal.
          - Do not break character.
          - Start by introducing yourself and checking the candidate's ID.`,
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log("Session opened");
            setStatus(SessionStatus.ACTIVE);
            
            // Connect input stream to processor
            if (!inputContextRef.current || !streamRef.current) return;
            
            const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
            source.connect(inputAnalyserRef.current!);
            
            // Use ScriptProcessor for raw PCM access (Standard for this API usage)
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch (e) {
                    console.error("Error sending audio input", e);
                  }
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
            
            // Save references to disconnect later
            (sessionPromise as any)._processor = processor;
            (sessionPromise as any)._source = source;
          },
          onmessage: async (msg: LiveServerMessage) => {
            handleServerMessage(msg);
          },
          onclose: () => {
            console.log("Session closed");
            if (status !== SessionStatus.FINISHED) {
                setStatus(SessionStatus.FINISHED);
            }
          },
          onerror: (err) => {
            console.error("Session error", err);
            setError("Connection error. Please ensure your microphone is working and try again.");
            setStatus(SessionStatus.ERROR);
            stopSession();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Could not access microphone or connect to AI. Please check permissions.");
      setStatus(SessionStatus.ERROR);
      stopSession();
    }
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    // 1. Handle Transcripts (Optional: Currently disabled in config to ensure connection stability)
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      currentOutputTransRef.current += text;
    } else if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      currentInputTransRef.current += text;
    }

    if (message.serverContent?.turnComplete) {
      // Commit transcriptions
      if (currentInputTransRef.current.trim()) {
        setTranscripts(prev => [...prev, {
          id: Date.now() + '-user',
          role: 'user',
          text: currentInputTransRef.current,
          timestamp: new Date(),
          isFinal: true
        }]);
        currentInputTransRef.current = '';
      }
      
      if (currentOutputTransRef.current.trim()) {
        setTranscripts(prev => [...prev, {
          id: Date.now() + '-examiner',
          role: 'examiner',
          text: currentOutputTransRef.current,
          timestamp: new Date(),
          isFinal: true
        }]);
        currentOutputTransRef.current = '';
      }
    }

    // 2. Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && outputContextRef.current) {
      try {
        // Handle time sync
        nextStartTime = Math.max(nextStartTime, outputContextRef.current.currentTime);
        
        const audioBuffer = await decodeAudioData(
          base64Decode(audioData),
          outputContextRef.current
        );

        const source = outputContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to analyser for visualization
        if (outputAnalyserRef.current) {
          source.connect(outputAnalyserRef.current);
          outputAnalyserRef.current.connect(outputContextRef.current.destination);
        } else {
          source.connect(outputContextRef.current.destination);
        }

        source.start(nextStartTime);
        nextStartTime += audioBuffer.duration;
        
        sourcesRef.current.add(source);
        source.onended = () => {
            sourcesRef.current.delete(source);
        };
      } catch (e) {
        console.error("Error decoding audio", e);
      }
    }

    // 3. Handle Interruptions
    if (message.serverContent?.interrupted) {
      sourcesRef.current.forEach(source => {
          try { source.stop(); } catch(e) {}
      });
      sourcesRef.current.clear();
      nextStartTime = 0;
    }
  };

  const stopSession = () => {
    // Close Live Session
    if (sessionRef.current) {
        sessionRef.current.then((session: any) => {
             // Disconnect audio nodes
            if ((sessionRef.current as any)._processor) {
                (sessionRef.current as any)._processor.disconnect();
                (sessionRef.current as any)._source.disconnect();
            }
            try { session.close(); } catch(e) {}
        });
    }

    // Stop tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close contexts
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    setStatus(SessionStatus.IDLE);
    setTranscripts([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">IELTS Speaking Simulation</h2>
          <p className="text-slate-500">Examiner: Mr. Sterling (AI)</p>
        </div>
        
        <div className="flex items-center gap-3">
          {status === SessionStatus.IDLE || status === SessionStatus.FINISHED || status === SessionStatus.ERROR ? (
            <button
              onClick={startSession}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-md transition-all active:scale-95"
            >
              <Play className="w-5 h-5" />
              Start Test
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-semibold transition-all active:scale-95"
            >
              <Square className="w-5 h-5 fill-current" />
              End Test
            </button>
          )}
        </div>
      </div>

      {/* Main Interaction Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">
        
        {/* Visualizer Panel */}
        <div className="md:col-span-2 bg-slate-900 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                 <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-500 via-slate-900 to-slate-900"></div>
            </div>

            {/* Status Indicators */}
            <div className="flex justify-between items-start z-10">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
                    status === SessionStatus.ACTIVE ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                    status === SessionStatus.CONNECTING ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                    {status === SessionStatus.CONNECTING && <Loader2 className="w-4 h-4 animate-spin" />}
                    {status === SessionStatus.ACTIVE && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                    {status === SessionStatus.IDLE && "Ready"}
                    {status === SessionStatus.CONNECTING && "Connecting..."}
                    {status === SessionStatus.ACTIVE && "Live Session"}
                    {status === SessionStatus.FINISHED && "Finished"}
                    {status === SessionStatus.ERROR && "Error"}
                </div>
            </div>

            {/* Visualizers */}
            <div className="space-y-6 z-10 mb-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                        <Volume2 className="w-4 h-4" /> Examiner (Output)
                    </div>
                    <AudioVisualizer 
                        analyser={outputAnalyserRef.current} 
                        isActive={status === SessionStatus.ACTIVE} 
                        color="#60a5fa" // blue-400
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                        <Mic className="w-4 h-4" /> You (Input)
                    </div>
                    <AudioVisualizer 
                        analyser={inputAnalyserRef.current} 
                        isActive={status === SessionStatus.ACTIVE} 
                        color="#34d399" // emerald-400
                    />
                </div>
            </div>

            {error && (
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-red-900/50 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 animate-in fade-in slide-in-from-bottom-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}
        </div>

        {/* Transcript / Notes Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Live Transcript</h3>
            </div>
            
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4"
              ref={scrollRef}
            >
                {transcripts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-2 p-4">
                        <Mic className="w-8 h-8 opacity-20" />
                        <p className="text-sm">Audio-only mode enabled for stability. Listen carefully!</p>
                    </div>
                ) : (
                    transcripts.map((t) => (
                        <div key={t.id} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] text-slate-400 mb-1 uppercase">
                                {t.role === 'user' ? 'You' : 'Examiner'}
                            </span>
                            <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm leading-relaxed ${
                                t.role === 'user' 
                                ? 'bg-primary-600 text-white rounded-tr-sm' 
                                : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                            }`}>
                                {t.text}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-sm">
        <div className="bg-blue-100 p-2 rounded-lg h-fit">
            <Volume2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
            <h4 className="font-semibold mb-1">Tip for best results</h4>
            <p className="text-blue-700/80">
                Use headphones to prevent the AI from hearing itself (echo). Speak clearly and naturally. 
                The AI is designed to pause when you speak and listen attentively.
            </p>
        </div>
      </div>
    </div>
  );
};