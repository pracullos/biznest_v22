import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, RotateCcw, MapPin } from 'lucide-react'
import axios from 'axios'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useCityContext } from '@/context/city.context'
import { useIsRole } from '@/hooks/use-permission'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What is the best zone for a retail business?',
  'Which areas have low flood and landslide risk?',
  'Are there commercial zones away from hazard areas?',
  'What business types suit the available zones here?',
]

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="size-3 text-primary" />
        </div>
      )}
      <div className={cn(
        'max-w-[82%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-muted text-foreground rounded-tl-sm',
      )}>
        {msg.text}
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function MessageWidget() {
  const isInvestor = useIsRole('investor')
  const { selectedCity } = useCityContext()

  if (!isInvestor) return null
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Reset conversation when city changes
  useEffect(() => {
    setMessages([])
    setError(null)
  }, [selectedCity?.id])

  async function send(question: string) {
    if (!question.trim() || loading) return
    if (!selectedCity?.id) {
      setError('Select a city first to get AI insights.')
      return
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: question }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await axios.post<{ answer: string; city_name: string }>(
        `/cities/${selectedCity.id}/analyze`,
        { question },
      )
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: res.data.answer,
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setError('Failed to get a response. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
  }

  function handleReset() {
    setMessages([])
    setError(null)
    setInput('')
  }

  const isEmpty = messages.length === 0

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">

      {/* Panel */}
      <div
        className={cn(
          'pointer-events-auto w-80 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden',
          'transition-all duration-200 origin-bottom-right',
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none',
        )}
        style={{ height: '480px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center">
              <Sparkles className="size-3 text-primary" />
            </div>
            <span className="text-sm font-semibold">BizNest AI</span>
          </div>
          <div className="flex items-center gap-0.5 -mr-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={handleReset}
                title="Clear conversation"
              >
                <RotateCcw className="size-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* City context chip */}
        {selectedCity && (
          <div className="px-3 pb-2 shrink-0">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
              <MapPin className="size-2.5 text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                {selectedCity.name}
              </span>
            </div>
          </div>
        )}

        <Separator className="shrink-0" />

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 py-3">

            {/* Empty state — welcome + suggested prompts */}
            {isEmpty && (
              <div className="space-y-4">
                <div className="text-center pt-2 space-y-1">
                  <p className="text-xs font-medium">Ask about {selectedCity?.name ?? 'your city'}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Get AI insights on zoning, hazards, and the best spots for your business.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={!selectedCity}
                      className="w-full text-left rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 px-2.5 py-2 text-[11px] text-foreground/80 hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {!selectedCity && (
                  <p className="text-center text-[10px] text-muted-foreground">
                    Select a city from the sidebar to start.
                  </p>
                )}
              </div>
            )}

            {/* Messages */}
            {!isEmpty && (
              <div className="space-y-3">
                {messages.map(msg => (
                  <Bubble key={msg.id} msg={msg} />
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="size-3 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}
                {error && (
                  <p className="text-[11px] text-destructive text-center py-1">{error}</p>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <Separator className="shrink-0" />

        {/* Input */}
        <div className="px-3 py-2.5 shrink-0 flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
            placeholder={selectedCity ? 'Ask about zoning, hazards…' : 'Select a city first…'}
            disabled={!selectedCity || loading}
            className={cn(
              'flex-1 min-w-0 h-8 rounded-md bg-muted/50 px-3 text-xs outline-none border border-transparent',
              'placeholder:text-muted-foreground/60',
              'focus:border-border transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
          <Button
            size="icon"
            className="size-8 shrink-0"
            disabled={!input.trim() || !selectedCity || loading}
            onClick={() => void send(input)}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'pointer-events-auto relative flex items-center justify-center rounded-xl transition-all duration-150 shadow-2xl border size-11',
          open
            ? 'bg-primary text-primary-foreground border-primary/50 scale-95'
            : 'bg-black/65 backdrop-blur-md border-white/10 text-white/70 hover:text-white hover:bg-black/75',
        )}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
      >
        <Sparkles className="size-5" />
      </button>
    </div>
  )
}