// src/pages/games/Hangman.tsx
import { useState, useEffect, useRef } from 'react'
import { Hash } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal } from './GameShell'
import { ripple } from '../../../shared/lib/ripple'
import { useGamePresence } from '../useGamePresence'

const ACCENT    = 'var(--accent)'
const MAX_LIVES = 3
const MAX_HINTS = 3

// localStorage key for tracking seen words
const SEEN_KEY = 'hangman_seen_words'

function getSeenWords(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveSeenWords(seen: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])) } catch {}
}


interface WordEntry { word: string; hint: string; difficulty: 'easy' | 'medium' | 'hard' | 'impossible' }

const WORDS: WordEntry[] = [
  // ── EASY (3–5 letters) ────────────────────────────────────────────────────
  { word: 'CAT',     hint: 'It purrs, knocks things off tables, and owns you.',           difficulty: 'easy' },
  { word: 'DOG',     hint: "Man's best friend. Will eat your homework without guilt.",     difficulty: 'easy' },
  { word: 'SUN',     hint: 'The original source of all your vitamin D. Do not stare.',    difficulty: 'easy' },
  { word: 'FISH',    hint: 'Lives underwater, never blinks, terrible at conversations.',  difficulty: 'easy' },
  { word: 'CAKE',    hint: 'You only get it once a year and everyone sings badly.',       difficulty: 'easy' },
  { word: 'BIRD',    hint: 'Has wings. Not all of them use them. Very rude.',             difficulty: 'easy' },
  { word: 'RAIN',    hint: 'Free water falling from the sky. Ruins every outdoor plan.',  difficulty: 'easy' },
  { word: 'TREE',    hint: 'Gives you shade, oxygen, and a place for birds to judge you.',difficulty: 'easy' },
  { word: 'LION',    hint: 'Called the king but sleeps 20 hours a day. Respect.',         difficulty: 'easy' },
  { word: 'STAR',    hint: "A distant sun. You've been wishing on dead ones for years.",  difficulty: 'easy' },
  { word: 'FROG',    hint: 'Starts in water, ends on land. Confused its whole life.',     difficulty: 'easy' },
  { word: 'BOOK',    hint: 'Holds an entire world inside but fits in your bag.',          difficulty: 'easy' },
  { word: 'MOON',    hint: 'Controls the tides and allegedly werewolves.',                difficulty: 'easy' },
  { word: 'SNOW',    hint: 'Cold, white, and cancels school. Adults do not enjoy it.',    difficulty: 'easy' },
  { word: 'WOLF',    hint: 'Howls at the moon. Always misunderstood in fairy tales.',     difficulty: 'easy' },
  { word: 'FIRE',    hint: 'Hot, mesmerising, and very bad at following rules.',          difficulty: 'easy' },
  { word: 'GOLD',    hint: 'Shiny metal that started wars and ended friendships.',        difficulty: 'easy' },
  { word: 'IRON',    hint: 'Makes your clothes flat and your body strong. Two jobs.',     difficulty: 'easy' },
  { word: 'MILK',    hint: 'Comes from cows, goes bad fast, and everyone forgot it.',     difficulty: 'easy' },
  { word: 'SOCK',    hint: 'Always goes in pairs. Always comes out alone from the wash.', difficulty: 'easy' },
  { word: 'SAND',    hint: 'Tiny rocks that get everywhere and stay there forever.',      difficulty: 'easy' },
  { word: 'WIND',    hint: 'Invisible but will mess up your hair instantly.',             difficulty: 'easy' },
  { word: 'SEED',    hint: 'Tiny thing with the audacity to become a tree someday.',      difficulty: 'easy' },
  { word: 'NEST',    hint: 'A bird built a house with no hands. Respect the craft.',      difficulty: 'easy' },
  { word: 'DRUM',    hint: 'Hit it to make music. Neighbours will disagree it is music.', difficulty: 'easy' },
  { word: 'SALT',    hint: 'Tiny white crystals that save food and ruin wounds.',         difficulty: 'easy' },
  { word: 'LAMP',    hint: 'Sits in the corner and waits to be rubbed by the wrong person.', difficulty: 'easy' },
  { word: 'SHIP',    hint: 'A giant floating thing that somehow does not sink. Usually.', difficulty: 'easy' },
  { word: 'ROPE',    hint: 'Twisted fibres with too many uses to count.',                 difficulty: 'easy' },
  { word: 'FIST',    hint: 'A closed hand with strong opinions.',                         difficulty: 'easy' },
  { word: 'BEAR',    hint: 'Huge, fluffy, and would absolutely end you in the wild.',     difficulty: 'easy' },
  { word: 'RING',    hint: 'Worn on a finger. Means different things to different people.',difficulty: 'easy' },
  { word: 'WELL',    hint: 'A hole in the ground full of wishes and water.',              difficulty: 'easy' },
  { word: 'CAVE',    hint: 'A dark hole in a rock that bats call home.',                  difficulty: 'easy' },
  { word: 'DART',    hint: 'A tiny pointed thing you throw at a circle on a wall.',       difficulty: 'easy' },
  { word: 'MIST',    hint: 'Fog but smaller. Romantic and slightly inconvenient.',        difficulty: 'easy' },
  { word: 'HIVE',    hint: 'Thousands of bees living together. Do not knock it.',         difficulty: 'easy' },
  { word: 'CLAY',    hint: 'Wet earth that becomes art or a pot if you are patient.',     difficulty: 'easy' },
  { word: 'KITE',    hint: 'A diamond in the sky tied to a string and your childhood.',   difficulty: 'easy' },
  { word: 'GLOW',    hint: 'Light with softer energy. Fireflies and phone screens both do it.', difficulty: 'easy' },

  // ── MEDIUM (6–8 letters) ─────────────────────────────────────────────────
  { word: 'PYTHON',   hint: 'Both a deadly snake and the language behind your favourite apps.',  difficulty: 'medium' },
  { word: 'GALAXY',   hint: 'Billions of stars in one neighbourhood. You live in one.',         difficulty: 'medium' },
  { word: 'JUNGLE',   hint: 'More species per square metre than your city has people.',          difficulty: 'medium' },
  { word: 'CASTLE',   hint: 'Had a moat. Now it charges tourist entry and sells fridge magnets.',difficulty: 'medium' },
  { word: 'CACTUS',   hint: 'Thrives on neglect. The plant equivalent of a loner.',             difficulty: 'medium' },
  { word: 'BRIDGE',   hint: 'Connects two places nobody wanted to swim between.',               difficulty: 'medium' },
  { word: 'MARBLE',   hint: 'Cold, smooth, and used to build empires and bathroom floors.',     difficulty: 'medium' },
  { word: 'WALLET',   hint: 'Flat and mostly empty. Very relatable object.',                    difficulty: 'medium' },
  { word: 'PEPPER',   hint: 'Tiny and makes your eyes water if it sneezes on you.',            difficulty: 'medium' },
  { word: 'SPRINT',   hint: 'Running but with urgency, panic, and immediate regret.',           difficulty: 'medium' },
  { word: 'FLUTE',    hint: 'Blow into the side of it and music somehow happens.',              difficulty: 'medium' },
  { word: 'SOCKET',   hint: 'The hole in the wall that powers modern civilisation.',            difficulty: 'medium' },
  { word: 'CHROME',   hint: 'Shiny finishing on cars and also the reason your RAM is gone.',   difficulty: 'medium' },
  { word: 'GRAVEL',   hint: 'Tiny rocks that live in driveways and the soles of your shoes.',  difficulty: 'medium' },
  { word: 'MIRROR',   hint: 'Shows you the truth whether you want it or not.',                  difficulty: 'medium' },
  { word: 'FOSSIL',   hint: 'A dead thing that became a rock. The original legacy.',            difficulty: 'medium' },
  { word: 'JACKET',   hint: 'Wearable warmth. Also makes you look like you have plans.',       difficulty: 'medium' },
  { word: 'MAGNET',   hint: 'Invisible force that attracts things and ruins hard drives.',     difficulty: 'medium' },
  { word: 'TUNNEL',   hint: 'A hole through a mountain because going over it was too hard.',   difficulty: 'medium' },
  { word: 'CANDLE',   hint: 'Wax with fire on top. Romantic until it burns your table.',       difficulty: 'medium' },
  { word: 'SPIDER',   hint: 'Eight legs, zero friends, builds its home wherever it wants.',    difficulty: 'medium' },
  { word: 'OXYGEN',   hint: 'Invisible gas you need every few seconds. Very demanding.',       difficulty: 'medium' },
  { word: 'SHADOW',   hint: 'Follows you everywhere but only when there is light.',            difficulty: 'medium' },
  { word: 'HELMET',   hint: 'Hard hat that arguments with your hairstyle to save your life.',  difficulty: 'medium' },
  { word: 'ISLAND',   hint: 'Land completely surrounded by water. Peaceful until the food runs out.', difficulty: 'medium' },
  { word: 'CURSOR',   hint: 'The little arrow on your screen with all the power.',             difficulty: 'medium' },
  { word: 'FREEZE',   hint: 'What water does when it gets too cold and what you do in panic.', difficulty: 'medium' },
  { word: 'DESERT',   hint: 'Sand, heat, and mirages. Beautiful and deadly in equal measure.', difficulty: 'medium' },
  { word: 'TROPHY',   hint: 'A shiny object that says you beat everyone else. Display it.',    difficulty: 'medium' },
  { word: 'PLANET',   hint: 'A giant rock orbiting a star. You are standing on one right now.',difficulty: 'medium' },
  { word: 'BUTTON',   hint: 'Small circle that holds your clothes together or starts a war.',  difficulty: 'medium' },
  { word: 'FILTER',   hint: 'Removes the bad stuff. Used in coffee, water, and selfies.',      difficulty: 'medium' },
  { word: 'SIGNAL',   hint: 'Invisible message sent through air that your phone lives for.',   difficulty: 'medium' },
  { word: 'FROZEN',   hint: "Water's solid state. Also Elsa's entire personality.",            difficulty: 'medium' },
  { word: 'GOBLIN',   hint: 'Small, green, chaotic energy. Not to be trusted with treasure.',  difficulty: 'medium' },
  { word: 'BLANKET',  hint: 'Fabric rectangle that solves most problems. The real MVP.',       difficulty: 'medium' },
  { word: 'COMPASS',  hint: 'Always points north. Very stubborn. Very useful.',                difficulty: 'medium' },
  { word: 'LANTERN',  hint: 'Old-school portable light. Carried by people who planned ahead.', difficulty: 'medium' },
  { word: 'AIRPORT',  hint: 'Where you wait for hours to go somewhere for hours.',             difficulty: 'medium' },
  { word: 'CABINET',  hint: 'A box with doors that holds things you forget you own.',          difficulty: 'medium' },

  // ── HARD (8–10 letters) ──────────────────────────────────────────────────
  { word: 'QUANTUM',    hint: 'Physics so strange even physicists argue about what it means.',   difficulty: 'hard' },
  { word: 'PHOENIX',    hint: 'Burns to ash and comes back. The original comeback story.',       difficulty: 'hard' },
  { word: 'ENCRYPT',    hint: 'Scramble a message so only the right person can read it.',        difficulty: 'hard' },
  { word: 'BIZARRE',    hint: 'So weird it defies easy description but you know it instantly.',  difficulty: 'hard' },
  { word: 'TYCOON',     hint: 'Extremely rich person who probably owns several islands already.', difficulty: 'hard' },
  { word: 'VORTEX',     hint: 'A spinning pull you cannot escape. Also your phone at 2am.',      difficulty: 'hard' },
  { word: 'RHYTHM',     hint: 'No vowels, all feeling. Hard to spell, impossible to fake.',      difficulty: 'hard' },
  { word: 'BAROQUE',    hint: 'Fancy European art era with too many angels and way too much gold.', difficulty: 'hard' },
  { word: 'WRINKLE',    hint: 'What time does to skin, fabric, and plans.',                      difficulty: 'hard' },
  { word: 'ZEPHYR',     hint: 'A gentle western breeze with a very dramatic name.',              difficulty: 'hard' },
  { word: 'GLADIATOR',  hint: 'Fought for survival in a sand arena. Also a great film.',         difficulty: 'hard' },
  { word: 'XYLOPHONE',  hint: 'Bang the coloured bars with a stick to make music. Kids love it.',difficulty: 'hard' },
  { word: 'VERTIGO',    hint: 'Dizziness caused by heights or Hitchcock.',                       difficulty: 'hard' },
  { word: 'SORCERER',   hint: 'Casts spells. Has a hat. Lives in a tower. Very mysterious.',     difficulty: 'hard' },
  { word: 'MARATHON',   hint: '42 kilometres of regret that people voluntarily sign up for.',    difficulty: 'hard' },
  { word: 'FRACTURE',   hint: 'A break — in a bone, a relationship, or a plan.',                 difficulty: 'hard' },
  { word: 'DIPLOMAT',   hint: 'Professionally says difficult things in the nicest possible way.', difficulty: 'hard' },
  { word: 'EPIDEMIC',   hint: 'When too many people get sick at once and everyone panics.',      difficulty: 'hard' },
  { word: 'CATALYST',   hint: 'The thing that makes everything else happen without changing itself.', difficulty: 'hard' },
  { word: 'BLIZZARD',   hint: 'Snow with anger issues and strong winds.',                        difficulty: 'hard' },
  { word: 'DIAMETER',   hint: 'A straight line through the centre of a circle. Geometry basics.',difficulty: 'hard' },
  { word: 'CORRIDOR',   hint: 'A long hallway that connects rooms and appears in every horror film.', difficulty: 'hard' },
  { word: 'MOLECULE',   hint: 'Two or more atoms holding hands. The building block of everything.', difficulty: 'hard' },
  { word: 'SEQUENCE',   hint: 'Things arranged in a specific order that actually matters.',       difficulty: 'hard' },
  { word: 'UNIVERSE',   hint: 'Everything that exists. You are a very small part of it.',        difficulty: 'hard' },
  { word: 'DELEGATE',   hint: 'Hand off your work to someone else professionally.',              difficulty: 'hard' },
  { word: 'PROPHECY',   hint: 'A prediction of the future that always comes true in the worst way.', difficulty: 'hard' },
  { word: 'CONQUEST',   hint: 'Winning by force. Empires were built on it. History is full of it.', difficulty: 'hard' },
  { word: 'SKELETON',   hint: 'The framework inside you holding everything together. Never rests.', difficulty: 'hard' },
  { word: 'ARTIFACT',   hint: 'An object from the past with a whole story and a museum shelf.',  difficulty: 'hard' },
  { word: 'STAMPEDE',   hint: 'A crowd of animals or people all running in the same panic.',     difficulty: 'hard' },
  { word: 'TWILIGHT',   hint: 'The soft light just after sunset. Also a vampire film nobody admits to liking.', difficulty: 'hard' },
  { word: 'GEOMETRY',   hint: 'The maths of shapes, angles, and why parallel lines never meet.', difficulty: 'hard' },
  { word: 'ILLUSION',   hint: 'Tricks your eyes into seeing something that is not really there.', difficulty: 'hard' },
  { word: 'PARASITE',   hint: 'Lives off another creature without paying rent.',                  difficulty: 'hard' },
  { word: 'MOMENTUM',   hint: 'Once something is moving it takes effort to stop. Ask any boulder.', difficulty: 'hard' },
  { word: 'ASTRONAUT',  hint: 'Travels beyond Earth for work. Very niche career path.',          difficulty: 'hard' },
  { word: 'DEMOCRACY',  hint: 'A system where everyone votes and then argues about the result.',  difficulty: 'hard' },
  { word: 'EVOLUTION',  hint: 'Slow change over generations. You are its current draft.',         difficulty: 'hard' },
  { word: 'HURRICANE',  hint: 'A spinning storm with a calm centre and very bad intentions.',    difficulty: 'hard' },

  // ── IMPOSSIBLE (10–15 letters) ────────────────────────────────────────────
  { word: 'MNEMONIC',      hint: 'A memory trick your brain uses to remember what it keeps forgetting.',   difficulty: 'impossible' },
  { word: 'SYZYGY',        hint: 'Three celestial bodies perfectly aligned. Unbeatable in Scrabble too.', difficulty: 'impossible' },
  { word: 'QUIXOTIC',      hint: 'Chasing impossible dreams with full sincerity. Don Quijote energy.',    difficulty: 'impossible' },
  { word: 'CHRYSALIS',     hint: 'Not quite a caterpillar, not yet a butterfly. The awkward in-between.', difficulty: 'impossible' },
  { word: 'ALGORITHM',     hint: 'A step-by-step recipe for a computer. Also why you saw that ad.',       difficulty: 'impossible' },
  { word: 'LABYRINTH',     hint: 'A maze you were not meant to escape. Also a David Bowie film.',         difficulty: 'impossible' },
  { word: 'POLYPHONY',     hint: 'Multiple distinct melodies playing simultaneously in harmony.',          difficulty: 'impossible' },
  { word: 'PHOSPHORUS',    hint: 'Glows in the dark. Essential for life. Explosive if mishandled.',       difficulty: 'impossible' },
  { word: 'BYZANTINE',     hint: 'So politically complicated it became an adjective for complexity.',     difficulty: 'impossible' },
  { word: 'HYPOTHESIS',    hint: 'An educated guess dressed in a lab coat pretending to be science.',     difficulty: 'impossible' },
  { word: 'ARCHIPELAGO',   hint: 'A chain of islands scattered across water. Looks stunning on a map.',   difficulty: 'impossible' },
  { word: 'JUXTAPOSE',     hint: 'Place two contrasting things side by side to highlight the difference.',difficulty: 'impossible' },
  { word: 'CRYPTOGRAM',    hint: 'A message hidden behind a code only the clever will ever crack.',       difficulty: 'impossible' },
  { word: 'PNEUMONIA',     hint: 'A serious lung infection that starts with a silent P to confuse you.',  difficulty: 'impossible' },
  { word: 'XENOPHOBIA',    hint: 'Fear and hatred of people simply because they come from somewhere else.',difficulty: 'impossible' },
  { word: 'MELANCHOLY',    hint: 'A deep, quiet sadness with no obvious source. Rain and old music.',     difficulty: 'impossible' },
  { word: 'CATACLYSM',     hint: 'A sudden violent event that changes everything permanently.',           difficulty: 'impossible' },
  { word: 'CAMOUFLAGE',    hint: 'The art of hiding by looking exactly like your surroundings.',          difficulty: 'impossible' },
  { word: 'RENAISSANCE',   hint: 'European rebirth of art and knowledge. Everyone started painting.',     difficulty: 'impossible' },
  { word: 'METAMORPHOSIS', hint: 'A complete transformation. Kafka wrote about it. Butterflies live it.', difficulty: 'impossible' },
  { word: 'CATASTROPHE',   hint: 'A disaster of the highest order. Not a minor inconvenience.',           difficulty: 'impossible' },
  { word: 'SERENDIPITY',   hint: 'Finding something wonderful when you were not even looking for it.',    difficulty: 'impossible' },
  { word: 'KALEIDOSCOPE',  hint: 'A tube full of mirrors and coloured glass that makes patterns forever.', difficulty: 'impossible' },
  { word: 'SUBTERRANEAN',  hint: 'Existing beneath the earth. Moles and tunnels live here.',             difficulty: 'impossible' },
  { word: 'PHOTOSYNTHESIS',hint: 'How plants turn sunlight into food. The original solar panel.',         difficulty: 'impossible' },
  { word: 'SYCOPHANT',     hint: 'Someone who flatters powerful people to gain favour. A professional fan.', difficulty: 'impossible' },
  { word: 'ONOMATOPOEIA',  hint: 'A word that sounds like what it describes. Buzz. Crash. Sizzle.',      difficulty: 'impossible' },
  { word: 'PERPENDICULAR', hint: 'Meeting at a perfect right angle. Very strict about it too.',           difficulty: 'impossible' },
  { word: 'HALLUCINATION', hint: 'Seeing or hearing something that is not there. The brain going rogue.', difficulty: 'impossible' },
  { word: 'EXTRATERRESTRIAL', hint: 'Originating beyond Earth. Everything you hope is out there.',       difficulty: 'impossible' },
  { word: 'INSUBORDINATE', hint: 'Refusing to follow orders. The most polite word for rebellious.',      difficulty: 'impossible' },
  { word: 'DISILLUSIONMENT', hint: 'When reality finally shatters a belief you held for too long.',      difficulty: 'impossible' },
  { word: 'COUNTERCLOCKWISE', hint: 'The direction that clocks do not go. Left and round.',              difficulty: 'impossible' },
  { word: 'TELECOMMUNICATION', hint: 'Sending information over a distance. Your phone call is this.',    difficulty: 'impossible' },
  { word: 'AUTOBIOGRAPHY',  hint: 'A book someone wrote about their own life. Very self-aware.',          difficulty: 'impossible' },
  { word: 'CARDIOVASCULAR', hint: 'Relating to your heart and blood vessels. They never take a break.',  difficulty: 'impossible' },
  { word: 'PHILOSOPHICAL',  hint: 'Concerned with the big questions. Why are we here? What is truth?',   difficulty: 'impossible' },
  { word: 'ARCHAEOLOGICAL',  hint: 'Related to digging up the past and brushing dirt off old things.',    difficulty: 'impossible' },
  { word: 'ELECTROMAGNETIC', hint: 'The force behind light, radio waves, and your microwave.',           difficulty: 'impossible' },
  { word: 'UNPRECEDENTED',  hint: 'Never happened before in recorded history. A first.',                  difficulty: 'impossible' },
]

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible'
const DIFF_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'impossible']

const DIFF_META: Record<Difficulty, { label: string; color: string; winsNeeded: number; xpPerWord: number }> = {
  easy:       { label: 'Easy',       color: '#3ecf8e', winsNeeded: 3, xpPerWord: 8  },
  medium:     { label: 'Medium',     color: '#4f8ef7', winsNeeded: 3, xpPerWord: 14 },
  hard:       { label: 'Hard',       color: '#9b6dff', winsNeeded: 3, xpPerWord: 22 },
  impossible: { label: 'Impossible', color: '#f5c542', winsNeeded: 3, xpPerWord: 36 },
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function pickWord(difficulty: Difficulty, sessionUsed: Set<string>): WordEntry {
  const seen    = getSeenWords()
  const pool    = WORDS.filter(w => w.difficulty === difficulty)
  // Prefer words not seen globally and not used this session
  let candidates = pool.filter(w => !seen.has(w.word) && !sessionUsed.has(w.word))
  // If exhausted globally for this tier, reset that tier's seen words and try again
  if (candidates.length === 0) {
    const tierWords = pool.map(w => w.word)
    const newSeen   = new Set([...seen].filter(w => !tierWords.includes(w)))
    saveSeenWords(newSeen)
    candidates = pool.filter(w => !sessionUsed.has(w.word))
  }
  // Final fallback: use any word in the pool
  if (candidates.length === 0) candidates = pool
  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  // Mark as seen globally
  seen.add(picked.word)
  saveSeenWords(seen)
  return picked
}

function HangmanFigure({ wrong, accent }: { wrong: number; accent: string }) {
  const s = { stroke: '#888899', strokeWidth: 2.5, strokeLinecap: 'round' as const, fill: 'none' }
  const a = { ...s, stroke: accent }
  return (
    <svg width={110} height={130} viewBox="0 0 110 130" style={{ display: 'block' }}>
      <line x1={10}  y1={125} x2={100} y2={125} {...s} />
      <line x1={30}  y1={125} x2={30}  y2={10}  {...s} />
      <line x1={30}  y1={10}  x2={65}  y2={10}  {...s} />
      <line x1={65}  y1={10}  x2={65}  y2={26}  {...s} />
      {wrong >= 1 && <circle cx={65} cy={34} r={8} {...a} />}
      {wrong >= 2 && <line x1={65} y1={42} x2={65} y2={80} {...a} />}
      {wrong >= 3 && <line x1={65} y1={52} x2={48} y2={66} {...a} />}
    </svg>
  )
}

function DiffProgressBar({ difficulty, winsInDiff, winsNeeded }: { difficulty: Difficulty; winsInDiff: number; winsNeeded: number }) {
  const meta = DIFF_META[difficulty]
  const pct  = Math.min(100, (winsInDiff / winsNeeded) * 100)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color }}>{meta.label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{winsInDiff}/{winsNeeded}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--surface3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: meta.color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

interface Props { rank: GameRank; onEnd: (payload: GameEndPayload) => void; onBack: () => void; sessionsLeft?: number; sessionCost?: number }

export default function Hangman({ rank: _rank, onEnd, onBack, sessionsLeft = 99, sessionCost = 1 }: Props) {
  useGamePresence('hangman')
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')

  const [difficulty,   setDifficulty]   = useState<Difficulty>('easy')
  const [winsPerDiff,  setWinsPerDiff]  = useState<Record<Difficulty, number>>({ easy: 0, medium: 0, hard: 0, impossible: 0 })
  const [totalWins,    setTotalWins]    = useState(0)
  const [totalLosses,  setTotalLosses]  = useState(0)
  const [totalXP,      setTotalXP]      = useState(0)
  const sessionUsed = useRef<Set<string>>(new Set())

  const [entry,       setEntry]       = useState<WordEntry | null>(null)
  const [guessed,     setGuessed]     = useState<Set<string>>(new Set())
  const [livesLeft,   setLivesLeft]   = useState(MAX_LIVES)
  const [hintsLeft,   setHintsLeft]   = useState(MAX_HINTS)
  const [wordResult,  setWordResult]  = useState<'win' | 'lose' | null>(null)

  const startRef = useRef(Date.now())
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const letters  = entry ? entry.word.split('') : []
  const wrong    = [...guessed].filter(l => !letters.includes(l)).length
  const revealed = letters.length > 0 && letters.every(l => guessed.has(l))

  useEffect(() => {
    if (phase !== 'play' || !entry || wordResult) return
    if (revealed)            setWordResult('win')
    else if (livesLeft <= 0) setWordResult('lose')
  }, [guessed, livesLeft])

  useEffect(() => {
    if (!wordResult) return
    const t = setTimeout(() => {
      wordResult === 'win' ? handleWordWin() : handleWordLose()
    }, 1800)
    return () => clearTimeout(t)
  }, [wordResult])

  function loadWord(diff: Difficulty) {
    const w = pickWord(diff, sessionUsed.current)
    sessionUsed.current.add(w.word)
    setEntry(w)
    setGuessed(new Set())
    setLivesLeft(MAX_LIVES)
    setWordResult(null)
  }

  function handleWordWin() {
    const xp           = DIFF_META[difficulty].xpPerWord
    const newTotalWins = totalWins + 1
    const newXP        = totalXP + xp
    setTotalXP(newXP)
    setTotalWins(newTotalWins)
    const newWins = { ...winsPerDiff, [difficulty]: winsPerDiff[difficulty] + 1 }
    setWinsPerDiff(newWins)
    const needed = DIFF_META[difficulty].winsNeeded
    if (newWins[difficulty] >= needed) {
      const idx  = DIFF_ORDER.indexOf(difficulty)
      const next = idx < DIFF_ORDER.length - 1 ? DIFF_ORDER[idx + 1] : 'impossible'
      setDifficulty(next)
      loadWord(next)
    } else {
      loadWord(difficulty)
    }
  }

  function handleWordLose() {
    setTotalLosses(l => l + 1)
    loadWord(difficulty)
  }

  function guess(letter: string) {
    if (guessed.has(letter) || wordResult) return
    const ng = new Set(guessed); ng.add(letter)
    setGuessed(ng)
    if (!letters.includes(letter)) setLivesLeft(l => l - 1)
  }

  function useHint() {
    if (hintsLeft <= 0 || !entry || wordResult) return
    const unrevealed = letters.filter(l => !guessed.has(l))
    if (!unrevealed.length) return
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)]
    setHintsLeft(h => h - 1)
    const ng = new Set(guessed); ng.add(pick)
    setGuessed(ng)
  }

  function endSession() {
    const dur         = Math.floor((Date.now() - startRef.current) / 1000)
    const totalPlayed = totalWins + totalLosses
    const xpEarned    = Math.max(0, totalXP)
    const payload: GameEndPayload = {
      gameId:      'hangman' as any,
      gameName:    'Hangman',
      rank:        _rank,
      score:       totalWins * 100,
      xpEarned,
      durationSec: dur,
      streak:      totalWins,
      correct:     totalWins,
      total:       totalPlayed,
      detail: {
        'Words Solved': totalWins,
        'Words Failed': totalLosses,
        'Accuracy':     totalPlayed > 0 ? `${Math.round((totalWins / totalPlayed) * 100)}%` : '0%',
      },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function start() {
    startRef.current = Date.now()
    setDifficulty('easy')
    setWinsPerDiff({ easy: 0, medium: 0, hard: 0, impossible: 0 })
    setTotalWins(0); setTotalLosses(0); setTotalXP(0)
    setHintsLeft(MAX_HINTS)
    sessionUsed.current.clear()
    setResult(null)
    loadWord('easy')
    setPhase('play')
  }

  const rankCfg  = getRankConfig(_rank)
  const diffMeta = DIFF_META[difficulty]

  const rules = [
    { icon: '🔤', text: 'Guess the hidden word letter by letter.' },
    { icon: '💡', text: 'Each word comes with a riddle-style hint — use it wisely.' },
    { icon: '❤️', text: `${MAX_LIVES} lives per word. Wrong letters cost a life.` },
    { icon: '🚫', text: 'No XP for failed words — only correct ones count.' },
    { icon: '📈', text: 'Win 3 words per tier: Easy → Medium → Hard → Impossible.' },
    { icon: '🔁', text: 'Words rotate — you will rarely see the same one twice.' },
    { icon: '⚡', text: 'Session costs 3 global plays.' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Hangman"
      tagline="Guess the word. One letter at a time."
      accent={ACCENT}
      icon={<Hash size={40} />}
      rules={rules}
      rankState={{ rank: _rank, currentStreak: 0, bestStreak: 0 }}
      streakRequired={rankCfg.streakRequired}
      onStart={start}
      onClose={onBack}
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} promoted={null} sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(90px)', opacity: 0.07, background: ACCENT, top: '10%', right: '-10%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Hangman"
        accent={ACCENT}
        icon={<Hash size={14} />}
        streak={totalWins}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Wins"  value={totalWins}  accent={ACCENT} />
            <StatChip label="Lives" value={'❤️'.repeat(livesLeft) || '💀'} />
          </div>
        }
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 90, flexShrink: 0, padding: '14px 10px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>Progress</div>
          {DIFF_ORDER.map(d => (
            <DiffProgressBar key={d} difficulty={d} winsInDiff={winsPerDiff[d]} winsNeeded={DIFF_META[d].winsNeeded} />
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>XP earned</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{totalXP}</div>
          </div>
        </div>

        {/* Game area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 12px 0', overflowY: 'auto' }}>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: diffMeta.color, background: `${diffMeta.color}18`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${diffMeta.color}33` }}>
              {diffMeta.label}
            </span>
          </div>

          <HangmanFigure wrong={wrong} accent={ACCENT} />

          {entry && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5, marginBottom: 10, fontStyle: 'italic', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
              💬 {entry.hint}
            </div>
          )}

          {/* Word display */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', margin: '6px 0' }}>
            {letters.map((l, i) => {
              const show = guessed.has(l) || wordResult === 'lose'
              return (
                <div key={i} style={{
                  width: 28, height: 36, borderRadius: 8,
                  background: show ? `${diffMeta.color}18` : 'var(--surface2)',
                  border: show ? `1px solid ${diffMeta.color}55` : '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: show ? diffMeta.color : 'transparent',
                  boxShadow: 'var(--elev-raise-sm)',
                  transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
                }}>
                  {show ? l : '_'}
                </div>
              )
            })}
          </div>

          {wordResult && (
            <div style={{ fontSize: 13, fontWeight: 800, margin: '8px 0', color: wordResult === 'win' ? '#3ecf8e' : '#ff6b6b', animation: 'wordFlash 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              {wordResult === 'win' ? `✅ Correct! +${DIFF_META[difficulty].xpPerWord} XP` : `❌ It was: ${entry?.word}`}
            </div>
          )}

          {/* Hint button */}
          <button
            type="button"
            onClick={(e) => { ripple(e); useHint() }}
            disabled={hintsLeft <= 0 || !!wordResult}
            className="ripple-wrap"
            style={{
              padding: '6px 16px', borderRadius: 12,
              cursor: hintsLeft <= 0 || wordResult ? 'not-allowed' : 'pointer',
              background: hintsLeft > 0 && !wordResult ? 'rgba(245,197,66,0.12)' : 'var(--surface2)',
              color: hintsLeft > 0 && !wordResult ? '#f5c542' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 700, marginBottom: 10,
              border: `1px solid ${hintsLeft > 0 && !wordResult ? 'rgba(245,197,66,0.3)' : 'rgba(255,255,255,0.06)'}`,
              opacity: hintsLeft <= 0 || wordResult ? 0.5 : 1,
              transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
            }}
          >
            💡 Reveal letter ({hintsLeft} left)
          </button>

          {/* Keyboard */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', paddingBottom: 16, maxWidth: 320 }}>
            {ALPHABET.map(l => {
              const isGuessed = guessed.has(l)
              const isCorrect = isGuessed && letters.includes(l)
              const isWrong   = isGuessed && !letters.includes(l)
              return (
                <button key={l} type="button" className="ripple-wrap"
                  onClick={(e) => { ripple(e); guess(l) }}
                  disabled={isGuessed || !!wordResult}
                  style={{
                    width: 32, height: 36, borderRadius: 9, fontSize: 13, fontWeight: 700,
                    border: isCorrect ? `1px solid ${diffMeta.color}55` : isWrong ? '1px solid rgba(255,107,107,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    background: isCorrect ? `${diffMeta.color}18` : isWrong ? 'rgba(255,107,107,0.1)' : 'var(--surface)',
                    color: isCorrect ? diffMeta.color : isWrong ? '#ff6b6b' : 'var(--text)',
                    cursor: isGuessed || wordResult ? 'default' : 'pointer',
                    boxShadow: isGuessed ? 'none' : '2px 2px 5px var(--neu-dark),-1px -1px 3px var(--neu-light)',
                    opacity: isWrong ? 0.45 : 1,
                    transition: 'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)',
                  }}>
                  {l}
                </button>
              )
            })}
          </div>

          <button type="button" onClick={(e) => { ripple(e); endSession() }} className="ripple-wrap"
            style={{ marginBottom: 20, padding: '8px 22px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            End Session
          </button>
        </div>
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
      <style>{`@keyframes wordFlash { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}
