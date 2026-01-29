// Vercel serverless function: returns API base URL from env at runtime.
// Frontend fetches this so VITE_API_BASE_URL works without rebuilding.
export default function handler(req, res) {
  const url = process.env.VITE_API_BASE_URL || '';
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ apiBaseUrl: url.trim() });
}
