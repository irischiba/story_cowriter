import React, { useState, useRef, useEffect } from 'react';

const GENRES = [
  { id: 'adventure', label: 'Adventure', emoji: '🗡️', color: 'from-orange-400 to-red-500' },
  { id: 'fairy tale', label: 'Fairy Tale', emoji: '🧚', color: 'from-pink-400 to-fuchsia-500' },
  { id: 'funny', label: 'Funny', emoji: '😂', color: 'from-yellow-400 to-orange-400' },
  { id: 'spooky-lite', label: 'Spooky', emoji: '👻', color: 'from-indigo-400 to-purple-600' },
  { id: 'sci-fi', label: 'Sci-Fi', emoji: '🚀', color: 'from-cyan-400 to-blue-500' },
];

const GRADE_LEVELS = [
  { id: 'K-1', label: 'K–1' },
  { id: '2-3', label: '2–3' },
  { id: '4-5', label: '4–5' },
];

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are a warm, enthusiastic creative writing partner for elementary school kids ages 5–11.
Your job is to collaboratively write a story one turn at a time.

Rules:
- Write ONLY 3–5 sentences per turn — keep it the kid's story, not yours
- Match the vocabulary and complexity to the selected grade level
- Never introduce scary, violent, or inappropriate content
- Always end your turn at an exciting moment so the kid wants to keep going
- If the kid writes something silly or unexpected, embrace it with enthusiasm
- Stay consistent with character names, places, and plot details established so far
- Be warm and encouraging in tone — this should feel like play
- Do NOT add any commentary outside the story text itself — just continue the narrative`;

const ENCOURAGEMENTS = [
  'Great addition! ✨',
  'Ooh, what a twist! 🌀',
  'Love it! 💛',
  'Yes! Keep going! 🎉',
  'Amazing! 🌟',
  'So creative! 🎨',
  'Whoa! Cool idea! 🤩',
];

function parseHints(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^\d+[\.\)]\s*(.+)/);
    if (m) out.push(m[1].trim());
  }
  return out.length >= 2 ? out.slice(0, 3) : null;
}

export default function StoryCowriter() {
  const [phase, setPhase] = useState('setup');
  const [genre, setGenre] = useState(null);
  const [gradeLevel, setGradeLevel] = useState('2-3');
  const [characterName, setCharacterName] = useState('');
  const envApiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_API_KEY) || '';
  const [apiKey, setApiKey] = useState(envApiKey);
  const [turns, setTurns] = useState([]);
  const [kidInput, setKidInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hints, setHints] = useState([]);
  const [encouragement, setEncouragement] = useState(null);
  const storyEndRef = useRef(null);
  const storyTopRef = useRef(null);

  useEffect(() => {
    storyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns, isLoading]);

  useEffect(() => {
    if (!encouragement) return;
    const t = setTimeout(() => setEncouragement(null), 2200);
    return () => clearTimeout(t);
  }, [encouragement]);

  async function callClaude(messages) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data.content[0].text.trim();
  }

  function buildMessages(turnsList, appendUser = null) {
    const messages = [];
    messages.push({
      role: 'user',
      content: `Please start a ${genre} story for a ${gradeLevel} grade reader. The main character's name is ${characterName || 'a brave hero'}. Write just the opening hook — 3 to 5 sentences — and end at an exciting moment so I want to keep going.`,
    });
    turnsList.forEach((t, i) => {
      messages.push({
        role: t.author === 'kid' ? 'user' : 'assistant',
        content: t.text,
      });
    });
    if (appendUser) messages.push({ role: 'user', content: appendUser });
    return messages;
  }

  async function startStory() {
    if (!genre || !apiKey.trim() || isLoading) return;
    setError(null);
    setIsLoading(true);
    setPhase('writing');
    try {
      const text = await callClaude(buildMessages([]));
      setTurns([{ author: 'claude', text }]);
    } catch (e) {
      setError("Oops! Let's try that again 😊");
      setPhase('setup');
    } finally {
      setIsLoading(false);
    }
  }

  async function submitKidTurn() {
    const input = kidInput.trim();
    if (!input || isLoading) return;
    setError(null);
    setHints([]);
    const nextTurns = [...turns, { author: 'kid', text: input }];
    setTurns(nextTurns);
    setKidInput('');
    setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
    setIsLoading(true);
    try {
      const text = await callClaude(buildMessages(nextTurns));
      setTurns([...nextTurns, { author: 'claude', text }]);
    } catch (e) {
      setError("Oops! Let's try that again 😊");
      setTurns(turns);
      setKidInput(input);
    } finally {
      setIsLoading(false);
    }
  }

  async function getHints() {
    if (isLoading || hintLoading) return;
    setHintLoading(true);
    setError(null);
    try {
      const text = await callClaude(
        buildMessages(
          turns,
          `I'm not sure what to write next. Give me exactly 3 short ideas (one sentence each) for what could happen next in the story. Format them as a simple numbered list. Keep them exciting!`
        )
      );
      const parsed = parseHints(text);
      setHints(parsed || [text]);
    } catch (e) {
      setError("Oops! Let's try that again 😊");
    } finally {
      setHintLoading(false);
    }
  }

  function resetAll() {
    setPhase('setup');
    setGenre(null);
    setCharacterName('');
    setTurns([]);
    setKidInput('');
    setHints([]);
    setError(null);
    setEncouragement(null);
  }

  const selectedGenre = GENRES.find(g => g.id === genre);

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-purple-100 to-pink-100 p-4 md:p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-6 md:p-10 space-y-7">
          <div className="text-center space-y-2">
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent leading-tight">
              Let's Write a Story Together! ✨
            </h1>
            <p className="text-lg text-gray-600">Pick what kind of story to make...</p>
          </div>

          <div>
            <label className="block text-xl font-bold text-gray-800 mb-3">1. Choose a genre</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {GENRES.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  className={`p-4 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105 active:scale-95 bg-gradient-to-br ${g.color} shadow-md ${
                    genre === g.id ? 'ring-4 ring-yellow-300 scale-105 shadow-xl' : ''
                  }`}
                >
                  <div className="text-4xl mb-1">{g.emoji}</div>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xl font-bold text-gray-800 mb-3">2. Reading level</label>
            <div className="flex gap-2">
              {GRADE_LEVELS.map(gl => (
                <button
                  key={gl.id}
                  onClick={() => setGradeLevel(gl.id)}
                  className={`flex-1 py-3 rounded-xl text-lg font-bold transition-colors ${
                    gradeLevel === gl.id
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Grade {gl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xl font-bold text-gray-800 mb-3">
              3. What's your hero's name?{' '}
              <span className="text-sm font-normal text-gray-500">(optional)</span>
            </label>
            <input
              value={characterName}
              onChange={e => setCharacterName(e.target.value)}
              placeholder="e.g. Luna the brave"
              className="w-full px-4 py-3 text-lg rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
            />
          </div>

          {!envApiKey && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Anthropic API key{' '}
                <span className="font-normal text-gray-500">
                  (stays in your browser only — or set <code>VITE_ANTHROPIC_API_KEY</code> in{' '}
                  <code>app/.env.local</code>)
                </span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none font-mono text-sm"
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div className="text-center text-red-600 font-semibold bg-red-50 rounded-xl py-2">
              {error}
            </div>
          )}

          <button
            onClick={startStory}
            disabled={!genre || !apiKey.trim() || isLoading}
            className="w-full py-5 rounded-2xl text-2xl font-extrabold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95"
          >
            {isLoading ? 'Starting...' : 'Start the Story! 🚀'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'writing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-purple-100 to-pink-100 p-3 md:p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between bg-white rounded-2xl shadow-md p-3 md:p-4">
            <h2 className="text-xl md:text-2xl font-bold text-purple-700 truncate">
              {selectedGenre?.emoji} Our {selectedGenre?.label} Story
            </h2>
            <button
              onClick={() => setPhase('finished')}
              className="ml-3 px-3 md:px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-500 font-bold text-base md:text-lg shadow whitespace-nowrap active:scale-95 transition-transform"
            >
              Finish 🎉
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4 md:p-6 space-y-3 max-h-[55vh] overflow-y-auto">
            {turns.map((t, i) => (
              <TurnBlock key={i} turn={t} />
            ))}
            {isLoading && <ThinkingBubble />}
            <div ref={storyEndRef} />
          </div>

          {hints.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-4 space-y-2">
              <div className="text-sm font-bold text-purple-600">💡 Tap an idea to use it:</div>
              <div className="flex flex-col gap-2">
                {hints.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setKidInput(h);
                      setHints([]);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold text-left text-base transition-colors"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {encouragement && (
            <div className="text-center text-xl font-bold text-purple-700 animate-bounce">
              {encouragement}
            </div>
          )}

          {error && (
            <div className="text-center text-red-600 font-semibold bg-white rounded-xl p-3 shadow">
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-md p-3 md:p-4 space-y-3 sticky bottom-2">
            <textarea
              value={kidInput}
              onChange={e => setKidInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitKidTurn();
                }
              }}
              disabled={isLoading}
              placeholder="What happens next?"
              rows={3}
              className="w-full px-4 py-3 text-lg rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none resize-none disabled:bg-gray-50"
            />
            <div className="flex gap-2">
              <button
                onClick={submitKidTurn}
                disabled={isLoading || !kidInput.trim()}
                className="flex-1 py-3 rounded-xl text-lg md:text-xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg active:scale-95 transition-transform"
              >
                Add to Story ✏️
              </button>
              <button
                onClick={getHints}
                disabled={isLoading || hintLoading}
                className="px-4 md:px-5 py-3 rounded-xl text-lg md:text-xl font-bold bg-yellow-300 hover:bg-yellow-400 disabled:opacity-40 shadow active:scale-95 transition-transform"
              >
                {hintLoading ? '...' : 'Hint 💡'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-purple-100 to-pink-100 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div ref={storyTopRef} className="text-center space-y-2 py-4 md:py-6">
          <div className="text-5xl md:text-6xl animate-pulse">🎉✨📖✨🎉</div>
          <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent">
            Your Story is Finished!
          </h1>
          <p className="text-lg md:text-xl text-gray-700">Look what you made! 🌟</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10 space-y-4 print:shadow-none">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-purple-700 mb-4">
            {selectedGenre?.emoji} {characterName ? `${characterName}'s ` : 'A '}
            {selectedGenre?.label} Tale
          </h2>
          <div className="max-w-none space-y-4">
            {turns.map((t, i) => (
              <p
                key={i}
                className="text-lg md:text-xl leading-relaxed text-gray-800 whitespace-pre-wrap first-letter:text-3xl first-letter:font-bold first-letter:text-purple-600 first-letter:mr-1"
              >
                {t.text}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 print:hidden">
          <button
            onClick={() => storyTopRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex-1 py-4 rounded-2xl text-xl font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg active:scale-95 transition-transform"
          >
            Read it again 📖
          </button>
          <button
            onClick={() => setPhase('writing')}
            className="flex-1 py-4 rounded-2xl text-xl font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 shadow active:scale-95 transition-transform"
          >
            Keep Writing ✏️
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 py-4 rounded-2xl text-xl font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 shadow active:scale-95 transition-transform"
          >
            Print 🖨️
          </button>
          <button
            onClick={resetAll}
            className="flex-1 py-4 rounded-2xl text-xl font-bold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-lg active:scale-95 transition-transform"
          >
            New Story 🌟
          </button>
        </div>
      </div>
    </div>
  );
}

function TurnBlock({ turn }) {
  const isKid = turn.author === 'kid';
  return (
    <div
      className={`rounded-2xl p-4 border-2 ${
        isKid
          ? 'bg-gradient-to-br from-yellow-50 to-amber-100 border-amber-300'
          : 'bg-gradient-to-br from-blue-50 to-purple-100 border-purple-300'
      }`}
    >
      <div
        className={`text-sm font-bold mb-1 ${
          isKid ? 'text-amber-700' : 'text-purple-700'
        }`}
      >
        {isKid ? '✏️ You wrote:' : '✨ Your story partner wrote:'}
      </div>
      <div className="text-lg text-gray-800 whitespace-pre-wrap leading-relaxed">
        {turn.text}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="rounded-2xl p-4 border-2 bg-gradient-to-br from-blue-50 to-purple-100 border-purple-300">
      <div className="text-sm font-bold mb-1 text-purple-700">
        ✨ Your story partner is thinking...
      </div>
      <div className="text-2xl flex items-center gap-2">
        <span className="inline-block animate-bounce">🤔</span>
        <span className="inline-block animate-pulse text-purple-600 font-bold">
          • • •
        </span>
      </div>
    </div>
  );
}
