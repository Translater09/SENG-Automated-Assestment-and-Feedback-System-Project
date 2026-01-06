import client from './client';
import axios from "axios";


export const loginUser = async (email, password) => {
  const res = await axios.post("http://127.0.0.1:8000/auth/login", {
    email,
    password
  });
  return res.data;
};

export const submitSpeaking = async (file, token) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('token', token);
    
    // Sequence Diagram: submitAudio -> Backend
    return await client.post('/activities/speaking', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const submitWriting = async (text, token) => {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('token', token);

    // Sequence Diagram: submitWriting -> Backend
    return await client.post('/activities/writing', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
};

export const getWeeklyReport = async (studentId, token) => {
    // FR9: Weekly Report
    return await client.get(`/reports/weekly/${studentId}?token=${token}`);
};
// src/api/submit.js dosyasının en altına ekle:

export const updateScore = async (submissionId, newScore, comment, token) => {
    // PUT isteği atıyoruz
    // Backend Form verisi beklediği için FormData kullanıyoruz yine
    const formData = new FormData();
    formData.append('token', token);
    
    
    
    return await client.put(`/teacher/review/${submissionId}`, {
        new_score: parseInt(newScore),
        teacher_comment: comment
    }, {
        headers: {
            'Content-Type': 'application/json'
        },
        params: { token: token } // Token'ı query string olarak gönderiyoruz
    });
    
};


export const submitQuiz = async (answersObj, token) => {
    // Cevap objesini stringe çevir (Örn: "Soru 1: A, Soru 2: B")
    const answersText = Object.entries(answersObj)
        .map(([q, a]) => `${q}: ${a}`)
        .join(", ");

    const formData = new FormData();
    formData.append('answers', answersText);
    formData.append('token', token);

    return await client.post('/activities/quiz', formData, {
        headers: { 'Content-Type': 'multipart/form-data' } // Form data olarak gönderiyoruz
    });
};