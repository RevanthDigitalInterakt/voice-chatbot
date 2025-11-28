import axios from "axios";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000';

/**
 * Integrated pipeline: Audio Language Detection + ASR + Translation
 */
export const sendAudioBhashiniPipeline = async (audioBase64) => {
  try {
    console.log('🎤 Starting integrated Bhashini pipeline (ALD + ASR + NMT)...');
    
    const response = await axios.post(
      `${PROXY_URL}/api/bhashini-pipeline`,
      { audioBase64 },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Pipeline processing failed');
    }

    console.log('✅ Bhashini pipeline complete');
    console.log('   Detected Language:', response.data.detectedLanguage);
   
    return {
      detectedLanguage: response.data.detectedLanguage,
      detectedScript: response.data.detectedScript,
      confidence: response.data.confidence,
      originalText: response.data.originalText,
      translatedText: response.data.translatedText,
      languageName: getLanguageName(response.data.detectedLanguage)
    };

  } catch (error) {
    console.error('❌ Bhashini Pipeline Error:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to process audio');
  }
};

/**
 * Text-to-Speech: Convert text to audio using Bhashini TTS
 * @param {string} text - Text to convert to speech
 * @param {string} language - Target language code (e.g., 'en', 'te', 'hi')
 * @param {string} gender - Voice gender: 'male' or 'female' (default: 'female')
 * @returns {Promise<Blob>} Audio blob that can be played
 */
export const textToSpeechBhashini = async (text, language , gender ) => {
  try {
    console.log('🔊 Converting text to speech...');
    console.log('   Text:', text);
    console.log('   Language:', language);
    console.log('   Gender:', gender);
    
    const response = await axios.post(
      `${PROXY_URL}/api/tts`,
      { 
        text, 
        language,
        gender 
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'TTS conversion failed');
    }

    // Convert base64 audio to blob
    const audioBase64 = response.data.audioContent;
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioBlob = new Blob([bytes], { type: 'audio/wav' });
    
    console.log('✅ TTS conversion complete');
    console.log('   Audio size:', audioBlob.size, 'bytes');
    
    return audioBlob;

  } catch (error) {
    console.error('❌ TTS Error:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to convert text to speech');
  }
};

/**
 * Play audio from blob
 * @param {Blob} audioBlob - Audio blob to play
 * @returns {Promise<HTMLAudioElement>} Audio element (can be used to control playback)
 */
export const playAudioBlob = async (audioBlob) => {
  return new Promise((resolve, reject) => {
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve(audio);
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Failed to play audio'));
      };
      
      audio.play().catch(reject);
      
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Convert text to speech and play immediately
 * @param {string} text - Text to speak
 * @param {string} language - Language code
 * @param {string} gender - Voice gender
 * @returns {Promise<HTMLAudioElement>} Audio element
 */
export const speakText = async (text, language = 'en', gender = 'female') => {
  try {
    const audioBlob = await textToSpeechBhashini(text, language, gender);
    const audio = await playAudioBlob(audioBlob);
    return audio;
  } catch (error) {
    console.error('❌ Failed to speak text:', error);
    throw error;
  }
};

/**
 * Legacy ASR function (kept for backward compatibility)
 */
export const sendAudioToBhashini = async (audioBase64, language) => {
  try {
    if (!language) {
      language = 'en';
    }

    const response = await axios.post(
      `${PROXY_URL}/api/transcribe`,
      { audioBase64, language },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Transcription failed');
    }

    return response.data.text;

  } catch (error) {
    console.error('❌ ASR Error:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to transcribe audio');
  }
};

/**
 * Audio Language Detection only
 */
export const sendAudioToBhashiniALD = async (audioBase64) => {
  try {
    const response = await axios.post(
      `${PROXY_URL}/api/ald_transcribe`,
      { audioBase64 },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Language detection failed');
    }

    return response.data.text;

  } catch (error) {
    console.error('❌ Language Detection Error:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to detect language');
  }
};

/**
 * Helper function to get language name from code
 */
function getLanguageName(langCode) {
  const languageMap = {
    'te': 'Telugu (తెలుగు)',
    'hi': 'Hindi (हिन्दी)',
    'ta': 'Tamil (தமிழ்)',
    'kn': 'Kannada (ಕನ್ನಡ)',
    'ml': 'Malayalam (മലയാളം)',
    'mr': 'Marathi (मराठी)',
    'gu': 'Gujarati (ગુજરાતી)',
    'bn': 'Bengali (বাংলা)',
    'pa': 'Punjabi (ਪੰਜਾਬੀ)',
    'or': 'Odia (ଓଡ଼ିଆ)',
    'en': 'English'
  };
  return languageMap[langCode] || langCode;
}

export default {
  sendAudioBhashiniPipeline,
  sendAudioToBhashini,
  sendAudioToBhashiniALD,
  textToSpeechBhashini,
  playAudioBlob,
  speakText,
  getLanguageName
};