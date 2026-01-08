import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from "axios";

const Login = () => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [isNeon, setIsNeon] = useState(false); // Neon Modu
  const [isSwinging, setIsSwinging] = useState(false);

  // Form State'leri
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleNeonMode = () => {
    setIsNeon(!isNeon);
    setIsSwinging(true);
    setTimeout(() => setIsSwinging(false), 1000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Token İsteği
      const res = await axios.post("http://127.0.0.1:8000/token", 
        new URLSearchParams({
          username: formData.email,
          password: formData.password,
        })
      );
      
      const token = res.data.access_token;
      localStorage.setItem('token', token);

      // 2. Kullanıcı Rolünü Öğren
      const userRes = await axios.get(`http://127.0.0.1:8000/users/me?token=${token}`);
      const role = userRes.data.role;
      
      localStorage.setItem('role', role);
      localStorage.setItem('first_name', userRes.data.first_name);

      // 3. Role Göre Yönlendirme (Admin Eklendi ✅)
      if (role === 'admin') {
          window.location.href = '/admin/users'; // Admin paneline zorla yönlendirme
      } else if (role === 'teacher') {
          navigate('/teacher/dashboard'); 
      } else if (role === 'student') {
          navigate('/student/dashboard');
      } else {
          navigate('/'); // Tanımsız rol
      }

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError("Giriş başarısız! Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex justify-center items-center h-screen relative overflow-hidden font-sans transition-colors duration-1000
        ${isNeon ? "bg-[#050505]" : "bg-[#0f1115]"}
    `}>
      
      {/* ARKA PLAN DESENİ */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')" }}>
      </div>

      {/* ---  ANA SAYFAYA DÖN BUTONU --- */}
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

      {/* --- NEON ARKA IŞIKLARI --- */}
      <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out pointer-events-none ${isNeon ? 'opacity-100' : 'opacity-0'}`}>
         <div className="absolute top-[-20%] left-[-20%] w-[50vw] h-[50vw] bg-blue-600/20 blur-[150px] rounded-full"></div>
         <div className="absolute bottom-[-20%] right-[-20%] w-[50vw] h-[50vw] bg-purple-600/20 blur-[150px] rounded-full"></div>
      </div>

      {/* --- İP MEKANİZMASI --- */}
      <div 
        className={`absolute top-0 right-[20%] z-50 flex flex-col items-center cursor-pointer group origin-top ${isSwinging ? 'animate-swing' : ''}`}
        onClick={toggleNeonMode}
      >
        <div className={`w-1 bg-gradient-to-b from-gray-600 to-gray-400 shadow-lg transition-all duration-300 ease-out active:h-48 ${isNeon ? "h-32" : "h-40"}`}></div>
        <div className="w-3 h-8 rounded-full bg-gray-200 shadow-lg border border-gray-400 group-active:translate-y-1 transition-transform relative">
             <div className="absolute right-6 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 font-mono pr-2">
                {isNeon ? "Normal Mod" : "Neon Modu"}
             </div>
        </div>
      </div>

      {/* --- LOGIN FORMU --- */}
      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ease-in-out
          ${isNeon ? "scale-105" : "scale-100"}
      `}>
        
        <div className={`
            p-8 rounded-3xl border transition-all duration-700 relative overflow-hidden
            ${isNeon 
                ? "bg-[#0a0a12]/80 backdrop-blur-xl border-blue-500/50 shadow-[0_0_50px_rgba(59,130,246,0.3)]" 
                : "bg-[#111827] border-gray-800 shadow-2xl"}
        `}>
            
            {/* Başlık */}
            <div className="text-center mb-8">
                <h1 className={`text-4xl font-black mb-2 transition-all duration-700 tracking-tight
                    ${isNeon 
                        ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                        : "text-white"}
                `}>
                    GİRİŞ YAP
                </h1>
                <p className={`text-sm transition-colors duration-700 ${isNeon ? "text-blue-200" : "text-gray-500"}`}>
                    AAFS Platformuna Hoşgeldiniz
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
                <input type="email" name="email" placeholder="Email Adresi" value={formData.email} onChange={handleChange} required
                    className={`w-full p-3.5 rounded-xl outline-none transition-all duration-500
                        ${isNeon 
                            ? "bg-black/50 border border-blue-500/50 text-blue-100 placeholder-blue-500/30 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                            : "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"}
                    `} />

                <input type="password" name="password" placeholder="Şifre" value={formData.password} onChange={handleChange} required
                    className={`w-full p-3.5 rounded-xl outline-none transition-all duration-500
                        ${isNeon 
                            ? "bg-black/50 border border-purple-500/50 text-purple-100 placeholder-purple-500/30 focus:shadow-[0_0_15px_rgba(168,85,247,0.4)]" 
                            : "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"}
                    `} />

                <button type="submit" disabled={loading}
                    className={`w-full py-4 mt-2 font-bold rounded-xl transition-all duration-500 transform hover:-translate-y-1 active:scale-95
                        ${isNeon
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] hover:shadow-[0_0_40px_rgba(59,130,246,0.8)]"
                            : "bg-white text-black hover:bg-gray-200"}
                    `}
                >
                    {loading ? "Giriş Yapılıyor..." : "GİRİŞ YAP"}
                </button>
            </form>

            <div className={`mt-8 text-center pt-6 border-t transition-colors duration-700 ${isNeon ? "border-white/10" : "border-gray-700"}`}>
                <p className={`text-sm ${isNeon ? "text-gray-400" : "text-gray-500"}`}>
                    Hesabın yok mu?
                    <Link to="/register" className={`ml-2 font-bold transition ${isNeon ? "text-blue-400 hover:text-blue-300 drop-shadow-glow" : "text-white hover:underline"}`}>
                        Kayıt Ol
                    </Link>
                </p>
            </div>
        </div>
      </div>
      
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
};

export default Login;
