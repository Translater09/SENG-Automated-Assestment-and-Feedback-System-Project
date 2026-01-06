import React, { useState, useEffect } from 'react';
import axios from 'axios';

const WReport = ({ token }) => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    //  Dashboard Özet Verileri çekimi 
    const fetchReportSummary = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:8000/report/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReportData(res.data);
        } catch (err) { console.error("Özet verisi alınamadı."); }
    };

    useEffect(() => { if (token) fetchReportSummary(); }, [token]);

    //  PDF İndirme İşlemi [cite: 118]
    const handleDownload = async () => {
        setLoading(true);
        try {
            const response = await axios.get(
                `http://127.0.0.1:8000/report/download?token=${token}`,
                { responseType: 'blob' } // PDF bütünlüğü için zorunlu
            );

            const fileBlob = new Blob([response.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(fileBlob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `Weekly_Progress_Report.pdf`);
            document.body.appendChild(link);
            link.click();
            
            window.URL.revokeObjectURL(blobUrl);
            link.remove();
        } catch (error) { alert("Rapor şu an indirilemiyor."); } finally { setLoading(false); }
    };

    return (
        <div className="p-6 bg-[#0f172a] rounded-xl border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">Haftalık Gelişim Paneli</h2>
            
            {/*  Aktivite Sayıları ve Görsel Barlar  */}
            {reportData?.counts && (
                <div className="space-y-4 mb-8">
                    {Object.entries(reportData.counts).map(([type, count]) => (
                        <div key={type} className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50">
                            <div className="flex justify-between items-end mb-2">
                                <p className="text-slate-500 text-xs font-bold uppercase">{type}</p>
                                <p className="text-white text-lg font-black">{count} Aktivite</p>
                            </div>
                            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-indigo-500 h-full transition-all duration-1000" 
                                    style={{ width: `${Math.min(count * 20, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/*  Öğretmen Geri Bildirimi Önizleme  */}
            {reportData?.latest_teacher_comment && (
                <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <p className="text-emerald-400 text-[10px] font-black uppercase mb-2">Öğretmen Değerlendirmesi</p>
                    <p className="text-slate-200 text-sm italic italic leading-relaxed">"{reportData.latest_teacher_comment}"</p>
                </div>
            )}

            <button 
                onClick={handleDownload} 
                disabled={loading} 
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-widest shadow-xl transition-all"
            >
                {loading ? "Rapor Hazırlanıyor..." : "Profesyonel Raporu İndir (PDF)"}
            </button>
        </div>
    );
};

export default WReport;