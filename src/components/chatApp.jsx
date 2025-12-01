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

const AlertCircle = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
  </svg>
);

function MessageBubble({ message, sender, isNew, metadata, onReplay, isPlaying, wasVoiceInput }) {
  return (
    <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-6 ${isNew ? 'animate-slide-up' : ''} w-full px-2`}>
      <div className={`flex items-end gap-3 ${sender === 'user' ? 'max-w-[85%] sm:max-w-[78%]' : 'max-w-full'} ${sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        {sender === 'bot' && (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white flex-shrink-0 shadow-md ring-1 ring-blue-200">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
        )}
        <div className="flex flex-col gap-2 flex-1">
          <div className={`group relative px-5 py-3 sm:px-5 sm:py-3.5 ${
            sender === 'user'
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-3xl rounded-br-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-95'
              : 'bg-gray-100 text-gray-900 rounded-3xl rounded-bl-sm shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200'
          }`}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">{message}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {metadata && (
              <div className="flex-1 min-w-0 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600 flex items-center gap-2 shadow-sm border border-gray-200">
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

            {sender === 'bot' && onReplay && wasVoiceInput && (
              <button
                onClick={onReplay}
                disabled={isPlaying}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                  isPlaying
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800 shadow-sm border border-gray-200'
                } disabled:opacity-50 disabled:hover:scale-100`}
                title="Replay audio"
              >
                {isPlaying ? (
                  <Volume className="w-4 h-4 animate-pulse" />
                ) : (
                  <Volume className="w-4 h-4" />
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
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const quickReplies = [
    { label: 'Raise a Case', icon: '📅' },
    { label: 'Info', icon: '📋' }
  ];

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

    setShowQuickReplies(false);
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
        isNew: true,
        wasVoiceInput: isVoiceInput
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
    <div className="min-h-screen h-full w-full fixed inset-0 bg-white flex overflow-hidden">
      {/* LEFT SIDEBAR - Digital Interakt Branding */}
      <div className="hidden lg:flex lg:w-[35%] bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex-col items-center justify-center relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{animationDuration: '4s'}} />
        </div>

        {/* Company Branding Content */}
        <div className="relative z-10 text-center px-8 space-y-6 flex flex-col items-center justify-center w-full h-full">
          {/* Company Logo with Animated Rings */}
          <div className="relative w-24 h-24">
            {/* Rotating rings */}
            <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-spin" style={{animationDuration: '20s'}} />
            <div className="absolute inset-2 border-2 border-white/30 rounded-full animate-spin" style={{animationDuration: '25s', animationDirection: 'reverse'}} />
            <div className="absolute inset-4 border-2 border-white/40 rounded-full animate-pulse" />

            {/* Center logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white shadow-2xl flex items-center justify-center border-3 border-white/50 overflow-hidden">
                <img src="/logo.webp" alt="Digital Interakt Logo" className="w-12 h-12 object-contain" />
              </div>
            </div>
          </div>

          {/* Company Name */}
          <div className="space-y-1">
            <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight animate-fade-in">
              Digital
              <br />
              Interakt
            </h2>
            <p className="text-white/70 text-xs font-light tracking-wide">Innovation at Scale</p>
          </div>

          {/* Features/Info - Centered layout */}
          {/* <div className="space-y-2.5 flex flex-col items-center">
            <div className="flex items-center justify-center gap-2 text-white/90">
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-medium">Enterprise Solutions</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/90">
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-medium">AI-Powered Voice</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/90">
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-medium">Multi-Language Support</span>
            </div>
          </div> */}

          {/* Status Badge - Bottom */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm hover:bg-white/15 transition-colors">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white text-xs font-medium">Powered by Salesforce</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Chatbot */}
      <div className="w-full lg:w-[65%] flex flex-col overflow-hidden bg-white">
        <header className="relative z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="w-full px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md ring-1 ring-blue-200">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">AI Assistant</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-2 h-2 ${sessionStarted ? 'bg-green-500' : 'bg-amber-500'} rounded-full ${sessionStarted ? 'animate-pulse-slow' : 'animate-pulse'}`} />
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">
                      {isInitializing ? 'Connecting...' : sessionStarted ? `Online • ${detectedUserLanguage.toUpperCase()}` : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-4">
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
              {messages.map((msg, index) => (
                <div key={msg.id}>
                  <MessageBubble
                    message={msg.text}
                    sender={msg.sender}
                    isNew={msg.isNew}
                    metadata={msg.metadata}
                    onReplay={msg.sender === 'bot' ? () => replayMessage(msg.text, msg.id) : null}
                    isPlaying={playingMessageId === msg.id}
                    wasVoiceInput={msg.wasVoiceInput}
                  />
                  {msg.sender === 'bot' && index === 0 && showQuickReplies && (
                    <div className="flex justify-start mb-8 mt-2 animate-slide-up">
                      <div className="flex flex-col gap-3 w-full max-w-md">
                        <p className="text-xs text-gray-600 font-semibold px-4 uppercase tracking-wide">Quick replies:</p>
                        <div className="flex flex-wrap gap-3 px-4">
                          {quickReplies.map((reply, idx) => (
                            <button
                              key={idx}
                              onClick={() => sendMessage(reply.label)}
                              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 text-sm font-semibold border border-blue-200 transition-all hover:shadow-md hover:scale-105 active:scale-95 shadow-sm"
                            >
                              {reply.icon} {reply.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start mb-7 animate-slide-up">
                  <div className="flex items-end gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md ring-1 ring-blue-200">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div className="bg-white px-6 py-4.5 rounded-2xl rounded-bl-sm shadow-md border border-gray-200">
                      <div className="flex gap-2">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: `${i * 0.15}s`}} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isTranscribing && (
                <div className="flex justify-center mb-7 animate-slide-up">
                  <div className="bg-white shadow-md px-5 py-3 rounded-full flex items-center gap-3 border border-gray-200">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-5 bg-blue-600 rounded-full animate-sound-wave" style={{animationDelay: `${i * 0.1}s`}} />
                      ))}
                    </div>
                    <span className="text-gray-700 text-sm font-semibold">Processing audio...</span>
                  </div>
                </div>
              )}

              {isSpeaking && (
                <div className="flex justify-center mb-7 animate-slide-up">
                  <div className="relative flex items-center justify-center">
                    {/* Animated background circles */}
                    <div className="absolute w-32 h-32 bg-blue-100 rounded-full animate-pulse opacity-50"></div>
                    <div className="absolute w-24 h-24 bg-blue-200 rounded-full animate-pulse opacity-40" style={{animationDelay: '0.2s'}}></div>

                    {/* Center stop button with speaker icon */}
                    <button
                      onClick={() => {
                        if (currentAudioRef.current) {
                          currentAudioRef.current.pause();
                          currentAudioRef.current = null;
                        }
                        setIsSpeaking(false);
                        setPlayingMessageId(null);
                      }}
                      className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95"
                      title="Stop audio playback"
                    >
                      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </button>

                    {/* Language label above */}
                    <div className="absolute top-0 transform -translate-y-12 whitespace-nowrap">
                      <span className="text-blue-700 text-sm font-semibold bg-white px-4 py-2 rounded-full shadow-md border border-blue-200">
                        🔊 Speaking in {detectedUserLanguage.toUpperCase()}
                      </span>
                    </div>

                    {/* Stop label below */}
                    <div className="absolute bottom-0 transform translate-y-12 whitespace-nowrap">
                      <span className="text-red-600 text-xs font-bold animate-bounce">
                        TAP TO STOP
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {error && (
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 mb-4 animate-slide-up">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4 shadow-md">
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

      <footer className="relative z-10 bg-white border-t border-gray-200 shadow-lg">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          {isListening && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between shadow-md animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                <span className="text-red-700 font-semibold text-sm sm:text-base">
                  Recording {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex gap-1.5 items-end h-6">
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
            <div className="flex items-center gap-3 bg-white rounded-2xl shadow-lg border border-gray-300 p-3 hover:shadow-xl transition-shadow focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && !isListening && !isTranscribing && !isLoading && sendMessage()}
                placeholder="Message AI Assistant..."
                disabled={isListening || isTranscribing || isInitializing}
                className="flex-1 bg-transparent border-0 outline-none px-5 py-4 text-gray-900 placeholder-gray-500 text[15px] disabled:opacity-50 font-medium"
              />

              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => isListening && stopRecording()}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                disabled={isLoading || isTranscribing || isInitializing}
                className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all font-semibold ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 shadow-sm'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Hold to record voice message"
                aria-label="Record voice message"
              >
                <Mic className="w-5 h-5" />
              </button>

              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || isListening || isTranscribing || isInitializing}
                className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all font-semibold ${
                  input.trim() && !isLoading && !isListening && !isTranscribing && !isInitializing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-105 active:scale-95'
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

          @keyframes fade-in {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
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

          .animate-fade-in {
            animation: fade-in 1s ease-in-out;
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
    </div>
  );
}