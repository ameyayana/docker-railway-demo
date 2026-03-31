import Fastify from 'fastify';
import axios from 'axios';
import 'dotenv/config'; 

// This is an API for us to look for jobs in our area. 
// The / route will return all endpoints as an array.
const app = Fastify({ logger: true });

const LINKUP_API_KEY = process.env.LINKUP_API_KEY;
const LINKUP_BASE_URL = 'https://api.linkup.so/v1';

console.log({ LINKUP_API_KEY: LINKUP_API_KEY ? "LOADED" : "MISSING" });

app.get('/health', async () => {
  // Updated version to 1.3.0 to trigger GitHub Actions
  return { status: 'ok', version: '1.3.0' };
});

app.get('/', async () => {
  return {
    name: 'JobSearch API',
    // Added a custom message to ensure git detects a change
    description: 'Powered by Linkup. Deployment automated via GitHub Actions by Ameowlia.',
    endpoints: [
      'GET  /health',
      'GET  /api/jobs?query=<role>&location=<location>',
      'GET  /api/company?name=<company>',
      'POST /api/search   body: { query, depth }',
    ],
  };
});

app.post('/api/search', async (request, reply) => {
  const { query, depth = 'standard' } = request.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return reply.status(400).send({ error: 'query must be a non-empty string' });
  }
  if (!['standard', 'deep'].includes(depth)) {
    return reply.status(400).send({ error: 'depth must be "standard" or "deep"' });
  }

  try {
    const response = await axios.post(
      `${LINKUP_BASE_URL}/search`,
      { q: query.trim(), depth, outputType: 'searchResults' },
      { headers: { Authorization: `Bearer ${LINKUP_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || 'Linkup API error';
    return reply.status(status).send({ error: message });
  }
});

app.get('/api/jobs', async (request, reply) => {
  const { query, location = 'Malaysia' } = request.query;

  if (!query || query.trim() === '') {
    return reply.status(400).send({ error: 'query parameter is required' });
  }

  const searchQuery = `${query.trim()} jobs in ${location}`;

  try {
    const response = await axios.post(
      `${LINKUP_BASE_URL}/search`,
      { q: searchQuery, depth: 'standard', outputType: 'searchResults' },
      { headers: { Authorization: `Bearer ${LINKUP_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const results = response.data.results || [];
    return {
      query: searchQuery,
      count: results.length,
      results: results.map(r => ({
        title: r.name,
        url: r.url,
        snippet: r.content?.slice(0, 300),
      })),
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || 'Linkup API error';
    return reply.status(status).send({ error: message });
  }
});

app.get('/api/company', async (request, reply) => {
  const { name } = request.query;

  if (!name || name.trim() === '') {
    return reply.status(400).send({ error: 'name parameter is required' });
  }

  try {
    const response = await axios.post(
      `${LINKUP_BASE_URL}/search`,
      {
        q: `${name.trim()} company hiring jobs open roles 2024 2025`,
        depth: 'standard',
        outputType: 'searchResults',
      },
      { headers: { Authorization: `Bearer ${LINKUP_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const results = response.data.results || [];
    return {
      company: name.trim(),
      count: results.length,
      results: results.map(r => ({
        title: r.name,
        url: r.url,
        snippet: r.content?.slice(0, 300),
      })),
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || 'Linkup API error';
    return reply.status(status).send({ error: message });
  }
});

const start = async () => {
  try {
    await app.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Logic to check if module is being run directly
const isMain = import.meta.url.endsWith(process.argv[1]) || 
               process.argv[1]?.includes('app.js');

if (isMain) {
  start();
}

export { app };