const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const proxy = 'socks5h://184.178.172.14:4145'; // Proxy
const lang = 'en';
const charList = ' ' + 'abcdefghijklmnopqrstuvwxyz0123456789';

async function makeGoogleRequest(query) {
  try {
    const response = await axios.get('http://suggestqueries.google.com/complete/search', {
      params: {
        client: 'firefox',
        hl: lang,
        q: query,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      proxy: false,
      httpsAgent: new SocksProxyAgent(proxy),
      timeout: 5000, // 5 seconds timeout
    });
    return response.data[1] || [];
  } catch (error) {
    console.error(`Error fetching "${query}":`, error.message);
    return [];
  }
}

async function getAutocompleteSuggestions(keyword) {
  const queries = [...charList].map(c => `${keyword} ${c}`);
  
  const results = await Promise.all(
    queries.map(query => makeGoogleRequest(query))
  );

  const flatSuggestions = results.flat();
  const uniqueSuggestions = Array.from(new Set(flatSuggestions.filter(Boolean)));

  // Return first 30 if too many
  return uniqueSuggestions; //.slice(0, 60);
}

// Example usage
// (async () => {
//   const suggestions = await getAutocompleteSuggestions('neerja movie');
//   console.log(suggestions.length, suggestions);
// })();

module.exports = { getAutocompleteSuggestions };
