import axios from 'axios';

export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL || 'https://api.wavey.info'
)
  .trim()
  .replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export default apiClient;
