import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation
} from "react-router-dom";

import NetworkHandler from "./components/NetworkHandler";
import ErrorBoundary from "./components/ErrorBoundary";

// Sayfalar
import Login from "./pages/Login";
import Welcome from './pages/Welcome'; 
import Register from "./pages/Register";

// Bileşenler
import Navbar from "./components/Navbar";

// Student Sayfaları
import ProtectedRoute from "./components/ProtectedRoute";
import StudentLayout from "./layouts/Student_Layout";
import StudentDashboard from "./pages/StudentDashboard";
import SpeakingSubmit from "./pages/SpeakingSubmit";
import WritingSubmit from "./pages/WritingSubmit";
import QuizSubmit from "./pages/QuizSubmit";
import StudentProgress from "./pages/StudentProgress";
import WReport from "./pages/WReport";
import Results from "./pages/Results";

// Teacher Sayfaları
import TeacherRoute from "./routes/Teacher_Route";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherStudents from "./pages/TeacherStudents";
import TeacherStudentDetail from "./pages/TeacherStudentDetail";

// Admin Sayfaları
import AdminDashboard from "./pages/AdminDashboard";

import "./styles/global.css";

const AppContent = () => {
  const location = useLocation();

  return (
    // Navbar her zaman görünsün
    <>
      <Navbar key={location.pathname} />

      <Routes>
        {/* --- GİRİŞ VE KARŞILAMA --- */}
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />       
        <Route path="/register" element={<Register />} /> 

        {/* ---------- STUDENT (Öğrenci Paneli) ---------- */}
        <Route
          path="/student"
          element={
            <ProtectedRoute>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="speaking" element={<SpeakingSubmit />} />
          <Route path="writing" element={<WritingSubmit />} />
          <Route path="quiz" element={<QuizSubmit />} />
          <Route path="report" element={<WReport />} />
        </Route>

        {/* Sonuç Sayfası */}
        <Route path="/results" element={<Results />} />

        {/* ---------- TEACHER (Öğretmen Paneli) ---------- */}
        <Route
          path="/teacher/dashboard"
          element={
            <TeacherRoute>
              <TeacherDashboard />
            </TeacherRoute>
          }
        />

        <Route
          path="/teacher/students"
          element={
            <TeacherRoute>
              <TeacherStudents />
            </TeacherRoute>
          }
        />

        <Route
          path="/teacher/students/:studentId"
          element={
            <TeacherRoute>
              <TeacherStudentDetail />
            </TeacherRoute>
          }
        />

        {/* ---------- ADMIN ---------- */}
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </>
  );
};

function App() {
  return (
    // 1. Kalkan: Hata Yakalayıcı (Kod hatalarında beyaz ekranı önler)
    <ErrorBoundary>
      {/* 2. Kalkan: İnternet Kontrolcüsü (Bağlantı koparsa uyarı verir) */}
      <NetworkHandler>
        <Router>
          <AppContent />
        </Router>
      </NetworkHandler>
    </ErrorBoundary>
  );
}

export default App;