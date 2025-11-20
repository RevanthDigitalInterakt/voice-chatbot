import axios from "axios";

export const sendAudioToBhashini = async (audioBase64) =>{
     try {
    const response = await axios.post(
      import.meta.env.VITE_BHASHINI_API_URL,
      {
        pipelineTasks: [
          {
            taskType: 'asr',
            config: {
              language: { sourceLanguage: 'en' },
              serviceId: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
              audioFormat: 'wav',
              samplingRate: 16000,
            },
          },
        ],
        inputData: {
          audio: [{ audioContent: audioBase64 }],
        },
      },
      {
        headers: {
          Authorization: import.meta.env.VITE_BHASHINI_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.pipelineResponse[0]?.outputData?.output[0]?.target?.value;
  } catch(error){
    console.error("Bhashini Api Request Error");
    throw error;
  }
}