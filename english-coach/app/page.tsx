'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'ai' | 'user';
  content: string;
  imageUrl?: string | null;
}

export default function InteractiveCoachPage() {
  const [activeTab, setActiveTab] = useState<'curriculum' | 'typing' | 'extraHelp'>('curriculum');
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Progress & State
  const [currentLevel, setCurrentLevel] = useState<string>('Beginner');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [progressPct, setProgressPct] = useState<number>(10);
  const [personalizedPlan, setPersonalizedPlan] = useState<string | null>(null);
  const [mode, setMode] = useState<string>('curriculum');
  const [placementCompleted, setPlacementCompleted] = useState<boolean>(false);

  // Load saved progress when app opens
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
    } else {
      // If never taken, start on placement test mode
      setMode('placementTest');
    }
  }, []);

  // Save data to memory whenever it changes
  useEffect(() => {
    localStorage.setItem('coachLevel', currentLevel);
    localStorage.setItem('coachWeek', currentWeek.toString());
    localStorage.setItem('coachDay', currentDay.toString());
    if (personalizedPlan) localStorage.setItem('coachPlan', personalizedPlan);
    localStorage.setItem('coachPlacementDone', placementCompleted.toString());
  }, [currentLevel, currentWeek, currentDay, personalizedPlan, placementCompleted]);

  const startSession = async (targetMode: string) => {
    setMode(targetMode);
    setActiveTab(targetMode === 'typing' ? 'typing' : targetMode === 'extraHelp' ? 'extraHelp' : 'curriculum');
    setSessionActive(true);
    setIsLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isInitialGreeting: true,
          mode: targetMode,
          currentLevel,
          currentWeek,
          currentDay,
          personalizedPlan
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessages([{ role: 'ai', content: data.feedback, imageUrl: data.webImageUrl }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !isLoading) return;
    const userMsg = inputText;
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMsg,
          mode,
          currentLevel,
          currentWeek,
          currentDay,
          personalizedPlan,
          chatHistory: messages
        })
      });
      const data = await res.json();
      if (data.success) {
        if (mode === 'placementTest' && data.detectedLevel) {
          setCurrentLevel(`Level ${data.detectedLevel}`);
          if (data.newPersonalizedPlan) setPersonalizedPlan(data.newPersonalizedPlan);
          setPlacementCompleted(true);
          localStorage.setItem('coachPlacementDone', 'true');
        }
        if (data.progressBump) {
          setProgressPct(prev => Math.min(100, prev + data.progressBump));
        }
        setMessages(prev => [...prev, { role: 'ai', content: data.feedback, imageUrl: data.webImageUrl }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>English Coach - Mr. Handsome</h2>
        <div>
          <span style={{ marginRight: '15px' }}><b>{currentLevel}</b> (Wk {currentWeek}, Day {currentDay})</span>
          {placementCompleted && (
            <button 
              onClick={() => startSession('placementTest')}
              style={{ padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Retake Placement Test
            </button>
          )}
        </div>
      </div>

      {!sessionActive ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#f9fafb', borderRadius: '8px' }}>
          <h3>Welcome back! Pick up where you left off.</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
            {!placementCompleted && (
              <button onClick={() => startSession('placementTest')} style={{ padding: '10px 20px', fontSize: '16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Take Placement Test
              </button>
            )}
            <button onClick={() => startSession('curriculum')} style={{ padding: '10px 20px', fontSize: '16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Continue Daily Lesson (Week {currentWeek}, Day {currentDay})
            </button>
            <button onClick={() => startSession('typing')} style={{ padding: '10px 20px', fontSize: '16px', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Typing Practice
            </button>
            <button onClick={() => startSession('extraHelp')} style={{ padding: '10px 20px', fontSize: '16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Extra Help / Homework
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button onClick={() => startSession('curriculum')} style={{ background: mode === 'curriculum' ? '#16a34a' : '#e5e7eb', color: mode === 'curriculum' ? '#fff' : '#000', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Daily Lesson</button>
            <button onClick={() => startSession('typing')} style={{ background: mode === 'typing' ? '#9333ea' : '#e5e7eb', color: mode === 'typing' ? '#fff' : '#000', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Typing</button>
            <button onClick={() => startSession('extraHelp')} style={{ background: mode === 'extraHelp' ? '#d97706' : '#e5e7eb', color: mode === 'extraHelp' ? '#fff' : '#000', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Extra Help</button>
            <button onClick={() => setSessionActive(false)} style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Home Menu</button>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', height: '400px', overflowY: 'scroll', padding: '15px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#eff6ff' : '#f3f4f6', padding: '10px 14px', borderRadius: '8px', maxWidth: '75%' }}>
                <p style={{ margin: 0 }}>{m.content}</p>
                {m.imageUrl && <img src={m.imageUrl} alt="visual aid" style={{ marginTop: '10px', maxWidth: '100%', borderRadius: '6px' }} />}
              </div>
            ))}
            {isLoading && <p style={{ color: '#6b7280', fontStyle: 'italic' }}>Mr. Handsome is typing...</p>}
          </div>

          <div style={{ display: 'flex', marginTop: '15px', gap: '10px' }}>
            <input 
              type="text" 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder="Type your response..." 
              style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
            <button onClick={handleSend} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
