import axios from "axios";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000';

export const sendAudioToBhashini = async (audioBase64, language = 'te') => {
  try {
    console.log('🎤 Sending to proxy server...');
    console.log('Proxy URL:', PROXY_URL);
    console.log('Language:', language);
    console.log('Audio size:', audioBase64.length, 'characters');
    
    const response = await axios.post(
      `${PROXY_URL}/api/transcribe`,
      { 
        audioBase64, 
        language 
      },
      {
        headers: { 
          'Content-Type': 'application/json' 
        },
        timeout: 30000,
      }
    );

    console.log('✅ Response received:', response.data);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Transcription failed');
    }

    return response.data.text;

  } catch (error) {
    console.error('❌ Bhashini Service Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to proxy server. Make sure it\'s running on port 3000');
    }
    
    if (error.response?.status === 400) {
      throw new Error('Invalid audio data sent to server');
    }
    
    if (error.response?.status === 500) {
      throw new Error('Server error during transcription');
    }
    
    throw new Error(error.response?.data?.error || error.message || 'Failed to transcribe audio');
  }
};

// Optional: Multi-language transcription
export const sendAudioMultiLanguage = async (audioBase64, languages = ["hi", "te", "ta", "kn", "en"]) => {
  try {
    console.log('🌐 Attempting multi-language transcription...');
    
    const response = await axios.post(
      `${PROXY_URL}/api/transcribe-multi`,
      { 
        audioBase64, 
        languages 
      },
      {
        headers: { 
          'Content-Type': 'application/json' 
        },
        timeout: 30000,
      }
    );

    console.log('✅ Multi-language response:', response.data);

    if (!response.data.success && !response.data.text) {
      throw new Error('Could not transcribe in any language');
    }

    return {
      text: response.data.text,
      language: response.data.detectedLanguage
    };

  } catch (error) {
    console.error('❌ Multi-language transcription error:', error);
    throw new Error(error.response?.data?.error || 'Multi-language transcription failed');
  }
};