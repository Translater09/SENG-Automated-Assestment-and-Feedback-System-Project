import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function SpeakingSubmit() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false); // Sürükleme efekti için
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError("");
    }
  };
  // --- DOSYA KALDIRMA FONKSİYONU  ---
  const handleRemoveFile = (e) => {
    e.preventDefault(); // Label'ın açılmasını engelle
    e.stopPropagation(); // Event'in yukarı taşmasını engelle
    setSelectedFile(null);
    setError("");
  };

  // --- SÜRÜKLE BIRAK (DRAG & DROP) OLAYLARI ---
  
  // 1. Sürükleme Başladı
  const handleDragOver = (e) => {
    e.preventDefault(); // Tarayıcının dosyayı açmasını engeller (Siyah ekran çözümü)
    setIsDragging(true);
  };

  // 2. Sürükleme Bitti (Kutudan çıktı)
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // 3. Dosya Bırakıldı
  const handleDrop = (e) => {
    e.preventDefault(); // Tarayıcının dosyayı açmasını engeller (Siyah ekran çözümü)
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Sadece ses dosyalarını kabul et
      if (file.type.startsWith("audio/")) {
        setSelectedFile(file);
        setError("");
      } else {
        setError("Lütfen sadece ses dosyası (mp3, wav, m4a) yükleyin.");
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Lütfen önce bir ses dosyası seçin.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("token", token);

    setLoading(true);
    try {
      // Endpoint adresini kendi backendine göre ayarla
      const res = await axios.post("http://127.0.0.1:8000/activities/speaking", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Başarılı olursa sonuç sayfasına yönlendir
      navigate("/results", { state: { result: res.data } });
    } catch (err) {
      console.error(err);
      setError("Gönderim sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1221] text-gray-200 py-12 px-4 flex items-center justify-center font-sans">
      
      {/* ANA KART */}
      <div className="bg-[#111827] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-700 overflow-hidden relative">
        
        {/* Üst Dekorasyon */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="p-10 relative z-10">
          
          {/* BAŞLIK ALANI */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/10 text-blue-400 mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/10">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              Speaking Practice
            </h1>
            <p className="text-gray-400 max-w-md mx-auto text-lg leading-relaxed">
              Ses kaydını yükle, yapay zeka telaffuzunu ve gramerini saniyeler içinde analiz etsin.
            </p>
          </div>

          {/* YÜKLEME ALANI (GÜNCELLENDİ) */}
          <div 
            className="mb-8"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label 
              htmlFor="audio-upload" 
              className={`group flex flex-col items-center justify-center w-full h-72 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ease-in-out relative overflow-hidden
                ${isDragging 
                    ? "border-blue-500 bg-blue-500/10 scale-[1.02] shadow-2xl shadow-blue-500/20" 
                    : selectedFile 
                        ? "border-green-500/50 bg-green-500/5" 
                        : "border-gray-700 hover:border-blue-500/50 hover:bg-[#1a202c] bg-[#0f1420]"
                }
              `}
            >
              
              {/* Arka plan animasyonu */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              {/* --- YENİ EKLENDİ: KALDIRMA BUTONU --- */}
              {selectedFile && (
                <button
                  onClick={handleRemoveFile}
                  className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-red-500/10 rounded-full transition-all border border-gray-700 hover:border-red-500/30 shadow-lg"
                  title="Dosyayı Kaldır"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}  
              <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10 pointer-events-none">
                {selectedFile ? (
                  // DOSYA SEÇİLDİYSE
                  <div className="text-center animate-fade-in">
                    <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-3 mx-auto animate-bounce-short">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="mb-1 text-lg font-bold text-white">{selectedFile.name}</p>
                    <p className="text-xs text-green-400 font-mono bg-green-900/20 px-3 py-1 rounded-full inline-block border border-green-500/20">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Hazır</p>
                    <p className="mt-4 text-xs text-gray-500 font-bold uppercase tracking-widest group-hover:text-gray-300 transition">Değiştirmek için tıkla</p>
                  </div>
                ) : (
                  // DOSYA SEÇİLMEDİYSE
                  <div className="text-center w-full">

                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto transition-all duration-300 ${isDragging ? "bg-blue-500 text-white scale-110" : "bg-gray-800 text-gray-500 group-hover:bg-gray-700 group-hover:text-gray-300"}`}>
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <p className="mb-2 text-xl text-gray-300 font-bold">
                        {isDragging ? "Dosyayı Buraya Bırak!" : "Ses dosyasını sürükle"}
                    </p>
                    <p className="text-sm text-gray-500">veya dosya seçmek için <span className="text-blue-400 font-bold underline decoration-blue-500/30 group-hover:decoration-blue-500 transition">tıkla</span></p>
                    <div className="mt-6 flex gap-2 justify-center">
                        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded border border-gray-700">MP3</span>
                        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded border border-gray-700">WAV</span>
                        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded border border-gray-700">M4A</span>
                    </div>
                  </div>
                )}
              </div>
              <input 
                id="audio-upload" 
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </label>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-900/10 p-3 rounded-lg border border-red-900/20 animate-fade-in">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </div>

          {/* BUTON */}
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedFile}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group
              ${loading 
                ? "bg-gray-800 cursor-not-allowed text-gray-500" 
                : !selectedFile
                  ? "bg-gray-800 cursor-not-allowed text-gray-500 opacity-50"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white hover:shadow-blue-600/30 transform hover:-translate-y-1"
              }
            `}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Analiz Ediliyor...
              </>
            ) : (
              <>
                <span></span> Gönder ve Değerlendir
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}