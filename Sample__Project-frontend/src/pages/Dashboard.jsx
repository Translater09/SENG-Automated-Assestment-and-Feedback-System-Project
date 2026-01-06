import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import RepeatedMistakes from "../components/RepeatedMistakes";

const Dashboard = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      try {
        const res = await axios.get(
          `http://127.0.0.1:8000/student/dashboard?token=${token}`
        );
        setItems(res.data || []);
      } catch (err) {
        console.error(err);
        setError("Dashboard yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token]);

  if (loading) return <p className="p-6">⏳ Yükleniyor...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📊 Student Dashboard</h2>

      {/* 🔥 FR7 BURADA */}
      <RepeatedMistakes />

      {items.length === 0 ? (
        <p>Henüz gönderim yok.</p>
      ) : (
        items.map((item) => (
          <div
            key={item.submission_id}
            className="border p-4 mb-3 rounded bg-white"
          >
            <p>
              <strong>Type:</strong> {item.type}
            </p>
            <p>
              <strong>Score:</strong> {item.score}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(item.created_at).toLocaleString()}
            </p>
            <p>
              <strong>Feedback:</strong> {item.feedback_preview}
            </p>
          </div>
        ))
      )}

      <Link
        to="/progress"
        className="mt-6 inline-block text-indigo-600 underline"
      >
        📈 İlerleme Durumumu Gör
      </Link>
    </div>
  );
};

export default Dashboard;
