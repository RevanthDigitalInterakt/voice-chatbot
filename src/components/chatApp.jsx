import { useState, useRef, useEffect } from 'react';
import { sendAudioToBhashini } from '../services/bhashiniService';
import { convertToWav, blobToBase64, validateAudioBlob } from '../components/utils/audioUtils';
const Mic = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

const Send = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
  </svg>
);

function MessageBubble({ message, sender, isNew }) {
  return (
    <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4 ${isNew ? 'animate-fade-in' : ''}`}>
      <div className={`flex items-end gap-3 max-w-[85%] ${sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        {sender === 'bot' && (
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-purple-500/30">
            <span className="text-lg">✈️</span>
          </div>
        )}
        <div className={`px-5 py-3.5 ${
          sender === 'user'
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white rounded-2xl rounded-br-sm shadow-xl shadow-purple-500/20'
            : 'bg-white/80 backdrop-blur-xl text-gray-800 rounded-2xl rounded-bl-sm border border-white/50 shadow-xl shadow-gray-200/50'
        }`}>
          <p className="text-[15px] leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default function MyraChat() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hey there! I'm Siara ✨", sender: 'bot' },
    { id: 2, text: "Your personal AI companion. Speak in any Indian language! 🌏", sender: 'bot' },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('te');
  
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    // Prevent starting a new recording if already recording
    if (isListening || isStoppingRef.current) {
      console.log('Already recording or stopping, ignoring start request');
      return;
    }

    try {
      setError(null);
      isStoppingRef.current = false;
      
      console.log('🎤 Starting recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      
      console.log('Using MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          console.log('Audio chunk received, size:', e.data.size);
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...');
        console.log('Total chunks collected:', audioChunksRef.current.length);
        
        // Small delay to ensure all chunks are collected
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          setIsTranscribing(true);
          
          if (audioChunksRef.current.length === 0) {
            console.error('No audio chunks collected!');
            setError("Recording failed - no audio data captured");
            return;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('Created audio blob:', {
            size: audioBlob.size,
            type: audioBlob.type,
            chunks: audioChunksRef.current.length
          });
          
          validateAudioBlob(audioBlob);
          
          console.log('Converting to WAV format...');
          const wavBlob = await convertToWav(audioBlob);
          
          console.log('Converting to base64...');
          const base64Audio = await blobToBase64(wavBlob);
          
          console.log('Sending to Bhashini API...');
          const transcribedText = await sendAudioToBhashini(base64Audio, selectedLanguage);
          console.log('Transcription result:', transcribedText);
          
          if (transcribedText && transcribedText.trim()) {
            sendMessage(transcribedText);
          } else {
            setError("No speech detected. Please speak clearly and try again.");
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError(err.message || "Failed to transcribe audio");
        } finally {
          setIsTranscribing(false);
          isStoppingRef.current = false;
          
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setError('Recording error: ' + (e.error?.message || 'Unknown error'));
        isStoppingRef.current = false;
      };

      // Start recording with timeslice to get chunks regularly
      mediaRecorder.start(1000); // Collect data every 1 second
      setIsListening(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(p => p + 1);
      }, 1000);
      
      console.log('✅ Recording started successfully');
      
    } catch (err) {
      console.error('Microphone error:', err);
      isStoppingRef.current = false;
      
      if (err.name === 'NotAllowedError') {
        setError("Microphone access denied. Please allow microphone permission.");
      } else if (err.name === 'NotFoundError') {
        setError("No microphone found. Please connect a microphone.");
      } else if (err.name === 'NotReadableError') {
        setError("Microphone is being used by another application.");
      } else {
        setError("Failed to access microphone: " + err.message);
      }
    }
  };

  const stopRecording = () => {
    console.log('Attempting to stop recording...');
    
    // Prevent multiple stop calls
    if (isStoppingRef.current) {
      console.log('Already stopping, ignoring stop request');
      return;
    }
    
    if (!mediaRecorderRef.current || !isListening) {
      console.log('Not recording, nothing to stop');
      return;
    }
    
    isStoppingRef.current = true;
    
    try {
      if (mediaRecorderRef.current.state === 'recording') {
        // Request final data before stopping
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          console.log('Recording stopped');
        }
      }
      
      setIsListening(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
      isStoppingRef.current = false;
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;
    
    setMessages(p => [...p, { id: Date.now(), text, sender: 'user', isNew: true }]);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Replace with your actual AI backend call
    setTimeout(() => {
      const responses = [
        "Absolutely! I found some amazing options for you. Kerala's backwaters are stunning this time of year 🌴",
        "Great choice! Let me pull up the best deals and hidden gems for your destination ✨",
        "Perfect timing! I've got some exclusive recommendations that'll make your trip unforgettable 🎉",
      ];
      setMessages(p => [...p, { 
        id: Date.now() + 1, 
        text: responses[Math.floor(Math.random() * responses.length)], 
        sender: 'bot', 
        isNew: true 
      }]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen h-full w-full fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}} />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/10 p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/40">
            <span className="text-2xl">✈️</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Siara</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white/60 text-sm">AI Expert • Online</span>
            </div>
          </div>
          
          {/* Language selector */}
          <div className="flex gap-2">
            <select 
              value={selectedLanguage} 
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-white/10 text-white rounded-xl px-3 py-2 text-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="te">తెలుగు</option>
              <option value="hi">हिन्दी</option>
              <option value="ta">தமிழ்</option>
              <option value="kn">ಕನ್ನಡ</option>
              <option value="en">English</option>
              <option value="ml">മലയാളം</option>
              <option value="mr">मराठी</option>
              <option value="gu">ગુજરાતી</option>
              <option value="bn">বাংলা</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-2">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg.text} sender={msg.sender} isNew={msg.isNew} />
        ))}
        
        {/* Bot typing indicator */}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="flex items-end gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="text-lg">✈️</span>
              </div>
              <div className="bg-white/80 backdrop-blur-xl px-5 py-4 rounded-2xl rounded-bl-sm border border-white/50 shadow-xl">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2.5 h-2.5 bg-gradient-to-b from-purple-500 to-fuchsia-500 rounded-full animate-bounce" style={{animationDelay: `${i * 0.15}s`}} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Transcribing indicator */}
        {isTranscribing && (
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-white/80 text-sm">Transcribing audio...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="relative z-10 mx-4 mb-2 bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm text-center">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 bg-white/10 backdrop-blur-xl border-t border-white/10 p-4">
        {isListening && (
          <div className="mb-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-xl border border-red-400/30 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white font-semibold">
                Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex gap-1 items-end h-6">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-red-400 rounded-full animate-pulse" 
                  style={{
                    height: `${12 + Math.sin(i * 0.8) * 8}px`,
                    animationDelay: `${i * 0.05}s`
                  }} 
                />
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && !isListening && !isTranscribing && sendMessage()}
              placeholder="Type or hold mic to speak..."
              disabled={isListening || isTranscribing}
              className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent disabled:opacity-50 transition-all"
            />
          </div>
          
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={() => isListening && stopRecording()}
            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
            disabled={isLoading || isTranscribing}
            className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${
              isListening
                ? 'bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-500/40 animate-pulse'
                : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:shadow-lg hover:shadow-purple-500/40'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Hold to record"
          >
            <Mic className="w-6 h-6 text-white" />
          </button>
          
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading || isListening || isTranscribing}
            className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 flex items-center justify-center hover:shadow-lg hover:shadow-fuchsia-500/40 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-6 h-6 text-white" />
          </button>
        </div>
        
        <p className="text-white/40 text-xs text-center mt-3">
          🎤 Hold mic to speak • 🌐 Selected: {selectedLanguage.toUpperCase()}
        </p>
      </div>

      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}