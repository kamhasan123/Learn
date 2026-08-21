"use client";
import { useState, useRef, FormEvent } from "react";

export default function Home() {
  const [inputMode, setInputMode] = useState("voice"); 
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", content: "Welcome! Please submit your text, voice recording, or snap a photo of your handwriting for analysis." }
  ]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Robust function to handle sending messages and files
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault(); // Prevents page reload if triggered by the Enter key

    console.log("Attempting to send message. Input text:", inputText, "File:", selectedFileName);

    if (!inputText.trim() && !selectedFileName) {
      console.log("Message blocked: No text or file provided.");
      return;
    }

    // Add user message to UI
    const userContent = selectedFileName ? `[Attached File: ${selectedFileName}] ${inputText}` : inputText;
    const newMessages = [...messages, { role: "user", content: userContent }];
    
    setMessages(newMessages);
    setInputText("");
    setSelectedFileName(null);
    setIsLoading(true);

    try {
      console.log("Sending request to /api/analyze...");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userContent, type: inputMode }),
      });

      console.log("Response received. Status:", response.status);
      const data = await response.json();

      if (data.success) {
        setMessages([...newMessages, { role: "ai", content: data.feedback }]);
      } else {
        setMessages([...newMessages, { role: "ai", content: "Oops, the AI returned an error: " + (data.message || "Unknown error") }]);
      }
    } catch (error) {
      console.error("Critical Network Error:", error);
      setMessages([...newMessages, { role: "ai", content: "Network error. Please check your terminal to ensure the server is running." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mobile camera and file uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFileName(e.target.files[0].name);
      console.log("File selected:", e.target.files[0].name);
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
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[650px] relative">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/90 p-2 gap-1 justify-center z-10">
            <button onClick={() => setInputMode("voice")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${inputMode === "voice" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800"}`}>🎤 Voice</button>
            <button onClick={() => setInputMode("typing")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${inputMode === "typing" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800"}`}>⌨️ Typing</button>
            <button onClick={() => setInputMode("grammar")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${inputMode === "grammar" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800"}`}>📝 Handwriting</button>
          </div>

          {/* Chat History Area */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-slate-950/40 pb-32">
            {!assessmentStarted ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <button onClick={() => setAssessmentStarted(true)} className="px-8 py-3 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold rounded-full shadow-lg shadow-emerald-500/20 transition-all">
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
              <div className="self-start text-xs text-emerald-400 animate-pulse mt-2 ml-10">AI is thinking...</div>
            )}
          </div>

          {/* Input Controls */}
          {assessmentStarted && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              {inputMode === "typing" && (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" 
                  />
                  <button type="submit" disabled={isLoading} className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                    Send
                  </button>
                </form>
              )}

              {inputMode === "grammar" && (
                <div className="flex flex-col gap-3">
                  {selectedFileName && (
                    <div className="text-xs text-emerald-400 flex items-center gap-2">
                      <span>📸 {selectedFileName} attached</span>
                      <button onClick={() => setSelectedFileName(null)} className="text-slate-500 hover:text-red-400">✖</button>
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 flex flex-col gap-2">
                      <textarea 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type text or upload a photo of your handwriting..."
                        className="w-full h-14 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                      />
                      {/* Mobile Camera / File Input Trigger */}
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="self-start px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 border border-slate-700"
                      >
                        📷 Open Camera
                      </button>
                    </div>
                    <button onClick={() => handleSendMessage()} disabled={isLoading} className="h-14 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                      Send
                    </button>
                  </div>
                </div>
              )}

              {inputMode === "voice" && (
                <button className="w-full py-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 font-bold text-sm">
                  🎙️ Hold to Speak (Requires Audio API setup)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
