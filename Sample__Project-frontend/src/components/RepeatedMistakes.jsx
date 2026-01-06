import { useEffect, useState } from "react";
import axios from "axios";

// hasActivity gelmezse varsayılan olarak true olsun ki hata vermesin
export default function RepeatedMistakes({ hasActivity = true }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  // --- UC7 İÇİN YENİ STATE ---
  const [challenge, setChallenge] = useState(null);
  // ---------------------------
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;
    const fetchMistakesAndChallenges = async () => {
      try {
        // 1. Mevcut Sık Yapılan Hatalar Verisi 
        const res = await axios.get(`http://127.0.0.1:8000/analytics/repeated-mistakes?token=${token}`);
        setData(res.data.repeated_mistakes || []);

        // Eğer veritabanında hata verisi varsa AI'dan dinamik analiz istiyoruz
        if (res.data.repeated_mistakes && res.data.repeated_mistakes.length > 0) {
          const challengeRes = await axios.get(`http://127.0.0.1:8000/student/challenges?token=${token}`);
          setChallenge(challengeRes.data);
        }
      } catch (err) {
        console.error("Analiz hatası:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMistakesAndChallenges();
  }, [token]);

  if (loading) return (
    <div className="bg-[#111827] border border-gray-700 rounded-xl p-6 h-96 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></span>
        <span className="text-gray-500 text-sm animate-pulse">Analiz yükleniyor...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* --- UC7 AI CHALLENGE DETECTION PANELI --- */}
      {hasActivity && (
        <div className="bg-[#111827] border border-red-900/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="red">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2 uppercase tracking-widest">
            <span className="animate-pulse">●</span> Öğrenme Zorluğu Tespİtİ
          </h3>

          {challenge ? (
            /*  Success Scenario: Analiz başarılı */
            <div className="space-y-3">
              <div className="border-l-4 border-red-500 pl-3">
                <p className="text-xs text-red-400 font-bold uppercase">Krİtİk Konu Tespiti</p>
                <p className="text-white text-base font-semibold leading-tight">"{challenge.pattern_found}"</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
                <p className="text-blue-400 text-[10px] font-bold uppercase mb-1">AI Tavsİyesİ </p>
                <p className="text-gray-400 text-xs leading-relaxed">{challenge.recommendation}</p>
              </div>
            </div>
          ) : (
            /* Extension 2a: Yeterli veri toplanıyor */
            <div className="bg-blue-900/10 border border-blue-800/30 p-3 rounded-lg">
              <p className="text-blue-300 text-xs font-bold italic">AI Analizi Hazırlanıyor...</p>
              <p className="text-gray-500 text-[10px] mt-1 leading-tight">
                Döküman kuralı gereği kişiselleştirilmiş tespitler için en az 3 aktiviteyi tamamlaman gerekiyor.
              </p>
            </div>
          )}
        </div>
      )}

      {/* --- SIK YAPILAN HATALAR LİSTESİ  --- */}
      <div className="bg-[#111827] border border-gray-700 rounded-xl p-6 shadow-lg h-96 flex flex-col relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
          <span className="bg-red-500/20 text-red-400 p-1.5 rounded-lg text-lg">⚠️</span>
          <span>Sık Yapılan Hatalar</span>
        </h3>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative z-10 space-y-3">
          {(!data || data.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
              {!hasActivity ? (
                <>
                  <div className="bg-gray-700/30 p-4 rounded-full mb-3 ring-1 ring-gray-600">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-300 font-bold text-lg">Henüz Veri Yok</p>
                  <p className="text-gray-500 text-sm mt-1 px-4">İlk ödevini tamamladığında burada AI analizlerini göreceksin.</p>
                </>
              ) : (
                <>
                  <div className="bg-green-500/10 p-4 rounded-full mb-3 ring-1 ring-green-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  <p className="text-gray-300 font-bold text-lg">Harika gidiyorsun!</p>
                  <p className="text-gray-500 text-sm mt-1">Tekrar eden kritik bir hatan bulunamadı.</p>
                </>
              )}
            </div>
          ) : (
            data.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800 hover:border-gray-600 transition group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold font-mono border
                    ${index === 0 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                    index === 1 ? 'bg-gray-400/10 text-gray-400 border-gray-400/20' :
                    index === 2 ? 'bg-orange-700/10 text-orange-400 border-orange-700/20' :
                    'bg-gray-800 text-gray-500 border-gray-700'}`}>
                    {index + 1}
                  </span>
                  <span className="text-gray-300 text-sm font-medium group-hover:text-white transition break-words capitalize" title={item.error_type}>
                    {item.error_type.toLowerCase()}
                  </span>
                </div>

                <div className="flex items-center gap-3 pl-2 flex-shrink-0">
                  <div className="h-1.5 w-12 bg-gray-700 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-red-500/70 rounded-full"
                      style={{ width: `${Math.min((item.count / data[0].count) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20 min-w-[3.5rem] text-center whitespace-nowrap">
                    {item.count} kez
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}