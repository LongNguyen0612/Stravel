import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CopilotLayout } from "./components/b2b/CopilotLayout";
import { CopilotSidebar } from "./components/b2b/CopilotSidebar";
import { SessionPanel } from "./components/b2b/SessionPanel";
import { ChatInterface } from "./components/b2c/ChatInterface";
import { DemoLayout } from "./components/b2c/DemoLayout";
import { useStreamContext } from "./hooks/useStreamContext";
import { api } from "./services/apiClient";
import type { AdvisorySession } from "./types/domain";

function CopilotPage() {
  const [session, setSession] = useState<AdvisorySession | null>(null);
  const { state, connect } = useStreamContext();

  const handleCreateSession = async () => {
    const newSession = (await api.sessions.create()) as AdvisorySession;
    setSession(newSession);
    connect(newSession.id);
  };

  return (
    <CopilotLayout
      sessionPanel={<SessionPanel session={session} onCreateSession={handleCreateSession} />}
      sidebar={<CopilotSidebar state={state} />}
    />
  );
}

interface DemoMessage {
  role: "user" | "assistant";
  content: string;
}

function DemoPage() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [stage, setStage] = useState("profiling");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleSend = async (message: string) => {
    setIsLoading(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const resp = await fetch("/api/v1/demo/sessions", { method: "POST" });
        const data = await resp.json();
        sid = data.session_id;
        setSessionId(sid);
      }

      setMessages((prev) => [...prev, { role: "user", content: message }]);

      const chatResp = await fetch(`/api/v1/demo/sessions/${sid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const chatData = await chatResp.json();
      setMessages((prev) => [...prev, { role: "assistant", content: chatData.reply }]);
      setStage(chatData.stage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DemoLayout stage={stage}>
      <ChatInterface messages={messages} onSendMessage={handleSend} isLoading={isLoading} />
    </DemoLayout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CopilotPage />} />
        <Route path="/demo" element={<DemoPage />} />
      </Routes>
    </BrowserRouter>
  );
}
