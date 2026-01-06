import React, { useState, useEffect } from 'react'; 
import { submitWriting } from '../api/submit'; 
import { useNavigate } from 'react-router-dom'; 

const WritingSubmit = () => {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // ---  SAYFA AÇILDIĞINDA YEDEK VAR MI KONTROL ET ---
    useEffect(() => {
        const savedDraft = localStorage.getItem('draft_writing');
        if (savedDraft) {
            setText(savedDraft);
        }
    }, []);

    // ---  METİN DEĞİŞTİKÇE YEREL HAFIZAYA KAYDET ---
    const handleTextChange = (e) => {
        const value = e.target.value;
        setText(value);
        localStorage.setItem('draft_writing', value);
    };

    const handleSubmit = async () => {
        if (!text) return alert("Lütfen bir metin yazın!");
        const token = localStorage.getItem('token');
        setLoading(true);

        try {
            const response = await submitWriting(text, token);
            
            // ---  GÖNDERİM BAŞARILIYSA YEDEĞİ TEMİZLE ---
            localStorage.removeItem('draft_writing');
            
            navigate('/results', { state: { result: response.data } });
        } catch (error) {
            console.error(error);
            alert("Hata oluştu! İnternet bağlantını kontrol et.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0b1221] text-white flex items-center justify-center p-6 font-sans">
            <div className="max-w-3xl w-full space-y-8">
                
                {/* BAŞLIK ALANI */}
                <div className="text-center space-y-2">
                    <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Writing Activity
                    </h2>
                    <p className="text-gray-400">Düşüncelerini İngilizceye dök. AI senin için analiz etsin.</p>
                </div>

                {/* EDİTÖR KUTUSU */}
                <div className="bg-[#111827] p-1 rounded-2xl shadow-2xl border border-gray-700 focus-within:border-blue-500 transition-colors duration-300">
                    <div className="bg-[#0f1420] rounded-t-xl px-4 py-3 border-b border-gray-800 flex gap-2">
                        {/* Süs butonlar */}
                        <div className="flex gap-1.5">
                            
                        </div>
                    </div>

                    <textarea 
                        className="w-full h-80 bg-transparent text-gray-200 p-6 text-lg focus:outline-none resize-none font-sans leading-relaxed placeholder-gray-600"
                        placeholder="Write your essay here..."
                        value={text}
                        onChange={handleTextChange} // handleTextChange ile güncellendi
                        spellCheck="false"
                    ></textarea>

                    <div className="px-6 py-3 text-right text-xs text-gray-500 border-t border-gray-800 font-mono flex justify-between">
                        <span className="text-red-500/60 font-sans italic">Taslak otomatik kaydediliyor...</span>
                        <span>{text.length} karakter</span>
                    </div>
                </div>

                {/* GÖNDER BUTONU */}
                <button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 transition-all transform active:scale-95 text-lg flex justify-center items-center gap-2"
                >
                    {loading ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Analiz Ediliyor...</span>
                        </>
                    ) : (
                        <>
                            <span>Makaleyi Gönder</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default WritingSubmit;