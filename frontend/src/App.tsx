import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import ModelDetail from "@/pages/ModelDetail";

export default function App() {
  return (
    <Router basename="/frontend">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/model/:name" element={<ModelDetail />} />
      </Routes>
    </Router>
  );
}
