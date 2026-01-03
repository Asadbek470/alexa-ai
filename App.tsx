
import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, ShieldCheck, LogOut, UserCircle, Search, Sparkles, LogIn, ChevronRight } from 'lucide-react';
import { Message } from './types';
import { ChatMessage } from './components/ChatMessage';
import { chatWithAlexa, generateSpeech, playRawAudio } from './services/gemini';

const App: React.FC = () => {
  const [user, setUser] = useState<string | null>(localStorage.getItem('alexa_user'));
  const [loginInput, setLoginInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('alexa_chat_history');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        role: 'assistant',
        text: 'Привет! Я Алекса. Как ваши дела? Я готова ответить на любой ваш вопрос.',
        timestamp: Date.now(),
      }
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('alexa_chat_history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'ru-RU';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInput.trim()) {
      setUser(loginInput);
      localStorage.setItem('alexa_user', loginInput);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('alexa_user');
    localStorage.removeItem('alexa_chat_history');
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      text: 'До встречи! Возвращайтесь поскорее.',
      timestamp: Date.now(),
    }]);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleSendMessage = async (textToSubmit?: string) => {
    const text = textToSubmit || inputText;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const response = await chatWithAlexa(text, history);
      const assistantText = response.text || "Простите, я задумалась. Спросите еще раз?";
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Источник',
        uri: chunk.web?.uri || ''
      })).filter((s: any) => s.uri !== '');

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: assistantText,
        timestamp: Date.now(),
        sources: sources,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (ttsEnabled && assistantText) {
        setIsSpeaking(true);
        const audioData = await generateSpeech(assistantText);
        if (audioData) await playRawAudio(audioData);
        setIsSpeaking(false);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: "Что-то пошло не так с сервером. Попробуйте обновить страницу.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4 bg-[#050507]">
        <div className="w-full max-w-sm glass-panel p-10 rounded-[40px] shadow-2xl animate-in fade-in zoom-in duration-700">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-24 h-24 alexa-gradient rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/20 mb-8 transform hover:rotate-6 transition-transform">
              <Sparkles size={48} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Alexa</h1>
            <p className="text-zinc-500 text-sm font-medium">Ваш новый стандарт общения с ИИ</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative group">
              <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-cyan-400 transition-colors" size={20} />
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Как вас зовут?"
                className="w-full bg-zinc-900/50 border border-zinc-800 text-white rounded-2xl py-5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-zinc-600"
              />
            </div>
            <button
              type="submit"
              className="w-full alexa-gradient hover:scale-[1.02] text-white font-bold py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 group active:scale-[0.98]"
            >
              Начать общение
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
          
          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-full">
              <ShieldCheck size={14} className="text-cyan-500" />
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                Created by Asadbek
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-transparent overflow-hidden">
      {/* Premium Header */}
      <header className="flex items-center justify-between px-8 py-6 glass-panel z-20 mt-4 mx-4 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-14 h-14 rounded-2xl alexa-gradient flex items-center justify-center shadow-lg transition-all ${isSpeaking ? 'voice-active scale-105' : ''}`}>
              <Sparkles size={28} className="text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-2xl text-white tracking-tight">Alexa</h1>
              <span className="text-[9px] bg-cyan-500 text-white font-black px-2 py-0.5 rounded-md uppercase">Live</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium">
              Ассистент {user} • <span className="text-cyan-500">Онлайн</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`p-3 rounded-2xl transition-all ${ttsEnabled ? 'text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20' : 'text-zinc-500 hover:bg-zinc-800'}`}
          >
            {ttsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
          <button 
            onClick={handleLogout}
            className="p-3 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all"
            title="Выйти"
          >
            <LogOut size={24} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-10 space-y-4 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto w-full">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full alexa-gradient flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="glass-panel px-6 py-4 rounded-3xl rounded-tl-none border-white/10">
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="p-8 mb-4 mx-4 glass-panel rounded-[40px]">
        <div className="max-w-3xl mx-auto">
          <div className={`relative flex items-center gap-4 bg-zinc-900/50 p-2 pl-6 rounded-[28px] border border-white/5 transition-all focus-within:border-cyan-500/50 focus-within:ring-4 focus-within:ring-cyan-500/10 ${isListening ? 'ring-4 ring-cyan-500/20 border-cyan-500 shadow-2xl shadow-cyan-500/20' : ''}`}>
            <Search size={22} className="text-zinc-500" />
            <input
              type="text"
              autoFocus
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isListening ? "Слушаю ваш вопрос..." : "Спросите о чем угодно у Алексы..."}
              className="flex-1 bg-transparent border-none text-white py-5 text-lg focus:outline-none placeholder-zinc-600"
            />
            
            <div className="flex items-center gap-2 pr-2">
              <button
                onClick={toggleListening}
                className={`p-4 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white shadow-xl shadow-red-500/30' : 'text-zinc-500 hover:text-cyan-400 hover:bg-cyan-400/10'}`}
              >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                className={`p-4 rounded-2xl transition-all ${inputText.trim() ? 'alexa-gradient text-white shadow-xl shadow-cyan-500/30' : 'text-zinc-800 bg-zinc-800/20'}`}
              >
                <Send size={24} />
              </button>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center px-4">
             <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-black">Powered by Asadbek</span>
             <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-black">2026 Edition</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
