/**
 * Audio Utility Functions - Fixed based on working Streamlit implementation
 * Place this file in: src/utils/audioUtils.js
 */

/**
 * Convert AudioBuffer to WAV format (16-bit PCM, mono, 16kHz)
 * This matches the Bhashini API requirements exactly
 */
const audioBufferToWav = (buffer) => {
  const numChannels = 1; // Mono
  const sampleRate = 16000; // 16kHz as required by Bhashini
  const format = 1; // PCM
  const bitsPerSample = 16;
  
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.getChannelData(0); // Get mono channel
  const dataLength = samples.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // Write WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  let pos = 0;
  
  // RIFF chunk descriptor
  writeString(pos, 'RIFF'); pos += 4;
  view.setUint32(pos, bufferLength - 8, true); pos += 4;
  writeString(pos, 'WAVE'); pos += 4;
  
  // fmt sub-chunk
  writeString(pos, 'fmt '); pos += 4;
  view.setUint32(pos, 16, true); pos += 4; // Subchunk1Size (16 for PCM)
  view.setUint16(pos, format, true); pos += 2; // AudioFormat (1 for PCM)
  view.setUint16(pos, numChannels, true); pos += 2; // NumChannels
  view.setUint32(pos, sampleRate, true); pos += 4; // SampleRate
  view.setUint32(pos, sampleRate * blockAlign, true); pos += 4; // ByteRate
  view.setUint16(pos, blockAlign, true); pos += 2; // BlockAlign
  view.setUint16(pos, bitsPerSample, true); pos += 2; // BitsPerSample
  
  // data sub-chunk
  writeString(pos, 'data'); pos += 4;
  view.setUint32(pos, dataLength, true); pos += 4;
  
  // Write PCM samples
  const volume = 0.8;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] * volume));
    const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(pos, value, true);
    pos += 2;
  }
  
  return arrayBuffer;
};

/**
 * Convert audio blob to WAV format with 16kHz sample rate (Bhashini requirement)
 */
export const convertToWav = async (audioBlob) => {
  try {
    console.log('🎵 Converting audio to WAV format...');
    console.log('Input blob size:', audioBlob.size, 'bytes');
    console.log('Input blob type:', audioBlob.type);
    
    // Create audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Read blob as array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('Original sample rate:', audioBuffer.sampleRate, 'Hz');
    console.log('Original channels:', audioBuffer.numberOfChannels);
    console.log('Duration:', audioBuffer.duration, 'seconds');
    
    // Resample to 16kHz mono if needed
    const targetSampleRate = 16000;
    let resampledBuffer;
    
    if (audioBuffer.sampleRate !== targetSampleRate || audioBuffer.numberOfChannels !== 1) {
      console.log('Resampling to 16kHz mono...');
      
      const offlineContext = new OfflineAudioContext(
        1, // mono
        audioBuffer.duration * targetSampleRate,
        targetSampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      resampledBuffer = await offlineContext.startRendering();
      console.log('Resampled to:', resampledBuffer.sampleRate, 'Hz');
    } else {
      resampledBuffer = audioBuffer;
      console.log('No resampling needed');
    }
    
    // Convert to WAV
    const wavArrayBuffer = audioBufferToWav(resampledBuffer);
    const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
    
    console.log('✅ WAV conversion complete');
    console.log('Output WAV size:', wavBlob.size, 'bytes');
    
    return wavBlob;
    
  } catch (error) {
    console.error('❌ Error converting audio to WAV:', error);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
};

/**
 * Convert blob to base64 string (without data URL prefix)
 */
export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the data URL prefix (e.g., "data:audio/wav;base64,")
      const base64 = reader.result.split(',')[1];
      console.log('✅ Base64 conversion complete, length:', base64.length);
      resolve(base64);
    };
    reader.onerror = (error) => {
      console.error('❌ Error converting to base64:', error);
      reject(error);
    };
    reader.readAsDataURL(blob);
  });
};

/**
 * Validate audio blob before processing
 */
export const validateAudioBlob = (blob) => {
  if (!blob) {
    throw new Error('No audio blob provided');
  }
  
  if (blob.size === 0) {
    throw new Error('Audio blob is empty');
  }
  
  if (blob.size < 100) {
    throw new Error('Audio recording too short');
  }
  
  console.log('✅ Audio blob validated:', {
    size: blob.size,
    type: blob.type
  });
  
  return true;
};