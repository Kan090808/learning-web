import { useState, useRef, useEffect } from "react";

const METHODS = [
  { id: "recall", icon: "🧠", name: "主動回憶", desc: "AI 出題，你作答，強化記憶", color: "#6C63FF", bg: "#F0EEFF" },
  { id: "feynman", icon: "🧑‍🏫", name: "費曼技巧", desc: "用自己的話解釋，AI 找出盲點", color: "#E8862A", bg: "#FFF4EA" },
  { id: "interleaving", icon: "🔀", name: "交錯練習", desc: "混合不同類型題目，深化理解", color: "#2AB5A0", bg: "#EAFAF7" },
  { id: "deliberate", icon: "🎯", name: "刻意練習", desc: "AI 鎖定你的弱點，專項突破", color: "#D94F70", bg: "#FDEEF3" },
];

const SYSTEM_PROMPTS = {
  recall: (topic) => `你是一位嚴格但友善的學習教練，專門使用「主動回憶」學習法。使用者正在學習：${topic}
你的任務：每次出 1 個問題，測試使用者對 ${topic} 的理解。問題要從基礎到進階，循序漸進。使用者回答後，給出詳細批改：✅ 正確的部分、❌ 錯誤或遺漏的部分、💡 補充說明。批改完後問「準備好了嗎？繼續下一題」。用繁體中文回答，保持簡潔，每次只出一題。`,
  feynman: (topic) => `你是一位使用「費曼技巧」的學習教練。使用者正在學習：${topic}
你的任務：先請使用者「用自己的話，像解釋給小孩聽一樣」解釋 ${topic} 的某個概念。仔細分析他的解釋：找出哪些地方說得好、哪些地方模糊、哪些地方有誤解。針對盲點，用最簡單的比喻幫他釐清。然後再挑下一個概念讓他解釋。用繁體中文，語氣像聊天，不要太正式。`,
  interleaving: (topic) => `你是一位使用「交錯練習」的學習教練。使用者正在學習：${topic}
你的任務：混合出不同類型的題目：選擇題、填空題、應用題、比較題。題目類型要不規律地交替，不能連續出同一類型。每題結束後簡短說明答案，然後立刻換下一種題型。在題目前標記題型，例如「【應用題】」「【比較題】」。用繁體中文，保持節奏感。`,
  deliberate: (topic) => `你是一位使用「刻意練習」的學習教練。使用者正在學習：${topic}
你的任務：先問 2-3 個基礎問題，找出使用者的弱點。一旦發現弱點，集中火力在那個弱點上出題。每次出題難度比上次稍微高一點點（剛好超出舒適圈）。給出即時、具體的反饋。明確告訴使用者「你的弱點是___，我們來專攻這裡」。用繁體中文，語氣積極鼓勵。`,
};

const VOCAB_EXTRACT_SYSTEM = `你是一個詞彙抽取工具。從使用者提供的學習內容中，抽取 2~5 個重要的學習詞彙或概念。
只回傳 JSON 陣列，不要有任何其他文字、說明或 markdown 代碼塊：
[{"word":"詞彙","reading":"讀音或拼音（若無則空字串）","meaning":"中文解釋，一句話以內"}]
如果內容沒有值得記憶的詞彙，回傳空陣列 []。`;

const OPENROUTER_MODEL = "deepseek/deepseek-v4-flash:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── OpenRouter API call (OpenAI-compatible) ──
async function callOpenRouter(apiKey, systemPrompt, messages) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://learning-web.app",
      "X-Title": "Learning Engine",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text })),
      ],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API 錯誤");
  return data.choices?.[0]?.message?.content || "發生錯誤，請重試。";
}

// ── Vocab extractor ──
async function extractVocab(apiKey, text) {
  if (!apiKey) return [];
  try {
    const result = await callOpenRouter(apiKey, VOCAB_EXTRACT_SYSTEM, [
      { role: "user", text: `學習內容：\n${text}` },
    ]);
    const clean = result.replace(/```json|```/g, "").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}

// ── Browser TTS ──
function useTTS() {
  const [playingId, setPlayingId] = useState(null);
  const uttRef = useRef(null);
  const speak = (text, id) => {
    if (!window.speechSynthesis) return;
    if (playingId === id) { window.speechSynthesis.cancel(); setPlayingId(null); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "zh-TW";
    utt.onend = () => setPlayingId(null);
    utt.onerror = () => setPlayingId(null);
    uttRef.current = utt;
    setPlayingId(id);
    window.speechSynthesis.speak(utt);
  };
  return { speak, playingId };
}

// ── Typing Text ──
function TypingText({ text, onDone }) {
  const [displayed, setDisplayed] = useState("");
  const i = useRef(0);
  useEffect(() => {
    setDisplayed(""); i.current = 0;
    if (!text) return;
    const t = setInterval(() => {
      i.current++;
      setDisplayed(text.slice(0, i.current));
      if (i.current >= text.length) { clearInterval(t); onDone?.(); }
    }, 11);
    return () => clearInterval(t);
  }, [text]);
  return <span style={{ whiteSpace: "pre-wrap" }}>{displayed}</span>;
}

// ── Message Bubble ──
function MessageBubble({ msg, method, speak, playingId, vocab, onAddWord }) {
  const isAI = msg.role === "assistant";
  const isPlaying = playingId === msg.id;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignSelf: isAI ? "flex-start" : "flex-end", maxWidth: "86%", gap: 6 }}>
      <div style={{ background: isAI ? "#fff" : method.color, color: isAI ? "#1A1A2E" : "#fff", borderRadius: isAI ? "18px 18px 18px 4px" : "18px 18px 4px 18px", padding: "13px 17px", fontSize: 14.5, lineHeight: 1.7, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", whiteSpace: "pre-wrap" }}>
        {msg.text}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: isAI ? 4 : 0, paddingRight: isAI ? 0 : 4, justifyContent: isAI ? "flex-start" : "flex-end" }}>
        <button onClick={() => speak(msg.text, msg.id)}
          style={{ background: isPlaying ? method.bg : "transparent", border: isPlaying ? `1px solid ${method.color}` : "1px solid #E8E8E8", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: isPlaying ? method.color : "#999", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          {isPlaying ? "⏹ 停止" : "🔊 朗讀"}
        </button>
      </div>
      {isAI && msg.vocab && msg.vocab.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 4, marginTop: 2 }}>
          {msg.vocab.map((v, i) => {
            const saved = vocab.some((w) => w.word === v.word);
            return (
              <button key={i} onClick={() => !saved && onAddWord(v)}
                style={{ background: saved ? "#F0FFF4" : "#fff", border: `1.5px solid ${saved ? "#52C77D" : "#E0DFF8"}`, borderRadius: 20, padding: "4px 12px", fontSize: 12.5, color: saved ? "#2A9D5C" : "#555", cursor: saved ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.15s" }}>
                <span style={{ fontWeight: 600 }}>{v.word}</span>
                {v.reading && <span style={{ opacity: 0.6, fontSize: 11 }}>{v.reading}</span>}
                <span style={{ marginLeft: 2 }}>{saved ? "✓" : "＋"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Flashcard ──
function Flashcard({ card, onNext, onPrev, index, total }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [index]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ fontSize: 13, color: "#aaa" }}>{index + 1} / {total}</div>
      <div onClick={() => setFlipped(!flipped)} style={{ width: 300, height: 180, cursor: "pointer", perspective: 600, position: "relative" }}>
        <div style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d", transition: "transform 0.4s ease", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", background: "#fff", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E" }}>{card.word}</div>
            {card.reading && <div style={{ fontSize: 14, color: "#aaa" }}>{card.reading}</div>}
            <div style={{ fontSize: 12, color: "#ccc", marginTop: 8 }}>點擊翻面</div>
          </div>
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#6C63FF", borderRadius: 20, boxShadow: "0 4px 20px rgba(108,99,255,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", textAlign: "center", lineHeight: 1.5 }}>{card.meaning}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{card.word}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onPrev} disabled={index === 0} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #E0E0E0", background: "#fff", color: index === 0 ? "#ccc" : "#555", cursor: index === 0 ? "not-allowed" : "pointer", fontWeight: 600 }}>← 上一張</button>
        <button onClick={onNext} disabled={index === total - 1} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: index === total - 1 ? "#E0DFF8" : "#6C63FF", color: "#fff", cursor: index === total - 1 ? "not-allowed" : "pointer", fontWeight: 600 }}>下一張 →</button>
      </div>
    </div>
  );
}

// ── API Modal ──
function ApiModal({ currentKey, onSave, onClose }) {
  const [val, setVal] = useState(currentKey || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", width: "90%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚙️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>API 設定</h2>
        <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 6 }}>
          輸入你的 <strong>OpenRouter API Key</strong>，串接免費的 DeepSeek V4 Flash 模型。
        </p>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"
          style={{ fontSize: 12, color: "#6C63FF", display: "inline-block", marginBottom: 6 }}>
          → 前往 OpenRouter 免費取得 Key
        </a>
        <div style={{ fontSize: 12, background: "#F0EEFF", color: "#6C63FF", borderRadius: 8, padding: "8px 12px", marginBottom: 16, lineHeight: 1.5 }}>
          使用模型：<code style={{ fontWeight: 700 }}>deepseek/deepseek-v4-flash:free</code><br />
          免費額度：20 次/分鐘，200 次/天，無需信用卡
        </div>
        <input type="password" placeholder="sk-or-v1-..." value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && val.trim() && onSave(val.trim())}
          style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "2px solid #E0DFF8", borderRadius: 10, outline: "none", color: "#1A1A2E", marginBottom: 14, fontFamily: "monospace" }} />
        <div style={{ fontSize: 11, color: "#bbb", marginBottom: 16 }}>Key 儲存在瀏覽器 localStorage，不會上傳至任何伺服器</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => val.trim() && onSave(val.trim())}
            style={{ flex: 1, padding: 12, background: "#6C63FF", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            {currentKey ? "更新 Key" : "儲存並開始"}
          </button>
          {currentKey && (
            <button onClick={() => onSave(null)}
              style={{ padding: "12px 16px", background: "#FFF0F0", color: "#E05C5C", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>清除</button>
          )}
          <button onClick={onClose}
            style={{ padding: "12px 16px", background: "#F5F5F5", color: "#888", border: "none", borderRadius: 10, cursor: "pointer" }}>取消</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──
export default function LearningEngine() {
  const [step, setStep] = useState("home");
  const [topic, setTopic] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [method, setMethod] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingMsg, setTypingMsg] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openrouter_api_key") || null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [vocab, setVocab] = useState([]);
  const [flashIndex, setFlashIndex] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const { speak, playingId } = useTTS();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingMsg]);

  const addWord = (v) => setVocab((prev) => prev.some((w) => w.word === v.word) ? prev : [...prev, v]);
  const removeWord = (word) => setVocab((prev) => prev.filter((w) => w.word !== word));

  const startMethod = async (m) => {
    if (!apiKey) { setShowApiModal(true); return; }
    setMethod(m); setStep("chat"); setMessages([]); setLoading(true);
    const initMsg = m.id === "feynman"
      ? `我想用費曼技巧學習「${topic}」，請告訴我要從哪個概念開始解釋。`
      : `我想開始學習「${topic}」，請出第一題。`;
    try {
      const aiText = await callOpenRouter(apiKey, SYSTEM_PROMPTS[m.id](topic), [{ role: "user", text: initMsg }]);
      setLoading(false);
      setTypingMsg({ role: "assistant", text: aiText, id: Date.now(), vocab: [] });
    } catch (e) {
      setLoading(false);
      setMessages([{ role: "assistant", text: `❌ 錯誤：${e.message}`, id: Date.now(), vocab: [] }]);
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || loading || typingMsg || !apiKey) return;
    const userMsg = userInput.trim();
    setUserInput("");
    const newMessages = [...messages, { role: "user", text: userMsg, id: Date.now(), vocab: [] }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const aiText = await callOpenRouter(apiKey, SYSTEM_PROMPTS[method.id](topic), newMessages);
      setLoading(false);
      setTypingMsg({ role: "assistant", text: aiText, id: Date.now(), vocab: [] });
    } catch (e) {
      setLoading(false);
      setMessages((prev) => [...prev, { role: "assistant", text: `❌ 錯誤：${e.message}`, id: Date.now(), vocab: [] }]);
    }
  };

  const onTypingDone = async () => {
    if (!typingMsg) return;
    const msg = { ...typingMsg };
    const vocabList = await extractVocab(apiKey, msg.text);
    msg.vocab = vocabList;
    setMessages((prev) => [...prev, msg]);
    setTypingMsg(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const reset = () => { setStep("home"); setTopic(""); setInputVal(""); setMethod(null); setMessages([]); setTypingMsg(null); };
  const activeMethod = method || METHODS[0];

  const Header = ({ showVocab = false, showBack = false }) => (
    <div style={{ width: "100%", maxWidth: 680, padding: "28px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: "#1A1A2E", cursor: "pointer" }} onClick={reset}>
        學習<span style={{ color: "#6C63FF" }}>引擎</span>
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {showVocab && (
          <button onClick={() => setStep("vocab")}
            style={{ background: vocab.length > 0 ? "#F0EEFF" : "none", border: `1.5px solid ${vocab.length > 0 ? "#6C63FF" : "#E0DFF8"}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, color: vocab.length > 0 ? "#6C63FF" : "#aaa", cursor: "pointer", fontWeight: 500 }}>
            📖 單字庫 {vocab.length > 0 && `(${vocab.length})`}
          </button>
        )}
        <button onClick={() => setShowApiModal(true)}
          style={{ background: apiKey ? "#F0EEFF" : "#FFF8E1", border: `1.5px solid ${apiKey ? "#6C63FF" : "#FFD54F"}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, color: apiKey ? "#6C63FF" : "#9A7A20", cursor: "pointer", fontWeight: 500 }}>
          {apiKey ? "⚙️ API 已設定" : "⚙️ 設定 API"}
        </button>
        {showBack && (
          <button onClick={() => step === "chat" ? setStep("method") : reset()}
            style={{ background: "none", border: "1.5px solid #E0DFF8", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#6C63FF", cursor: "pointer", fontWeight: 500 }}>← 返回</button>
        )}
      </div>
    </div>
  );

  // ── Vocab Page ──
  if (step === "vocab") return (
    <div style={{ minHeight: "100vh", background: "#F7F6F3", fontFamily: "'Noto Sans TC','Inter',sans-serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      {showApiModal && <ApiModal currentKey={apiKey} onSave={(k) => { setApiKey(k); k ? localStorage.setItem("openrouter_api_key", k) : localStorage.removeItem("openrouter_api_key"); setShowApiModal(false); }} onClose={() => setShowApiModal(false)} />}
      <Header showBack />
      <div style={{ width: "100%", maxWidth: 520, padding: "36px 24px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A2E", marginBottom: 4 }}>📖 我的單字庫</h2>
        <p style={{ fontSize: 13, color: "#aaa", marginBottom: 32 }}>{vocab.length} 個單字</p>
        {vocab.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#ccc" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div>還沒有單字，去學習時點擊單字加入吧！</div>
          </div>
        ) : (
          <>
            <Flashcard card={vocab[flashIndex]} index={flashIndex} total={vocab.length}
              onNext={() => setFlashIndex((i) => Math.min(i + 1, vocab.length - 1))}
              onPrev={() => setFlashIndex((i) => Math.max(i - 1, 0))} />
            <div style={{ marginTop: 40 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#aaa", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>全部單字</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vocab.map((v, i) => (
                  <div key={v.word} onClick={() => setFlashIndex(i)}
                    style={{ background: flashIndex === i ? "#F0EEFF" : "#fff", border: `1.5px solid ${flashIndex === i ? "#6C63FF" : "#F0F0F0"}`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s" }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "#1A1A2E" }}>{v.word}</span>
                      {v.reading && <span style={{ fontSize: 12, color: "#aaa", marginLeft: 8 }}>{v.reading}</span>}
                      <div style={{ fontSize: 12.5, color: "#888", marginTop: 3 }}>{v.meaning}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeWord(v.word); if (flashIndex >= vocab.length - 1) setFlashIndex(Math.max(0, vocab.length - 2)); }}
                      style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F3", fontFamily: "'Noto Sans TC','Inter',sans-serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-7px)}}
        textarea:focus,input:focus{border-color:#6C63FF!important}
        .mcard:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(108,99,255,0.12)}
      `}</style>

      {showApiModal && <ApiModal currentKey={apiKey} onSave={(k) => { setApiKey(k); k ? localStorage.setItem("openrouter_api_key", k) : localStorage.removeItem("openrouter_api_key"); setShowApiModal(false); }} onClose={() => setShowApiModal(false)} />}

      <Header showVocab={step === "chat"} showBack={step !== "home"} />

      {/* HOME */}
      {step === "home" && (
        <div style={{ width: "100%", maxWidth: 600, padding: "64px 24px 0", textAlign: "center" }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: "#1A1A2E", lineHeight: 1.15, letterSpacing: "-1px", marginBottom: 12 }}>你想學什麼？</h1>
          <p style={{ fontSize: 16, color: "#666", marginBottom: 36, lineHeight: 1.6 }}>輸入主題，AI 用科學學習法帶你學</p>
          {!apiKey && (
            <div onClick={() => setShowApiModal(true)} style={{ background: "#FFF8E1", border: "1.5px solid #FFD54F", borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#7A5C00" }}>尚未設定 OpenRouter API Key</div>
                <div style={{ fontSize: 12, color: "#9A7A20" }}>點此設定，即可使用免費 DeepSeek AI 學習功能</div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, maxWidth: 500, margin: "0 auto" }}>
            <input style={{ flex: 1, padding: "14px 18px", fontSize: 15, border: "2px solid #E0DFF8", borderRadius: 12, background: "#fff", outline: "none", color: "#1A1A2E" }}
              placeholder="例如：Python、西班牙文、量子力學..."
              value={inputVal} onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && inputVal.trim()) { setTopic(inputVal.trim()); setStep("method"); } }} />
            <button style={{ padding: "14px 24px", background: "#6C63FF", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
              onClick={() => { if (inputVal.trim()) { setTopic(inputVal.trim()); setStep("method"); } }}>開始 →</button>
          </div>
          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
            {METHODS.map((m) => (
              <div key={m.id} style={{ background: m.bg, borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* METHOD SELECT */}
      {step === "method" && (
        <div style={{ width: "100%", maxWidth: 600, padding: "36px 24px" }}>
          {!apiKey && (
            <div onClick={() => setShowApiModal(true)} style={{ background: "#FFF8E1", border: "1.5px solid #FFD54F", borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 20 }}>
              <span>⚠️</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7A5C00" }}>請先設定 API Key 才能開始</div>
            </div>
          )}
          <div style={{ display: "inline-block", background: "#EEF", color: "#6C63FF", borderRadius: 8, padding: "4px 12px", fontSize: 14, fontWeight: 600, marginBottom: 28 }}>📚 {topic}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>選擇學習法</h2>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 28 }}>選一種方式開始，隨時可以換</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {METHODS.map((m) => (
              <div key={m.id} className="mcard"
                style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", cursor: "pointer", border: "2px solid #F0F0F0", transition: "all 0.18s" }}
                onClick={() => startMethod(m)}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = m.color}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#F0F0F0"}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{m.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: "#888", lineHeight: 1.4 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHAT */}
      {step === "chat" && (
        <div style={{ width: "100%", maxWidth: 680, flex: 1, display: "flex", flexDirection: "column", padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14, fontWeight: 600, background: activeMethod.bg, color: activeMethod.color }}>
            <span>{activeMethod.icon}</span><span>{activeMethod.name}</span>
            <span style={{ fontWeight: 400, color: "#888", marginLeft: 4 }}>· {topic}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} method={activeMethod} speak={speak} playingId={playingId} vocab={vocab} onAddWord={addWord} />
            ))}
            {typingMsg && (
              <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start", maxWidth: "86%" }}>
                <div style={{ background: "#fff", color: "#1A1A2E", borderRadius: "18px 18px 18px 4px", padding: "13px 17px", fontSize: 14.5, lineHeight: 1.7, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", whiteSpace: "pre-wrap" }}>
                  <TypingText text={typingMsg.text} onDone={onTypingDone} />
                </div>
              </div>
            )}
            {loading && (
              <div style={{ display: "flex", gap: 5, padding: "14px 18px", background: "#fff", borderRadius: "18px 18px 18px 4px", alignSelf: "flex-start", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                {[0, 1, 2].map((i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#C0BCE8", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: "flex", gap: 10, padding: "14px 0 24px", position: "sticky", bottom: 0, background: "#F7F6F3" }}>
            <textarea ref={inputRef} rows={2}
              style={{ flex: 1, padding: "13px 16px", fontSize: 14.5, border: "2px solid #E0DFF8", borderRadius: 12, background: "#fff", outline: "none", color: "#1A1A2E", resize: "none" }}
              placeholder={apiKey ? "輸入你的回答..." : "請先設定 API Key…"}
              value={userInput} onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <button
              style={{ padding: "0 20px", background: (loading || !!typingMsg || !userInput.trim() || !apiKey) ? "#C8C5F0" : activeMethod.color, color: "#fff", border: "none", borderRadius: 12, fontSize: 20, cursor: (loading || !!typingMsg || !userInput.trim() || !apiKey) ? "not-allowed" : "pointer" }}
              onClick={sendMessage} disabled={loading || !!typingMsg || !userInput.trim() || !apiKey}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}
