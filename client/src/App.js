import React, { useState } from "react";
import "./App.css";
import VulnerablePreview from "./components/VulnerablePreview";
import SecurePreview from "./components/SecurePreview";
import InfoPanel from "./components/InfoPanel";

function App() {
  const [activeTab, setActiveTab] = useState("vulnerable");

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔗 Link Preview Generator</h1>
        <p className="subtitle">
          Ứng dụng tạo preview link - Demo SSRF Attack & Prevention
        </p>
      </header>

      <div className="tabs">
        <button
          className={activeTab === "vulnerable" ? "active" : ""}
          onClick={() => setActiveTab("vulnerable")}
        >
          ⚠️ Vulnerable Version
        </button>
        <button
          className={activeTab === "secure" ? "active" : ""}
          onClick={() => setActiveTab("secure")}
        >
          ✅ Secure Version
        </button>
        <button
          className={activeTab === "info" ? "active" : ""}
          onClick={() => setActiveTab("info")}
        >
          📚 Thông tin SSRF
        </button>
      </div>

      <div className="content">
        {activeTab === "vulnerable" && <VulnerablePreview />}
        {activeTab === "secure" && <SecurePreview />}
        {activeTab === "info" && <InfoPanel />}
      </div>
    </div>
  );
}

export default App;
