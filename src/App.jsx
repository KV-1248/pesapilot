import { useEffect, useRef, useState, useCallback } from "react";

const API = "http://localhost:8080/api";

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function playSuccessChime(enabled) {
  if (!enabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
      gain.gain.setValueAtTime(0.14, ctx.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.09);
      osc.stop(ctx.currentTime + i * 0.09 + 0.36);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

function runConfetti(canvas) {
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#00A651", "#10B981", "#F59E0B", "#34D399", "#FFFFFF"];
  const particles = Array.from({ length: 75 }, () => ({
    x: canvas.width * (0.3 + Math.random() * 0.4),
    y: canvas.height * 0.5,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
    size: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    vRot: (Math.random() - 0.5) * 12
  }));

  let frame = 0;
  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45;
      p.rot += p.vRot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (++frame < 85) {
      requestAnimationFrame(step);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(step);
}

function buildSmsBody(payment) {
  const dateStr = new Date().toLocaleDateString("en-KE");
  const timeStr = formatTime();
  const amt = Number(payment.amount || 0).toFixed(2);
  if (payment.status === "SUCCESS") {
    return `${payment.reference} Confirmed. Ksh ${amt} received from ${payment.phone} on ${dateStr} at ${timeStr}. Transaction cost, Ksh 0.00.`;
  }
  if (payment.status === "PENDING") {
    return `${payment.reference} Pending. STK Push sent to ${payment.phone} for Ksh ${amt}. Awaiting customer M-Pesa PIN entry.`;
  }
  return `${payment.reference} Failed. Transaction of Ksh ${amt} from ${payment.phone} was cancelled or timed out. Ksh 0.00 deducted.`;
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [inFlight, setInFlight] = useState(false);
  const [payments, setPayments] = useState([]);
  const [flashingRefs, setFlashingRefs] = useState(new Set());
  const [lastSynced, setLastSynced] = useState("Synced just now");
  const [darkMode, setDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mobileTab, setMobileTab] = useState("chat");
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const confettiRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const knownStatusesRef = useRef(new Map());
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, inFlight]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setActiveReceipt(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`${API}/payments`);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const newlySucceeded = new Set();
      data.forEach((p) => {
        const prev = knownStatusesRef.current.get(p.reference);
        if (prev && prev !== "SUCCESS" && p.status === "SUCCESS") {
          newlySucceeded.add(p.reference);
        }
        knownStatusesRef.current.set(p.reference, p.status);
      });

      if (newlySucceeded.size > 0) {
        playSuccessChime(soundEnabled);
        runConfetti(confettiRef.current);
        showToast("Payment confirmed!");
        setFlashingRefs(newlySucceeded);
        setTimeout(() => setFlashingRefs(new Set()), 1500);
      }

      setPayments(data);
      setLastSynced(`Synced ${formatTime()}`);
    } catch {
      // Background polling failure ignored
    }
  }, [soundEnabled, showToast]);

  useEffect(() => {
    fetchPayments();
    const id = setInterval(fetchPayments, 3000);
    return () => clearInterval(id);
  }, [fetchPayments]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || inFlight) return;

      setInFlight(true);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: trimmed, time: formatTime() }
      ]);

      try {
        const res = await fetch(`${API}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, sessionId })
        });
        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "bot", text: data.reply || "Done.", time: formatTime() }
        ]);
        await fetchPayments();
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "error",
            text: "Couldn't reach the server, please try again",
            time: formatTime()
          }
        ]);
      } finally {
        setInFlight(false);
        textareaRef.current?.focus();
      }
    },
    [inFlight, sessionId, fetchPayments]
  );

  const handleFormSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
  };

  const handleDemoMode = async () => {
    if (inFlight) return;
    const typeAndSend = async (phrase) => {
      let current = "";
      for (const ch of phrase) {
        current += ch;
        setInput(current);
        await new Promise((r) => setTimeout(r, 28));
      }
      await sendMessage(phrase);
    };
    await typeAndSend("request 10 bob from 0700000000");
    await new Promise((r) => setTimeout(r, 1500));
    await typeAndSend("did it go through?");
  };

  const handleDownloadPng = () => {
    if (!activeReceipt) return;
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 380;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 640, 380);
    ctx.fillStyle = "#00A651";
    ctx.fillRect(0, 0, 640, 74);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("MPESA • PesaPilot Receipt", 28, 46);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 20px monospace";
    ctx.fillText(`REF: ${activeReceipt.reference}  (${activeReceipt.status})`, 28, 120);
    ctx.font = "18px sans-serif";
    ctx.fillText(`Phone: ${activeReceipt.phone}   |   Amount: Ksh ${activeReceipt.amount}`, 28, 158);
    ctx.fillStyle = "#4B5563";
    ctx.font = "15px sans-serif";
    const sms = buildSmsBody(activeReceipt);
    ctx.fillText(sms.slice(0, 68), 28, 215);
    ctx.fillText(sms.slice(68, 136), 28, 240);
    const link = document.createElement("a");
    link.download = `MPesa-Receipt-${activeReceipt.reference}.png`;
    link.href = c.toDataURL("image/png");
    link.click();
    showToast("Receipt downloaded");
  };

  const successPayments = payments.filter((p) => p.status === "SUCCESS");
  const totalCollected = successPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <>
      <canvas id="confetti-canvas" ref={confettiRef} />

      <header>
        <div className="brand">
          <div className="logo-box" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div>
            <div className="brand-title">
              <span>PesaPilot</span>
              <span className="status-pill"><span className="dot" /> Online</span>
              <span className="mode-pill">Live Mode (8080)</span>
            </div>
            <div className="tagline">Chat. Pay. Done. • M-Pesa STK Copilot</div>
          </div>
        </div>

        <div className="header-actions">
          <button type="button" className="btn-ghost btn-demo" onClick={handleDemoMode} title="Run live pitch demo">
            ▶ Pitch Demo
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) {
                playSuccessChime(true);
                runConfetti(confettiRef.current);
              }
            }}
            title="Toggle payment chime"
          >
            {soundEnabled ? "🔊 Chime" : "🔇 Muted"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setDarkMode((d) => !d)}
            title="Toggle dark mode"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <div className="mobile-tabs">
        <div className="tab-track">
          <button
            type="button"
            className={`tab-btn ${mobileTab === "chat" ? "active" : ""}`}
            onClick={() => setMobileTab("chat")}
          >
            💬 Chat
          </button>
          <button
            type="button"
            className={`tab-btn ${mobileTab === "payments" ? "active" : ""}`}
            onClick={() => setMobileTab("payments")}
          >
            💳 Payments ({payments.length})
          </button>
        </div>
      </div>

      <main>
        <section className={`chat-panel ${mobileTab !== "chat" ? "hidden-mobile" : ""}`}>
          <div className="session-bar">
            <span>Daraja STK Session ID: <code>{sessionId.slice(0, 8)}...</code></span>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                setSessionId(crypto.randomUUID());
                showToast("New Daraja STK session started");
              }}
            >
              ↻ New Session
            </button>
          </div>

          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h2>Karibu to PesaPilot! 👋</h2>
                <p>I&apos;m your AI M-Pesa dispatcher. Type in plain English to send an instant STK push, query payment receipts, or track collections.</p>
                <div className="example-box">
                  <strong>EXAMPLE COMMANDS YOU CAN TEST:</strong><br />
                  • &ldquo;Request KES 500 from 0712345678 for lunch&rdquo;<br />
                  • &ldquo;Did payment for PP-f3e29a44 go through?&rdquo;<br />
                  • &ldquo;Request 250 bob from 0722123456&rdquo;
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`msg-row ${m.role}`}>
                  <div className="bubble">{m.text}</div>
                  <div className="timestamp">{m.time}</div>
                </div>
              ))
            )}

            {inFlight && (
              <div className="typing" aria-label="Assistant is typing">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="composer-area">
            <div className="chips-label">SUGGESTIONS:</div>
            <div className="chips">
              {[
                "Request 10 bob from 0712345678",
                "Did it go through?",
                "Show all payments"
              ].map((chipText) => (
                <button
                  key={chipText}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setInput(chipText);
                    textareaRef.current?.focus();
                  }}
                >
                  {chipText}
                </button>
              ))}
            </div>

            <form className="input-box" onSubmit={handleFormSubmit}>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleInputKeyDown}
                placeholder="Type 'Request KES 500 from 0712345678 for lunch'..."
              />
              <button type="submit" className="send-btn" disabled={inFlight}>
                Send ↵
              </button>
            </form>
            <div className="composer-hint">
              Press Enter ↵ to send, Shift+Enter for new line • <em>Safely prompts user device via STK</em>
            </div>
          </div>
        </section>

        <aside className={`payments-panel ${mobileTab !== "payments" ? "hidden-mobile" : ""}`}>
          <div className="payments-header">
            <div className="payments-title-row">
              <h3>Recent Payments</h3>
              <div className="payments-header-right">
                <span className="poll-badge"><span className="dot" style={{ color: "var(--primary)" }} /> Polls 3s</span>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => {
                    fetchPayments();
                    showToast("Refreshing payments...");
                  }}
                  title="Refresh payments now"
                >
                  ↻
                </button>
              </div>
            </div>

            <div className="summary-grid">
              <div className="metric-card">
                <div className="metric-label">Total Collected</div>
                <div className="metric-value green">Ksh {totalCollected.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Count / Success</div>
                <div className="metric-value">
                  {payments.length} txns ({successPayments.length} paid)
                </div>
              </div>
            </div>
          </div>

          <div className="payments-list">
            {payments.length === 0 ? (
              <div className="empty-payments">No payments yet</div>
            ) : (
              [...payments].reverse().map((p) => {
                const badgeIcon = p.status === "SUCCESS" ? "✓" : p.status === "PENDING" ? "●" : "✕";
                return (
                  <div
                    key={p.reference}
                    className={`payment-card ${flashingRefs.has(p.reference) ? "flash-success" : ""}`}
                    onClick={() => setActiveReceipt(p)}
                  >
                    <div className="card-top">
                      <div className="ref-group">
                        <span>{p.reference}</span>
                        <button
                          type="button"
                          className="copy-btn"
                          title="Copy reference"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(p.reference);
                            showToast(`Copied ${p.reference}`);
                          }}
                        >
                          📋
                        </button>
                      </div>

                      <span
                        className={`badge ${p.status}`}
                        onClick={(e) => {
                          if (p.status === "SUCCESS") {
                            e.stopPropagation();
                            playSuccessChime(soundEnabled);
                            runConfetti(confettiRef.current);
                            showToast(`${p.reference} confirmed`);
                          }
                        }}
                      >
                        {badgeIcon} {p.status}
                      </span>
                    </div>

                    <div className="card-bottom">
                      <span className="phone-text">{p.phone}</span>
                      <span className="amount-text">Ksh {Number(p.amount).toLocaleString()}</span>
                    </div>

                    <div className="sms-hint">
                      <span>Tap to view SMS</span>
                      <span>Daraja STK</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="payments-footer">
            <span><span className="dot" style={{ color: "var(--primary)" }} /> Pending auto-sync</span>
            <span>{lastSynced}</span>
          </div>
        </aside>
      </main>

      {activeReceipt && (
        <div
          className="modal-backdrop open"
          onClick={(e) => {
            if (e.target.classList.contains("modal-backdrop")) setActiveReceipt(null);
          }}
        >
          <div className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <div className="receipt-header">
              <div>
                <strong id="modalTitle">MPESA</strong>
                <div className="receipt-sub">Safaricom M-Pesa Service • Simulated SMS</div>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setActiveReceipt(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div className="receipt-body">
              <div className="sms-bubble">{buildSmsBody(activeReceipt)}</div>
              <div className="receipt-meta">
                <div><span>REF CODE</span><strong>{activeReceipt.reference}</strong></div>
                <div><span>STATUS</span><strong>{activeReceipt.status}</strong></div>
                <div><span>PHONE</span><strong>{activeReceipt.phone}</strong></div>
                <div><span>AMOUNT</span><strong>Ksh {Number(activeReceipt.amount).toLocaleString()}</strong></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="primary-action" onClick={handleDownloadPng}>
                  ⬇ Download Receipt (.PNG)
                </button>
                <button type="button" onClick={() => window.print()}>🖨 Print / PDF</button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildSmsBody(activeReceipt));
                    showToast("SMS receipt copied");
                  }}
                >
                  📋 Copy SMS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { amount, phone } = activeReceipt;
                    setActiveReceipt(null);
                    sendMessage(`Request KES ${amount} from ${phone}`);
                  }}
                >
                  📲 Resend STK
                </button>
                <button type="button" onClick={() => setActiveReceipt(null)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`toast ${toastMsg ? "show" : ""}`}>{toastMsg}</div>
    </>
  );
}
