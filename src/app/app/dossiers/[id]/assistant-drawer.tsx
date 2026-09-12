"use client";

import * as React from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askAssistant } from "@/server/actions/assistant";

const SUGGESTED_QUESTIONS = [
  "Por que está bloqueado?",
  "Qual documento está divergente?",
  "Mostre a evidência.",
  "Quais documentos faltam?",
  "Qual regra foi aplicada?",
  "Qual fundamento?",
  "O que mudou desde a versão anterior?",
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AssistantDrawer({ dossierId }: { dossierId: string }) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou seu assistente de conferência regulatória. Respondo estritamente com base nos documentos, evidências e regras vinculadas a este processo.",
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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Não consegui processar sua consulta no momento. Tente novamente." },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
          <Sparkles className="h-4 w-4" />
          Assistente Contextual
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Assistente de Conferência
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Apoio contextual baseado exclusivamente nas evidências do processo.
          </p>
        </SheetHeader>

        <div className="flex flex-1 flex-col justify-between overflow-hidden p-4">
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && <p className="pl-9 text-xs text-muted-foreground">Consultando base do processo...</p>}
            </div>
          </ScrollArea>

          <div className="space-y-3 pt-3 border-t border-border mt-3">
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
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
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre as divergências..."
                disabled={loading}
                className="h-9 text-xs"
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={loading || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
