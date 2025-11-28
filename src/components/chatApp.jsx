import { useState, useRef, useEffect } from 'react';
import { sendAudioBhashiniPipeline, textToSpeechBhashini, playAudioBlob } from '../services/bhashiniService';
import { convertToWav, blobToBase64, validateAudioBlob } from '../components/utils/audioUtils'
import salesforceAgent from '../services/salesforceAgentService';

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

const Volume = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const VolumeX = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" x2="17" y1="9" y2="15"/><line x1="17" x2="23" y1="9" y2="15"/>
  </svg>
);

const Sparkles = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  </svg>
);

const AlertCircle = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
  </svg>
);

function MessageBubble({ message, sender, isNew, metadata, onReplay, isPlaying }) {
  return (
    <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-5 ${isNew ? 'animate-slide-up' : ''}`}>
      <div className={`flex items-end gap-3 max-w-[80%] sm:max-w-[75%] ${sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        {sender === 'bot' && (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg ring-2 ring-blue-400/20">
            <Sparkles className="w-5 h-5" />
          </div>
        )}
        <div className="flex flex-col gap-2 flex-1">
          <div className={`group relative px-4 py-3 sm:px-5 sm:py-3.5 ${
            sender === 'user'
              ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-br-md shadow-lg hover:shadow-xl transition-shadow'
              : 'bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-md hover:shadow-lg transition-shadow border border-gray-100'
          }`}>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {metadata && (
              <div className="flex-1 min-w-0 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs text-gray-600 flex items-center gap-2 shadow-sm border border-gray-100">
                <span className="font-medium text-gray-700">{metadata.languageName}</span>
                {metadata.confidence && (
                  <span className="text-gray-500">
                    • {(metadata.confidence * 100).toFixed(0)}%
                  </span>
                )}
                {metadata.originalText && metadata.originalText !== message && (
                  <span className="text-gray-500 italic truncate">
                    • Original: "{metadata.originalText}"
                  </span>
                )}
              </div>
            )}

            {sender === 'bot' && onReplay && (
              <button
                onClick={onReplay}
                disabled={isPlaying}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
                  isPlaying
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm border border-gray-200'
                } disabled:opacity-50 disabled:hover:scale-100`}
                title="Replay audio"
              >
                {isPlaying ? (
                  <>
                    <Volume className="w-3.5 h-3.5 animate-pulse" />
                    <span>Playing</span>
                  </>
                ) : (
                  <>
                    <Volume className="w-3.5 h-3.5" />
                    <span>Replay</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [detectedUserLanguage, setDetectedUserLanguage] = useState('en');
  const [userUsedVoice, setUserUsedVoice] = useState(false);

  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const isStoppingRef = useRef(false);
  const currentAudioRef = useRef(null);
  // Use ref to store the latest detected language
  const detectedLanguageRef = useRef('en');

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        setIsInitializing(true);
        console.log('🚀 Initializing Agentforce...');
        
        const initialMessage = await salesforceAgent.startSession();
        
        const welcomeMsg = {
          id: 1,
          text: initialMessage || "Hello! I'm your Salesforce AI Agent. How can I help you today?",
          sender: 'bot'
        };
        
        setMessages([welcomeMsg]);

        // Don't autoplay welcome message to avoid browser autoplay policy errors
        // Audio will work after first user interaction

        setSessionStarted(true);
        console.log('✅ Agentforce initialized');
      } catch (error) {
        console.error('Failed to initialize Agentforce:', error);
        setMessages([
          {
            id: 1,
            text: "⚠️ Unable to connect to Salesforce Agent. Please check your configuration.",
            sender: 'bot'
          }
        ]);
        setError('Failed to connect to Salesforce Agent');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAgent();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      salesforceAgent.endSession();
    };
  }, []); // Empty dependency array - run only once

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to speak bot messages with explicit language parameter
  const speakBotMessage = async (text, messageId, languageOverride = null) => {
    if (!ttsEnabled || isSpeaking) return;
    
    try {
      setIsSpeaking(true);
      setPlayingMessageId(messageId);
      
      // Use override language, or ref value, or state value, or default to English
      const languageToUse = languageOverride || detectedLanguageRef.current || detectedUserLanguage || 'en';
      
      console.log(`🔊 Speaking: "${text.substring(0, 50)}..."`);
      console.log(`   Language for TTS: ${languageToUse}`);
      console.log(`   detectedLanguageRef.current: ${detectedLanguageRef.current}`);
      console.log(`   detectedUserLanguage state: ${detectedUserLanguage}`);
      
      const audioBlob = await textToSpeechBhashini(text, languageToUse, 'female');
      
      // Play audio
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        setPlayingMessageId(null);
        currentAudioRef.current = null;
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        setPlayingMessageId(null);
        currentAudioRef.current = null;
        console.error('Error playing audio');
      };
      
      await audio.play();
      
    } catch (error) {
      console.error('❌ Failed to speak message:', error);
      setIsSpeaking(false);
      setPlayingMessageId(null);
    }
  };

  // Function to replay a bot message
  const replayMessage = (text, messageId) => {
    if (isSpeaking && playingMessageId === messageId) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsSpeaking(false);
      setPlayingMessageId(null);
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      speakBotMessage(text, messageId);
    }
  };

  const startRecording = async () => {
    if (isListening || isStoppingRef.current) {
      return;
    }

    try {
      setError(null);
      isStoppingRef.current = false;
      
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
      
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          setIsTranscribing(true);
          
          if (audioChunksRef.current.length === 0) {
            setError("Recording failed - no audio data captured");
            return;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          validateAudioBlob(audioBlob);
          
          const wavBlob = await convertToWav(audioBlob);
          const base64Audio = await blobToBase64(wavBlob);

          const pipelineResult = await sendAudioBhashiniPipeline(base64Audio);
          
          // Store detected language in BOTH state and ref
          if (pipelineResult.detectedLanguage) {
            console.log('🗣️ Language detected from pipeline:', pipelineResult.detectedLanguage);
            detectedLanguageRef.current = pipelineResult.detectedLanguage;
            setDetectedUserLanguage(pipelineResult.detectedLanguage);
            console.log('✅ Updated detectedLanguageRef.current to:', detectedLanguageRef.current);
          }
          
          if (pipelineResult && pipelineResult.translatedText && pipelineResult.translatedText.trim()) {
            // Mark that user used voice input
            setUserUsedVoice(true);
            // Pass the detected language directly to sendMessage
            sendMessage(
              pipelineResult.translatedText,
              {
                languageName: pipelineResult.languageName,
                confidence: pipelineResult.confidence,
                originalText: pipelineResult.originalText
              },
              pipelineResult.detectedLanguage, // Pass detected language
              true // isVoiceInput flag
            );
          } else {
            setError("No speech detected. Please speak clearly and try again.");
          }
        } catch (err) {
          console.error('Processing error:', err);
          setError(err.message || "Failed to process audio");
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

      mediaRecorder.start(1000);
      setIsListening(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(p => p + 1);
      }, 1000);
      
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
    if (isStoppingRef.current || !mediaRecorderRef.current || !isListening) {
      return;
    }
    
    isStoppingRef.current = true;
    
    try {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
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

  const sendMessage = async (text = input, metadata = null, detectedLang = null, isVoiceInput = false) => {
    if (!text.trim()) return;

    if (!sessionStarted) {
      setError('Session not started. Please refresh the page.');
      return;
    }

    const userMessage = {
      id: Date.now(),
      text,
      sender: 'user',
      isNew: true,
      metadata
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const agentResponse = await salesforceAgent.sendMessage(text);

      const botMessage = {
        id: Date.now() + 1,
        text: agentResponse,
        sender: 'bot',
        isNew: true
      };

      setMessages(prev => [...prev, botMessage]);

      // Only use TTS if user used voice input
      if (ttsEnabled && isVoiceInput && userUsedVoice) {
        setTimeout(() => {
          const ttsLanguage = detectedLang || detectedLanguageRef.current || 'en';
          console.log('🎯 Using language for TTS:', ttsLanguage);
          speakBotMessage(agentResponse, botMessage.id, ttsLanguage);
        }, 300);
      }

    } catch (error) {
      console.error('❌ Error getting agent response:', error);

      const errorMessage = {
        id: Date.now() + 1,
        text: `⚠️ Sorry, I encountered an error: ${error.message}`,
        sender: 'bot',
        isNew: true
      };

      setMessages(prev => [...prev, errorMessage]);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-full w-full fixed inset-0 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-float-delayed" />
      </div>

      <header className="relative z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-2 ring-blue-100">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Salesforce AI Agent</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2 h-2 ${sessionStarted ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full ${sessionStarted ? 'animate-pulse-slow' : 'animate-pulse'}`} />
                  <span className="text-gray-600 text-xs sm:text-sm font-medium">
                    {isInitializing ? 'Connecting...' : sessionStarted ? `Online • ${detectedUserLanguage.toUpperCase()}` : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setTtsEnabled(!ttsEnabled);
                if (currentAudioRef.current) {
                  currentAudioRef.current.pause();
                  currentAudioRef.current = null;
                }
                setIsSpeaking(false);
                setPlayingMessageId(null);
              }}
              className={`px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
                ttsEnabled
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
              title={ttsEnabled ? 'Disable voice responses' : 'Enable voice responses'}
            >
              {ttsEnabled ? <Volume className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{ttsEnabled ? 'Voice On' : 'Voice Off'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-1">
          {isInitializing ? (
            <div className="flex justify-center items-center h-full min-h-[60vh]">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-700 font-medium text-lg">Connecting to Salesforce Agent</p>
                <p className="text-gray-500 text-sm mt-2">Please wait...</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg.text}
                  sender={msg.sender}
                  isNew={msg.isNew}
                  metadata={msg.metadata}
                  onReplay={msg.sender === 'bot' ? () => replayMessage(msg.text, msg.id) : null}
                  isPlaying={playingMessageId === msg.id}
                />
              ))}

              {isLoading && (
                <div className="flex justify-start mb-5 animate-slide-up">
                  <div className="flex items-end gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg ring-2 ring-blue-400/20">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-white px-5 py-4 rounded-2xl rounded-bl-md shadow-md border border-gray-100">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: `${i * 0.15}s`}} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isTranscribing && (
                <div className="flex justify-center mb-5 animate-slide-up">
                  <div className="bg-white shadow-md px-4 py-2.5 rounded-full flex items-center gap-2.5 border border-gray-200">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1 h-4 bg-blue-600 rounded-full animate-sound-wave" style={{animationDelay: `${i * 0.1}s`}} />
                      ))}
                    </div>
                    <span className="text-gray-700 text-sm font-medium">Processing audio...</span>
                  </div>
                </div>
              )}

              {isSpeaking && (
                <div className="flex justify-center mb-5 animate-slide-up">
                  <div className="bg-blue-50 shadow-md px-4 py-2.5 rounded-full flex items-center gap-2.5 border border-blue-200">
                    <Volume className="w-4 h-4 text-blue-600 animate-pulse" />
                    <span className="text-blue-700 text-sm font-medium">Speaking in {detectedUserLanguage.toUpperCase()}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {error && (
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 mb-3 animate-slide-up">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
              aria-label="Dismiss error"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <footer className="relative z-10 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          {isListening && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between shadow-md animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                <span className="text-red-700 font-semibold text-sm sm:text-base">
                  Recording {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex gap-1 items-end h-6">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-sound-wave"
                    style={{
                      height: `${12 + Math.sin(i * 0.8) * 8}px`,
                      animationDelay: `${i * 0.08}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <div className="flex items-center gap-2 bg-white rounded-full shadow-lg border border-gray-200/50 p-2 hover:shadow-xl transition-shadow">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && !isListening && !isTranscribing && !isLoading && sendMessage()}
                placeholder="Message TGNPDCL Assistant..."
                disabled={isListening || isTranscribing || isInitializing}
                className="flex-1 bg-transparent border-0 outline-none px-4 py-3 text-gray-900 placeholder-gray-500 text-[15px] disabled:opacity-50"
              />

              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => isListening && stopRecording()}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                disabled={isLoading || isTranscribing || isInitializing}
                className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Hold to record voice message"
                aria-label="Record voice message"
              >
                <Mic className="w-5 h-5" />
              </button>

              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || isListening || isTranscribing || isInitializing}
                className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                  input.trim() && !isLoading && !isListening && !isTranscribing && !isInitializing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

        </div>
      </footer>

      <style>{`
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes float-delayed {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-30px, 30px) scale(1.1);
          }
          66% {
            transform: translate(20px, -20px) scale(0.9);
          }
        }

        @keyframes sound-wave {
          0%, 100% {
            height: 0.5rem;
            opacity: 0.5;
          }
          50% {
            height: 1.5rem;
            opacity: 1;
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .animate-float {
          animation: float 20s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 25s ease-in-out infinite;
        }

        .animate-sound-wave {
          animation: sound-wave 0.8s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        /* Smooth scrollbar */
        main::-webkit-scrollbar {
          width: 8px;
        }

        main::-webkit-scrollbar-track {
          background: transparent;
        }

        main::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        main::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}