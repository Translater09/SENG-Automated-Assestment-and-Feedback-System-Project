import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uygulama Hatası:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-[#02040a] flex flex-col items-center justify-center p-6 text-center">
             <div className="bg-[#111827] border border-blue-500/30 p-10 rounded-3xl shadow-2xl max-w-md w-full">
                <h1 className="text-4xl font-black text-white mb-4">ÜZGÜNÜZ 😕</h1>
                <p className="text-gray-400 mb-8">
                    Beklenmedik bir hata oluştu. İnternet bağlantısından veya sunucudan kaynaklı bir sorun olabilir.
                </p>
                <button
                    onClick={() => {
                        this.setState({ hasError: false });
                        window.location.href = '/';
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
                >
                    Ana Sayfaya Dön ve Yenile
                </button>
             </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;