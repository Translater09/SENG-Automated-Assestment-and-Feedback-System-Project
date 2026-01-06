import { useParams } from "react-router-dom";

const TeacherStudentDetail = () => {
  const { studentId } = useParams();

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">
        Student Analytics – {studentId}
      </h2>

      <h3 className="mt-4 font-semibold">Repeated Mistakes</h3>
      <ul className="list-disc ml-6 mt-2">
        <li>Tense errors</li>
        <li>Article misuse</li>
      </ul>
    </div>
  );
};

export default TeacherStudentDetail;
