export const API_URL = import.meta.env.PUBLIC_API_URL || (typeof window !== 'undefined' && window.location.port === '4322' ? 'http://localhost:3032' : 'http://localhost:3031');
