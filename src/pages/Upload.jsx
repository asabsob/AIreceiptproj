import { Link } from "react-router-dom";

export default function Upload() {
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginTop: 12 }}>Upload</h1>
      <p>If you can see this, the app’s JS is running ✅</p>
      <p>
        Try a room URL like:{" "}
        <code>#/room/DEMO123</code>
      </p>
      <Link to="/#/room/DEMO123">Open demo room</Link>
    </div>
  );
}
