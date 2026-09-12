"use client";

import * as React from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askAssistant } from "@/server/actions/assistant";

const SUGGESTED_QUESTIONS = [
  "Quais documentos estão faltando?",
  "Quais inconsistências são críticas?",
  "O dossiê possui bloqueios regulatórios para liberação?",
  "Explique a divergência de marca ou lote.",
  "Quais regras foram aplicadas?",
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AssistantTab({ dossierId }: { dossierId: string }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Olá! Sou o copiloto de conferência deste dossiê. Respondo com base estrita nos dados extraídos dos documentos e regras regulatórias ativas.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const result = await askAssistant(dossierId, question);
      if (result.ok && result.data) {
        setMessages((prev) => [...prev, { role: "assistant", content: result.data!.answer }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Não consegui responder agora. Tente novamente." }]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex h-[560px] flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Copiloto de Conferência Documental
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          Ancorado nos Dados do Dossiê
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <p className="pl-9 text-xs text-muted-foreground">Analisando dossiê…</p>}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte algo sobre este dossiê…" disabled={loading} />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
