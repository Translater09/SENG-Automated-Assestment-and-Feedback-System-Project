import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from "recharts";

export default function StudentProgress() {
  const [data, setData] = useState({ WRITING: [], SPEAKING: [], QUIZ: [], OVERALL: [] });
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Backend'den kategorize edilmiş veriyi alıyoruz
        const res = await axios.get(`http://127.0.0.1:8000/student/progress?token=${token}`);
        setData(res.data);
      } catch (err) {
        console.error("Progress veri hatası:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Genel İstatistik Hesaplamaları (OVERALL verisi üzerinden)
  const averageScore = data.OVERALL?.length > 0 
    ? Math.round(data.OVERALL.reduce((acc, curr) => acc + curr.score, 0) / data.OVERALL.length) 
    : 0;

  // Grafik Bileşeni (Kod tekrarını önlemek için yardımcı component)
  const RenderProgressChart = ({ chartData, title, color, dataKey = "score" }) => (
    <div className="bg-[#111827] p-6 rounded-2xl border border-gray-700 h-[350px]">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-6 rounded-full" style={{ backgroundColor: color }}></span>
        {title}
      </h3>
      {chartData && chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`color${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: color }}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              fillOpacity={1} 
              fill={`url(#color${title})`} 
              strokeWidth={3}
              name="Puan"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
          Bu kategori için henüz yeterli veri toplanmadı.
        </div>
      )}
    </div>
  );

  if (loading) return <div className="p-10 text-white text-center">Veriler yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#0b1221] text-white p-4 md:p-10 pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Başlık */}
        <div>
            <h1 className="text-2xl font-bold mb-2 uppercase tracking-tighter">📈 Yetenek Analİz Merkezİ</h1>
            
        </div>

        {/* Özet Kartları (Aynı Kaldı) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#111827] p-6 rounded-2xl border border-gray-700 hover:border-blue-500/50 transition-colors">
                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Toplam Aktivite</h3>
                <p className="text-4xl font-black mt-2 text-blue-400">{data.OVERALL?.length || 0}</p>
            </div>
            <div className="bg-[#111827] p-6 rounded-2xl border border-gray-700 hover:border-green-500/50 transition-colors">
                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Genel Ortalama</h3>
                <p className={`text-4xl font-black mt-2 ${averageScore >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {averageScore}
                </p>
            </div>
            <div className="bg-[#111827] p-6 rounded-2xl border border-gray-700 hover:border-purple-500/50 transition-colors">
                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Son Performans</h3>
                <p className="text-4xl font-black mt-2 text-purple-400">
                    {data.OVERALL?.length > 0 ? data.OVERALL[data.OVERALL.length - 1].score : "-"}
                </p>
            </div>
        </div>

        {/*  ANA GRAFİKLER ALANI */}
        <div className="grid grid-cols-1 gap-8">
            {/* 1. Genel Gelişim (Area Chart ile daha profesyonel) */}
            <RenderProgressChart 
                chartData={data.OVERALL} 
                title="Genel Gelişim Trendi" 
                color="#6366f1" 
            />

            {/* 2. Yetenek Bazlı Yan Yana Grafikler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <RenderProgressChart 
                    chartData={data.WRITING} 
                    title="Writing Performansı" 
                    color="#3b82f6" 
                />
                <RenderProgressChart 
                    chartData={data.SPEAKING} 
                    title="Speaking Performansı" 
                    color="#10b981" 
                />
                <RenderProgressChart 
                    chartData={data.QUIZ} 
                    title="Quiz Başarı Oranı" 
                    color="#f59e0b" 
                />
            </div>
        </div>

        <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest">
             Visualizing progress through categorical time-series data
        </p>
      </div>
    </div>
  );
}