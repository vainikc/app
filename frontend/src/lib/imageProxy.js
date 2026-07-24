// Utility to proxy Instagram CDN images through backend to bypass CORP header
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const proxyImage = (url) => {
  if (!url) return '';
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('instagram.com')) {
    return `${BACKEND_URL}/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};
