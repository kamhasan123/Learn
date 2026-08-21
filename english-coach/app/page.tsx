"use client";
import { useState } from "react";

export default function Home() {
  const [inputMode, setInputMode] = useState("voice"); 
  const [assessmentStarted, setAssessmentStarted] = useState(false);

  return (
    <main className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col lg:flex-row">
      <div className="w-full lg:w-[42%] bg-slate-900 border-b lg:border-r border-slate-800 p-6 md:p-8 flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold text-white">
          English <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Coach</span>
        </h1>
        <div className="bg-indigo-900/30 border border-indigo-500/30 p-4 rounded-xl">
          <h2 className="text-lg font-bold text-indigo-300">Curriculum Active</h2>
          <p className="text-sm text-slate-300">Progressing through the 30-Week Mastery Plan.</p>
        </div>
      </div>

      <div className="w-full lg:w-[58%] p-4 md:p-8 flex flex-col justify-center items-center bg-slate-950">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[650px]">
          
          <div className="flex border-b border-slate-800 bg-slate-900/90 p-2 gap-1 justify-center overflow-x-auto">
            <button onClick={() => setInputMode("voice")} className={`px-4 py-2 rounded-lg text-xs font-bold ${inputMode === "voice" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>🎤 Voice</button>
            <button onClick={() => setInputMode("typing")} className={`px-4 py-2 rounded-lg text-xs font-bold ${inputMode === "typing" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>⌨️ Typing</button>
            <button onClick={() => setInputMode("grammar")} className={`px-4 py-2 rounded-lg text-xs font-bold ${inputMode === "grammar" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>📝 Handwriting/Grammar</button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-center gap-6 text-center">
            {!assessmentStarted ? (
              <button onClick={() => setAssessmentStarted(true)} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full">
                Start Lesson
              </button>
            ) : (
              <div className="bg-slate-800 p-4 rounded-xl text-sm text-slate-200">
                AI: Please submit your text, voice recording, or upload a photo of your handwriting for analysis.
              </div>
            )}
          </div>

          {assessmentStarted && (
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              {inputMode === "voice" && (
                <button className="w-full py-4 bg-indigo-600 rounded-xl text-white font-bold text-sm">🎙️ Hold to Speak</button>
              )}
              {inputMode === "typing" && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Type..." className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" />
                  <button className="px-4 bg-indigo-600 text-white font-bold rounded-xl">Send</button>
                </div>
              )}
              {inputMode === "grammar" && (
                <div className="flex flex-col gap-2">
                  <textarea placeholder="Paste text here for grammar check..." className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white"></textarea>
                  <div className="flex justify-between items-center">
                    <input type="file" accept="image/*" className="text-xs text-slate-400" />
                    <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs">Analyze</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
