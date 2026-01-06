import React, { useState, useEffect } from 'react';

const NetworkHandler = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#02040a] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="bg-[#111827] border border-red-500/30 p-10 rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.2)] max-w-md w-full">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                </svg>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">BAĞLANTI KOPTU</h1>
            <p className="text-gray-400 mb-8">
                İnternet bağlantın kesildi. Sistemi kullanmaya devam etmek için lütfen bağlantını kontrol et.
            </p>
            <button 
                onClick={() => window.location.reload()} 
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20"
            >
                TEKRAR DENE
            </button>
        </div>
      </div>
    );
  }

  return children;
};

export default NetworkHandler;