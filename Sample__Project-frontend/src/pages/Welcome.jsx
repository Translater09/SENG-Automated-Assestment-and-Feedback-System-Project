import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Welcome() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  
  // Typing Efekti
  const [text, setText] = useState("");
  const fullText = "Automated Assessment & Feedback System";

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      setText(fullText.slice(0, index));
      index++;
      if (index > fullText.length) clearInterval(timer);
    }, 40); 
    return () => clearInterval(timer);
  }, []);

  const handleStart = () => {
    setIsExiting(true);
    setTimeout(() => navigate("/login"), 800); 
  };

  return (
    <div className="min-h-screen w-full bg-[#02040a] relative overflow-hidden flex flex-col items-center justify-center font-sans p-4">
      
      {/* ARKA PLAN */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
         <div className="absolute top-[-50%] right-[-50%] w-[100vw] h-[100vw] bg-blue-900/10 rounded-full blur-[100px] animate-pulse"></div>
         <div className="absolute bottom-[-50%] left-[-50%] w-[100vw] h-[100vw] bg-purple-900/10 rounded-full blur-[100px] animate-pulse"></div>
      </div>

      {/* --- ANA İÇERİK --- */}
      <div className={`relative z-10 max-w-6xl w-full flex flex-col items-center transition-all duration-800 ease-in-out ${isExiting ? "scale-110 opacity-0 blur-lg" : "scale-100 opacity-100"}`}>
        
        {/* HERO SECTION (Başlık ve Butonlar Artık Burada) */}
        <div className="text-center space-y-6 mb-12 mt-10">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-widest uppercase mb-2 animate-fade-in-up">
                ✨ Yapay Zeka Destekli Öğrenme
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl mb-2">
                AAFS
            </h1>
            
            {/* Alt Başlık (Typing) */}
            <h2 className="text-lg md:text-2xl text-gray-400 font-light h-8">
                {text}<span className="animate-blink">|</span>
            </h2>

            {/* --- BUTONLAR VE AKSİYON ALANI (YUKARI TAŞINDI) --- */}
            <div className="flex flex-col items-center gap-4 pt-6">
                
                {/* Ana Buton: Giriş Yap */}
                <button
                    onClick={handleStart}
                    className="group relative px-12 py-4 bg-white text-black font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    <span className="relative z-10 flex items-center gap-3">
                        Sisteme Giriş Yap
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </span>
                </button>

                {/* Alt Link: Kayıt Ol */}
                <p className="text-gray-500 text-sm mt-2">
                    Henüz hesabın yok mu? 
                    <Link to="/register" className="ml-2 text-blue-400 hover:text-blue-300 font-bold underline-offset-4 hover:underline transition-all">
                        Hemen Kayıt Oluştur
                    </Link>
                </p>
            </div>
        </div>

        {/* FEATURES GRID (Bilgi Kartları - Aşağıda dekoratif duruyor) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl px-4 opacity-80 hover:opacity-100 transition-opacity duration-500">
            {/* KART 1 */}
            <div className="bg-[#0f111a]/40 border border-white/5 p-6 rounded-2xl hover:bg-blue-900/10 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl group-hover:scale-110 transition-transform">🎤</span>
                    <h3 className="text-white font-bold">Speaking</h3>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">AI ile konuşma analizi.</p>
            </div>

            {/* KART 2 */}
            <div className="bg-[#0f111a]/40 border border-white/5 p-6 rounded-2xl hover:bg-purple-900/10 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl group-hover:scale-110 transition-transform">✍️</span>
                    <h3 className="text-white font-bold">Writing</h3>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">Kelime ve gramer kontrolü.</p>
            </div>

            {/* KART 3 */}
            <div className="bg-[#0f111a]/40 border border-white/5 p-6 rounded-2xl hover:bg-green-900/10 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl group-hover:scale-110 transition-transform">🧠</span>
                    <h3 className="text-white font-bold">Quiz</h3>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">Seviyene uygun akıllı testler.</p>
            </div>
        </div>

        

      </div>
      
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        .animate-blink { animation: blink 1s step-end infinite; }
      `}</style>
    </div>
  );
}