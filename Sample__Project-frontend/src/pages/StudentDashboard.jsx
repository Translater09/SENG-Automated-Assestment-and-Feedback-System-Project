import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import RepeatedMistakes from "../components/RepeatedMistakes";

// --- TEMİZLİKÇİ FONKSİYON ---
const formatFeedbackText = (text) => {
  if (!text) return "Değerlendirme bekleniyor...";

  let cleanText = text
    .replace(/\?\?\?/g, "")
    .replace(/\?\?/g, "")
    .replace(/Transcript:/gi, "TRANSKRİPT:")
    .replace(/Yorum:/gi, "YORUM:");

  cleanText = cleanText.split(/>>|\[Teacher|\[ÖĞRETMEN/i)[0];

  const parts = cleanText.trim().split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={index} className="font-bold text-white block mt-3 mb-1 text-lg">
          {part.replace(/\*\*/g, "")}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export default function StudentDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [dailyQuote, setDailyQuote] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; 

  const token = localStorage.getItem("token");
  const firstName = localStorage.getItem("first_name") || "Student";
  const navigate = useNavigate();
  const API_URL = "http://127.0.0.1:8000";

  const quotes = [
    "İngilizceni geliştirmek için harika bir gün! 🌟",
    "Hata yapmaktan korkma, hatalar öğrenmenin kanıtıdır. 💪",
    "Bugün atacağın küçük bir adım, yarın büyük bir başarıya dönüşecek. 🚀",
    "Bir dil, yeni bir dünya demektir. Keşfetmeye devam et! 🌍",
    "İstikrar, yetenekten daha önemlidir. Çalışmaya devam! 📚",
    "Kendine güven, sandığından çok daha fazlasını yapabilirsin. 🔥",
    "Her gün %1 daha iyi olsan, yıl sonunda 37 kat daha iyi olursun. 📈",
    "Zorluklar başarının süsüdür. Pes etmek yok! 💎",
    "Bugün pratik yapmak için mükemmel bir zaman. ⏳",
    "Başarı, her gün tekrarlanan küçük çabaların toplamıdır. ✨"
  ];

  useEffect(() => {
    if (!token) {
        navigate("/login");
        return;
    }
    setDailyQuote(quotes[Math.floor(Math.random() * quotes.length)]);

    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_URL}/student/dashboard?token=${token}`);
        setSubmissions(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate]);

  const handleDelete = async (subId, e) => {
    e.stopPropagation(); 
    if(!window.confirm("Bu çalışmayı silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;

    try {
        await axios.delete(`${API_URL}/submission/${subId}`, { params: { token } });
        setSubmissions(prev => prev.filter(s => s.submission_id !== subId));
        if (currentItems.length === 1 && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
        alert("🗑️ Aktivite başarıyla silindi.");
    } catch (error) {
        console.error(error);
        alert("Silme işlemi sırasında hata oluştu.");
    }
  };

  const handleDownloadReport = async () => {
    try {
      setDownloadLoading(true);
      const response = await axios.get(`${API_URL}/report/download?token=${token}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Progress_Report_${firstName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Rapor indirilemedi:", err);
      alert("Rapor oluşturulurken bir hata oluştu.");
    } finally {
        setDownloadLoading(false);
    }
  };
  // --- EKSİK OLAN FONKSİYON (BUNU EKLE) ---
  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-400 border-green-500/50 bg-green-500/10";
    if (score >= 70) return "text-blue-400 border-blue-500/50 bg-blue-500/10";
    if (score >= 50) return "text-yellow-400 border-yellow-500/50 bg-yellow-500/10";
    return "text-red-400 border-red-500/50 bg-red-500/10";
  };
  const getScoreTextColor = (score) => {
    if (score >= 85) return "text-green-400";
    if (score >= 70) return "text-blue-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = submissions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(submissions.length / itemsPerPage);

  if (loading) return (
    <div className="min-h-screen bg-[#0b1221] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b1221] text-gray-200 pb-20 pt-10 font-sans">
      <div className="container mx-auto px-6 max-w-7xl">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
                Merhaba, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">{firstName}</span>! 👋
            </h1>
            <p className="text-gray-400 text-lg animate-fade-in">{dailyQuote}</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 mt-4 md:mt-0">
            <div className="hidden md:block text-right">
                <p className="text-sm text-gray-500 font-mono">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <button 
                onClick={handleDownloadReport}
                disabled={downloadLoading}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition shadow-lg text-sm font-bold"
            >
                {downloadLoading ? "Hazırlanıyor..." : "Gelişim Raporunu İndir (PDF)"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL: İSTATİSTİKLER */}
          <div className="space-y-8 h-fit">
            <div className="h-auto"> 
                <RepeatedMistakes hasActivity={submissions.length > 0} />
            </div>
            
            <div className="bg-[#111827] border border-gray-700 p-8 rounded-2xl shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-600/20 transition duration-500"></div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Son Aktİvİte Skoru</h3>
              <div className="flex items-baseline gap-2">
                 <span className={`text-6xl font-black tracking-tighter ${submissions[0]?.score >= 50 ? 'text-green-400' : submissions[0]?.score ? 'text-red-400' : 'text-gray-600'}`}>
                    {submissions[0]?.score || "0"}
                 </span>
                 <span className="text-gray-500 text-xl font-medium">/100</span>
              </div>
              <p className="text-sm text-gray-500 mt-4 border-t border-gray-800 pt-4">
                 {submissions.length > 0 ? "Son çalışmandan aldığın puan." : "Henüz puan yok."}
              </p>
            </div>
          </div>

          {/* SAĞ: AKTİVİTE LİSTESİ */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <span className="bg-blue-600/20 text-blue-400 p-2 rounded-lg">📜</span>
                    Aktivitelerim
                </h2>
                <span className="text-sm text-gray-500 bg-[#111827] px-3 py-1 rounded-full border border-gray-800">
                    Toplam: {submissions.length}
                </span>
            </div>
            
            <div className="flex flex-col gap-5 min-h-[400px]">
                {submissions.length === 0 ? (
                    <div className="bg-[#111827] p-12 rounded-2xl text-center border border-dashed border-gray-700 flex flex-col items-center">
                        <p className="text-xl text-white font-bold">Henüz hiç kayıt yok.</p>
                        <p className="text-gray-500 mt-2">Menüden "Writing", "Quiz" veya "Speaking" seçerek ilk adımını at! </p>
                    </div>
                ) : (
                    currentItems.map((sub) => (
                        <div 
                            key={sub.submission_id} 
                            onClick={() => setSelectedSub(sub)} 
                            className="group relative bg-[#111827] border border-gray-800 hover:border-blue-500/40 p-6 rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/10 flex flex-col md:flex-row justify-between gap-6 cursor-pointer"
                        >
                            
                            {/* SİLME BUTONU */}
                            <button 
                                onClick={(e) => handleDelete(sub.submission_id, e)}
                                className="absolute top-4 right-4 text-gray-600 hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition z-10 opacity-0 group-hover:opacity-100"
                                title="Aktiviteyi Sil"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>

                            {/* Sol: İkon ve Bilgi */}
                            <div className="flex gap-5 items-start">
                                <div className={`p-3 rounded-xl flex-shrink-0 ${
                                    sub.type === 'writing' ? 'bg-purple-900/20 text-purple-400' : 
                                    sub.type === 'speaking' ? 'bg-blue-900/20 text-blue-400' : 'bg-green-900/20 text-green-400'
                                }`}>
                                    {sub.type === 'writing' ? '✍️' : sub.type === 'speaking' ? '🎤' : '🧠'}
                                </div>

                                <div>
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <span className="text-white font-bold capitalize text-lg tracking-wide">
                                            {sub.type} Practice
                                        </span>
                                        <span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-1 rounded">
                                            {new Date(sub.created_at).toLocaleDateString()}
                                        </span>
                                        {sub.teacher_updated && (
                                            <span className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 text-[10px] px-2 py-1 rounded border border-yellow-500/20 font-bold uppercase tracking-wider">
                                                ★ Öğretmen İncelemesi
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-gray-400 text-sm leading-relaxed max-w-lg">
                                        {sub.teacher_comment 
                                            ? <span className="text-blue-300 font-medium bg-blue-900/10 px-2 py-0.5 rounded border border-blue-900/30">💬 Hoca: "{sub.teacher_comment.length > 50 ? sub.teacher_comment.substring(0,50)+"..." : sub.teacher_comment}"</span> 
                                            : "AI analizi ve detaylı geri bildirim için incele..."}
                                    </div>
                                </div>
                            </div>

                            {/* Sağ: Puan ve Buton */}
                            <div className="flex flex-col md:items-end justify-center border-t md:border-t-0 border-gray-800 pt-4 md:pt-0 pr-8">
                                {/* Hoca puanı değiştirdiyse AI notunu çiz, değiştirmediyse gösterme */}
                                {sub.teacher_updated && sub.ai_score !== undefined && sub.score !== sub.ai_score && (
                                     <span className="text-xs text-gray-500 line-through mr-1 opacity-70 mb-1 block">
                                        (AI: {sub.ai_score})
                                     </span>
                                )}
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Score</span>
                                    <span className={`text-3xl font-black ${getScoreTextColor(sub.score)}`}>
    {sub.score}
</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* --- SAYFALAMA BUTONLARI --- */}
            {submissions.length > itemsPerPage && (
                <div className="flex justify-center items-center gap-4 mt-8">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition border border-gray-700"
                    >
                        &lt; Önceki
                    </button>
                    <span className="text-gray-400 text-sm font-bold bg-[#111827] px-3 py-1 rounded border border-gray-700">
                        Sayfa {currentPage} / {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition border border-gray-700"
                    >
                        Sonraki &gt;
                    </button>
                </div>
            )}

          </div>
        </div>

        {/* --- DETAY MODALI (POPUP) --- */}
        {selectedSub && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-[#111827] w-full max-w-3xl rounded-3xl shadow-2xl border border-gray-700 flex flex-col max-h-[90vh] overflow-hidden">
              
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#0f1420]">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="capitalize">{selectedSub.type}</span> Detayı
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">{new Date(selectedSub.created_at).toLocaleString()}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-2xl font-black ${getScoreColor(selectedSub.score)}`}>
                    {selectedSub.score}
                  </div>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 bg-[#111827]">
                  
                  {/* --- ÖĞRETMEN NOTU --- */}
                  {selectedSub.teacher_comment && (
                      <div className="bg-gradient-to-r from-blue-900/40 to-[#111827] border-l-4 border-blue-500 p-6 rounded-r-xl shadow-lg relative">
                          <div className="flex justify-between items-start mb-2">
                             <h3 className="text-blue-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>👨‍🏫</span> Öğretmenİn Notu
                             </h3>
                             
                             {/* Puan değiştiyse yeni puanı göster */}
                             {selectedSub.score !== selectedSub.ai_score && (
                                <div className="flex flex-col items-end">
                                    <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md">
                                        Yeni Puan: {selectedSub.score}
                                    </div>
                                    {selectedSub.ai_score !== undefined && (
                                        <span className="text-[10px] text-blue-300 mt-1 font-mono opacity-80">
                                            (AI Puanı: {selectedSub.ai_score})
                                        </span>
                                    )}
                                </div>
                             )}
                          </div>
                          <p className="text-blue-100 text-lg italic leading-relaxed mt-2">"{selectedSub.teacher_comment}"</p>
                      </div>
                  )}

                  <div className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700">
                      <h3 className="text-gray-300 font-bold mb-3 text-sm uppercase tracking-wider flex items-center gap-2"><span>📝</span> Senin Çalışman / Cevapların</h3>
                      <div className="text-gray-400 whitespace-pre-wrap text-sm font-mono bg-black/30 p-4 rounded-xl border border-gray-700/50 max-h-60 overflow-y-auto custom-scrollbar leading-relaxed">
                        {selectedSub.content ? selectedSub.content : <span className="italic opacity-50">İçerik görüntülenemedi.</span>}
                      </div>
                  </div>

                  <div className="bg-gray-800/30 p-6 rounded-2xl border border-gray-800">
                      <h3 className="text-purple-400 font-bold mb-4 text-sm uppercase tracking-wider flex items-center gap-2"><span>🤖</span> Detaylı AI Yorumu</h3>
                      <div 
                        className="text-gray-300 text-base leading-7 font-light" 
                        style={{ whiteSpace: "pre-wrap" }} 
                      >
                        {formatFeedbackText(selectedSub.ai_feedback || selectedSub.evaluation?.feedback_text)}
                      </div>
                  </div>

                  {selectedSub.mistakes && selectedSub.mistakes.length > 0 && (
                      <div className="bg-[#0f1420] p-6 rounded-2xl border border-red-900/30">
                          {/* BAŞLIK GÜNCELLEMESİ */}
                          <h3 className="text-red-400 font-bold mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                            <span>{selectedSub.type?.toLowerCase() === 'quiz' ? '🧩' : '⚠️'}</span> 
                            {selectedSub.type?.toLowerCase() === 'quiz' ? 'Soru Analizi & Cevaplar' : 'Hatalar ve Gelişim Alanları'}
                          </h3>
                          
                          <div className="grid grid-cols-1 gap-4">
                              {selectedSub.mistakes.map((m, idx) => (
                                  <div key={idx} className="bg-[#1a1f2e] border border-gray-700 p-4 rounded-xl hover:border-blue-500/30 transition group">
                                      {/* Üst Kısım: Hata Türü */}
                                      <div className="flex items-start justify-between mb-2">
                                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${selectedSub.type?.toLowerCase() === 'quiz' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {m.error_type}
                                        </span>
                                      </div>
                                      
                                      {/* Senin Cevabın / Hata Açıklaması */}
                                      <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                                        {m.description}
                                      </p>
                                      
                                      {/* Doğru Cevap / Öneri Bölümü GÜNCELLEMESİ */}
                                      <div className={`flex flex-col gap-1 pt-3 border-t border-gray-700/50 -mx-4 -mb-4 p-4 rounded-b-xl ${selectedSub.type?.toLowerCase() === 'quiz' ? 'bg-green-900/10' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-500 font-bold text-lg">✓</span>
                                            <span className="text-green-500 text-xs font-black uppercase tracking-widest">
                                                {selectedSub.type?.toLowerCase() === 'quiz' ? 'DOĞRU CEVAP' : 'ÖNERİ'}
                                            </span>
                                        </div>
                                        <span className="text-green-400/90 text-sm font-medium pl-6 block">
                                            {m.suggestion}
                                        </span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {(!selectedSub.mistakes || selectedSub.mistakes.length === 0) && (
                      <div className="bg-green-900/10 border border-green-500/20 p-6 rounded-2xl text-center">
                          <span className="text-2xl block mb-2">🎉</span>
                          <p className="text-green-400 font-medium">Harika! Bu çalışmada hiç hata bulunamadı.</p>
                      </div>
                  )}
              </div>      

              <div className="p-5 border-t border-gray-800 bg-[#0f1420] flex justify-end">
                  <button onClick={() => setSelectedSub(null)} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors">Kapat</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}