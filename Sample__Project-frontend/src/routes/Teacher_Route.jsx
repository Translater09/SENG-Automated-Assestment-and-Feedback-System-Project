import { Navigate } from "react-router-dom";

export default function TeacherRoute({ children }) {
  const role = localStorage.getItem("role");
  return role === "teacher" ? children : <Navigate to="/login" />;
}
