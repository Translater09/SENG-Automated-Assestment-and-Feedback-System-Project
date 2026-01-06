import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Register() {
  // --- STATE ---
  const [isNeon, setIsNeon] = useState(false); // Varsayılan: Normal Mod
  const [isSwinging, setIsSwinging] = useState(false);

  // --- FORM STATE ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  // --- İP MEKANİZMASI ---
  const toggleNeonMode = () => {
    setIsNeon(!isNeon);
    setIsSwinging(true);
    setTimeout(() => setIsSwinging(false), 1000);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/register", {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        role: role 
      });

      if (res.data.id) {
        alert("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        navigate("/login");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Kayıt başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // ANA SAHNE: Arka plan Neon moduna göre değişir
    <div className={`flex justify-center items-center h-screen relative overflow-hidden font-sans transition-colors duration-1000
        ${isNeon ? "bg-[#050505]" : "bg-[#0f1115]"}
    `}>
      
      {/* 1. KATMAN: ZEMİN DOKUSU */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')" }}>
      </div>

      {/* --- ANA SAYFAYA DÖN BUTONU --- */}
      <Link 
        to="/"
        className="absolute top-8 left-8 z-50 flex items-center gap-2 text-gray-500 hover:text-white transition-colors duration-300 group"
      >
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all 
            ${isNeon ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-gray-700 hover:border-gray-500"}
        `}>
            <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </div>
        <span className="text-sm font-medium tracking-wide opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">Ana Sayfa</span>
      </Link>

      {/* --- NEON MODU ARKA IŞIKLARI (Sadece ip çekilince görünür) --- */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out pointer-events-none ${isNeon ? 'opacity-100' : 'opacity-0'}`}>
         {/* Üstten inen ışık hüzmesi */}
         <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[100vh] bg-gradient-to-b from-blue-600/10 via-purple-600/5 to-transparent blur-[60px] rounded-[100%]"></div>
      </div>

      {/* --- İP MEKANİZMASI (SAĞDA) --- */}
      <div 
        className={`absolute top-0 right-[15%] z-50 flex flex-col items-center cursor-pointer group origin-top ${isSwinging ? 'animate-swing' : ''}`}
        onClick={toggleNeonMode}
      >
        {/* İp */}
        <div 
            className={`w-1 bg-gradient-to-b from-gray-600 to-gray-400 shadow-lg transition-all duration-300 ease-out active:h-48
            ${isNeon ? "h-32" : "h-40"}
            `}
        ></div>
        {/* Tutacak */}
        <div className="w-3 h-8 rounded-full bg-gray-200 shadow-lg border border-gray-400 group-active:translate-y-1 transition-transform relative">
             {/* İpucu */}
             <div className="absolute right-6 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 font-mono pr-2">
                {isNeon ? "Normal Mod" : "Neon Modu"}
             </div>
        </div>
      </div>

      {/* --- REGISTER FORMU --- */}
      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ease-in-out
          ${isNeon ? "scale-105" : "scale-100"}
      `}>
        
        <div className={`
            p-8 rounded-3xl border transition-all duration-700 relative overflow-hidden
            ${isNeon 
                ? "bg-[#0a0a12]/80 backdrop-blur-xl border-blue-500/50 shadow-[0_0_50px_rgba(59,130,246,0.2)]" 
                : "bg-[#111827] border-gray-800 shadow-2xl"}
        `}>
            
            {/* Başlık */}
            <div className="text-center mb-6">
                <h1 className={`text-3xl font-black mb-2 transition-all duration-700 tracking-tight
                    ${isNeon 
                        ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                        : "text-white"}
                `}>
                    KAYIT OL
                </h1>
                <p className={`text-sm transition-colors duration-700 ${isNeon ? "text-blue-200" : "text-gray-500"}`}>
                    AAFS Ailesine Katıl
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
                
                {/* AD - SOYAD */}
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Ad" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                        className={`w-full p-3.5 rounded-xl outline-none transition-all duration-500
                            ${isNeon 
                                ? "bg-black/50 border border-blue-500/50 text-blue-100 placeholder-blue-500/30 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                                : "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"}
                        `} />
                    <input type="text" placeholder="Soyad" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                        className={`w-full p-3.5 rounded-xl outline-none transition-all duration-500
                            ${isNeon 
                                ? "bg-black/50 border border-blue-500/50 text-blue-100 placeholder-blue-500/30 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                                : "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"}
                        `} />
                </div>

                {/* EMAIL */}
                <div className="relative group">
                    <input type="email" placeholder="Email Adresi" value={email} onChange={(e) => setEmail(e.target.value)} required
                        className={`w-full p-3.5 pl-12 rounded-xl outline-none transition-all duration-500
                            ${isNeon 
                                ? "bg-black/50 border border-blue-500/50 text-blue-100 placeholder-blue-500/30 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                                : "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"}
                        `} />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">✉️</span>
                </div>

                {/* ŞİFRE */}
                <div className="relative group">
                    <input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required
                        className={`w-full p-3.5 pl-12 rounded-xl outline-none transition-all duration-500
                            ${isNeon 
                                ? "bg-black/50 border border-purple-500/50 text-purple-100 placeholder-purple-500/30 focus:shadow-[0_0_15px_rgba(168,85,247,0.4)]" 
                                : "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"}
                        `} />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔒</span>
                </div>

                {/* HESAP TÜRÜ SEÇİMİ */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <label 
                        className={`cursor-pointer border p-3 rounded-xl text-center transition-all duration-300 relative overflow-hidden group
                        ${role === 'student' 
                            ? (isNeon ? "bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]" : "bg-blue-600 text-white")
                            : "bg-black/20 border-gray-700 text-gray-400 hover:bg-white/5"}
                        `}
                    >
                        <input type="radio" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} className="hidden" />
                        <span className="relative z-10 flex items-center justify-center gap-2 font-bold text-sm">🎓 Öğrenci</span>
                    </label>

                    <label 
                        className={`cursor-pointer border p-3 rounded-xl text-center transition-all duration-300 relative overflow-hidden group
                        ${role === 'teacher' 
                            ? (isNeon ? "bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]" : "bg-purple-600 text-white")
                            : "bg-black/20 border-gray-700 text-gray-400 hover:bg-white/5"}
                        `}
                    >
                        <input type="radio" name="role" value="teacher" checked={role === 'teacher'} onChange={() => setRole('teacher')} className="hidden" />
                        <span className="relative z-10 flex items-center justify-center gap-2 font-bold text-sm">👨‍🏫 Öğretmen</span>
                    </label>
                </div>

                {/* KAYIT BUTONU */}
                <button 
                    type="submit" 
                    disabled={loading}
                    className={`w-full py-4 mt-2 font-bold rounded-xl transition-all duration-500 transform hover:-translate-y-1 active:scale-95
                        ${isNeon
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] hover:shadow-[0_0_40px_rgba(59,130,246,0.8)]"
                            : "bg-white text-black hover:bg-gray-200"}
                    `}
                >
                    {loading ? "Kaydediliyor..." : "HESAP OLUŞTUR"}
                </button>

            </form>

            <div className={`mt-6 text-center pt-6 border-t transition-colors duration-700 ${isNeon ? "border-white/10" : "border-gray-700"}`}>
                <p className={`text-sm ${isNeon ? "text-gray-400" : "text-gray-500"}`}>
                    Zaten hesabın var mı?
                    <Link to="/login" className={`ml-2 font-bold transition ${isNeon ? "text-blue-400 hover:text-blue-300 drop-shadow-glow" : "text-white hover:underline"}`}>
                        Giriş Yap
                    </Link>
                </p>
            </div>
        </div>
      </div>

      {/* Animasyon CSS'i */}
      <style>{`
        @keyframes swing {
            0% { transform: rotate(0deg); }
            20% { transform: rotate(5deg); }
            40% { transform: rotate(-3deg); }
            60% { transform: rotate(2deg); }
            80% { transform: rotate(-1deg); }
            100% { transform: rotate(0deg); }
        }
        .animate-swing {
            animation: swing 1s ease-in-out;
            transform-origin: top center;
        }
      `}</style>

    </div>
  );
}