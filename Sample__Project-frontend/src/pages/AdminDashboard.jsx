import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role"); 

  // Güvenlik: Admin değilse at
  useEffect(() => {
    if (role !== "admin") {
      navigate("/student/dashboard", { replace: true });
    }
  }, []); 

  // Verileri Çek
  useEffect(() => {
    if (role === "admin") {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/admin/users?token=${token}`),
        axios.get(`http://127.0.0.1:8000/admin/stats?token=${token}`)
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 🗑️ KULLANICI SİLME İŞLEMİ
  const handleDelete = async (userId) => {
    // 🔥 1. Adım: SİLME ONAYI SORUSU
    const isConfirmed = window.confirm("⚠️ DİKKAT!\n\nBu kullanıcıyı ve tüm verilerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.");
    
    if (!isConfirmed) return; // "İptal" derse işlem durur.
    
    const userToDelete = users.find(u => u.id === userId);

    try {
      await axios.delete(`http://127.0.0.1:8000/admin/users/${userId}?token=${token}`);
      
      // Listeden görsel olarak sil
      setUsers(users.filter(u => u.id !== userId)); 

      // 🔥 2. Adım: İSTATİSTİKLERİ ANLIK GÜNCELLE
      if (stats && userToDelete) {
        setStats(prevStats => ({
          ...prevStats,
          total_users: prevStats.total_users - 1, // Genel toplam düşer
          
          // Öğrenciyse öğrenci sayısını düşür
          active_students: userToDelete.role === 'student' 
            ? prevStats.active_students - 1 
            : prevStats.active_students,

          // Öğretmense öğretmen sayısını düşür
          active_teachers: userToDelete.role === 'teacher' 
            ? prevStats.active_teachers - 1 
            : prevStats.active_teachers
        }));
      }

    } catch (err) {
      alert("Silme başarısız oldu. Lütfen tekrar deneyin.");
    }
  };

  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[#0b1221] p-8 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
            <h1 className="text-3xl font-bold text-red-500">🛡️ Admin Paneli</h1>
            <span className="text-gray-500 text-sm mt-2">(Sistem Yöneticisi)</span>
        </div>

        {/* İstatistik Kartları (Grid 4'lü Oldu) */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Kart 1 */}
            <div className="bg-[#111827] p-6 rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Toplam Kullanıcı</h3>
              <p className="text-4xl font-bold mt-2">{stats.total_users}</p>
            </div>
            {/* Kart 2 */}
            <div className="bg-[#111827] p-6 rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Toplam Ödev</h3>
              <p className="text-4xl font-bold mt-2 text-blue-400">{stats.total_submissions}</p>
            </div>
            {/* Kart 3 */}
            <div className="bg-[#111827] p-6 rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Aktif Öğrenci</h3>
              <p className="text-4xl font-bold mt-2 text-green-400">{stats.active_students}</p>
            </div>
            {/* Kart 4 (YENİ) */}
            <div className="bg-[#111827] p-6 rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Aktif Öğretmen</h3>
              <p className="text-4xl font-bold mt-2 text-purple-400">{stats.active_teachers}</p>
            </div>
          </div>
        )}

        {/* Kullanıcı Listesi */}
        <div className="bg-[#111827] rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-gray-700 bg-gray-800/50">
             <h3 className="font-bold text-gray-200">Kayıtlı Kullanıcılar</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="p-4">İsim</th>
                <th className="p-4">Email</th>
                <th className="p-4">Rol</th>
                <th className="p-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/50 transition">
                  <td className="p-4 font-bold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                        {u.name.charAt(0)}
                    </div>
                    {u.name}
                  </td>
                  <td className="p-4 text-gray-400">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border tracking-wider
                      ${u.role === 'admin' ? 'bg-red-900/20 text-red-400 border-red-900/30' : 
                        u.role === 'teacher' ? 'bg-purple-900/20 text-purple-400 border-purple-900/30' : 
                        'bg-blue-900/20 text-blue-400 border-blue-900/30'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {u.role !== 'admin' && (
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-3 py-1.5 rounded transition text-xs font-bold border border-red-500/20"
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-10 text-center text-gray-500">
                Sistemde hiç kullanıcı yok.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}