'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'ai' | 'user';
  content: string;
  imageUrl?: string | null;
}

export default function InteractiveCoachPage() {
  const [activeTab, setActiveTab] = useState<'curriculum' | 'extraHelp' | 'placementTest' | 'typing'>('placementTest');
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  
  const [currentLevel, setCurrentLevel] = useState<string>('Beginner');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [progressPct, setProgressPct] = useState<number>(10);
  const [personalizedPlan, setPersonalizedPlan] = useState<string | null>(null); 
  const [mode, setMode] = useState<string>('curriculum');
  const [placementCompleted, setPlacementCompleted] = useState<boolean>(false);

  // 1. Load saved data when the app opens
  useEffect(() => {
    const savedLevel = localStorage.getItem('coachLevel');
    const savedWeek = localStorage.getItem('coachWeek');
    const savedDay = localStorage.getItem('coachDay');
    const savedPlan = localStorage.getItem('coachPlan');
    const savedPlacementDone = localStorage.getItem('coachPlacementDone');

    if (savedLevel) setCurrentLevel(savedLevel);
    if (savedWeek) setCurrentWeek(Number(savedWeek));
    if (savedDay) setCurrentDay(Number(savedDay));
    if (savedPlan) setPersonalizedPlan(savedPlan);
    
    if (savedPlacementDone === 'true') {
      setPlacementCompleted(true);
      setActiveTab('curriculum');
    } else {
      setActiveTab('placementTest');
    }
  }, []);

  // 2. Save data to memory whenever it changes
  useEffect(() => {
    localStorage.setItem('coachLevel', currentLevel);
    localStorage.setItem('coachWeek', currentWeek.toString());
    localStorage.setItem('coachDay', currentDay.toString());
    if (personalizedPlan) {
      localStorage.setItem('coachPlan', personalizedPlan);
    }
    localStorage.setItem('coachPlacementDone', placementCompleted.toString());
  }, [currentLevel, currentWeek, currentDay, personalizedPlan, placementCompleted]);
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load available browser voices for text-to-speech
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        if (availableVoices.length > 0 && !selectedVoice) {
          const defaultVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
          setSelectedVoice(defaultVoice.name);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [selectedVoice]);

  // 🗣️ Text-to-Speech Engine
  const speakText = (text: string) => {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/[*_~#-]/g, ''); 
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.90; 
    utterance.pitch = 1.10; 
    
    if (selectedVoice) {
      const voiceObj = voices.find(v => v.name === selectedVoice);
      if (voiceObj) utterance.voice = voiceObj;
    }
    
    window.speechSynthesis.speak(utterance);
  };

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
          currentDay,
          currentLevel,
          personalizedPlan,
          chatHistory: []
        }),
      });

      const data = await res.json();
      if (data.success) {
        const initialMsg = data.feedback || data.spokenReply || "Hello! Let's begin our lesson.";
        setMessages([{ role: 'ai', content: initialMsg, imageUrl: data.webImageUrl || data.imageUrl || null }]);
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

  const handleSendMessage = async (payloadContent: { text?: string; audio?: string; image?: string }) => {
    if (isLoading) return;

    let userDisplayText = payloadContent.text || "[Voice Message]";
    if (payloadContent.image) userDisplayText = "[Image Uploaded]";

    const newHistory = [...messages, { role: 'user' as const, content: userDisplayText, imageUrl: payloadContent.image || null }];

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
          image: payloadContent.image,
          currentLevel,
          currentWeek,
          currentDay,
          mode: activeTab,
          personalizedPlan,
          chatHistory: newHistory
        }),
      });

      const data = await res.json();
      if (data.success) {
        const aiMessage = data.feedback || data.nextChallenge;
        setMessages(prev => [...prev, { role: 'ai', content: aiMessage, imageUrl: data.webImageUrl || data.imageUrl || null }]);
        
        if (data.spokenReply || data.feedback) {
          speakText(data.spokenReply || data.feedback);
        }
        
        if (data.progressBump) setProgressPct(prev => Math.min(prev + data.progressBump, 100));
        
        if (data.detectedLevel) {
          setCurrentLevel(`Level ${data.detectedLevel}`);
          setPlacementCompleted(true);
          localStorage.setItem('coachPlacementDone', 'true');
          if (activeTab === 'placementTest') setActiveTab('curriculum'); 
        }
        
        if (data.newPersonalizedPlan) setPersonalizedPlan(data.newPersonalizedPlan);
      }
    } catch (err) {
      console.error("Error communicating with coach:", err);
      speakText("Let's try that again! Please repeat your response for me.");
      const errorMsg = "Let's try that again. Please repeat your response.";
      setMessages(prev => [...prev, { role: 'ai', content: errorMsg, imageUrl: null }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          handleSendMessage({ audio: reader.result as string });
          stream.getTracks().forEach(track => track.stop());
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => handleSendMessage({ image: reader.result as string });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0f19] text-white font-sans">
      <header className="px-6 pt-4 pb-0 border-b border-gray-800 bg-[#111827]">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <h1 className="text-lg font-bold">ENGLISH COACH - MR. HANDSOME</h1>
            <span className="text-xs px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 font-medium">
              Wk {currentWeek}, Day {currentDay}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {placementCompleted && (
              <button
                onClick={() => {
                  setActiveTab('placementTest');
                  setSessionActive(false);
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-yellow-400 border border-yellow-600/50 rounded-lg transition font-medium"
              >
                Retake Placement
              </button>
            )}
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-[#1f2937] border border-gray-700 text-xs text-gray-200 rounded p-1 max-w-[160px]"
            >
              {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
            <div className="text-xs px-3 py-1 bg-indigo-950 border border-indigo-800 rounded-lg text-indigo-300 font-bold">
              Level: {currentLevel}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-6 border-b border-gray-700 overflow-x-auto whitespace-nowrap">
          {!placementCompleted && (
            <button onClick={() => { setActiveTab('placementTest'); setSessionActive(false); }} className={`pb-2 text-sm font-medium ${activeTab === 'placementTest' ? 'border-b-2 border-yellow-500 text-yellow-400' : 'text-gray-400'}`}>
              🎯 Placement Test
            </button>
          )}
          <button onClick={() => { setActiveTab('curriculum'); setSessionActive(false); }} className={`pb-2 text-sm font-medium ${activeTab === 'curriculum' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400'}`}>
            📖 Daily Lesson
          </button>
          <button onClick={() => { setActiveTab('typing'); setSessionActive(false); }} className={`pb-2 text-sm font-medium ${activeTab === 'typing' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            ⌨️ Typing Practice
          </button>
          <button onClick={() => { setActiveTab('extraHelp'); setSessionActive(false); }} className={`pb-2 text-sm font-medium ${activeTab === 'extraHelp' ? 'border-b-2 border-green-500 text-green-400' : 'text-gray-400'}`}>
            🤝 Extra Help
          </button>
        </div>
      </header>

      {sessionActive && activeTab === 'curriculum' && (
        <div className="w-full bg-gray-800 h-1.5">
          <div className="bg-indigo-500 h-1.5 transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
        </div>
      )}

      {activeTab === 'curriculum' && personalizedPlan && (
        <div className="bg-indigo-900/40 border-b border-indigo-800 p-3 text-xs text-indigo-200 text-center">
          <span className="font-bold">Your Custom Path:</span> {personalizedPlan}
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-4xl w-full mx-auto">
        {!sessionActive ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div className="p-8 bg-[#111827] border border-gray-800 rounded-2xl shadow-xl max-w-md w-full space-y-4">
              <h2 className="text-xl font-bold">Ready to begin your session?</h2>
              <p className="text-gray-400 text-sm">Your coach is prepared with custom exercises, live audio corrections, and spoken guidance.</p>
              <button
                onClick={() => startSession(activeTab)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition shadow-lg shadow-indigo-600/30"
              >
                START {activeTab.toUpperCase()}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {messages.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-md ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-[#1f2937] border border-gray-700/60 text-gray-100 rounded-bl-none'}`}>
                  <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-bold">
                    {msg.role === 'user' ? 'You' : 'Coach'}
                  </span>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Upload" className="mt-3 rounded-xl max-h-64 object-cover w-full border border-gray-700" />
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
            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {sessionActive && (
        <footer className="sticky bottom-0 bg-[#111827] border-t border-gray-800 p-4">
          <div className="max-w-4xl mx-auto flex items-center space-x-2">
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400" title="Upload image">📸</button>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3 rounded-xl text-white transition ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
              title="Voice input"
            >
              🎙️
            </button>

            <input 
              type="text" 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && inputText.trim()) {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  handleSendMessage({ text: inputText });
                }
              }}
              placeholder="Type your message or response..." 
              className="flex-1 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
            
            <button 
              onClick={() => {
                if (inputText.trim()) {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  handleSendMessage({ text: inputText });
                }
              }}
              disabled={isLoading || !inputText.trim()}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium text-sm transition shadow-lg shadow-indigo-600/20"
            >
              Send
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
