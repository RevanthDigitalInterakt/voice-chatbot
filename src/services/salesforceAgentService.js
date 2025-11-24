/**
 * Salesforce Agentforce API Service
 * Create this file: src/services/salesforceAgentService.js
 */

import axios from 'axios';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000';

class SalesforceAgentService {
  constructor() {
    this.sessionId = null;
    this.accessToken = null;
  }

  /**
   * Start a new Agentforce session
   */
  async startSession() {
    try {
      console.log('🚀 Starting Agentforce session...');
      
      const response = await axios.post(
        `${PROXY_URL}/api/salesforce/start-session`,
        {},
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      if (response.data.success) {
        this.sessionId = response.data.sessionId;
        console.log('✅ Session started:', this.sessionId);
        
        // Return initial greeting if available
        return response.data.initialMessage || 'Session started successfully';
      } else {
        throw new Error(response.data.error || 'Failed to start session');
      }
    } catch (error) {
      console.error('❌ Failed to start session:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to start Agentforce session');
    }
  }

  /**
   * Send message to Agentforce agent with streaming
   */
  async sendMessage(message) {
    if (!this.sessionId) {
      throw new Error('No active session. Please start a session first.');
    }

    try {
      console.log('📤 Sending message to Agentforce:', message);
      
      const response = await axios.post(
        `${PROXY_URL}/api/salesforce/send-message`,
        {
          sessionId: this.sessionId,
          message: message
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000 // Longer timeout for agent responses
        }
      );

      if (response.data.success) {
        console.log('✅ Received response from Agentforce');
        return response.data.message || 'No response from agent';
      } else {
        throw new Error(response.data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to communicate with Agentforce');
    }
  }

  /**
   * End the current session
   */
  async endSession() {
    if (!this.sessionId) {
      return;
    }

    try {
      console.log('👋 Ending Agentforce session...');
      
      await axios.post(
        `${PROXY_URL}/api/salesforce/end-session`,
        {
          sessionId: this.sessionId
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      console.log('✅ Session ended');
      this.sessionId = null;
    } catch (error) {
      console.error('⚠️ Error ending session:', error);
      // Don't throw - session might already be expired
      this.sessionId = null;
    }
  }

  /**
   * Check if session is active
   */
  isSessionActive() {
    return !!this.sessionId;
  }

  /**
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
  }
}

// Export singleton instance
const salesforceAgent = new SalesforceAgentService();
export default salesforceAgent;