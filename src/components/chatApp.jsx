import { useState, useRef, useEffect } from 'react';
import { Mic, Send, MessageCircle, Volume2, Globe } from 'lucide-react';

function MessageBubble({ message, sender, detectedLang }) {
  return (
    <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`flex items-end gap-2 max-w-sm ${
          sender === 'user' ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {sender === 'bot' && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
        )}

        <div
          className={`px-4 py-3 rounded-3xl ${
            sender === 'user'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-none shadow-lg'
              : 'bg-white text-gray-900 rounded-bl-none border border-gray-200 shadow-md'
          }`}
        >
          <p className="text-sm leading-relaxed font-medium">{message}</p>
          {detectedLang && sender === 'user' && (
            <p className="text-xs mt-1.5 opacity-75 flex items-center gap-1">
              <Globe className="w-3 h-3" /> {detectedLang}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyraChat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! I'm Myra, your Travel Expert 🌍",
      sender: 'bot',
      timestamp: new Date(),
    },
    {
      id: 2,
      text: 'Speak in any language (Hindi, Telugu, Tamil, etc.) and I will respond in English. Let\'s plan your perfect trip!',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const base64 = await blobToBase64(blob);
        console.log('Audio ready:', base64.substring(0, 50) + '...');
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: text,
        sender: 'user',
        timestamp: new Date(),
      },
    ]);

    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      const responses = [
        '✨ That sounds amazing! I found some wonderful options for you.',
        '🎉 Perfect! Let me find the best deals and recommendations.',
        '🌟 Great choice! Here are my top suggestions for your trip.',
        '💫 Excellent! I have some exciting travel plans for you.',
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: randomResponse,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    }, 1200);
  };

  const formatTime = (seconds) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-5 shadow-xl border-b border-indigo-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <span className="text-2xl font-bold">✈️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Myra</h1>
              <p className="text-blue-100 text-xs font-medium">AI Travel Expert</p>
            </div>
          </div>
          <Volume2 className="w-5 h-5 opacity-75" />
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg.text}
            sender={msg.sender}
            detectedLang={msg.detectedLang}
          />
        ))}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="bg-white text-gray-900 px-4 py-3 rounded-3xl rounded-bl-none border border-gray-200 shadow-md">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-2.5 h-2.5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="w-2.5 h-2.5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-5 shadow-2xl">
        {isListening && (
          <div className="mb-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-300 rounded-xl p-3 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-700 font-bold text-sm">
                🎤 Recording: {formatTime(recordingTime)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isListening && sendMessage()}
              placeholder="Ask me about travel plans..."
              disabled={isListening}
              className="w-full border border-gray-300 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm placeholder-gray-400 transition-all"
            />
          </div>

          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isLoading}
            className={`flex-shrink-0 p-3 rounded-full text-white transition-all transform hover:scale-110 active:scale-95 ${
              isListening
                ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:shadow-lg'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Hold to record"
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading || isListening}
            className="flex-shrink-0 p-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg transition-all transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-3 font-medium">
          💬 Type or hold the mic to speak • 🌍 Works in any Indian language
        </p>
      </div>
    </div>
  );
}