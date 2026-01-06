import axios from 'axios';

const client = axios.create({
    baseURL: 'http://localhost:8000', // Backend adresi
    headers: {
        'Content-Type': 'application/json',
    },
});

// Her isteğe otomatik token ekle (Login sonrası)
client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        
    }
    return config;
});

export default client;