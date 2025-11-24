import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Service ID mapping (same as Streamlit)
const getServiceId = (language) => {
  const serviceMap = {
    'te': 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
    'hi': 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
    'en': 'ai4bharat/whisper-medium-en--gpu--t4',
    'ta': 'ai4bharat/conformer-multilingual-dravidian-gpu--t4',
    'ml': 'ai4bharat/conformer-multilingual-dravidian-gpu--t4',
    'kn': 'ai4bharat/conformer-multilingual-dravidian-gpu--t4',
    'mr': 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
    'gu': 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
    'bn': 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
    'or': 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
    'pa': 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4'
  };
  return serviceMap[language] || 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4';
};

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Bhashini proxy server is running",
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.BHASHINI_API_KEY
  });
});

// Transcribe endpoint (matching Streamlit implementation)
app.post("/api/transcribe", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { audioBase64, language = "te" } = req.body;

    // Validation
    if (!audioBase64) {
      return res.status(400).json({
        error: "Missing audioBase64 in request body",
        success: false
      });
    }

    if (!process.env.BHASHINI_API_KEY) {
      return res.status(500).json({
        error: "BHASHINI_API_KEY not configured on server",
        success: false
      });
    }

    console.log(`[${new Date().toISOString()}] 🎤 Transcription request received`);
    console.log(`   Language: ${language}`);
    console.log(`   Audio size: ${audioBase64.length} characters`);
    console.log(`   Audio size (bytes): ~${Math.round(audioBase64.length * 0.75)}`);

    const serviceId = getServiceId(language);
    console.log(`   Service ID: ${serviceId}`);

    // Prepare request payload (exactly like Streamlit)
    const payload = {
      pipelineTasks: [
        {
          taskType: "asr",
          config: {
            language: {
              sourceLanguage: language
            },
            serviceId: serviceId,
            audioFormat: "wav",
            samplingRate: 16000
          }
        }
      ],
      inputData: {
        audio: [
          {
            audioContent: audioBase64
          }
        ]
      }
    };

    // Prepare headers (exactly like Streamlit)
    const headers = {
      'Accept': '*/*',
      'User-Agent': 'Siara-Voice-Assistant',
      'Authorization': process.env.BHASHINI_API_KEY,
      'Content-Type': 'application/json'
    };

    console.log(`   🚀 Sending to Bhashini API...`);

    // Make request to Bhashini API
    const response = await axios.post(
      process.env.BHASHINI_API_URL || "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
      payload,
      {
        headers: headers,
        timeout: 30000
      }
    );

    const processingTime = Date.now() - startTime;
    console.log(`   ⏱️  Processing time: ${processingTime}ms`);

    // Extract transcribed text (matching Streamlit logic)
    let transcribedText = "";
    
    if (response.data && response.data.pipelineResponse) {
      for (const task of response.data.pipelineResponse) {
        if (task.taskType === 'asr' && task.output) {
          for (const output of task.output) {
            if (output.source) {
              transcribedText = output.source;
              break;
            }
          }
        }
        if (transcribedText) break;
      }
    }

    // Also try alternative response format
    if (!transcribedText) {
      transcribedText = 
        response.data?.pipelineResponse?.[0]?.output?.[0]?.source ||
        response.data?.pipelineResponse?.[0]?.outputData?.output?.[0]?.source ||
        "";
    }

    if (!transcribedText || transcribedText.trim() === "") {
      console.log(`   ⚠️  No speech detected in audio`);
      return res.status(200).json({
        text: "",
        message: "No speech detected in audio",
        language: language,
        success: true,
        processingTime: processingTime
      });
    }

    console.log(`   ✅ Transcription successful`);
    console.log(`   📝 Result: "${transcribedText}"`);

    res.json({
      text: transcribedText,
      language: language,
      success: true,
      processingTime: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[${new Date().toISOString()}] ❌ Transcription error:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      processingTime: processingTime
    });

    // Detailed error responses
    let statusCode = 500;
    let errorMessage = "Transcription failed";
    let errorDetails = error.message;

    if (error.code === 'ECONNABORTED') {
      statusCode = 504;
      errorMessage = "Request timeout - Bhashini API took too long to respond";
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = "Cannot connect to Bhashini API";
    } else if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || error.response.statusText;
      errorDetails = error.response.data;
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: errorDetails,
      success: false,
      processingTime: processingTime
    });
  }
});

// Multi-language transcription endpoint
app.post("/api/transcribe-multi", async (req, res) => {
  try {
    const { audioBase64, languages = ["hi", "te", "ta", "kn", "en"] } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ 
        error: "Missing audioBase64",
        success: false 
      });
    }

    console.log(`[${new Date().toISOString()}] 🌐 Multi-language transcription request`);
    console.log(`   Trying languages: ${languages.join(", ")}`);

    // Try each language until one succeeds
    for (const lang of languages) {
      try {
        console.log(`   🔄 Trying language: ${lang}`);
        
        const serviceId = getServiceId(lang);
        
        const response = await axios.post(
          process.env.BHASHINI_API_URL || "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
          {
            pipelineTasks: [
              {
                taskType: "asr",
                config: {
                  language: { sourceLanguage: lang },
                  serviceId: serviceId,
                  audioFormat: "wav",
                  samplingRate: 16000
                }
              }
            ],
            inputData: {
              audio: [{ audioContent: audioBase64 }]
            }
          },
          {
            headers: {
              'Accept': '*/*',
              'Authorization': process.env.BHASHINI_API_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        // Extract text
        let text = "";
        if (response.data?.pipelineResponse) {
          for (const task of response.data.pipelineResponse) {
            if (task.taskType === 'asr' && task.output) {
              text = task.output[0]?.source || "";
              break;
            }
          }
        }

        if (text && text.trim()) {
          console.log(`   ✅ Successfully transcribed with language: ${lang}`);
          console.log(`   📝 Result: "${text}"`);
          return res.json({
            text,
            detectedLanguage: lang,
            success: true
          });
        }
      } catch (err) {
        console.log(`   ❌ Failed with language ${lang}: ${err.message}`);
        continue;
      }
    }

    console.log(`   ⚠️  Could not transcribe in any language`);
    res.status(200).json({
      text: "",
      message: "Could not transcribe audio in any supported language",
      success: false
    });

  } catch (error) {
    console.error("Multi-language transcription error:", error);
    res.status(500).json({
      error: "Transcription failed",
      details: error.message,
      success: false
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
    success: false
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Bhashini Proxy Server`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 Transcribe: http://localhost:${PORT}/api/transcribe`);
  console.log(`🌐 Multi-language: http://localhost:${PORT}/api/transcribe-multi`);
  console.log(`${"=".repeat(60)}`);
  
  if (!process.env.BHASHINI_API_KEY) {
    console.log(`⚠️  WARNING: BHASHINI_API_KEY not found!`);
    console.log(`   Please add it to your .env file`);
  } else {
    console.log(`✅ BHASHINI_API_KEY: Configured`);
  }
  
  if (!process.env.BHASHINI_API_URL) {
    console.log(`ℹ️  Using default Bhashini API URL`);
  } else {
    console.log(`✅ BHASHINI_API_URL: ${process.env.BHASHINI_API_URL}`);
  }
  
  console.log(`${"=".repeat(60)}\n`);
});