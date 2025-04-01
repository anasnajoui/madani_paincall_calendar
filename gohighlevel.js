const fetch = require('node-fetch');

// Le chiavi API saranno lette dalle variabili d'ambiente di Vercel
const API_KEY = process.env.GOHIGHLEVEL_API_KEY;
const BASE_API_URL = 'https://rest.gohighlevel.com/v1';

export default async function handler(req, res) {
  // Gestione CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gestione richieste preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Estrai endpoint e parametri dalla query
    const { endpoint, ...params } = req.query;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint parameter is required' });
    }

    // Costruisci l'URL completo dell'API GoHighLevel
    let apiUrl = `${BASE_API_URL}/${endpoint}`;
    
    // Per GET requests, aggiungi i parametri all'URL
    if (req.method === 'GET') {
      const queryParams = new URLSearchParams();
      
      for (const [key, value] of Object.entries(params)) {
        queryParams.append(key, value);
      }
      
      const queryString = queryParams.toString();
      if (queryString) {
        apiUrl += `?${queryString}`;
      }
    }

    console.log(`Proxying ${req.method} request to: ${apiUrl}`);

    // Effettua la chiamata all'API GoHighLevel
    const response = await fetch(apiUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      ...(req.method !== 'GET' && req.body && { body: JSON.stringify(req.body) })
    });

    // Leggi la risposta come JSON o testo in base allo status
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
      try {
        // Tenta di parsare come JSON anche se il content-type non è json
        data = JSON.parse(data);
      } catch (e) {
        // Se non è JSON, lascia il testo così com'è
      }
    }

    // Ritorna lo stesso status code e corpo della risposta originale
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying to GoHighLevel:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch data from GoHighLevel',
      message: error.message 
    });
  }
} 