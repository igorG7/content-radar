"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  id: number;
  role: "user" | "agent";
  content: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "agent",
    content: "Olá. Quando a integração estiver conectada, vou ajudar a consultar briefs, revisar decisões e orientar próximos passos da operação editorial.",
  },
];

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", content },
      {
        id: Date.now() + 1,
        role: "agent",
        content: "Mensagem recebida. A integração com o agente ainda será conectada; por enquanto esta tela valida a experiência de conversa.",
      },
    ]);
    setDraft("");
  }

  return (
    <section className="chat-shell panel">
      <div className="chat-thread" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className={`chat-message chat-message--${message.role}`}>
            <div className="chat-message__meta">
              <span>{message.role === "agent" ? "Agente" : "Você"}</span>
            </div>
            <p>{message.content}</p>
          </article>
        ))}
      </div>

      <form onSubmit={submit} className="chat-composer">
        <label className="sr-only" htmlFor="agent-message">Mensagem para o agente</label>
        <textarea
          id="agent-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="field chat-composer__input"
          rows={3}
          placeholder="Escreva uma pergunta ou comando para o agente..."
        />
        <button type="submit" className="button-primary chat-composer__button text-base" disabled={!draft.trim()}>
          <span>Enviar</span>
          <span className="nav-icon" aria-hidden="true">›</span>
        </button>
      </form>
    </section>
  );
}
