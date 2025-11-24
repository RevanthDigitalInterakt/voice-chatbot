import axios from 'axios';


const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000';


export const sendTextToServer = async (text, sourceLang, targetLang) => {
  try {
    console.log('🔤 Sending text for transliteration...');

    console.log('Proxy URL:', PROXY_URL);
    console.log('Source Language:', sourceLang);
    console.log('Target Language:', targetLang);
    console.log('Text length:', text.length, 'characters');
    
    
    const response = await axios.post(
      `${PROXY_URL}/api/transliteration`,
      { text, sourceLang, targetLang },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000,
      }
    );

    console.log('Response received:', response.data);

  } catch (error) {
    console.error('❌ Transliteration Service Error:', {
      message: error.message,}
    );
    throw new Error(error.response?.data?.error || error.message || 'Failed to transliterate text');
  }
};