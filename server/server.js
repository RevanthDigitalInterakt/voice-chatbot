import express, { response } from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { EventEmitter } from "events";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Service ID mapping (same as Streamlit)
const getServiceId = (language) => {
  const serviceMap = {
    te: "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4",
    hi: "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4",
    en: "ai4bharat/whisper-medium-en--gpu--t4",
    ta: "ai4bharat/conformer-multilingual-dravidian-gpu--t4",
    ml: "ai4bharat/conformer-multilingual-dravidian-gpu--t4",
    kn: "ai4bharat/conformer-multilingual-dravidian-gpu--t4",
    mr: "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4",
    gu: "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4",
    bn: "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4",
    or: "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4",
    pa: "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4",
  };
  return (
    serviceMap[language] ||
    "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4"
  );
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
    apiKeyConfigured: !!process.env.BHASHINI_API_KEY,
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
        success: false,
      });
    }

    if (!process.env.BHASHINI_API_KEY) {
      return res.status(500).json({
        error: "BHASHINI_API_KEY not configured on server",
        success: false,
      });
    }

    console.log(
      `[${new Date().toISOString()}] 🎤 Transcription request received`
    );
    console.log(`   Language: ${language}`);
    console.log(`   Audio size: ${audioBase64.length} characters`);
    console.log(
      `   Audio size (bytes): ~${Math.round(audioBase64.length * 0.75)}`
    );

    const serviceId = getServiceId(language);
    console.log(`   Service ID: ${serviceId}`);

    // Prepare request payload (exactly like Streamlit)
    const payload = {
      pipelineTasks: [
        {
          taskType: "asr",
          config: {
            language: {
              sourceLanguage: language,
            },
            serviceId: serviceId,
            audioFormat: "wav",
            samplingRate: 16000,
          },
        },
      ],
      inputData: {
        audio: [
          {
            audioContent: audioBase64,
          },
        ],
      },
    };

    // Prepare headers (exactly like Streamlit)
    const headers = {
      Accept: "*/*",
      "User-Agent": "Siara-Voice-Assistant",
      Authorization: process.env.BHASHINI_API_KEY,
      "Content-Type": "application/json",
    };

    console.log(`   🚀 Sending to Bhashini API...`);

    // Make request to Bhashini API
    const response = await axios.post(
      process.env.BHASHINI_API_URL ||
        "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
      payload,
      {
        headers: headers,
        timeout: 30000,
      }
    );

    const processingTime = Date.now() - startTime;
    console.log(`   ⏱️  Processing time: ${processingTime}ms`);

    // Extract transcribed text (matching Streamlit logic)
    let transcribedText = "";

    if (response.data && response.data.pipelineResponse) {
      for (const task of response.data.pipelineResponse) {
        if (task.taskType === "asr" && task.output) {
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
        processingTime: processingTime,
      });
    }

    console.log(`   ✅ Transcription successful`);
    console.log(`   📝 Result: "${transcribedText}"`);

    res.json({
      text: transcribedText,
      language: language,
      success: true,
      processingTime: processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error(`[${new Date().toISOString()}] ❌ Transcription error:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      processingTime: processingTime,
    });

    // Detailed error responses
    let statusCode = 500;
    let errorMessage = "Transcription failed";
    let errorDetails = error.message;

    if (error.code === "ECONNABORTED") {
      statusCode = 504;
      errorMessage = "Request timeout - Bhashini API took too long to respond";
    } else if (error.code === "ECONNREFUSED") {
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
      processingTime: processingTime,
    });
  }
});



// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
    success: false,
  });
});

// Add these imports at the top of server.js

// Add these constants after other constants
//tokens changed
const SF_ORG_DOMAIN = process.env.SF_ORG_DOMAIN;
const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;
const SF_AGENT_ID = process.env.SF_AGENT_ID;
const SF_API_HOST = process.env.SF_API_HOST;

// Session storage
const sessions = new Map();

// Helper: Get Salesforce access token
async function getSalesforceAccessToken() {
  try {
    const tokenUrl = `${SF_ORG_DOMAIN}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return response.data.access_token;
  } catch (error) {
    console.error(
      "Failed to get Salesforce access token:",
      error.response?.data || error.message
    );
    throw new Error("Authentication failed");
  }
}

// Helper: Parse Server-Sent Events
function parseSSE(text) {
  const lines = text.split("\n");
  const events = [];
  let currentEvent = { data: "" };

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      currentEvent.data += line.slice(6);
    } else if (line === "") {
      if (currentEvent.data) {
        try {
          events.push(JSON.parse(currentEvent.data));
        } catch (e) {
          // Ignore parse errors
        }
        currentEvent = { data: "" };
      }
    }
  }

  return events;
}

// ==============================================================
// SALESFORCE AGENTFORCE ENDPOINTS
// ==============================================================

// Start Agentforce session
app.post("/api/salesforce/start-session", async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 🚀 Starting Agentforce session`);

    // Get access token
    const accessToken = await getSalesforceAccessToken();
    console.log("✅ Got access token");

    // Create session
    const externalSessionKey = `session-${Date.now()}`;
    const sessionUrl = `${SF_API_HOST}/einstein/ai-agent/v1/agents/${SF_AGENT_ID}/sessions`;

    const sessionPayload = {
      externalSessionKey: externalSessionKey,
      instanceConfig: {
        endpoint: SF_ORG_DOMAIN,
      },
      tz: "America/Los_Angeles",
      variables: [
        {
          name: "$Context.EndUserLanguage",
          type: "Text",
          value: "en_US",
        },
      ],
      featureSupport: "Streaming",
      streamingCapabilities: {
        chunkTypes: ["Text"],
      },
      bypassUser: true,
    };

    const sessionResponse = await axios.post(sessionUrl, sessionPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    const sessionData = sessionResponse.data;
    const sessionId = sessionData.sessionId;

    console.log(`✅ Session created: ${sessionId}`);

    // Store session info
    sessions.set(sessionId, {
      sessionId,
      accessToken,
      createdAt: Date.now(),
    });

    // Extract initial greeting
    let initialMessage = "";
    if (sessionData.messages && sessionData.messages.length > 0) {
      initialMessage = sessionData.messages[0].message || "";
    }

    res.json({
      success: true,
      sessionId: sessionId,
      initialMessage: initialMessage,
    });
  } catch (error) {
    console.error(
      "❌ Failed to start Agentforce session:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        "Failed to start session",
    });
  }
});

// Send message to Agentforce agent
app.post("/api/salesforce/send-message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    console.log('msg sent to agent',message);

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing sessionId or message",
      });
    }

    console.log(
      `[${new Date().toISOString()}] 📤 Sending message to Agentforce`
    );
    console.log(`   Session: ${sessionId}`);
    console.log(`   Message: "${message}"`);

    // Get session info
    const sessionInfo = sessions.get(sessionId);
    if (!sessionInfo) {
      return res.status(404).json({
        success: false,
        error: "Session not found or expired",
      });
    }

    // Send message with streaming
    const messageUrl = `${SF_API_HOST}/einstein/ai-agent/v1/sessions/${sessionId}/messages/stream`;

    const messagePayload = {
      message: {
        sequenceId: Date.now(),
        type: "Text",
        text: message,
      },
      variables: [],
    };

    const response = await axios.post(messageUrl, messagePayload, {
      headers: {
        Authorization: `Bearer ${sessionInfo.accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      timeout: 60000,
      responseType: "text",
    });

    // Parse SSE response
    const events = parseSSE(response.data);

    // Extract the actual message
    let agentMessage = "";
    for (const event of events) {
      const msg = event.message || {};
      if (msg.type === "Inform" && msg.message) {
        agentMessage = msg.message;
        break;
      }
    }

    if (!agentMessage) {
      agentMessage = "I apologize, but I could not generate a response.";
    }

    // console.log(`✅ Agent response: "${agentMessage}"`);

    res.json({
      success: true,
      message: agentMessage,
    });
  } catch (error) {
    console.error(
      "❌ Failed to send message:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        "Failed to send message",
    });
  }
});

// End Agentforce session
app.post("/api/salesforce/end-session", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Missing sessionId",
      });
    }

    //console.log(`[${new Date().toISOString()}] 👋 Ending session: ${sessionId}`);

    const sessionInfo = sessions.get(sessionId);
    if (sessionInfo) {
      const endUrl = `${SF_API_HOST}/einstein/ai-agent/v1/sessions/${sessionId}`;

      try {
        await axios.delete(endUrl, {
          headers: {
            Authorization: `Bearer ${sessionInfo.accessToken}`,
            "x-session-end-reason": "UserRequest",
          },
          timeout: 10000,
        });
      } catch (err) {
        // Session might already be ended
        console.log("⚠️ Session may already be ended");
      }

      sessions.delete(sessionId);
    }

    res.json({
      success: true,
      message: "Session ended",
    });
  } catch (error) {
    console.error("❌ Failed to end session:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to end session",
    });
  }
});

// Clean up old sessions (run periodically)
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [sessionId, info] of sessions.entries()) {
    if (now - info.createdAt > maxAge) {
      console.log(`🧹 Cleaning up old session: ${sessionId}`);
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Start server
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Bhashini Proxy Server`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 Transcribe: http://localhost:${PORT}/api/transcribe`);
  console.log(
    `🌐 Multi-language: http://localhost:${PORT}/api/transcribe-multi`
  );
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

app.post("/api/bhashini-pipeline", async (req, res) => {
  const startTime = Date.now();

  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({
        error: "Missing audioBase64 in request body",
        success: false,
      });
    }

    if (!process.env.BHASHINI_API_KEY) {
      return res.status(500).json({
        error: "BHASHINI_API_KEY not configured on server",
        success: false,
      });
    }

    console.log(
      `[${new Date().toISOString()}] 🚀 Starting two-step process: ALD → ASR+NMT`
    );
    console.log(`   Audio size: ${audioBase64.length} characters`);
    console.log(
      `   Audio size (bytes): ~${Math.round(audioBase64.length * 0.75)}`
    );

    const headers = {
      Accept: "*/*",
      "User-Agent": "Voice-Assistant",
      Authorization: process.env.BHASHINI_API_KEY,
      "Content-Type": "application/json",
    };

    // ============================================================
    // STEP 1: Audio Language Detection (ALD) - Separate Call
    // ============================================================
    console.log(`   🔍 STEP 1: Detecting language...`);

    const aldPayload = {
      pipelineTasks: [
        {
          taskType: "audio-lang-detection",
          config: {
            serviceId: "bhashini/iitmandi/audio-lang-detection/gpu",
          },
        },
      ],
      inputData: {
        audio: [
          {
            audioContent: audioBase64,
          },
        ],
      },
    };

    const aldResponse = await axios.post(
      process.env.BHASHINI_API_URL ||
        "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
      aldPayload,
      {
        headers: headers,
        timeout: 20000,
      }
    );

    // Extract detected language from ALD response
    let detectedLanguage = "";
    let detectedScript = "";
    let confidence = 0;

    if (aldResponse.data && aldResponse.data.pipelineResponse) {
      for (const task of aldResponse.data.pipelineResponse) {
        if (task.taskType === "audio-lang-detection" && task.output) {
          for (const output of task.output) {
            if (output.langPrediction && output.langPrediction.length > 0) {
              // Log all predictions for debugging
              console.log(`   📊 All predictions:`, output.langPrediction.slice(0, 5).map(p =>
                `${p.langCode}(${(p.langScore * 100).toFixed(1)}%)`
              ).join(', '));

              const topPrediction = output.langPrediction[0];
              detectedLanguage = topPrediction.langCode;
              confidence = topPrediction.langScore;
              detectedScript = topPrediction.scriptCode;

              console.log(`   🌐 Detected: ${detectedLanguage} (${detectedScript})`);
              console.log(`   📊 Confidence: ${(confidence * 100).toFixed(2)}%`);
              break;
            }
          }
        }
      }
    }

    if (!detectedLanguage) {
      console.log(`   ❌ Could not detect language`);
      return res.status(200).json({
        success: false,
        message: "Could not detect language from audio",
        processingTime: Date.now() - startTime,
      });
    }

    // ============================================================
    // STEP 2: ASR + Translation Pipeline (based on detected language)
    // ============================================================
    console.log(`   🎤 STEP 2: Transcribing in ${detectedLanguage}...`);

    // Choose appropriate ASR service based on detected language (as per Bhashini docs)
    let asrServiceId;
    if (detectedLanguage === 'en') {
      // English - use Whisper
      asrServiceId = "ai4bharat/whisper-medium-en--gpu--t4";
      console.log(`   ✅ Using: ai4bharat/whisper-medium-en (English)`);
    } else if (['te', 'ta', 'kn', 'ml'].includes(detectedLanguage)) {
      // Dravidian languages - Telugu, Tamil, Kannada, Malayalam
      asrServiceId = "ai4bharat/conformer-multilingual-dravidian-gpu--t4";
      console.log(`   ✅ Using: conformer-multilingual-dravidian (${detectedLanguage})`);
    } else if (['hi', 'bn', 'mr', 'ur', 'or', 'pa', 'gu', 'sa'].includes(detectedLanguage)) {
      // Indo-Aryan languages - Hindi, Bengali, Marathi, Urdu, Odia, Punjabi, Gujarati, Sanskrit
      asrServiceId = "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4";
      console.log(`   ✅ Using: conformer-multilingual-indo_aryan (${detectedLanguage})`);
    } else {
      // Fallback to multilingual ASR
      asrServiceId = "bhashini/ai4bharat/conformer-multilingual-asr";
      console.log(`   ✅ Using: conformer-multilingual-asr (fallback for ${detectedLanguage})`);
    }

    // Build pipeline tasks for ASR + optional translation
    const pipelineTasks = [
      {
        taskType: "asr",
        config: {
          language: {
            sourceLanguage: detectedLanguage,
          },
          serviceId: asrServiceId,
          audioFormat: "wav",
          samplingRate: 16000,
        },
      },
    ];

    // Add translation task only if not English
    if (detectedLanguage !== 'en') {
      pipelineTasks.push({
        taskType: "translation",
        config: {
          language: {
            sourceLanguage: detectedLanguage,
            targetLanguage: "en",
          },
          serviceId: "ai4bharat/indictrans-v2-all-gpu--t4",
        },
      });
      console.log(`   🌍 Will translate: ${detectedLanguage} → en (using indictrans-v2)`);
    } else {
      console.log(`   ℹ️  No translation needed (already English)`);
    }

    const asrPayload = {
      pipelineTasks: pipelineTasks,
      inputData: {
        audio: [
          {
            audioContent: audioBase64,
          },
        ],
      },
    };

    const response = await axios.post(
      process.env.BHASHINI_API_URL ||
        "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
      asrPayload,
      {
        headers: headers,
        timeout: 30000,
      }
    );

    const processingTime = Date.now() - startTime;
    console.log(`   ⏱️  Total time: ${processingTime}ms`);

    // Extract ASR and translation results
    let originalText = "";
    let translatedText = "";

    if (response.data && response.data.pipelineResponse) {
      for (const task of response.data.pipelineResponse) {
        // Extract ASR results
        if (task.taskType === "asr" && task.output) {
          for (const output of task.output) {
            if (output.source) {
              originalText = output.source;
              console.log(`   🎤 Transcribed: "${originalText}"`);
              break;
            }
          }
        }

        // Extract Translation results
        if (task.taskType === "translation" && task.output) {
          for (const output of task.output) {
            if (output.target) {
              translatedText = output.target;
              console.log(`   🌍 Translated: "${translatedText}"`);
              break;
            }
          }
        }
      }
    }

    // Validate transcription
    if (!originalText || originalText.trim() === "") {
      console.log(`   ❌ No speech detected`);
      return res.status(200).json({
        success: false,
        message: "No speech detected in audio",
        detectedLanguage: detectedLanguage,
        processingTime: processingTime,
      });
    }

    // For English, use original text as translated text
    if (detectedLanguage === 'en') {
      translatedText = originalText;
    }

    console.log(`  ✅ Complete! Lang: ${detectedLanguage}, Text: "${translatedText || originalText}"`);

    res.json({
      success: true,
      detectedLanguage: detectedLanguage,
      detectedScript: detectedScript,
      confidence: confidence,
      originalText: originalText,
      translatedText: translatedText || originalText, // Fallback to original if translation fails
      processingTime: processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error(`[${new Date().toISOString()}] ❌ Pipeline error:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      processingTime: processingTime,
    });

    let statusCode = 500;
    let errorMessage = "Pipeline processing failed";
    let errorDetails = error.message;

    if (error.code === "ECONNABORTED") {
      statusCode = 504;
      errorMessage = "Request timeout - Bhashini API took too long to respond";
    } else if (error.code === "ECONNREFUSED") {
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
      processingTime: processingTime,
    });
  }
});

// ==============================================================
// AUDIO LANGUAGE DETECTION (ALD) - DEDICATED ENDPOINT
// ==============================================================

app.post("/api/detect-language", async (req, res) => {
  const startTime = Date.now();

  try {
    const { audioBase64 } = req.body;

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

    console.log(`[${new Date().toISOString()}] 🔍 Audio Language Detection request`);
    console.log(`   Audio size: ${audioBase64.length} characters`);

    const headers = {
      Accept: "*/*",
      "User-Agent": "Voice-Assistant",
      Authorization: process.env.BHASHINI_API_KEY,
      "Content-Type": "application/json"
    };

    const aldPayload = {
      pipelineTasks: [
        {
          taskType: "audio-lang-detection",
          config: {
            serviceId: "bhashini/iitmandi/audio-lang-detection/gpu"
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

    const aldResponse = await axios.post(
      process.env.BHASHINI_API_URL ||
        "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
      aldPayload,
      {
        headers: headers,
        timeout: 20000
      }
    );

    // Extract detected language from ALD response
    let detectedLanguage = "";
    let detectedScript = "";
    let confidence = 0;

    if (aldResponse.data && aldResponse.data.pipelineResponse) {
      for (const task of aldResponse.data.pipelineResponse) {
        if (task.taskType === "audio-lang-detection" && task.output) {
          for (const output of task.output) {
            if (output.langPrediction && output.langPrediction.length > 0) {
              console.log(`   📊 Predictions:`, output.langPrediction.slice(0, 5).map(p =>
                `${p.langCode}(${(p.langScore * 100).toFixed(1)}%)`
              ).join(', '));

              const topPrediction = output.langPrediction[0];
              detectedLanguage = topPrediction.langCode;
              confidence = topPrediction.langScore;
              detectedScript = topPrediction.scriptCode;

              console.log(`   ✅ Detected: ${detectedLanguage} (${(confidence * 100).toFixed(2)}%)`);
              break;
            }
          }
        }
      }
    }

    if (!detectedLanguage) {
      console.log(`   ⚠️ Could not detect language`);
      return res.status(200).json({
        success: false,
        message: "Could not detect language from audio",
        processingTime: Date.now() - startTime
      });
    }

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      detectedLanguage: detectedLanguage,
      detectedScript: detectedScript,
      confidence: confidence,
      processingTime: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error(`[${new Date().toISOString()}] ❌ Language detection error:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      code: error.code
    });

    let statusCode = 500;
    let errorMessage = "Language detection failed";
    let errorDetails = error.message;

    if (error.code === "ECONNABORTED") {
      statusCode = 504;
      errorMessage = "Request timeout - Bhashini API took too long to respond";
    } else if (error.code === "ECONNREFUSED") {
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

// ==============================================================
// ASR + TRANSLATION PIPELINE (uses pre-detected language)
// ==============================================================

app.post("/api/transcribe-with-language", async (req, res) => {
  const startTime = Date.now();

  try {
    const { audioBase64, detectedLanguage } = req.body;

    if (!audioBase64) {
      return res.status(400).json({
        error: "Missing audioBase64 in request body",
        success: false
      });
    }

    if (!detectedLanguage) {
      return res.status(400).json({
        error: "Missing detectedLanguage in request body",
        success: false
      });
    }

    if (!process.env.BHASHINI_API_KEY) {
      return res.status(500).json({
        error: "BHASHINI_API_KEY not configured on server",
        success: false
      });
    }

    console.log(`[${new Date().toISOString()}] 🎤 ASR+Translation request`);
    console.log(`   Detected Language: ${detectedLanguage}`);
    console.log(`   Audio size: ~${Math.round(audioBase64.length * 0.75)} bytes`);

    const headers = {
      Accept: "*/*",
      "User-Agent": "Voice-Assistant",
      Authorization: process.env.BHASHINI_API_KEY,
      "Content-Type": "application/json"
    };

    // Choose appropriate ASR service based on detected language
    let asrServiceId;
    if (detectedLanguage === 'en') {
      asrServiceId = "ai4bharat/whisper-medium-en--gpu--t4";
      console.log(`   ✅ Using: Whisper (English)`);
    } else if (['te', 'ta', 'kn', 'ml'].includes(detectedLanguage)) {
      asrServiceId = "ai4bharat/conformer-multilingual-dravidian-gpu--t4";
      console.log(`   ✅ Using: Conformer Dravidian (${detectedLanguage})`);
    } else if (['hi', 'bn', 'mr', 'ur', 'or', 'pa', 'gu', 'sa'].includes(detectedLanguage)) {
      asrServiceId = "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4";
      console.log(`   ✅ Using: Conformer Indo-Aryan (${detectedLanguage})`);
    } else {
      asrServiceId = "bhashini/ai4bharat/conformer-multilingual-asr";
      console.log(`   ✅ Using: Multilingual Fallback (${detectedLanguage})`);
    }

    // Build pipeline tasks
    const pipelineTasks = [
      {
        taskType: "asr",
        config: {
          language: {
            sourceLanguage: detectedLanguage
          },
          serviceId: asrServiceId,
          audioFormat: "wav",
          samplingRate: 16000
        }
      }
    ];

    // Add translation task only if not English
    if (detectedLanguage !== 'en') {
      pipelineTasks.push({
        taskType: "translation",
        config: {
          language: {
            sourceLanguage: detectedLanguage,
            targetLanguage: "en"
          },
          serviceId: "ai4bharat/indictrans-v2-all-gpu--t4"
        }
      });
      console.log(`   🌍 Adding translation: ${detectedLanguage} → en`);
    }

    const asrPayload = {
      pipelineTasks: pipelineTasks,
      inputData: {
        audio: [
          {
            audioContent: audioBase64
          }
        ]
      }
    };

    const response = await axios.post(
      process.env.BHASHINI_API_URL ||
        "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
      asrPayload,
      {
        headers: headers,
        timeout: 30000
      }
    );

    // Extract results
    let originalText = "";
    let translatedText = "";

    if (response.data && response.data.pipelineResponse) {
      for (const task of response.data.pipelineResponse) {
        if (task.taskType === "asr" && task.output) {
          for (const output of task.output) {
            if (output.source) {
              originalText = output.source;
              console.log(`   🎤 Transcribed: "${originalText}"`);
              break;
            }
          }
        }

        if (task.taskType === "translation" && task.output) {
          for (const output of task.output) {
            if (output.target) {
              translatedText = output.target;
              console.log(`   🌍 Translated: "${translatedText}"`);
              break;
            }
          }
        }
      }
    }

    if (!originalText || originalText.trim() === "") {
      console.log(`   ⚠️ No speech detected`);
      return res.status(200).json({
        success: false,
        message: "No speech detected in audio",
        detectedLanguage: detectedLanguage,
        processingTime: Date.now() - startTime
      });
    }

    // For English, use original text as translated text
    if (detectedLanguage === 'en') {
      translatedText = originalText;
    }

    const processingTime = Date.now() - startTime;
    console.log(`   ✅ Complete! Time: ${processingTime}ms`);

    res.json({
      success: true,
      detectedLanguage: detectedLanguage,
      originalText: originalText,
      translatedText: translatedText || originalText,
      processingTime: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error(`[${new Date().toISOString()}] ❌ ASR error:`, {
      message: error.message,
      status: error.response?.status,
      code: error.code,
      processingTime: processingTime
    });

    let statusCode = 500;
    let errorMessage = "Transcription failed";
    let errorDetails = error.message;

    if (error.code === "ECONNABORTED") {
      statusCode = 504;
      errorMessage = "Request timeout";
    } else if (error.code === "ECONNREFUSED") {
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

// ==============================================================
// BHASHINI TEXT-TO-SPEECH (TTS) ENDPOINT
// Add this to your server.js file after other endpoints
// ==============================================================





// Text-to-Speech endpoint
app.post("/api/tts", async (req, res) => {
  const startTime = Date.now();

  try {
    const { text, language, gender } = req.body;

    // Validation
    if (!text) {
      return res.status(400).json({
        error: "Missing text in request body",
        success: false
      });
    }

    if (!process.env.BHASHINI_API_KEY) {
      return res.status(500).json({
        error: "BHASHINI_API_KEY not configured on server",
        success: false
      });
    }

    console.log(`[${new Date().toISOString()}] 🔊 TTS request received`);
    console.log(`   Language: ${language}`);
    console.log(`   Gender: ${gender}`);
    console.log(`   Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    // Get appropriate TTS service ID based on language
    const getTTSServiceId = (lang) => {
      // Dravidian languages (Telugu, Tamil, Kannada, Malayalam)
      if (['te', 'ta', 'kn', 'ml'].includes(lang)) {
        return 'Bhashini/IITM/TTS';
      }
      // Indo-Aryan languages (Hindi, Marathi, Gujarati, Bengali, Punjabi, Odia)
      if (['hi', 'mr', 'gu', 'bn', 'pa', 'or'].includes(lang)) {
        return 'Bhashini/IITM/TTS';
      }
      // English
      if (lang === 'en') {
        return 'Bhashini/IITM/TTS';
      }
      // Default to Indo-Aryan
      return 'Bhashini/IITM/TTS';
    };

    const serviceId = getTTSServiceId(language);

    console.log(`   Service ID: ${serviceId}`);
    console.log(`   Gender: ${gender}`);

    // Prepare TTS request payload with translation pipeline
    // If target language is not English, add translation task
    const pipelineTasks = [];

    if (language !== 'en') {
      // Add translation task (English to target language)
      pipelineTasks.push({
        taskType: "translation",
        config: {
          language: {
            sourceLanguage: "en",
            targetLanguage: language
          },
          serviceId: "ai4bharat/indictrans-v2-all-gpu--t4"
        }
      });
      console.log(`   🌍 Adding translation: en → ${language}`);
    }

    // Add TTS task
    pipelineTasks.push({
      taskType: "tts",
      config: {
        language: {
          sourceLanguage: language
        },
        serviceId: serviceId,
        gender: gender,
        samplingRate: 8000
      }
    });

    const payload = {
      pipelineTasks: pipelineTasks,
      inputData: {
        input: [
          {
            source: text
          }
        ]
      }
    };

    const headers = {
      'Accept': '*/*',
      'User-Agent': 'Voice-Assistant',
      'Authorization': process.env.BHASHINI_API_KEY,
      'Content-Type': 'application/json'
    };

    console.log(`   🚀 Sending to Bhashini TTS API...`);

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

    // Extract audio content from response
    let audioContent = "";

    if (response.data && response.data.pipelineResponse) {
      for (const task of response.data.pipelineResponse) {
        if (task.taskType === 'tts' && task.audio) {
          for (const audio of task.audio) {
            if (audio.audioContent) {
              audioContent = audio.audioContent;
              break;
            }
          }
        }
        if (audioContent) break;
      }
    }

    if (!audioContent) {
      console.log(`   ⚠️  No audio generated`);
      return res.status(200).json({
        success: false,
        message: "Failed to generate audio",
        processingTime: processingTime
      });
    }

    console.log(`   ✅ TTS generation successful`);
    console.log(`   📊 Audio size: ~${Math.round(audioContent.length * 0.75)} bytes`);

    res.json({
      success: true,
      audioContent: audioContent,
      language: language,
      gender: gender,
      processingTime: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error(`[${new Date().toISOString()}] ❌ TTS error:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      processingTime: processingTime
    });

    let statusCode = 500;
    let errorMessage = "TTS generation failed";
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

// Update the server startup log to include TTS endpoint
// Modify the app.listen() section to add:
console.log(`🔊 Text-to-Speech: http://localhost:${PORT}/api/tts`);
// ==============================================================
