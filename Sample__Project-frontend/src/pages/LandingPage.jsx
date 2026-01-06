import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b1221] text-white flex flex-col">
      {/* Navbar */}
      <nav className="max-w-7xl mx-auto w-full p-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
            AAFS
        </h1>
        <div className="space-x-4">
            <Link to="/login" className="px-4 py-2 text-gray-300 hover:text-white transition">Giriş Yap</Link>
            <Link to="/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition">
                Kayıt Ol
            </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-5xl md:text-7xl font-extrabold mb-6">
          Dil Öğrenmenin <br />
          <span className="text-blue-500">Yapay Zeka</span> Hali
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mb-10">
          Automated Assessment and Feedback System (AAFS) ile İngilizce konuşma, 
          yazma ve test becerilerini geliştir. Anında AI geri bildirimi al.
        </p>
        
        <div className="flex gap-4">
            <Link to="/register" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full font-bold text-lg hover:scale-105 transition shadow-lg shadow-blue-900/50">
                Hemen Başla 
            </Link>
        </div>
      </div>

      {/* Özellikler */}
      <div className="bg-[#111827] py-16">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
                icon="🎤" title="Speaking Analizi" 
                desc="Sesini kaydet, AI telaffuzunu ve gramerini anında analiz etsin." 
            />
            <FeatureCard 
                icon="📝" title="Writing Kontrolü" 
                desc="Kompozisyonlarını yükle, kelime ve yapı hatalarını anında gör." 
            />
            <FeatureCard 
                icon="🧠" title="Akıllı Quizler" 
                desc="Seviyene uygun üretilen sorularla kendini sürekli test et." 
            />
        </div>
      </div>
      
      <footer className="p-6 text-center text-gray-600 text-sm">
        © 2025 AAFS Project. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="bg-[#1f2937] p-8 rounded-2xl border border-gray-700 hover:border-blue-500/50 transition hover:-translate-y-1">
            <div className="text-4xl mb-4">{icon}</div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-gray-400">{desc}</p>
        </div>
    )
}