import React, { useState, useEffect } from "react"; 
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Quiz = () => {
  const [topic, setTopic] = useState("general");
  const [difficulty, setDifficulty] = useState("easy");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // --- 1. YEDEKTEN GERİ YÜKLEME (Sayfa açıldığında) ---
  useEffect(() => {
    const savedQuestions = localStorage.getItem('quiz_questions');
    const savedAnswers = localStorage.getItem('quiz_progress');
    
    if (savedQuestions) {
      setQuestions(JSON.parse(savedQuestions));
    }
    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }
  }, []);

  // 1. QUIZ OLUŞTUR
  const handleGenerateQuiz = async () => {
    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/quiz/generate", {
        topic,
        difficulty
      }, { params: { token } });
      
      const newQuestions = res.data.questions || [];
      // QUIZ ID'sini kaydet (Backend puanlama için gerekli)
      localStorage.setItem('current_quiz_id', res.data.quiz_id);
      
      setQuestions(newQuestions);
      setAnswers({}); // Yeni quiz gelince cevapları sıfırla
      
      // SORULARI YEDEKLE
      localStorage.setItem('quiz_questions', JSON.stringify(newQuestions));
      localStorage.removeItem('quiz_progress'); // Yeni quiz için eski cevap yedeğini sil
    } catch (error) {
      console.error("Quiz oluşturulamadı:", error);
      alert("Quiz oluşturulurken hata çıktı. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. CEVAP SEÇİLDİĞİNDE YEDEKLEME ---
  const handleSelectOption = (idx, opt) => {
    // Soru ID'sini bulmak için questions array'ini kullanıyoruz
    // Ancak array index bazlı gidiyoruz, backend ID istiyor olabilir.
    // Backend modeline baktık: answers: Dict[str, str]  # question_id -> chosen_option
    // Bu durumda bizim questions state'imizdeki objelerin ID'si önemli.
    
    // Frontend'de questions[idx].id var mı? Evet, backend dönüyor.
    // O zaman state'imizi index yerine ID bazlı yapabiliriz veya gönderirken çevirebiliriz.
    // Mevcut yapı index kullanıyor.
    
    const updatedAnswers = {...answers, [idx]: opt};
    setAnswers(updatedAnswers);
    // Cevapları anlık yedekle
    localStorage.setItem('quiz_progress', JSON.stringify(updatedAnswers));
  };

  // 2. CEVAPLARI GÖNDER
  const handleSubmitQuiz = async () => {
    // --- KONTROL: Hepsi işaretlendi mi? ---
    if (Object.keys(answers).length !== questions.length) {
        alert("⚠️ Lütfen tüm soruları cevaplayınız!");
        return;
    }

    setSubmitting(true);
    
    // Backend'in beklediği format:
    // class QuizSubmitRequest(BaseModel):
    //     quiz_id: str
    //     answers: Dict[str, str]  # question_id -> chosen_option

    const quizId = localStorage.getItem('current_quiz_id');
    if (!quizId) {
        alert("Quiz kimliği bulunamadı. Lütfen sayfayı yenileyip yeni quiz oluşturun.");
        setSubmitting(false);
        return;
    }

    // Cevapları index'ten Question ID'ye çevir
    const formattedAnswers = {};
    questions.forEach((q, index) => {
        // questions[index] -> q
        // answers[index] -> öğrencinin cevabı
        if (answers[index]) {
            formattedAnswers[q.id] = answers[index];
        }
    });

    try {
      // ARTIK deterministik endpoint'e atıyoruz
      const response = await axios.post(`http://127.0.0.1:8000/mcq/quiz/submit?token=${token}`, {
        quiz_id: quizId,
        answers: formattedAnswers
      });
      
      // --- BAŞARILI GÖNDERİM SONRASI YEDEKLERİ TEMİZLE ---
      localStorage.removeItem('quiz_questions');
      localStorage.removeItem('quiz_progress');
      localStorage.removeItem('current_quiz_id');

      // --- DÜZELTME: Dashboard yerine Sonuç Ekranına git ---
      // Backend'den dönen yapı: { score, correct, total, feedback }
      navigate('/results', { state: { result: response.data } });

    } catch (error) {
      console.error(error);
      alert("Sonuçlar gönderilemedi. " + (error.response?.data?.detail || "Bağlantı hatası"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1221] text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full space-y-8">

        {/* BAŞLANGIÇ EKRANI */}
        {questions.length === 0 ? (
          <div className="bg-[#111827] p-8 rounded-3xl border border-gray-700 shadow-2xl text-center space-y-6">
             <div className="inline-block p-4 bg-purple-600/20 rounded-full mb-2">
                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
             </div>
             <h1 className="text-3xl font-extrabold text-white">AI Generated English Quiz</h1>
             <p className="text-gray-400">Konu ve zorluk seç, yapay zeka sana özel sorular hazırlasın.</p>
             
             <div className="space-y-4 text-left">
                <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Konu (Topic)</label>
                    {/* Konu Seçimi - Dropdown */}
<div>
    <label className="block text-sm font-bold text-gray-300 mb-2">Çalışma Alanı (Topic)</label>
    <select 
        value={topic} 
        onChange={(e) => setTopic(e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded-xl p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
    >
        <option value="Grammar: Tenses (Zamanlar)">Grammar: Tenses (Zamanlar)</option>
        <option value="Grammar: Prepositions (Edatlar)">Grammar: Prepositions (Edatlar)</option>
        <option value="Grammar: Conditionals (Koşul Cümleleri)">Grammar: Conditionals (If Clauses)</option>
        <option value="Vocabulary: Daily Life">Vocabulary: Daily Life (Günlük Yaşam)</option>
        <option value="Vocabulary: Business English">Vocabulary: Business English (İş İngilizcesi)</option>
        <option value="Vocabulary: Academic">Vocabulary: Academic (Akademik)</option>
        <option value="Phrasal Verbs">Phrasal Verbs</option>
        <option value="Idioms & Expressions">Idioms & Expressions (Deyimler)</option>
        <option value="General English">General English (Karışık)</option>
    </select>
</div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Zorluk Seviyesi</label>
                    <select 
                        value={difficulty} 
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-xl p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
                    >
                        <option value="easy">Easy (Kolay)</option>
                        <option value="medium">Medium (Orta)</option>
                        <option value="hard">Hard (Zor)</option>
                    </select>
                </div>
             </div>

             <button 
                onClick={handleGenerateQuiz}
                disabled={loading}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition transform active:scale-95 flex justify-center items-center gap-2"
             >
                {loading ? "Sorular Hazırlanıyor..." : "Quiz Başlat "}
             </button>
          </div>
        ) : (
          
          /* SORULAR EKRANI */
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Quiz Time!</h2>
                <button 
                  onClick={() => {
                    localStorage.removeItem('quiz_questions');
                    localStorage.removeItem('quiz_progress');
                    window.location.reload();
                  }}
                  className="text-xs text-red-400 hover:underline"
                >
                  Sıfırla ve Yeni Quiz Al
                </button>
                <span className="bg-gray-800 px-3 py-1 rounded text-sm text-gray-400">{questions.length} Soru</span>
             </div>

             <div className="space-y-4">
                {questions.map((q, idx) => (
                    <div key={idx} className="bg-[#111827] p-6 rounded-2xl border border-gray-700">
                        <p className="text-lg font-medium text-white mb-4">
                            <span className="text-purple-400 font-bold mr-2">{idx + 1}.</span> 
                            {q.question}
                        </p>
                        
                        <div className="space-y-2">
                            {q.options.map((opt, optIdx) => (
                                <label key={optIdx} className={`flex items-center p-3 rounded-xl border cursor-pointer transition
                                    ${answers[idx] === opt 
                                        ? 'bg-purple-600/20 border-purple-500 text-white' 
                                        : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800'}`
                                }>
                                    <input 
                                        type="radio" 
                                        name={`question-${idx}`} 
                                        value={opt}
                                        onChange={() => handleSelectOption(idx, opt)} // Burayı güncelledik
                                        className="hidden" 
                                    />
                                    <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center
                                        ${answers[idx] === opt ? 'border-purple-500' : 'border-gray-500'}`}>
                                        {answers[idx] === opt && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full"></div>}
                                    </div>
                                    {opt}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
             </div>

             <button 
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition text-lg disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {submitting ? "Gönderiliyor..." : "Quizi Bitir ve Gönder ✅"}
             </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Quiz;