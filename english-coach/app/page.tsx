"use client";
import { useState } from "react";

export default function Home() {
  const [inputMode, setInputMode] = useState("voice"); 
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "Welcome! Please submit your text, voice recording, or upload a photo of your handwriting for analysis." }
  ]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // 1. Add user message to the screen
    const newMessages = [...messages, { role: "user", content: inputText }];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);

    try {
      // 2. Send the message to your new OpenAI backend
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, type: inputMode }),
      });

      const data = await response.json();

      // 3. Display the AI's response
      if (data.success) {
        setMessages([...newMessages, { role: "ai", content: data.feedback }]);
      } else {
        setMessages([...newMessages, { role: "ai", content: "Oops, I had trouble connecting to the AI." }]);
      }
    } catch (error) {
      setMessages([...newMessages, { role: "ai", content: "Network error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col lg:flex-row">
      {/* Left Side Dashboard */}
      <div className="w-full lg:w-[42%] bg-slate-900 border-b lg:border-r border-slate-800 p-6 flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold text-white">
          English <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Coach</span>
        </h1>
        <div className="bg-indigo-900/30 border border-indigo-500/30 p-4 rounded-xl">
          <h2 className="text-lg font-bold text-indigo-300">Curriculum Active</h2>
          <p className="text-sm text-slate-300">Progressing through the 30-Week Mastery Plan.</p>
        </div>
      </div>

      {/* Right Side Chat Interface */}
      <div className="w-full lg:w-[58%] p-4 flex flex-col justify-center items-center bg-slate-950">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[650px]">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/90 p-2 gap-1 justify-center">
            <button onClick={() => setInputMode("voice")} className={`px-4 py-2 rounded-lg text-xs font-bold ${inputMode === "voice" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>🎤 Voice</button>
            <button onClick={() => setInputMode("typing")} className={`px-4 py-2 rounded-lg text-xs font-bold ${inputMode === "typing" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>⌨️ Typing</button>
            <button onClick={() => setInputMode("grammar")} className={`px-4 py-2 rounded-lg text-xs font-bold ${inputMode === "grammar" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>📝 Grammar</button>
          </div>

          {/* Chat History Area */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-slate-950/40">
            {!assessmentStarted ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <button onClick={() => setAssessmentStarted(true)} className="px-8 py-3 bg-emerald-500 text-slate-950 font-bold rounded-full">
                  Start Lesson
                </button>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`flex gap-2.5 max-w-[85%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ${msg.role === "user" ? "bg-slate-700" : "bg-gradient-to-tr from-indigo-500 to-cyan-500"}`}>
                    {msg.role === "user" ? "You" : "AI"}
                  </div>
                  <div className={`p-3 rounded-xl text-xs leading-relaxed shadow-sm ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-800 border border-slate-700/60 text-slate-200 rounded-tl-none"}`}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="self-start text-xs text-emerald-400 animate-pulse mt-2">AI is typing...</div>
            )}
          </div>

          {/* Input Controls */}
          {assessmentStarted && (
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              {inputMode === "typing" || inputMode === "grammar" ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={inputMode === "grammar" ? "Type a sentence to check grammar..." : "Type your message..."}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" 
                  />
                  <button onClick={handleSendMessage} className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors">
                    Send
                  </button>
                </div>
              ) : (
                <button className="w-full py-4 bg-indigo-600 rounded-xl text-white font-bold text-sm">🎙️ Hold to Speak (Coming Soon)</button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
