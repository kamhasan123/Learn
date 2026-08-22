'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'ai' | 'user';
  content: string;
  imageUrl?: string | null;
}

export default function InteractiveCoachPage() {
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentLevel, setCurrentLevel] = useState<string>('Beginner');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [mode, setMode] = useState<string>('curriculum');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load available browser voices for text-to-speech
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        if (availableVoices.length > 0 && !selectedVoice) {
          // Default to a natural English voice if possible
          const defaultVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
          setSelectedVoice(defaultVoice.name);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Function to trigger browser text-to-speech for voice feedback
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      if (selectedVoice) {
        const voiceObj = voices.find(v => v.name === selectedVoice);
        if (voiceObj) {
          utterance.voice = voiceObj;
        }
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  // Start session and fetch the initial greeting immediately
  const startSession = async (selectedMode = 'curriculum') => {
    setSessionActive(true);
    setMode(selectedMode);
    setIsLoading(true);
    setMessages([]);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isInitialGreeting: true,
          mode: selectedMode,
          currentWeek,
          currentLevel,
          chatHistory: []
        }),
      });

      const data = await res.json();
      if (data.success) {
        const initialMsg = data.feedback || data.spokenReply || "Hello! Let's begin our lesson.";
        setMessages([{ role: 'ai', content: initialMsg, imageUrl: data.imageUrl || null }]);
        speakText(data.spokenReply || initialMsg);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      const fallbackMsg = "Welcome! Let's start our lesson. What would you like to say?";
      setMessages([{ role: 'ai', content: fallbackMsg, imageUrl: null }]);
      speakText(fallbackMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Send user message (text or voice) to backend
  const handleSendMessage = async (payloadContent: { text?: string; audio?: string }) => {
    if (isLoading) return;

    const userDisplayText = payloadContent.text || "[Voice Message]";
    const newHistory = [...messages, { role: 'user' as const, content: userDisplayText, imageUrl: null }];
    setMessages(newHistory);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: payloadContent.text,
          audio: payloadContent.audio,
          currentLevel,
          currentWeek,
          mode,
          chatHistory: newHistory
        }),
      });

      const data = await res.json();
      if (data.success) {
        const aiMessage = data.feedback || data.nextChallenge;
        setMessages(prev => [...prev, { role: 'ai', content: aiMessage, imageUrl: data.imageUrl || null }]);
        
        // Speak response out loud using the selected voice
        if (data.spokenReply) {
          speakText(data.spokenReply);
        }

        if (data.detectedLevel) {
          setCurrentLevel(data.detectedLevel);
        }
      }
    } catch (err) {
      console.error("Error communicating with coach:", err);
      const errorMsg = "Let's try that again. Please repeat your response.";
      setMessages(prev => [...prev, { role: 'ai', content: errorMsg, imageUrl: null }]);
      speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice recording handlers
  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage({ audio: base64Audio });
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or unavailable:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0f19] text-white font-sans">
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#111827] gap-3">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          <h1 className="text-lg font-semibold tracking-wide">ENGLISH COACH</h1>
        </div>
        
        {/* Voice Selection Dropdown */}
        <div className="flex items-center space-x-3">
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="bg-[#1f2937] border border-gray-700 text-xs text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[180px]"
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <div className="text-sm px-3 py-1 bg-indigo-950 border border-indigo-800 rounded-full text-indigo-300">
            {currentLevel}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-4xl w-full mx-auto">
        {!sessionActive ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div className="p-8 bg-[#111827] border border-gray-800 rounded-2xl shadow-xl max-w-md w-full space-y-4">
              <h2 className="text-xl font-bold">Ready to begin your session?</h2>
              <p className="text-gray-400 text-sm">Your coach is prepared with custom exercises, live audio corrections, and spoken guidance.</p>
              <button
                onClick={() => startSession('curriculum')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition shadow-lg shadow-indigo-600/30"
              >
                START INTERACTIVE SESSION
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-md ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-[#1f2937] border border-gray-700/60 text-gray-100 rounded-bl-none'
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-bold">
                    {msg.role === 'user' ? 'You' : 'Coach'}
                  </span>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Lesson visual"
                      className="mt-3 rounded-xl max-h-64 object-cover w-full border border-gray-700"
                    />
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start">
                <div className="bg-[#1f2937] border border-gray-700/60 rounded-2xl px-5 py-3.5 text-sm text-gray-400 animate-pulse">
                  Coach is analyzing your speech and structuring feedback...
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Input Footer Bar */}
      {sessionActive && (
        <footer className="sticky bottom-0 bg-[#111827] border-t border-gray-800 p-4">
          <div className="max-w-4xl mx-auto flex items-center space-x-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputText.trim() && !isLoading) {
                  handleSendMessage({ text: inputText.trim() });
                }
              }}
              placeholder="Type your answer, or hold mic to speak..."
              className="flex-1 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              disabled={isLoading}
            />
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center space-x-2 transition select-none ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/40'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
              }`}
              title="Hold to speak"
            >
              <span>{isRecording ? 'RECORDING...' : 'HOLD TO SPEAK'}</span>
            </button>
            <button
              onClick={() => {
                if (inputText.trim() && !isLoading) {
                  handleSendMessage({ text: inputText.trim() });
                }
              }}
              disabled={isLoading || !inputText.trim()}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
