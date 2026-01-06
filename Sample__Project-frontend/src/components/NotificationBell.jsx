import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // Yönlendirme için

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const API_URL = "http://127.0.0.1:8000";

  // 1. Bildirimleri Çek
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/notifications`, {
        params: { token }
      });
      setNotifications(res.data);
    } catch (err) {
      console.error("Bildirim hatası:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Opsiyonel: Her 30 saniyede bir yeni bildirim var mı diye bak
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // 2. Dışarı tıklayınca menüyü kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. Bildirime Tıklama (Okundu Yap + Yönlendir)
  const handleNotificationClick = async (notif) => {
    // A. Backend'e "Okundu" bilgisi gönder
    if (!notif.is_read) {
      try {
        await axios.put(`${API_URL}/notifications/${notif.id}/read`, null, {
          params: { token }
        });
        
        // B. State'i güncelle (Sayı anında düşsün diye)
        setNotifications(prev => 
          prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
        );
      } catch (err) {
        console.error("Okundu işaretlenemedi", err);
      }
    }

    // C. Yönlendirme Mantığı
    setIsOpen(false); // Menüyü kapat
    if (localStorage.getItem("role") === "teacher") {
        navigate("/teacher-dashboard"); // Hoca ise paneline
    } else {
        navigate("/progress"); // Öğrenci ise notlarını görmeye
    }
  };

  // Okunmamış Sayısı
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      
      {/* --- ZİL İKONU VE ROZET --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition rounded-full hover:bg-gray-800 focus:outline-none"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#0b1221] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* --- AÇILIR MENÜ (DROPDOWN) --- */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in-down">
          
          <div className="bg-[#111827] px-4 py-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Bildirimler</h3>
            {unreadCount > 0 && <span className="text-xs text-blue-400">{unreadCount} yeni</span>}
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Henüz bildirim yok. 🌙
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 border-b border-gray-700/50 cursor-pointer transition hover:bg-gray-700/50 flex gap-3 items-start
                    ${notif.is_read ? 'opacity-60 bg-transparent' : 'bg-blue-900/10'}`}
                >
                  {/* Durum İkonu */}
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notif.is_read ? 'bg-gray-600' : 'bg-blue-500'}`}></div>
                  
                  <div>
                    <p className={`text-sm ${notif.is_read ? 'text-gray-400' : 'text-white font-semibold'}`}>
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-gray-500 mt-1 block">
                      {new Date(notif.created_at).toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tümünü Gör Butonu (Opsiyonel) */}
          <div className="bg-[#111827] p-2 text-center border-t border-gray-700">
            <button className="text-xs text-gray-400 hover:text-white transition">Tümünü temizle</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;