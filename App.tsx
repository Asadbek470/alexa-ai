
import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, ShieldCheck, LogOut, UserCircle, Search, Sparkles, LogIn, ChevronRight, Activity } from 'lucide-react';
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
        text: 'Приветствую! Я Алекса. Готова помочь вам с любыми задачами. Чем займемся?',
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
    if (user) {
      localStorage.setItem('alexa_chat_history', JSON.stringify(messages));
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, user]);

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
      text: 'Сессия завершена. Всегда рада помочь!',
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
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const response = await chatWithAlexa(text, history);
      const assistantText = response.text || "Извините, возникла ошибка связи. Повторите запрос.";
      
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
        text: "Ошибка сервера. Проверьте настройки API ключа.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4 bg-[#020203]">
        <div className="w-full max-w-sm glass-panel p-10 rounded-[48px] shadow-[0_32px_64px_rgba(0,0,0,0.5)] border-white/5 animate-in fade-in zoom-in duration-1000">
          <div className="flex flex-col items-center text-center mb-12">
            <div className="w-28 h-28 alexa-gradient rounded-[36px] flex items-center justify-center shadow-2xl shadow-cyan-500/20 mb-8 relative">
              <Sparkles size={48} className="text-white animate-pulse" />
              <div className="absolute -inset-4 bg-cyan-500/10 blur-3xl -z-10 rounded-full"></div>
            </div>
            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">Alexa</h1>
            <div className="h-1 w-12 bg-cyan-500 rounded-full mb-4 mx-auto"></div>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed">
              Ваш персональный интеллект,<br/>созданный <span className="text-white font-bold">Asadbek</span>
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <UserCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-cyan-400 transition-all" size={22} />
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Представьтесь"
                className="w-full bg-zinc-900/40 border border-white/5 text-white rounded-[24px] py-6 pl-14 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30 transition-all placeholder-zinc-700 text-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full alexa-gradient hover:brightness-110 active:scale-[0.97] text-white font-black py-6 rounded-[24px] transition-all shadow-2xl shadow-cyan-500/10 flex items-center justify-center gap-3 group text-lg"
            >
              Войти в систему
              <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
          
          <div className="mt-12 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900/80 rounded-full border border-white/5 shadow-inner">
              <ShieldCheck size={14} className="text-cyan-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">
                Unlimited by Asadbek
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto bg-transparent overflow-hidden px-4 py-4 lg:py-8">
      {/* Premium Header */}
      <header className="flex items-center justify-between px-8 py-5 glass-panel z-20 rounded-[32px] border-white/5 shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className={`w-16 h-16 rounded-[22px] alexa-gradient flex items-center justify-center shadow-lg transition-all duration-500 ${isSpeaking ? 'voice-active scale-110' : ''}`}>
              <Activity size={32} className={`text-white transition-all ${isSpeaking ? 'animate-pulse' : ''}`} />
            </div>
            {isSpeaking && <div className="absolute -inset-2 bg-cyan-500/20 blur-xl rounded-full -z-10 animate-pulse"></div>}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-black text-2xl text-white tracking-tighter">Alexa</h1>
              <span className="text-[10px] bg-cyan-500 text-white font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-lg shadow-cyan-500/20">Active</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-bold mt-1">
              Сессия для <span className="text-white">{user}</span> • <span className="text-cyan-400">Stable v2.5</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`p-3.5 rounded-2xl transition-all duration-300 ${ttsEnabled ? 'text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/10 border border-cyan-400/10' : 'text-zinc-600 hover:bg-zinc-900 border border-transparent'}`}
            title={ttsEnabled ? "Голос включен" : "Голос выключен"}
          >
            {ttsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
          <button 
            onClick={handleLogout}
            className="p-3.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all border border-transparent hover:border-red-400/10"
            title="Выйти из профиля"
          >
            <LogOut size={24} />
          </button>
        </div>
      </header>

      {/* Message Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 lg:px-20 py-12 space-y-6 scroll-smooth scrollbar-hide"
      >
        <div className="max-w-4xl mx-auto w-full">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-10 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-[14px] alexa-gradient flex items-center justify-center animate-pulse">
                  <Activity size={20} className="text-white" />
                </div>
                <div className="glass-panel px-7 py-5 rounded-[24px] rounded-tl-none border-white/10 shadow-xl">
                  <div className="flex gap-2.5">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Futuristic Input Area */}
      <footer className="p-4 lg:p-8 mb-4">
        <div className="max-w-4xl mx-auto relative">
          <div className={`relative flex items-center gap-4 glass-panel p-3 pl-8 rounded-[36px] border-white/5 transition-all duration-500 shadow-2xl ${isListening ? 'ring-4 ring-cyan-500/20 border-cyan-500/50 scale-[1.02] shadow-cyan-500/10' : 'focus-within:border-cyan-500/30'}`}>
            <Search size={24} className={`transition-colors duration-300 ${isListening ? 'text-cyan-400' : 'text-zinc-600'}`} />
            <input
              type="text"
              autoFocus
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isListening ? "Слушаю вас внимательно..." : "Напишите сообщение..."}
              className="flex-1 bg-transparent border-none text-white py-5 text-xl focus:outline-none placeholder-zinc-700 font-medium"
            />
            
            <div className="flex items-center gap-3 pr-3">
              <button
                onClick={toggleListening}
                className={`p-5 rounded-[24px] transition-all duration-300 ${isListening ? 'bg-red-500 text-white shadow-xl shadow-red-500/30 scale-110' : 'text-zinc-500 hover:text-cyan-400 hover:bg-cyan-400/5'}`}
              >
                {isListening ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                className={`p-5 rounded-[24px] transition-all duration-500 ${inputText.trim() ? 'alexa-gradient text-white shadow-xl shadow-cyan-500/40 active:scale-90' : 'text-zinc-800 bg-zinc-900/50'}`}
              >
                <Send size={26} />
              </button>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between items-center px-8 opacity-40 hover:opacity-100 transition-opacity">
             <span className="text-[9px] text-zinc-400 uppercase tracking-[0.4em] font-black">Developed by Asadbek</span>
             <div className="flex gap-4">
                <span className="text-[9px] text-zinc-400 uppercase tracking-[0.4em] font-black">Free Access</span>
                <span className="text-[9px] text-zinc-400 uppercase tracking-[0.4em] font-black">2026</span>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
