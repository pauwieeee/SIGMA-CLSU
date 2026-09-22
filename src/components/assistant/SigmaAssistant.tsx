import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send, X } from 'lucide-react'
import {
  askAssistant,
  AssistantError,
  type AssistantConversationMessage,
  type AssistantQueryContext,
} from '@/utils/assistantClient'
import { AssistantMarkdown } from '@/components/assistant/AssistantMarkdown'
import cobraMascot from '@/assets/cobra-assistant.png'

const suggestedChips = ['Scholars per college', 'Expiring this month', 'Show duplicate list']

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
    case 'database_error':
      return "I couldn't read the SIGMA records needed for that answer. Please try again."
    default:
      return 'The assistant is unavailable right now. Please try again shortly.'
  }
}

export function SigmaAssistant() {
  const [open, setOpen] = useState(false)
  const [showMascotIntro, setShowMascotIntro] = useState(false)
  const [messages, setMessages] = useState<AssistantConversationMessage[]>([
    {
      role: 'assistant',
      text: 'Hi! I am SIGMAI, your virtual assistant. How can I help you today?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [queryContext, setQueryContext] = useState<AssistantQueryContext | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (sessionStorage.getItem('sigmaMascotIntroShown')) return

    sessionStorage.setItem('sigmaMascotIntroShown', 'true')
    const startTimer = window.setTimeout(() => setShowMascotIntro(true), 450)
    const stopTimer = window.setTimeout(() => setShowMascotIntro(false), 5100)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(stopTimer)
    }
  }, [])

  async function ask(question: string) {
    if (!question.trim() || loading) return
    setMessages((m) => [...m, { role: 'user', text: question }])
    setInput('')
    setLoading(true)

    try {
      const response = await askAssistant(question, messages, queryContext)
      setQueryContext(response.context)
      setMessages((m) => [...m, { role: 'assistant', text: response.answer || "Sorry, I couldn't find an answer." }])
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
      <>
        {showMascotIntro && (
          <div className="sigma-mascot-intro" aria-hidden="true">
            <div className="sigma-mascot-intro-bubble">Need help?<br />I&apos;m here!</div>
            <img src={cobraMascot} alt="" />
          </div>
        )}
        <button
          onClick={() => {
            setShowMascotIntro(false)
            setOpen(true)
          }}
          aria-label="Open SIGMAI virtual assistant"
          className="sigma-chat-launcher fixed right-6 bottom-6 z-40"
        >
          <img src={cobraMascot} alt="" />
          <span className="sigma-chat-sparkle" aria-hidden="true">✦</span>
        </button>
      </>
    )
  }

  return (
    <div
      className="fixed right-6 bottom-6 z-40 flex h-[min(560px,calc(100vh-3rem))] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border shadow-2xl"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--nav-header-dark)' }}>
        <div className="flex items-center gap-2.5">
          <span className="sigma-chat-header-avatar">
            <img src={cobraMascot} alt="Cobra mascot" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">CHAT · SIGMAI</p>
            <p className="text-xs text-white/70">Ask about scholars, categories, or reports</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close SIGMA Assistant" className="text-white/80 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-lg px-3 py-2 text-sm text-white"
              style={{ background: 'var(--btn-primary-bg)' }}
            >
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex max-w-[92%] items-start gap-2">
              <span className="sigma-chat-message-avatar">
                <img src={cobraMascot} alt="" />
              </span>
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--menu-active-bg)', color: 'var(--text-primary)' }}
              >
                <AssistantMarkdown text={m.text} />
              </div>
            </div>
          ),
        )}
        {loading && (
          <div
            className="max-w-[70%] rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--menu-active-bg)', color: 'var(--text-muted)' }}
          >
            Thinking…
          </div>
        )}
        <div ref={messagesEndRef} />
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
          placeholder="Type your message here..."
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
