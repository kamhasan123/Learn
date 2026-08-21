"use client";

import { useState } from "react";

export default function Home() {
  const [inputMode, setInputMode] = useState("voice"); // Toggles between Voice and Typing
  const [assessmentStarted, setAssessmentStarted] = useState(false);

  return (
    <main className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col lg:flex-row">
      
      {/* Left Side - Dashboard */}
      <div className="w-full lg:w-[42%] bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-6 md:p-8 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl shadow-lg flex items-center justify-center">
            <span className="text-xl">🗣️</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            English <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Coach</span>
          </h1>
        </div>

        <div className="bg-indigo-900/30 border border-indigo-500/30 p-5 rounded-2xl">
          <h2 className="text-lg font-bold text-indigo-300 mb-2">Week 1: Baseline Assessment</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Before we generate your custom curriculum, the AI needs to gauge your current fluency level. This 2-minute diagnostic will test your vocabulary, sentence structure, and pronunciation.
          </p>
        </div>

        {/* Progress Tracker Placeholder */}
        <div className="flex flex-col gap-3 mt-auto">
           <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">30-Week Plan Progress</h2>
           <div className="w-full bg-slate-800 rounded-full h-2.5">
              <div className="bg-gradient-to-r from-emerald-400 to-cyan-500 h-2.5 rounded-full" style={{ width: '2%' }}></div>
           </div>
           <p className="text-xs text-slate-500 text-right">Day 1 / 210</p>
        </div>
      </div>

      {/* Right Side - Interactive Diagnostic Engine */}
      <div className="w-full lg:w-[58%] p-4 md:p-8 flex flex-col justify-center items-center bg-slate-950">
        
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[650px]">

          {/* Mode Toggle Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/90 p-2 gap-2 justify-center">
            <button 
              onClick={() => setInputMode("voice")}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inputMode === "voice" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800"}`}
            >
              🎤 Voice Chat
            </button>
            <button 
              onClick={() => setInputMode("typing")}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inputMode === "typing" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800"}`}
            >
              ⌨️ Typing
            </button>
          </div>

          {/* Chat / Assessment Area */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-center gap-6 bg-slate-950/40 text-center">
            
            {!assessmentStarted ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 shadow-xl mb-2">
                  <span className="text-4xl">🤖</span>
                </div>
                <h3 className="text-xl font-bold text-white">Ready for your Diagnostic?</h3>
                <p className="text-sm text-slate-400 max-w-xs">
                  The AI will ask you to introduce yourself and describe a recent hobby or activity. 
                </p>
                <button 
                  onClick={() => setAssessmentStarted(true)}
                  className="mt-4 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full transition-all shadow-lg shadow-emerald-500/20"
                >
                  Start Diagnostic
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-4">
                <div className="flex gap-2.5 max-w-[90%]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md">
                    AI
                  </div>
                  <div className="bg-slate-800 border border-slate-700/60 p-4 rounded-2xl rounded-tl-none text-slate-200 text-sm leading-relaxed shadow-sm text-left">
                    Welcome! Let's get started. Please tell me your name, and describe what you like to do for fun. Try to speak as naturally as possible.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Control Area (Changes based on selected tab) */}
          {assessmentStarted && (
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col items-center justify-center">
              {inputMode === "voice" ? (
                <button className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 animate-pulse">
                  <span>🎙️</span> Hold to Record Audio
                </button>
              ) : (
                <div className="w-full flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Type your response here..." 
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors">
                    Send
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
