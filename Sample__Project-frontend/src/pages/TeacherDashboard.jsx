import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const TeacherDashboard = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [selectedSub, setSelectedSub] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newScore, setNewScore] = useState("");
  const [comment, setComment] = useState("");
  const [showClassModal, setShowClassModal] = useState(false);
  const [modalType, setModalType] = useState("create");
  const [newClassName, setNewClassName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showCharts, setShowCharts] = useState(false);
  const [studentAnalytics, setStudentAnalytics] = useState(null);

  const token = localStorage.getItem("token");
  const API_URL = "http://127.0.0.1:8000";

  const initDashboard = async () => {
    try {
      setLoading(true);
      const subRes = await axios.get(`${API_URL}/teacher/submissions`, { params: { token } });
      setSubmissions(subRes.data);
      const classRes = await axios.get(`${API_URL}/teacher/my-classes`, { params: { token } });
      setClasses(classRes.data);
      if (classRes.data && classRes.data.length > 0 && !selectedClassId) {
        setSelectedClassId(classRes.data[0].class_id);
      }
    } catch (err) {
      console.error("Veri hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initDashboard();
  }, []);

  const handleStudentSelect = async (student) => {
    setSelectedStudent(student);
    setShowCharts(false); 
    try {
      const res = await axios.get(`${API_URL}/teacher/student-detail/${student.id}`, { params: { token } });
      setStudentAnalytics(res.data.analytics);
    } catch (err) {
      console.error("Analiz verisi çekilemedi.");
    }
  };

  const currentClassObj = classes.find(c => c.class_id === selectedClassId);
  const currentStudents = currentClassObj?.students || [];

  const filteredSubmissions = selectedStudent 
    ? submissions.filter(sub => sub.student_name === selectedStudent.name)
    : [];

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSubmissions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);

  const handleDeleteSubmission = async (subId) => {
    if (!window.confirm("Bu aktiviteyi kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/submission/${subId}`, { params: { token } });
      setSubmissions(prev => prev.filter(s => s.submission_id !== subId));
      if (currentItems.length === 1 && currentPage > 1) setCurrentPage(prev => prev - 1);
      
      if (selectedStudent) {
        handleStudentSelect(selectedStudent);
      }
    } catch (error) { alert("Silme işlemi başarısız."); }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/classes/create`, { name: newClassName }, { params: { token } });
      setNewClassName(""); setShowClassModal(false); initDashboard();
    } catch (error) { alert("Hata: " + (error.response?.data?.detail || "Hata")); }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!selectedClassId) return alert("Lütfen sınıf seçin!");
    try {
      await axios.post(`${API_URL}/classes/assign-student`, { student_email: studentEmail, class_id: selectedClassId }, { params: { token } });
      setStudentEmail(""); initDashboard();
    } catch (error) { alert("Öğrenci bulunamadı."); }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm("Emin misiniz?")) return;
    try {
      await axios.post(`${API_URL}/classes/remove-student`, { student_id: studentId, class_id: selectedClassId }, { params: { token } });
      initDashboard();
    } catch (error) { alert("İşlem başarısız."); }
  };

  const openReviewModal = async (sub) => {
    setSelectedSub(sub);
    setNewScore(sub.teacher_score || sub.ai_score);
    setComment(""); setDetailLoading(true); setDetailData(null);
    try {
      const res = await axios.get(`${API_URL}/teacher/submission/${sub.submission_id}`, { params: { token } });
      setDetailData(res.data);
      if (res.data.teacher_review) {
        setComment(res.data.teacher_review.teacher_comment);
        setNewScore(res.data.teacher_review.new_score);
      }
    } catch (error) { alert("Detaylar yüklenemedi."); } finally { setDetailLoading(false); }
  };

  const handleUpdateScore = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/teacher/review`, { submission_id: selectedSub.submission_id, new_score: parseInt(newScore), teacher_comment: comment }, { params: { token } });
      setSelectedSub(null); initDashboard();
    } catch (error) { alert("Hata oluştu."); }
  };

  if (loading) return <div className="min-h-screen bg-[#0b1221] flex items-center justify-center text-white">Yükleniyor...</div>;

  return (
    <div className="flex h-screen bg-[#0b1221] text-gray-200 font-sans overflow-hidden">
      
      {/* --- SOL TARAF: ÖĞRENCİ LİSTESİ PANELİ --- */}
      <div className="w-80 border-r border-gray-800 bg-[#0f172a] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white mb-4">👨‍🎓 Öğrenci Listesi</h2>
          <select 
            value={selectedClassId} 
            onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudent(null); }} 
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-purple-500 cursor-pointer text-sm"
          >
            {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {currentStudents.map(student => (
            <button 
              key={student.id} 
              onClick={() => handleStudentSelect(student)}
              className={`w-full p-4 rounded-xl text-left border transition-all ${selectedStudent?.id === student.id ? 'bg-indigo-600 border-indigo-400' : 'bg-[#111827] border-gray-800 hover:border-gray-600'}`}
            >
              <p className="font-bold text-sm text-white">{student.name}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">{student.email}</p>
            </button>
          ))}
        </div>
      </div>

      {/* --- SAĞ TARAF: AKTİVİTE VE ANALİZ PANELİ --- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="p-6 bg-[#0f172a] border-b border-gray-800 flex justify-between items-center shadow-md">
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">
              {selectedStudent ? `${selectedStudent.name} Paneli` : "Genel Yönetim"}
            </h1>
            <p className="text-xs text-gray-500 font-bold uppercase mt-1">Sınıf: {currentClassObj?.class_name || "-"}</p>
          </div>
          <div className="flex gap-3">
            {selectedStudent && (
              <button 
                onClick={() => setShowCharts(!showCharts)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition shadow-lg"
              >
                {showCharts ? "📋 Aktivite Listesi" : "📊 Gelişim Grafikleri"}
              </button>
            )}
            <button onClick={() => { setModalType("create"); setShowClassModal(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest">+ Sınıf</button>
            {currentClassObj && <button onClick={() => { setModalType("manage"); setShowClassModal(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest italic">Yönetim</button>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#0b1221]">
          {selectedStudent ? (
            showCharts ? (
              /* --- ÖĞRENCİYE ÖZEL GRAFİK GÖRÜNÜMÜ --- */
              <div className="space-y-8 animate-in fade-in duration-500">
                {/* GENEL GRAFİK */}
                <div className="bg-[#111827] p-6 rounded-2xl border border-gray-700 h-[400px]">
                  <h3 className="text-sm font-black text-indigo-400 uppercase mb-6 tracking-widest">
                    Performans Analizi (Zaman / Puan)
                  </h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={studentAnalytics?.OVERALL || []}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9CA3AF" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#9CA3AF" 
                        fontSize={12} 
                        domain={[0, 100]} 
                        ticks={[0, 20, 40, 60, 80, 100]}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                      <Area type="monotone" dataKey="score" stroke="#6366f1" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} name="Puan" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* DETAY GRAFİKLERİ (WRITING, SPEAKING, QUIZ) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {['WRITING', 'SPEAKING', 'QUIZ'].map(type => (
                    <div key={type} className="bg-[#111827] p-6 rounded-xl border border-gray-800">
                      <h4 className="text-xs font-black text-gray-500 mb-4 uppercase">{type} Gelişimi</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={studentAnalytics?.[type] || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            
                            {/* Y EKSENİ ARTIK AÇIK */}
                            <YAxis 
                                stroke="#6B7280" 
                                fontSize={10} 
                                domain={[0, 100]} 
                                tickLine={false}
                                axisLine={false}
                                width={30}
                            />
                            
                            {/* X EKSENİ EKLENDİ */}
                            <XAxis 
                                dataKey="date" 
                                stroke="#6B7280" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                            />

                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                            
                            <Area 
                                type="monotone" 
                                dataKey="score" 
                                stroke={type === 'WRITING' ? '#3b82f6' : type === 'SPEAKING' ? '#10b981' : '#f59e0b'} 
                                fill={type === 'WRITING' ? '#3b82f633' : type === 'SPEAKING' ? '#10b98133' : '#f59e0b33'} 
                                strokeWidth={2} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* --- ÖĞRENCİYE ÖZEL AKTİVİTE LİSTESİ --- */
              <div className="space-y-4">
                {currentItems.length === 0 ? <p className="text-center text-gray-500 py-20 italic">Öğrencinin henüz bir aktivitesi bulunmuyor.</p> : currentItems.map(sub => (
                  <div key={sub.submission_id} className="bg-[#111827] border border-gray-800 p-6 rounded-xl flex justify-between items-center group transition-all hover:border-indigo-500/50">
                    
                    {/* Sol: İkon ve Bilgi */}
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg flex items-center justify-center w-12 h-12 ${
                          sub.activity_type === 'writing' ? 'bg-blue-500/10 text-blue-400' :
                          sub.activity_type === 'speaking' ? 'bg-purple-500/10 text-purple-400' :
                          'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {/* SVG İKONLAR (Manuel Gömdüm) */}
                          {sub.activity_type === 'writing' ? (
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                          ) : sub.activity_type === 'speaking' ? (
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                          ) : (
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded font-black uppercase tracking-tighter">{sub.activity_type}</span>
                          <p className="text-white font-bold text-lg mt-1">{sub.student_name}</p>
                        </div>
                    </div>

                    {/* Sağ: Puan ve Butonlar */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="block text-[10px] text-gray-600 uppercase font-black">AI / FINAL</span>
                        <span className="text-xl font-black text-white">
                          {sub.ai_score} <span className="text-gray-700">/</span> <span className={sub.teacher_score ? 'text-emerald-400' : 'text-indigo-400'}>{sub.teacher_score || "-"}</span>
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => openReviewModal(sub)} 
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition shadow-lg shadow-indigo-900/40"
                        >
                          {sub.is_reviewed ? "Düzenle" : "İncele"}
                        </button>
                        
                        <button 
                          onClick={(e) => {
                             e.stopPropagation();
                             handleDeleteSubmission(sub.submission_id);
                          }}
                          className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Sil"
                        >
                           {/* TRASH SVG (Manuel Gömdüm) */}
                           <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredSubmissions.length > itemsPerPage && (
                  <div className="flex justify-center gap-4 mt-8">
                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-2 bg-gray-800 rounded-lg disabled:opacity-30 border border-gray-700">Önceki</button>
                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 bg-gray-800 rounded-lg disabled:opacity-30 border border-gray-700">Sonraki</button>
                  </div>
                )}
              </div>
            )
          ) : (
            /* BAŞLANGIÇ EKRANI */
            <div className="h-full flex flex-col items-center justify-center text-gray-700">
               <div className="w-20 h-20 bg-gray-800/30 rounded-full flex items-center justify-center mb-4"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></div>
               <p className="text-sm font-black uppercase tracking-[0.4em]">Lütfen soldan bir öğrenci seçin</p>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALLAR --- */}
      {showClassModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
              <div className="bg-[#1f2937] w-full max-w-md rounded-2xl p-6 border border-gray-600 shadow-2xl relative">
                  <button onClick={() => setShowClassModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                  {modalType === "create" ? (
                      <form onSubmit={handleCreateClass} className="space-y-4">
                          <h2 className="text-xl font-bold text-white">Yeni Sınıf Oluştur</h2>
                          <input type="text" placeholder="Sınıf Adı" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white outline-none" required />
                          <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold">Oluştur</button>
                      </form>
                  ) : (
                      <div className="space-y-4">
                          <h2 className="text-xl font-bold text-white">Sınıf Yönetimi ({currentClassObj?.class_name})</h2>
                          <form onSubmit={handleAddStudent} className="flex flex-col gap-3">
                              <input type="email" placeholder="Öğrenci Email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white outline-none" required />
                              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold">Ekle</button>
                          </form>
                          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {currentClassObj?.students?.map(s => (
                                  <li key={s.id} className="flex justify-between items-center bg-gray-900/50 p-2 rounded border border-gray-700/50">
                                      <span className="text-xs text-gray-300 truncate mr-2">• {s.name}</span>
                                      <button onClick={() => handleRemoveStudent(s.id)} className="bg-red-500/10 text-red-400 text-[10px] px-2 py-1 rounded">Sil</button>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  )}
              </div>
          </div>
      )}

      {selectedSub && (
           <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
              <div className="bg-[#1f2937] w-full max-w-5xl h-[85vh] rounded-2xl border border-gray-600 shadow-2xl flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-[#111827]"><h2 className="text-xl font-bold text-white flex items-center gap-2">📝 Ödev İnceleme</h2><button onClick={() => setSelectedSub(null)} className="text-gray-400 hover:text-white">✕</button></div>
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                      <div className="flex-1 overflow-y-auto p-6 border-r border-gray-700 bg-[#111827]/50 custom-scrollbar">
                          {detailLoading ? "Yükleniyor..." : detailData ? (
                              <div className="space-y-6">
                                  <div><h3 className="text-blue-400 font-bold mb-2 text-sm uppercase">Öğrenci Çalışması</h3><div className="bg-gray-800/80 p-5 rounded-xl border border-gray-700 text-gray-200 whitespace-pre-wrap font-serif text-lg">{detailData.content_text}</div></div>
                                  <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl p-5"><h3 className="text-purple-400 font-bold mb-4">🤖 AI Analizi (Skor: {detailData.ai_score})</h3>
                                    <p className="text-gray-300 text-sm italic mb-4">"{detailData.ai_feedback}"</p>
                                    <div className="space-y-3">{detailData.mistakes?.map((m, i) => (<div key={i} className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg"><span className="text-red-300 font-bold text-xs block mb-1">{m.type}</span><p className="text-gray-400 text-xs">{m.desc}</p><div className="mt-1 text-emerald-400 text-[10px] font-mono">Öneri: {m.fix}</div></div>))}</div>
                                  </div>
                              </div>
                          ) : "Veri yok"}
                      </div>
                      <div className="w-full md:w-1/3 bg-[#1f2937] p-6 border-l border-gray-700">
                          <form onSubmit={handleUpdateScore} className="space-y-6">
                              <div><label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Final Puanı</label><input type="number" min="0" max="100" value={newScore} onChange={e=>setNewScore(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white text-center text-3xl font-black outline-none focus:border-indigo-500" /></div>
                              <div><label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Hoca Yorumu (UC11)</label><textarea value={comment} onChange={e=>setComment(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white h-48 resize-none text-sm outline-none focus:border-indigo-500" placeholder="Öğrenciye özel not ekleyin..."></textarea></div>
                              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 transition hover:scale-[1.01]">Değerlendirmeyi Bitir</button>
                          </form>
                      </div>
                  </div>
              </div>
           </div>
      )}
    </div>
  );
};

export default TeacherDashboard;