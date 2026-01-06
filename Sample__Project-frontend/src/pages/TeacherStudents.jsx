import { useNavigate } from "react-router-dom";

const TeacherStudents = () => {
  const navigate = useNavigate();

 
  const students = [
    { id: "stu1", name: "Student A" },
    { id: "stu2", name: "Student B" }
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Students</h2>

      <ul className="mt-4">
        {students.map((s) => (
          <li
            key={s.id}
            className="cursor-pointer text-blue-600 underline"
            onClick={() => navigate(`/teacher/students/${s.id}`)}
          >
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeacherStudents;
