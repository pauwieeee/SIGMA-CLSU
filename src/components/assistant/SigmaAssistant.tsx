import { useState, type FormEvent } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { askAssistant, AssistantError } from '@/utils/assistantClient'
import { AssistantMarkdown } from '@/components/assistant/AssistantMarkdown'

interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
}

const suggestedChips = ['Scholars per college', 'Expiring this month', 'Export duplicate list']

function errorMessageFor(code: string): string {
  switch (code) {
    case 'config_missing':
      return "The assistant isn't configured yet — an admin needs to set the Gemini API key on this deployment."
    case 'gemini_unauthorized':
      return 'The assistant is misconfigured (invalid API key). Please contact an administrator.'
    case 'gemini_rate_limited':
      return 'SIGMA Assistant is at capacity right now — please try again in a minute.'
    case 'gemini_timeout':
      return 'That took too long to answer. Please try again — if it keeps happening, try a shorter question.'
    case 'gemini_bad_response':
      return "I couldn't generate a response for that question. Try rephrasing it."
    case 'invalid_request':
      return "That question couldn't be sent — please try typing it again."
    case 'network_error':
      return "I couldn't reach the assistant service. Check your connection and try again."
    default:
      return 'The assistant is unavailable right now. Please try again shortly.'
  }
}

export function SigmaAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: "Hi Sir/Ma'am 👋 I can help you look up students, scholarships, or duplicate flags. What do you need?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function ask(question: string) {
    if (!question.trim()) return
    setMessages((m) => [...m, { role: 'user', text: question }])
    setInput('')
    setLoading(true)

    try {
      const answer = await askAssistant(question)
      setMessages((m) => [...m, { role: 'assistant', text: answer || "Sorry, I couldn't find an answer." }])
    } catch (err) {
      const code = err instanceof AssistantError ? err.code : 'network_error'
      setMessages((m) => [...m, { role: 'assistant', text: errorMessageFor(code) }])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    ask(input)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open SIGMA Assistant"
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:bg-[var(--btn-primary-hover)]"
        style={{ background: 'var(--btn-primary-bg)' }}
      >
        <MessageCircle size={24} />
      </button>
    )
  }

  return (
    <div
      className="fixed right-6 bottom-6 z-40 flex h-[560px] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border shadow-2xl"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--nav-header-dark)' }}>
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Bot size={17} className="text-white" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">SIGMA Assistant</p>
            <p className="text-xs text-white/70">Ask about scholars, categories, or reports</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close SIGMA Assistant" className="text-white/80 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto text-white' : ''}`}
            style={
              m.role === 'user'
                ? { background: 'var(--btn-primary-bg)' }
                : { background: 'var(--menu-active-bg)', color: 'var(--text-primary)' }
            }
          >
            {m.role === 'assistant' ? <AssistantMarkdown text={m.text} /> : m.text}
          </div>
        ))}
        {loading && (
          <div
            className="max-w-[70%] rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--menu-active-bg)', color: 'var(--text-muted)' }}
          >
            Thinking…
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t p-2" style={{ borderColor: 'var(--divider-light)' }}>
        {suggestedChips.map((chip) => (
          <button
            key={chip}
            onClick={() => ask(chip)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:text-white"
            style={{
              background: 'var(--menu-active-bg)',
              color: 'var(--nav-header-dark)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--menu-active-bg)')}
          >
            {chip}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-2" style={{ borderColor: 'var(--divider-light)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask SIGMA Assistant…"
          className="flex-1 rounded-full border px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--input-border)' }}
        />
        <button
          type="submit"
          disabled={loading}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60"
          style={{ background: 'var(--btn-primary-bg)' }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
