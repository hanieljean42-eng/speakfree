// Fonction Netlify - Vérifier la santé du backend Render

const axios = require('axios');

const BACKEND_URL = process.env.REACT_APP_API_URL || 'https://speakfree-api.onrender.com';

exports.handler = async (event) => {
  try {
    // Tenter une connexion simple au backend
    const response = await axios.get(`${BACKEND_URL}/api/schools/stats/global`, {
      timeout: 5000
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'healthy',
        backend: 'online',
        timestamp: new Date().toISOString(),
        data: response.data
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        status: 'unhealthy',
        backend: 'offline',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
};
