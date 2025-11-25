// Fonction Netlify serverless - Proxy API vers le backend Render
// Cela permet aux requêtes API de passer par Netlify sans problèmes CORS

const axios = require('axios');

const BACKEND_URL = process.env.REACT_APP_API_URL || 'https://speakfree-api.onrender.com';

exports.handler = async (event) => {
  // Récupérer le chemin de l'API
  const path = event.path.replace('/.netlify/functions/api-proxy', '');
  const method = event.httpMethod;
  const headers = event.headers;
  const body = event.body ? JSON.parse(event.body) : null;

  try {
    // Construire l'URL complète
    const url = `${BACKEND_URL}${path}`;

    // Effectuer l'appel API
    const response = await axios({
      method,
      url,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': headers.authorization || ''
      }
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: error.message,
        details: error.response?.data
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
