import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Bildirim State'leri
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role")?.trim().toLowerCase();
  const API_URL = "http://127.0.0.1:8000"; // API URL'i

  // Bildirimleri Çeken Fonksiyon
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/notifications`, {
        params: { token: token }
      });
      setNotifications(response.data);
      const unread = response.data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.log("Bildirim servisi beklemede...");
    }
  };

  // --- YENİ EKLENEN FONKSİYON: BİLDİRİME TIKLAMA ---
  const handleNotificationClick = async (notif) => {
    // 1. Eğer okunmamışsa, backend'e 'okundu' isteği at
    if (!notif.is_read) {
        try {
            await axios.put(`${API_URL}/notifications/${notif.id}/read`, null, {
                params: { token }
            });
            
            // State'i anında güncelle (Sayı düşsün, renk değişsin)
            const updatedList = notifications.map(n => 
                n.id === notif.id ? { ...n, is_read: true } : n
            );
            setNotifications(updatedList);
            setUnreadCount(prev => Math.max(0, prev - 1));

        } catch (error) {
            console.error("Bildirim güncellenemedi", error);
        }
    }

    // 2. Dropdown'ı kapat
    setShowDropdown(false);

    // 3. İlgili sayfaya yönlendir
    if (role === 'teacher') {
        navigate("/teacher/dashboard");
    } else {
        navigate("/student/progress"); // Veya öğrenci notlarını nerede görüyorsa
    }
  };
  // ----------------------------------------------------

  // Sayfa değiştikçe bildirimleri yenile
  useEffect(() => {
    fetchNotifications();
    setShowDropdown(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/"; 
  };

  if (!token) return null;

  return (
    <nav className="bg-[#0b1221] border-b border-gray-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-90 transition-all duration-300">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* SOL TARAFA (Logo ve Linkler) */}
        <div className="flex items-center gap-10">
          <Link to={role === 'teacher' ? "/teacher/dashboard" : "/student/dashboard"} className="group">
            <h1 className="font-extrabold text-2xl tracking-wide bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent group-hover:opacity-80 transition">
              AAFS
            </h1>
          </Link>
          
          <div className="hidden md:flex items-center gap-2">
            {role === "student" && (
            <>
                <NavLink to="/student/dashboard" text="Dashboard" active={location.pathname === "/student/dashboard"} />
                <NavLink to="/student/progress" text="Progress" active={location.pathname === "/student/progress"} />
                <NavLink to="/student/speaking" text="Speaking" active={location.pathname === "/student/speaking"} />
                <NavLink to="/student/writing" text="Writing" active={location.pathname === "/student/writing"} />
                <NavLink to="/student/quiz" text="Quiz" active={location.pathname === "/student/quiz"} />
            </>
            )}
            
            {role === "teacher" && (
              <NavLink to="/teacher/dashboard" text="Teacher Panel" active={true} extraClass="text-yellow-400 hover:text-yellow-200" />
            )}
          </div>
        </div>

        {/* SAĞ TARAF (Bildirim + Logout) */}
        <div className="flex items-center gap-5">
          
          {/* 🔔 BİLDİRİM ÇANI */}
          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="bg-gray-800/50 p-2.5 rounded-full hover:bg-gray-700 text-gray-300 transition focus:outline-none relative group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-white transition">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0b1221] animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* AÇILIR MENÜ */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>
                
                <div className="absolute right-0 mt-4 w-80 bg-[#111827] border border-gray-700 text-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in-down">
                  <div className="bg-gray-800/50 px-4 py-3 font-bold border-b border-gray-700 text-sm flex justify-between items-center">
                    <span>Bildirimler</span>
                    <span className="text-xs text-gray-400">{notifications.length} adet</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">Hiç bildirim yok. 🎉</div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                            key={notif.id} 
                            onClick={() => handleNotificationClick(notif)} // Tıklama Olayı Eklendi
                            className={`p-4 border-b border-gray-700/50 hover:bg-gray-800 transition text-sm cursor-pointer 
                                ${!notif.is_read ? 'bg-blue-900/10 border-l-4 border-l-blue-500' : 'opacity-70'}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                             <p className={`leading-relaxed ${!notif.is_read ? 'text-white font-semibold' : 'text-gray-400'}`}>
                                {notif.message}
                             </p>
                             {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>}
                          </div>
                          <span className="text-xs text-gray-500 block mt-1">
                            {new Date(notif.created_at).toLocaleString('tr-TR')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* LOGOUT BUTTON */}
          <button
            onClick={handleLogout}
            className="group flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 text-sm font-medium"
          >
            <span>Logout</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
};

// NavLink Bileşeni
const NavLink = ({ to, text, active, extraClass = "" }) => (
  <Link 
    to={to} 
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 
      ${active 
        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
        : "text-gray-400 hover:text-white hover:bg-white/5"} 
      ${extraClass}`}
  >
    {text}
  </Link>
);

export default Navbar;