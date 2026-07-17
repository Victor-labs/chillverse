// src/features/exploration/story/content/map1.ts
//
// Greenfields narrative content. Recurring NPC is Mira Ashgrove, an
// unsanctioned prior explorer whose journal is found in fragments across
// chambers 1-4 and who is found alive at the chamber 5 climax.
//
// Mechanical notes:
// - Only the claim checkpoints of chambers 2, 4, and 5 (the artifact
//   chambers) carry `artifact_odds_delta` / `grant_artifact` effects.
//   Everything else is `xp_bonus` + `set_flag` — lore/flavor only, so no
//   choice is ever a "wrong" one.
// - `grant_artifact` targets two new story_exclusive rows that need to
//   exist in the `artifacts` table before this ships: "Mira's Key" and
//   "Mira's Second Key" (see the migration).

import type { ChamberStory } from '../types'

const MOSSY_GATE: ChamberStory = {
  start: {
    intro: [
      "The guild's letter said little: a gate, half-swallowed by forest, marking the edge of a region no cartographer had properly walked in a generation. Find what's inside. Catalogue it. Bring back anything that survived.",
      "You expected rust. Instead you find moss — thick, unbroken sheets of it, climbing the old stone in patterns too deliberate to be growth. Spirals. Long unbroken lines that bend at exact angles, like something traced them with a steady hand before letting the plants fill in the ink.",
      "The forest beyond is quiet in the wrong way. Not empty — you can hear birds, water somewhere close, the give of soil underfoot — but muted, as though the sound is being absorbed rather than carried. Your own footsteps land without echo.",
      "Wedged into a crack at the base of the gate, protected from weather by an overhang of root, is a page. Leather-backed, water-stained at the edges, the handwriting cramped and hurried:",
      '"—the moss grows toward something, not from something. I\'ve stopped calling it strange. Strange implies it\'s wrong. It isn\'t wrong. It\'s just older than the word for right." — no signature, only initials: M.A.',
    ],
    options: [
      {
        id: 'trace_moss',
        label: 'Trace the moss patterns with your hand',
        reveal: [
          'You follow one spiral with two fingers, expecting slime and cold. Instead the moss is dry, warm from within rather than from the sun. Under your palm, for exactly the space of one held breath, you feel it move — not wind, not your own pulse. A slow contraction, like something breathing at a depth you can\'t reach.',
          'You pull your hand back. The moss settles. You decide not to write "alive" in your notes yet, though the word sits close.',
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_1' },
          { type: 'xp_bonus', amount: 5 },
        ],
      },
      {
        id: 'read_journal',
        label: 'Read the rest of the journal page',
        reveal: [
          'The ink continues, smaller, as if the writer was running low on room: "Told them at the guild hall it was a survey. It stopped being a survey around the second chamber. If someone finds this before I do — the gate isn\'t guarding what\'s inside. It\'s guarding what\'s outside from what\'s inside."',
          "You fold the page into your satchel. Whoever M.A. was, they didn't sound like someone prone to fright.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_1' },
          { type: 'xp_bonus', amount: 5 },
        ],
      },
      {
        id: 'check_ground',
        label: 'Check the ground for signs of the last visitor',
        reveal: [
          "The soil holds a single boot print, half-dissolved by seasons of rain, pointing toward the gate rather than away from it. No return prints beside it, no drag marks.",
          "Whoever left it walked in and, as far as the ground remembers, simply didn't walk back out this way. You choose, for now, to believe the kindest explanation.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_1' },
          { type: 'xp_bonus', amount: 5 },
        ],
      },
    ],
    transition: [
      "The gate opens easily under your hand — too easily, like it's been waiting. Beyond it, the path narrows, and the quiet gets a little quieter.",
    ],
  },

  mid: {
    intro: [
      "An hour in, and the path behind you has already closed up — not literally, you're fairly sure, but you couldn't describe the way back if asked. The trees here don't repeat themselves the way forest trees should.",
      "You stop to rest against the gate's inner face, the side that never sees sun. It should be the cold side. It isn't. Faint warmth radiates through the stone at shoulder height — the kind a wall holds after a fire's been out for hours, except no fire has ever been lit here that you can find evidence of.",
      "Carved into that warm patch, worn nearly smooth: three concentric rings with a single line breaking outward from the center, like a seed splitting open. Nothing in the guild's reference texts matches it.",
      "Something small moves at the edge of your vision — not an animal, more a shift in light, gone before you turn your head fully. You've stopped assuming these things are nothing.",
    ],
    options: [
      {
        id: 'press_carving',
        label: 'Press your palm flat against the warm carving',
        reveal: [
          "The warmth spreads up through your fingers, into your wrist, and for one disorienting second you're not looking at the gate at all — you're looking through it, at this same clearing without any stone gate standing in it, only open field under a sky the wrong color of green-gold.",
          'The vision snaps shut like a door. Your hand is trembling. You write "field, no gate, sky wrong" and underline it twice.',
        ],
        effects: [{ type: 'xp_bonus', amount: 5 }],
      },
      {
        id: 'sketch_carving',
        label: 'Sketch the carving exactly as it appears',
        reveal: [
          "Your pencil catches what your eye skipped: the seed symbol isn't alone. Fainter lines radiate from it across the stone, so worn they're nearly invisible except in low light — dozens of smaller versions of the same shape, scattered like the carving was trying to multiply itself before whoever carved it stopped, or was stopped.",
        ],
        effects: [{ type: 'xp_bonus', amount: 5 }],
      },
      {
        id: 'search_lightshift',
        label: 'Search where the light-shift went',
        reveal: [
          "No tracks, no disturbed leaves — but three feet further on, half-buried in loam, your boot catches on something hard. A second journal page, badly water-damaged, only a fragment legible:",
          '"...doesn\'t chase. Doesn\'t need to. Everywhere I go is already inside it." The rest has bled into illegible smears of ink and rain.',
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_2' },
          { type: 'xp_bonus', amount: 5 },
        ],
      },
    ],
    transition: [
      "You don't have an explanation yet, and you're starting to suspect the guild's reference texts never will. What you have is a direction — deeper — and the prickling certainty that the last hour has been quieter than the one before it.",
    ],
  },

  claim: {
    intro: [
      "By the time the light starts going amber through the canopy, you've worked out enough to close your notebook on this chamber. The gate was never a boundary meant to keep something out, or even in. It's closer to a threshold you cross when you stop assuming the forest is empty of intention.",
      'Near the inner arch, where the moss thins into bare stone, you find the clearest carving yet: the same three-ring seed shape, complete this time, undamaged, with words beneath it in a script close enough to the common tongue to half-translate. You make out fragments — "sleeping," "not empty," something that might be "listens" or might be "learns."',
      "Your instruments, unhelpfully, record nothing unusual. Whatever this place is doing, it isn't doing it in any register your guild-issued tools were built to measure. That should be reassuring. It isn't.",
      "You have one chamber's worth of findings to decide how to log.",
    ],
    options: [
      {
        id: 'log_moss',
        label: "Log the moss behavior as the chamber's primary finding",
        reveal: [
          "You write three careful pages on directional growth patterns, deliberately underselling the warmth, the vision, the missing footsteps. It's the safest report. It's also, you know as you seal it, the least true one.",
        ],
        effects: [{ type: 'xp_bonus', amount: 10 }],
      },
      {
        id: 'log_journal',
        label: 'Log the journal fragments and flag M.A. as a prior expedition',
        reveal: [
          "You cross-reference the initials against the guild's expedition ledger from memory and find nothing — no M.A. authorized for this region, ever. Someone came here without sanction, went deep enough to leave two notes, and the guild has no record they existed.",
        ],
        effects: [
          { type: 'set_flag', key: 'mira_registered' },
          { type: 'xp_bonus', amount: 15 },
        ],
      },
      {
        id: 'log_carving',
        label: 'Log the carving and its half-translated inscription',
        reveal: [
          "You spend the last of the light copying the script exactly, symbol for symbol, rather than guessing at translation. Tedious work — but it means you'll carry an accurate record instead of a convenient guess.",
        ],
        effects: [{ type: 'xp_bonus', amount: 10 }],
      },
    ],
    transition: [
      "A gate that was warm on the wrong side, a woman who came here and wasn't in any ledger, and a forest that goes quieter the deeper you walk. Thornwood waits past the tree line, and even from here, you can hear that it doesn't sound like any wood you've walked before.",
    ],
  },
}

const THORNWOOD_PASS: ChamberStory = {
  start: {
    intro: [
      "The thorns here don't grow the way thorns should — outward, defensive, indifferent to what they're defending against. These curve inward, toward a footpath about a body's width across, like a hedge trained rather than grown.",
      "The hum starts about fifty paces in — not a sound exactly, more a pressure behind the sternum, slow and regular, one beat every four or five seconds. You check your own pulse against it out of habit. They don't match.",
      "Scored into a trunk at eye height: five parallel lines, evenly spaced, deep enough to have taken real effort or real time. Not claw marks — too straight, too intentional.",
      'Half-buried under that same tree\'s roots, a third page, cleaner than the others: "Thornwood doesn\'t threaten. It escorts. I keep waiting for the moment it turns hostile and it never comes — which frightens me more than hostility would." Below it, a smaller hand: "Five lines. Five chambers. I think I finally understand what I\'m counting."',
    ],
    options: [
      {
        id: 'follow_thorns',
        label: 'Follow the inward-curving thorns exactly where they lead',
        reveal: [
          "You let the hedge choose the route instead of your instincts. It leads you thirty paces off your natural path, straight to a hollow where the ground dips and cools — and where, half-sunk in leaf litter, something catches the light.",
          "Not close enough to identify yet. But it's the first thing all day that looks made rather than grown.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_3' },
          { type: 'xp_bonus', amount: 5 },
        ],
      },
      {
        id: 'listen_hum',
        label: 'Press your ear to the trunk to listen to the hum',
        reveal: [
          "The pressure-hum resolves into something closer to sound: not a heartbeat after all, but overlapping tones, dozens of them, faint and layered, like a held chord played by an orchestra a great distance away.",
          "It fades the moment you pull back, and you're left unsure whether you heard it or only convinced yourself you did.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_3' },
          { type: 'xp_bonus', amount: 5 },
        ],
      },
      {
        id: 'count_lines',
        label: 'Count the scored lines and search nearby trees for more',
        reveal: [
          "Twenty paces on, a second tree bears the same five lines. Then a third, thirty paces past that. Each set identical, each tree otherwise unmarked.",
          "Whoever cut these wasn't leaving a trail to follow — they were marking a count they didn't want to lose track of, the way a prisoner marks days. Five chambers. Someone else already knew.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_3' },
          { type: 'xp_bonus', amount: 5 },
        ],
      },
    ],
    transition: [
      "The hollow, the chord-hum, the counted trees — three threads, and you're not sure yet which is worth pulling first. The path narrows further, and the pressure behind your sternum keeps its slow, patient beat.",
    ],
  },

  mid: {
    intro: [
      "The hollow smells wrong before you reach it — not decay, but something sweeter underneath, like sap left too long in the sun. The light here bends strangely too, pooling in the low ground instead of falling straight.",
      "Half-sunk in the leaf litter is the object you glimpsed from the ridge: smooth, dark, faintly reflective in a way nothing organic should be. It hums — barely, at the very edge of feeling — in time with the same slow four-second pulse you've carried since you entered the pass.",
      "You crouch beside it without touching it yet. Up close, the surface is covered in the same three-ring seed carving from the gate, except here the rings are deeper, more deliberate — like a signature rather than decoration.",
      'Your fingers hover an inch above it. The humming, you\'re almost certain, gets very slightly louder.',
    ],
    options: [
      {
        id: 'lift_object',
        label: 'Lift it carefully with both hands, slow and deliberate',
        reveal: [
          "The moment your skin makes full contact, the hum becomes a sound with shape, and for half a heartbeat you're somewhere else: this same hollow, except the trees are saplings and the light is ordinary, and someone is laughing nearby, close enough that you could turn and see who — except the vision ends before you do.",
          "You're on your knees in the present again, the object warm and quiet in your palm.",
        ],
        effects: [{ type: 'xp_bonus', amount: 10 }],
      },
      {
        id: 'clear_litter',
        label: 'Brush away the surrounding leaf litter first',
        reveal: [
          "Clearing the debris reveals the object was never buried by accident — it rests in a shallow carved depression, a nest made specifically for it, matched exactly to its shape.",
          "Something placed this here on purpose, with care, the way you'd set something down gently rather than drop it and walk away.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_hollow_seen' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'study_carving',
        label: 'Study the carving pattern before touching it',
        reveal: [
          "Tracing the rings with one fingertip, you notice the outermost ring isn't a ring at all up close — it's dozens of tiny interlocking marks, almost like handwriting compressed into a border.",
          "Too small and worn to read here, but you sketch a section faithfully, certain it matters before you know why.",
        ],
        effects: [{ type: 'xp_bonus', amount: 10 }],
      },
    ],
    transition: [
      "Whatever this thing is, it isn't inert, and it isn't finished with you yet. Ahead, the pass opens into daylight again, and you carry the object the rest of the way without managing to explain why it feels less like finding something and more like being trusted with it.",
    ],
  },

  claim: {
    intro: [
      "Past the tree line, the pass opens into a clearing hazed gold with late light, and the pulse in your chest reaches something like a crescendo — not louder exactly, but complete, like a held breath finally let go.",
      "You understand, with sudden and total certainty, that the object in your hands isn't a relic. It's a memory that never finished happening, and it's been waiting in that hollow for someone patient enough to let it finish.",
      "The three-ring carving under your thumb is warm as skin now, and the humming has resolved, finally, into something almost like a voice, if a voice could be made of wind moving through young trees instead of words.",
    ],
    options: [
      {
        id: 'let_vision_take',
        label: 'Let the vision take you completely, without resisting it',
        reveal: [
          'You see it whole: a hillside exactly like this one, but younger, saplings instead of century oaks, and a figure moving through them, planting something — seeds, or roots, or intentions, it\'s hard to tell which. The figure isn\'t human, not quite, and isn\'t a tree either.',
          "The vision holds you gently and sets you down when it's finished, like it was being careful with something breakable. You surface in the clearing with tears on your face you don't remember starting.",
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_lore_vision_full' },
          { type: 'xp_bonus', amount: 20 },
          { type: 'artifact_odds_delta', value: 0.15 },
        ],
      },
      {
        id: 'observe_carefully',
        label: 'Hold part of yourself back and observe carefully instead',
        reveal: [
          "You watch the same hillside, the same figure, but from a careful distance, cataloguing rather than feeling. It's less overwhelming this way, and your notes stay intact.",
          'But something in the vision seems to notice your distance, and the warmth under your thumb cools by one degree, subtly, like disappointment.',
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_lore_vision_observed' },
          { type: 'xp_bonus', amount: 15 },
          { type: 'artifact_odds_delta', value: 0.05 },
        ],
      },
      {
        id: 'step_back',
        label: 'Set the object down and step back before the vision fully forms',
        reveal: [
          "You choose caution. The hum drops away mid-swell, unfinished, and you're left in the ordinary clearing with an ordinary ache behind your ribs, like waking from a dream at the best part.",
          "You'll never know how that hillside memory ends from this object. But you also know it isn't gone — only paused, waiting for someone braver, or more foolish, to try again.",
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_lore_vision_declined' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
    ],
    transition: [
      "Whichever way you chose to meet it, the memory — or its refusal — settles into you like grit under a fingernail. Past the clearing, the ground begins to slope downward, and the guild's outdated map marks the next feature only as \"ruin, unconfirmed.\"",
    ],
  },
}

const SUNKEN_ALTAR: ChamberStory = {
  start: {
    intro: [
      "The ground drops away gradually at first, then all at once — a basin sunk below the surrounding treeline, filled ankle-deep with water so still it holds the sky like glass. At its center, a stone altar rises just above the waterline.",
      "You'd expected an altar to face something — an idol, a horizon, a door. This one faces nothing. It's shaped instead like a shallow bowl, angled slightly downward: not built to receive offerings, but to receive sound.",
      "The water smells of wet stone and something faintly mineral, almost sweet, and every few seconds a single drop falls from the canopy and lands in the bowl with a note too clean and resonant for ordinary water on ordinary stone.",
      'Around the bowl\'s rim, carved so shallow you have to catch the light exactly right to see them: words in that half-familiar script from the gate. Wedged between two mossy stones nearby, the fourth journal page, nearly dry, protected in oilcloth: "They called it the Verdant Hush, once. Not a name for a place. A name for a listening."',
    ],
    options: [
      {
        id: 'read_aloud',
        label: 'Read the carved characters aloud, as best you can pronounce them',
        reveal: [
          "The syllables feel strange in your mouth, foreign in a way that has nothing to do with accent — like the shapes weren't designed for a human throat at all.",
          "The moment you finish, the drip from the canopy pauses. Not stops — pauses, the way a listener pauses when someone finally says something worth hearing. Then it resumes, and you can't shake the feeling you were just, briefly, heard back.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_4' },
          { type: 'set_flag', key: 'verdant_hush_name_known' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'study_bowl',
        label: "Study the bowl's construction",
        reveal: [
          "Running your hands along the underside, you find the bowl isn't carved from the surrounding bedrock at all — it's a separate stone, fitted with a precision that shouldn't have been possible with whatever tools this culture had access to.",
          "Someone brought this piece from somewhere else, specifically, deliberately, and set it here like a key set into a lock built to fit it.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_4' },
          { type: 'set_flag', key: 'verdant_hush_name_known' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'listen_silent',
        label: 'Stay silent and simply listen for several minutes',
        reveal: [
          "You lower yourself onto a dry stone and do nothing else. The basin's quiet turns out to have layers, once you stop filling it with your own noise.",
          "Underneath it all, so faint you might be imagining it, that same four-second pulse from Thornwood, present here too, patient as ever.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_journal_4' },
          { type: 'set_flag', key: 'verdant_hush_name_known' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
    ],
    transition: [
      "Whatever the Verdant Hush is, you're fairly sure it isn't hostile, isn't hunting, and isn't remotely finished being what it is. The basin's far edge slopes back upward into root and shadow.",
    ],
  },

  mid: {
    intro: [
      "Past the altar, the basin narrows into a channel where the water runs ankle-deep and startlingly clear, threading between root systems thick enough to have been growing since long before any guild existed.",
      "You find a second altar-stone half-submerged in the channel, smaller than the first, cracked clean through the middle. Whatever broke it did so with force, not time.",
      "For the first time all day, you feel watched in a way that isn't ambient or diffuse — specific, directional, coming from somewhere behind your left shoulder. You turn. Nothing. But the feeling settles into a kind of company.",
      "The channel walls are scored with the same five-line counting marks from Thornwood — except here, only three lines are complete. The other two are unfinished, the stone beneath them smooth and untouched.",
    ],
    options: [
      {
        id: 'examine_fracture',
        label: 'Examine the fracture in the broken altar-stone closely',
        reveal: [
          "The break isn't random. Up close, it follows the same three-ring pattern as the carving — someone, or something, struck it precisely at the pattern's center, hard enough to shatter stone in a single blow.",
          "This wasn't erosion. Someone destroyed this deliberately, and whoever did knew exactly where to hit it to make sure it couldn't listen anymore.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_altar_broken_understood' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'address_presence',
        label: 'Turn and address whatever is watching from behind you',
        reveal: [
          "You say something — you're not entirely sure what, something instinctive and half-formed — and the watched feeling doesn't vanish so much as change texture, softening from alertness into something closer to recognition.",
          'No voice answers. But the four-second pulse in your chest skips, just once, like something on the other end forgot itself for a beat before remembering to be patient again.',
        ],
        effects: [
          { type: 'set_flag', key: 'gf_felt_presence' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'complete_count',
        label: 'Trace the unfinished counting marks and try to complete the pattern',
        reveal: [
          "You press your fingers to the smooth, uncarved stone where the fourth and fifth lines should be, and for reasons you can't defend to yourself later, you carve them yourself with the edge of your surveying knife.",
          "Rough, shallow, nothing like the precision of the originals. It feels less like vandalism and more like finishing a sentence someone else left hanging mid-word for far too long.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_counting_completed' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
    ],
    transition: [
      "The sense of company fades gradually rather than vanishing outright. Ahead, the channel widens toward drier ground, and the light through the canopy takes on the particular slant that means the day is running out faster than your survey is.",
    ],
  },

  claim: {
    intro: [
      "By the time you climb out of the basin onto dry ground, you've stopped writing \"unusual\" in your notes and started writing \"consistent\" instead — chamber after chamber, one coherent thing, remembering in ways nothing this old should still be capable of.",
      "At the basin's lip, half-hidden under a fall of exposed root, you find a second boot print, fresher than the one at the gate, half-dissolved but still recognizably matched to the same tread.",
      "Somewhere between the gate and here, whoever left these prints stopped being a cautionary footnote in your survey and started being someone you're actively, specifically hoping to find alive.",
      "Ahead, the ground rises into a tangle of exposed roots thick as archways, and even from this distance, you can tell the next chamber isn't going to be subtle about what it is.",
    ],
    options: [
      {
        id: 'follow_print',
        label: "Follow the fresh print's direction as your priority",
        reveal: [
          "You take a bearing off the print's angle before it can weather further, and it points, unambiguously, straight toward the root tangle ahead rather than around it.",
          "Whatever M.A. was doing here, she wasn't wandering. She was heading somewhere on purpose.",
        ],
        effects: [{ type: 'xp_bonus', amount: 10 }],
      },
      {
        id: 'record_disturbance',
        label: 'Record the broken altar as evidence of an earlier disturbance',
        reveal: [
          "You write the fracture up carefully, cross-referencing it against the counting marks and the unfinished lines, and for the first time your report reads less like a survey and more like an investigation.",
          "Something happened here before M.A., possibly long before. She wasn't the first to disturb this place.",
        ],
        effects: [{ type: 'xp_bonus', amount: 15 }],
      },
      {
        id: 'sit_with_it',
        label: "Take a moment to sit with what you've learned before moving on",
        reveal: [
          "You allow yourself five minutes you can't really spare, doing nothing but letting the day's discoveries settle instead of immediately cataloguing them. It's not efficient. It's not what the guild pays for.",
          'But something in the quiet afterward feels earned rather than wasted, and you walk on lighter for it.',
        ],
        effects: [{ type: 'xp_bonus', amount: 10 }],
      },
    ],
    transition: [
      "The root tangle ahead doesn't look like a path so much as a decision the forest made without consulting anyone. You check your dwindling daylight, square your shoulders, and start counting turns before you've even taken the first one.",
    ],
  },
}

const ROOT_LABYRINTH: ChamberStory = {
  start: {
    intro: [
      "The root archways close overhead almost immediately, weaving into a canopy so dense the last daylight comes through in coin-sized fragments. You strike your lamp and immediately regret how loud the flint sounds in a place this quiet.",
      "The labyrinth doesn't announce itself as a labyrinth so much as reveal it gradually — the paths here don't hold still the way paths are supposed to. There's a rhythm to the shifting, though: the walls seem to rearrange only when you're not looking directly at them.",
      "Underfoot, the ground smells of turned earth, and every so often the whole structure gives a long, low creak, wood settling under weight that isn't yours. You've started thinking of it as breathing.",
      'At a junction where five paths diverge, you find a fifth journal page, tucked with obvious care into a hollow at eye height. The handwriting here is steady, calm: "I\'m not lost. I want to be very clear about that. I chose every turn. I think the labyrinth isn\'t the test. Choosing to stop being afraid of it is."',
    ],
    options: [
      {
        id: 'study_junction',
        label: 'Study the junction carefully before choosing a path',
        reveal: [
          "You take your time, sketching the five-path junction exactly as it stands — and catch, just barely, the moment one of the unchosen paths shifts a few degrees while you're focused on your notebook.",
          "You didn't imagine that. You have proof now, sketched in your own hand, and somehow the proof is less comforting than the uncertainty was.",
        ],
        effects: [
          { type: 'set_flag', key: 'mira_journal_5' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'trust_instinct',
        label: 'Trust your instinct and pick a direction immediately',
        reveal: [
          "You choose without deliberating — and the path you take feels, almost immediately, easier than it has any right to be, the roots underfoot smoother, the archway ahead noticeably clearer.",
          "Whether that's coincidence or reward, you decide not to examine too closely.",
        ],
        effects: [
          { type: 'set_flag', key: 'mira_journal_5' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'reread_page',
        label: 'Reread the fifth page slowly before moving on',
        reveal: [
          'You read it twice more, turning the phrase "choosing to stop being afraid" over until it stops sounding like bravado and starts sounding like instruction.',
          "Whatever this place has been asking of everyone who enters, you suspect it's been asking the same question of you since the gate.",
        ],
        effects: [
          { type: 'set_flag', key: 'mira_journal_5' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
    ],
    transition: [
      "However you choose to move, the labyrinth seems, for the moment, satisfied enough to let you through. The creaking settles into something almost rhythmic behind you, and ahead the archways begin, very gradually, to widen.",
    ],
  },

  mid: {
    intro: [
      "The labyrinth opens, without warning, into a small round clearing at its center — too perfectly circular to be natural, roots curving inward like ribs around a hollow chest. This space wasn't built for passing through. It was built for stopping.",
      "At the center, arranged with a care that stops your breath: a satchel, guild-issue, the leather gone soft and pale with age but still recognizably intact. Beside it, folded rather than dropped, a traveling cloak. No remains. No struggle.",
      "Half-buried beneath the folded cloak, the object you were already braced to find: dark, smooth, warm, humming with that same four-second pulse, its three-ring carving deeper and more worn than the one from Thornwood.",
      "The smell here is different — not turned earth, but something closer to woodsmoke and rain, the smell of a fire recently and deliberately let go out.",
    ],
    options: [
      {
        id: 'open_satchel',
        label: 'Open the satchel and go through its contents first',
        reveal: [
          "Inside, meticulously organized despite everything: spare notebooks, a broken compass, a small collection of pressed leaves labeled by date and location, and — tucked in an inner pocket — a final, unfinished letter, three sentences long, the last one trailing off mid-word.",
          "Whatever made her stop writing, it wasn't panic. The handwriting doesn't shake.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_fate_known' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'examine_cloak',
        label: 'Examine the folded cloak for signs of what happened',
        reveal: [
          "The cloak is folded with unusual precision, corners matched, the way you fold something you intend to leave behind on purpose rather than something torn from you in a struggle.",
          "There's no blood, no tearing, no evidence of violence anywhere on the fabric — only the ordinary wear of a garment that traveled a long way before its owner decided she didn't need it where she was going.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_fate_known' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'pick_object_first',
        label: 'Pick up the warm object immediately, setting the belongings aside',
        reveal: [
          "The vision arrives faster and clearer than either of the previous ones — you see the round clearing exactly as it is now, except occupied: a woman kneeling exactly where the satchel now sits, unhurried, reaching not toward you but toward the ground itself, palm flat against the roots.",
          "The vision doesn't show you what happens next. It simply ends, gently, like a held note finally allowed to fade.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_fate_known' },
          { type: 'set_flag', key: 'mira_vision_seen' },
          { type: 'xp_bonus', amount: 15 },
        ],
      },
    ],
    transition: [
      "Whatever you learned first, the shape of it is the same: she wasn't taken. She wasn't lost. Somewhere in this round, rib-curved hollow, Mira Ashgrove made a choice, and left everything that couldn't come with her folded neatly behind.",
    ],
  },

  claim: {
    intro: [
      "You can't stay in the round clearing indefinitely, however much some new and stubborn part of you wants to. Light is a finite resource today.",
      "The warm object sits heavier in your palm than its size should allow, and beside it Mira's folded belongings wait for a decision you didn't expect to be making today: what to carry forward, and what to leave exactly as she left it.",
      "You find, tucked into the satchel's outer pocket, one more thing you missed the first pass through — a small brass key, tarnished green, clearly not meant for any door you've encountered in this survey.",
    ],
    options: [
      {
        id: 'take_object_and_key',
        label: 'Take the object and the key, leave the rest exactly as it was',
        reveal: [
          "You carry forward only what seems to want carrying, and leave the satchel, cloak, and letter arranged precisely as you found them — a small act of respect toward whatever this place is.",
          "The vision that follows, once you're clear of the clearing, is the fullest yet: the same kneeling woman, and this time you feel, distinctly, something that might be gratitude directed at you specifically.",
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_respect_path' },
          { type: 'xp_bonus', amount: 20 },
          { type: 'artifact_odds_delta', value: 0.15 },
          { type: 'grant_artifact', artifactName: "Mira's Key" },
        ],
      },
      {
        id: 'take_everything',
        label: 'Take everything — object, key, satchel, and all — as evidence',
        reveal: [
          "You gather it all, methodical and thorough, the way the guild trained you to. It's the responsible choice, the defensible one when you're asked to account for every hour of this survey.",
          "The object hums quieter in your pack than it did in your palm, and you try not to read too much meaning into that.",
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_evidence_path' },
          { type: 'xp_bonus', amount: 15 },
          { type: 'artifact_odds_delta', value: 0.08 },
          { type: 'grant_artifact', artifactName: "Mira's Key" },
        ],
      },
      {
        id: 'take_letter_only',
        label: 'Take only the unfinished letter, leaving everything else including the object',
        reveal: [
          "You take the letter and nothing more, unable to shake the sense that the object and the key belong to a decision that isn't yours to make on someone else's behalf.",
          "It's the hardest choice of the three, and the least practical. Somehow, walking away from the clearing, it's also the choice that sits easiest in your chest.",
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_letter_only' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
    ],
    transition: [
      "However light or heavy your pack, you leave the round clearing changed by it regardless. The air changes first — cooler, mineral, faintly metallic — and somewhere below, further than any lamp could hope to reach, something vast and patient is very obviously still awake.",
    ],
  },
}

const DEEP_HOLLOW: ChamberStory = {
  start: {
    intro: [
      "The descent into the Deep Hollow isn't steep so much as inevitable — the ground simply stops pretending to be level, and root-ribbed tunnels swallow what's left of the daylight within a dozen steps.",
      "The temperature drops, then rises again, unevenly, like walking through a body with its own uneven pulse. Somewhere far below, faint enough to be a memory of sound rather than sound itself, something resonates through the stone at exactly four seconds a beat.",
      "Then the light changes. Not your lamp — something ahead, low and green-gold, pulsing gently along seams in the rock where thin veins of something luminous thread through like exposed nerve. This brightens and dims in time with the pulse, unmistakably, undeniably alive.",
      "You stand at the edge of it a long moment, Mira's key warm against your palm even through your glove, and understand that you've reached the center of whatever you've been walking through all day.",
    ],
    options: [
      {
        id: 'follow_veins',
        label: 'Follow the luminous veins deeper toward their source',
        reveal: [
          "The veins converge, the deeper you go, into a single thick channel running along the tunnel's ceiling like a spine, brightening steadily as you follow it.",
          "It doesn't lead you the fastest way down. It leads you the way it wants you to see it, past chambers of root-work so intricate they could be architecture or could simply be growth that forgot to stop being beautiful.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_deep_hollow_entered' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'test_temperature',
        label: 'Test the temperature shifts to understand the pattern',
        reveal: [
          "You map three warm pockets and two cold ones over the next twenty paces, and the pattern that emerges isn't random after all — it correlates, unmistakably, with the resonant pulse, warm exactly where the beat lands hardest.",
          "You're not walking through a tunnel. You're walking along something's arteries, and it's very much still circulating.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_deep_hollow_entered' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
      {
        id: 'try_key',
        label: 'Try the brass key against the nearest root-seam, just to see',
        reveal: [
          "It doesn't fit anything, not literally — there's no lock here, no mechanism. But holding it near the luminous vein, the light there brightens noticeably, responding the way a plant leans toward sun.",
          "For a moment you'd swear the four-second pulse skips, quickens, recognizes something about the key that has nothing to do with metal or teeth.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_deep_hollow_entered' },
          { type: 'xp_bonus', amount: 10 },
        ],
      },
    ],
    transition: [
      "Whichever thread you followed, the Hollow keeps opening ahead of you, wider and stranger with every turn, until the tunnel gives way at last to something too large for your lamp to fully illuminate — a cavern, and at its heart, unmistakably, a heart.",
    ],
  },

  mid: {
    intro: [
      "The cavern is larger than any single lamp should be able to prove, but the luminous veins do the proving for you: a chamber easily the size of the guild hall back home, its floor a single unbroken mass of root grown so densely it's stopped resembling roots and started resembling muscle.",
      "At the center, where all the veins converge, the root-mass rises into something you can only call a shape — not a statue, not a creature, but a suggestion of both, formed from centuries of growth that seems to have been growing toward this specific configuration on purpose.",
      "The pulse here isn't felt anymore. It's heard — a slow, resonant sound like a bell struck once and left to ring for longer than bells are supposed to ring. Standing this close to the source, you finally understand what every anomaly all day was a fragment of: not separate anomalies. One creature.",
      "Near the base of the shape, unmistakable even in this light, a figure sits with her back against the root-mass, hands folded, entirely still — and entirely, peacefully, alive.",
    ],
    options: [
      {
        id: 'say_her_name',
        label: 'Approach slowly and speak her name',
        reveal: [
          '"Mira?" The name comes out smaller than you intended. She opens her eyes — unhurried, the way someone wakes from a nap rather than a nightmare — and looks at you with an expression that isn\'t fear or relief but something closer to recognition.',
          '"You brought the key," she says. Not a question. She already knew.',
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_found_alive' },
          { type: 'xp_bonus', amount: 15 },
        ],
      },
      {
        id: 'observe_connection',
        label: "Stay back and observe how she's connected to the root-mass",
        reveal: [
          "You keep your distance and look carefully instead, and now that you're close enough to really see it, the roots don't restrain her — they support her, cradle her, the way a hand cradles something it's decided is worth protecting.",
          "Fine tendrils rest against her wrists, her temples, not invasive, more like a listener's hand resting on a shoulder. She doesn't look trapped. She looks tended.",
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_found_alive' },
          { type: 'xp_bonus', amount: 15 },
        ],
      },
      {
        id: 'examine_root_shape',
        label: 'Examine the root-shape itself before approaching Mira',
        reveal: [
          "Up close, the massive shape resolves into something almost architectural — not random growth but deliberate structure, ribs and chambers within chambers, and etched at its base, larger and clearer than anywhere else in the region, the full inscription:",
          '"the Verdant Hush wakes for no one, and forgets nothing, and asks only to be listened to in turn." You\'ve been reading fragments of this sentence since the gate. Here, finally, is the whole of it.',
        ],
        effects: [
          { type: 'set_flag', key: 'gf_mira_found_alive' },
          { type: 'xp_bonus', amount: 15 },
        ],
      },
    ],
    transition: [
      "Whatever brought you to this moment, the cavern holds its breath around all three of you, the pulse slowing further, as if the Hush itself is waiting to see what you do next.",
    ],
  },

  claim: {
    intro: [
      'Mira doesn\'t rise, and doesn\'t ask you to stay. "I came here looking for artifacts," she says, echoing the exact line from the guild\'s original brief. "I found out they were never artifacts. They\'re memories the Hush couldn\'t hold onto anymore on its own, so it started giving pieces away instead of losing them completely."',
      '"It\'s tired," she says simply. "Not dying. Just tired, the way anything is tired after remembering everything it\'s ever seen for longer than there\'s been a word for \'long.\' I chose to stay and help it rest easier. That doesn\'t mean you have to choose anything at all."',
      '"But you should know there\'s more of it than Greenfields — the old carvings call the next stretch something that translates roughly to \'the place that dreams in fire instead of green.\' I never got that far. Maybe you will."',
      "The Hush's pulse holds steady around all of you, patient as it's been since the gate, waiting — you understand now — not for an answer, but simply for whatever you choose to do next.",
    ],
    options: [
      {
        id: 'offer_to_stay',
        label: 'Offer to stay and help, the way Mira did',
        reveal: [
          'Mira\'s expression shifts — surprised, then something gentler. "Not yet," she says, not unkindly. "It doesn\'t need two of us, and Crystal Lake needs someone who remembers how to leave."',
          'But she takes the key from your palm anyway and presses it back into your hand, closed. "Keep this. It\'ll matter more where you\'re going than it did here." The root-mass dims and brightens once, deliberately, almost like a nod.',
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_ending_devoted' },
          { type: 'xp_bonus', amount: 30 },
          { type: 'artifact_odds_delta', value: 0.2 },
          { type: 'grant_artifact', artifactName: "Mira's Key" },
        ],
      },
      {
        id: 'ask_her_to_leave',
        label: 'Ask her to come back with you and report to the guild',
        reveal: [
          'She shakes her head, unoffended. "They wouldn\'t believe the report, and I\'m not sure I\'d want them to try."',
          'But she takes your hand a moment, warm despite everything, and presses something small into it — a second key, twin to the first, cut from the same tarnished brass. "For whoever comes after you. There\'s always someone after you."',
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_ending_continuity' },
          { type: 'xp_bonus', amount: 20 },
          { type: 'artifact_odds_delta', value: 0.12 },
          { type: 'grant_artifact', artifactName: "Mira's Second Key" },
        ],
      },
      {
        id: 'thank_and_respect',
        label: 'Simply thank her and let her choice be her own',
        reveal: [
          "You don't argue, don't plead, don't try to talk her into a decision that was never yours to make. Something in her posture eases at that, a tension you hadn't noticed until it left.",
          '"Most people try to convince me I\'m wrong," she says. "Thank you for not being most people." The cavern\'s pulse steadies further, and for the first time all day, you feel like you\'re leaving somewhere rather than escaping it.',
        ],
        effects: [
          { type: 'set_flag', key: 'greenfields_ending_respect' },
          { type: 'xp_bonus', amount: 25 },
          { type: 'artifact_odds_delta', value: 0.1 },
        ],
      },
    ],
    transition: [
      "You leave the Deep Hollow the way you entered — on foot, by lamplight, carrying considerably more than you arrived with. Ahead, past the edge of the guild's known maps, something waits that dreams, apparently, in fire instead of green. You already know you're going to go looking for it.",
    ],
  },
}

// mapId 1 (Greenfields) -> chamberId -> ChamberStory
export const STORY_CONTENT: Record<number, Record<number, ChamberStory>> = {
  1: {
    1: MOSSY_GATE,
    2: THORNWOOD_PASS,
    3: SUNKEN_ALTAR,
    4: ROOT_LABYRINTH,
    5: DEEP_HOLLOW,
  },
}
