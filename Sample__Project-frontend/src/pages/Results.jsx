import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// --- GELİŞMİŞ TEMİZLİKÇİ FONKSİYON ---
const formatFeedbackText = (text) => {
  if (!text) return "Değerlendirme bekleniyor...";

  // 1. Temel Karakter Temizliği
  let cleanText = text
    .replace(/\?\?\?/g, "")
    .replace(/\?\?/g, "")
    .replace(/Transcript:/gi, "TRANSKRİPT:")
    .replace(/Yorum:/gi, "YORUM:");

  // 2. KESİN ÇÖZÜM: Eski veritabanı kayıtlarındaki hoca yorumlarını AI metninden söküp atıyoruz.
  cleanText = cleanText.split(/>>|\[Teacher|\[ÖĞRETMEN/i)[0];

  // Sondaki boşlukları temizle
  cleanText = cleanText.trim();

  // 3. Kalın Yazıları Başlık Yap (**Yazı**)
  const parts = cleanText.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={index} className="font-bold text-white block mt-5 mb-2 text-lg border-b border-gray-700 pb-1 inline-block">
          {part.replace(/\*\*/g, "")}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

const Results = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  // --- EKLENEN KISIM: SAYFAYI EN TEPEYE KAYDIR ---
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  // ------------------------------------------------

  const result = state?.result;

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0b1221] flex items-center justify-center p-6 font-sans">
         <div className="bg-[#111827] p-8 rounded-2xl border border-gray-700 text-center shadow-2xl max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-2">Sonuç Bulunamadı</h2>
            <button onClick={() => navigate('/student/dashboard')} className="w-full bg-gray-800 text-white py-3 rounded-xl mt-4">
                Dashboard'a Dön
            </button>
         </div>
      </div>
    );
  }

  // Skor Renkleri
  const scoreColor = result.score >= 80 ? 'text-green-400' : result.score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const scoreBorder = result.score >= 80 ? 'border-green-500' : result.score >= 50 ? 'border-yellow-500' : 'border-red-500';
  const scoreBg = result.score >= 80 ? 'bg-green-500/10' : result.score >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10';

  return (
    <div className="min-h-screen bg-[#0b1221] text-gray-200 py-10 px-4 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* --- HEADER --- */}
        <div className="bg-[#111827] rounded-3xl shadow-2xl border border-gray-700 overflow-hidden relative p-8 md:p-10 flex flex-col md:flex-row justify-between items-center gap-8">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
             <div>
                <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase border border-blue-500/20">
                    {result.type} Result
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-3">Değerlendirme Raporu</h1>
             </div>
             <div className={`relative w-32 h-32 rounded-full border-4 ${scoreBorder} ${scoreBg} flex flex-col items-center justify-center backdrop-blur-sm shadow-2xl`}>
                <span className={`text-5xl font-black ${scoreColor}`}>{result.score}</span>
                <span className="text-xs font-bold uppercase text-gray-400 mt-1">Puan</span>
             </div>
        </div>

        {/* --- İÇERİK --- */}
        <div className="space-y-8">
            
            {/* --- ÖĞRETMEN NOTU KUTUSU --- */}
            {result.teacher_comment && (
                <div className="bg-gradient-to-r from-blue-900/40 to-[#111827] border-l-4 border-blue-500 rounded-r-2xl p-8 shadow-lg relative overflow-hidden">
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <h3 className="text-blue-400 font-bold flex items-center gap-2 text-xl">
                            <span>👨‍🏫</span> Öğretmen Notu
                        </h3>
                        
                        {/* GÜNCEL PUANI BURADA GÖSTERİYORUZ */}
                        {result.teacher_updated && (
                             <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 animate-pulse">
                                <span>Yeni Puan:</span>
                                <span className="text-xl">{result.score}</span>
                             </div>
                        )}
                    </div>
                    
                    <div className="text-white text-lg font-medium leading-relaxed italic border-l-2 border-gray-600 pl-4 ml-1 bg-black/20 p-4 rounded-r-lg">
                        "{result.teacher_comment}"
                    </div>
                </div>
            )}

            {/* 1. AI YORUMU (Temizlenmiş) */}
            <div className="bg-[#1a1625] border border-purple-500/30 rounded-2xl p-8 relative overflow-hidden group shadow-lg">
                <h3 className="text-purple-400 font-bold mb-4 flex items-center gap-2 text-xl">
                    <span className="text-2xl">🧞‍♂️</span> AI Analizi
                </h3>
                <div 
                  className="text-gray-200 leading-relaxed text-lg font-light" 
                  style={{ whiteSpace: "pre-wrap" }}
                >
                    {formatFeedbackText(result.feedback_text)}
                </div>
            </div>

            {/* 2. HATALAR VE GELİŞİM ALANLARI */}
            <div className="bg-[#111827] border border-gray-700 rounded-2xl p-8 shadow-lg">
                <h3 className="text-white font-bold mb-6 flex items-center gap-2 text-xl border-b border-gray-800 pb-4">
                    <span className="bg-red-500/20 text-red-500 p-2 rounded-lg text-lg">⚠️</span>
                    Gelişim Alanları
                </h3>

                {result.mistakes && result.mistakes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {result.mistakes.map((m, i) => (
                            <div key={i} className="bg-[#0f1420] border border-red-500/20 p-5 rounded-2xl">
                                <span className="inline-block bg-red-900/20 text-red-400 text-xs font-bold px-2 py-1 rounded mb-2">{m.error_type}</span>
                                <p className="text-gray-300 text-sm mb-3">{m.description}</p>
                                <div className="pt-3 border-t border-gray-800 text-green-400 text-sm font-medium">✓ {m.suggestion}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 opacity-80">
                         Mükemmel! Yapay zeka hata bulamadı.
                    </div>
                )}
            </div>

            {/* 3. QUIZ DETAYI */}
            {result.type === 'quiz' && result.feedback?.question_feedback && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white pl-2 border-l-4 border-blue-500">📝 Soru Analizi</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {result.feedback.question_feedback.map((q, i) => {
                            const isCorrect = q.your_answer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                            return (
                                <div key={i} className={`p-6 rounded-2xl border transition ${isCorrect ? 'bg-[#064e3b]/20 border-green-500/30' : 'bg-[#1f2937] border-gray-700'}`}>
                                    <p className="font-bold text-white mb-2"><span className="text-blue-500">Q{i+1}.</span> {q.question}</p>
                                    <p className="text-sm text-gray-400">Cevabın: <span className="text-white">{q.your_answer}</span></p>
                                    <p className="text-sm text-green-400">Doğru: {q.correct_answer}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        {/* BUTTONS */}
        <div className="flex justify-center gap-4 pt-10 pb-8">
            <button onClick={() => navigate('/student/dashboard')} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition border border-gray-600">Dashboard</button>
        </div>
      </div>
    </div>
  );
};

export default Results;