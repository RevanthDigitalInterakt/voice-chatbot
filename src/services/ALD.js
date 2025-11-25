import axios from 'axios';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000';

export const sendAudioToBhashiniALD  = async (audioBase64) => {
    try{
    
        console.log('🎤 Sending to Bhashini ALD via proxy server...');

        console.log('Proxy URL:', PROXY_URL);
        console.log('Audio size:', audioBase64.length, 'characters');


        const response = await axios.post(`${PROXY_URL}/api/ald_transcribe`, { 
            audioBase64
         },{
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
    }catch(error){
        console.error('❌ Bhashini ALD Service Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            code: error.code
          });
        throw new Error(error.response?.data?.error || error.message || 'Failed to transcribe audio');
    }
}
