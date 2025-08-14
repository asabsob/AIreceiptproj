import { useParams, Link } from "react-router-dom";

export default function Room() {
  const { id } = useParams();
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Room {id}</h1>
      <p>This is a placeholder page to prove routing works.</p>
      <Link to="/">← Back</Link>
    </div>
  );
}
