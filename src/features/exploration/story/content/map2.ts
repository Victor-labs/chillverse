// src/features/exploration/story/content/map2.ts
//
// Crystal Lake narrative content. Recurring NPC is Senna, Warden of the
// Sanctum of Vigil — the golden lotus-pavilion shrine at the lake's edge
// (the map's own splash art). The pavilion is the last calm thing before
// the chambers below it, which is deliberate: the surface is a kept
// peace, not the whole truth of the place.
//
// Central twist: the lake isn't cold water under a pretty shrine — it's
// warm, because a bed of coals has been kept alight and carefully banked
// beneath it for generations, on purpose, by whoever holds the Vigil.
// Senna didn't light it; she inherited the promise to keep it low and
// keep it lit from her predecessor, Ardis, whose farewell to her is what
// the pavilion's two-figure, golden-swan carving actually depicts (swans
// as a vow-image, not a romance one — a promise kept after the one who
// asked for it is gone). Senna is found alive at the chamber 5 climax,
// tending the coals, at peace with continuing the Vigil alone.
//
// Mechanical notes (mirrors map1.ts exactly):
// - Only the claim checkpoints of chambers 2 and 5 (the artifact
//   chambers) carry `artifact_odds_delta` / `grant_artifact` effects.
//   Everything else is `xp_bonus` + `set_flag` — lore/flavor only, so no
//   choice is ever a "wrong" one.
// - xp_bonus tops out at 30 and artifact_odds_delta at 0.2 in this file,
//   same ceiling as map1.ts, so the bounds documented in
//   0036_exploration_story.sql ("30 XP / 0.20 odds") stay accurate
//   without needing a comment update there.
// - `grant_artifact` targets two new story_exclusive rows that need to
//   exist in the `artifacts` table before this ships: "Senna's Ember"
//   and "Senna's Last Coal" (see 0037_crystal_lake_story.sql).

import type { ChamberStory } from '../types'

const EMBER_ARCH: ChamberStory = {
  start: {
    intro: [
      "The guild's brief called it a routine survey: a lake reported unnaturally warm, a shrine at its edge no map crew had logged in three generations. Someone finally had the energy allowance to check.",
      'You expected steam, or worse. Instead you find gold — a pavilion of old bronze and lotus carving, standing dry-shod at the water\'s edge, untouched by three generations of weather it should not have survived untouched.',
      'The air past the arch is warm the way a held hand is warm, not the way a fire is warm. Lotus grows in drifts you\'ve never seen grow this far from anything tropical. A carved swan, gone green-gold with age, watches the water with a stillness that isn\'t quite the stillness of metal.',
      'At the base of the arch, tucked where root meets stone, a strip of oilcloth holds a single folded page. The hand is neat, deliberate, unhurried — nothing like a survivor\'s scrawl:',
      '"The Vigil is not a fire. It is a promise that happens to need fuel. Whoever reads this after me — it only asks to be kept low, and kept lit. Both, always. Never just one." — unsigned.',
    ],
    options: [
      {
        id: 'touch_arch',
        label: 'Rest your palm on the arch itself',
        reveal: [
          'The bronze is warm on the outside and warmer underneath, the way a hearth stone stays warm long after the fire\'s banked. You feel it less as heat than as a kind of patience — something that has been waiting a very long time without minding the wait.',
          'You write "not dangerous" in your notes, then cross it out, then write it again. You\'re fairly sure both versions are true.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 5 },
          { type: 'set_flag', key: 'cl_ch1_start_touch_arch' },
        ],
      },
      {
        id: 'watch_swan',
        label: 'Study the carved swan at the water\'s edge',
        reveal: [
          'Up close the swan isn\'t alone — its neck curves toward a second, smaller shape half-submerged at the waterline, worn nearly featureless by time. Two figures, not one. The carving wasn\'t made to be admired from a distance; it was made to be found up close, by someone willing to kneel at the water.',
          'Swans mate for life, your guild tutor told you once, as a footnote in a lecture about nothing important. You wonder, now, if it was ever a footnote at all.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 5 },
          { type: 'set_flag', key: 'cl_ch1_start_watch_swan' },
        ],
      },
      {
        id: 'read_note_aloud',
        label: 'Read the note aloud, to no one',
        reveal: [
          'Your voice sounds strange under the arch — not echoing, exactly, but held, the way the note itself feels held. "Kept low, and kept lit. Both, always." You\'re not sure why you say it twice.',
          'Nothing answers. But the warmth under your boots seems, for a moment, to settle — like something exhaling.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 5 },
          { type: 'set_flag', key: 'cl_ch1_start_read_aloud' },
        ],
      },
    ],
    transition: [
      'Whatever this place is, it wasn\'t abandoned. It was left running, on purpose, by someone who expected — or hoped — that someone else would eventually come looking.',
    ],
  },
  mid: {
    intro: [
      'Past the pavilion the ground begins to slope, gently, toward a stair cut into warm stone. The lotus thins out here; what replaces it is a low haze that isn\'t quite smoke and isn\'t quite mist, and a heat that rises steadily, patiently, the further down you go.',
      'Cut into the first step, small enough to miss, is a second fragment of the same neat hand — clearly older writing than the note at the arch, the ink gone rust-brown:',
      '"They asked if I was afraid. I told them yes. They said good — that meant I understood what I was agreeing to. I have thought about that answer every day since."',
    ],
    options: [
      {
        id: 'descend_slow',
        label: 'Take the stair slowly, counting steps',
        reveal: [
          'Forty steps, evenly cut, evenly warm — no step colder or hotter than the last, which feels less like geology and more like maintenance. Something has been keeping this staircase exactly this temperature for a very long time.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch1_mid_count_steps' },
        ],
      },
      {
        id: 'press_ear_to_stone',
        label: 'Press your ear to the warm stone wall',
        reveal: [
          'Under the warmth there\'s a sound so low you feel it more than hear it — a slow, even pulse, like the memory of a bellows working somewhere far beneath your feet. It isn\'t urgent. It isn\'t even loud. It just doesn\'t stop.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch1_mid_listen' },
        ],
      },
      {
        id: 'reread_fragment',
        label: 'Read the fragment again before continuing',
        reveal: [
          '"Good — that meant I understood what I was agreeing to." You find yourself wondering exactly what agreement is waiting for you at the bottom of this stair, and whether the writer would tell you to turn back, or to keep going.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch1_mid_reread' },
        ],
      },
    ],
    transition: [
      'The stair ends at a wide arch of the same warm bronze as the pavilion above — the true Ember Arch, you realize, the shrine having only ever been its threshold. Beyond it, the air is unmistakably hotter.',
    ],
  },
  claim: {
    intro: [
      'The chamber past the true arch is empty of anything you\'d call treasure — just warm stone, banked coal-light glowing low along carved channels in the floor, and a third fragment, this one pressed flat under a smooth river stone as if to keep it from blowing away in a wind that doesn\'t exist here.',
      '"I am not the first to keep this. I will not be the last, if I do it right. That is the whole of the job: not to be the last."',
    ],
    options: [
      {
        id: 'leave_coals_undisturbed',
        label: 'Leave the coal-channels exactly as you found them',
        reveal: [
          'Whatever this is, it isn\'t yours to poke at. You catalogue the chamber carefully, touch nothing that glows, and leave the fragment where it lay. It feels, oddly, like the correct kind of respect.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch1_claim_undisturbed' },
        ],
      },
      {
        id: 'sketch_the_channels',
        label: 'Sketch the pattern the coal-channels make',
        reveal: [
          'From above, roughly drawn, the channels form the same two-figure shape as the pavilion carving — one large curve, one small, joined at a single point like held hands. You add the sketch to your report with a note: pattern repeats, not decorative.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch1_claim_sketch' },
        ],
      },
      {
        id: 'pocket_the_stone',
        label: 'Take the smooth river stone as a marker of the visit',
        reveal: [
          'It\'s cool where the chamber is warm — the only cool thing you\'ve touched since the arch. You pocket it as proof of the survey, half expecting it to warm in your hand. It doesn\'t.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch1_claim_stone' },
        ],
      },
    ],
    transition: [
      'You climb back out past the pavilion with more questions than the brief accounted for, and a growing certainty that "unnaturally warm lake" was, if anything, an undersell.',
    ],
  },
}

const CINDER_HALL: ChamberStory = {
  start: {
    intro: [
      'The second chamber opens into a long hall lined with what looks, at first, like a vein of ordinary cinder-slag — until you notice it forms an unbroken line the full length of the room, banked and even, exactly the width of a fire someone has spent a long time learning to keep small.',
      'Halfway down the hall, set into a niche too deliberate to be natural, is an object wrapped in cloth gone stiff with age. Beside it, a fourth fragment:',
      '"Everyone assumes the danger is the fire getting too big. The real danger was always the opposite — a fire this old, kept this small, wants very badly to go out. Every day is a day of talking it out of that."',
    ],
    options: [
      {
        id: 'unwrap_carefully',
        label: 'Unwrap the object slowly, cloth first',
        reveal: [
          'Under brittle wrapping is a small iron tool, tongs of a design you don\'t recognize, worn smooth at the grip by a hand that used them daily for what must have been years. Whoever this was tended this fire like a garden, not a hazard.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch2_start_unwrap' },
        ],
      },
      {
        id: 'walk_the_vein',
        label: 'Walk the full length of the cinder vein first',
        reveal: [
          'Forty paces of banked coal, glowing the same patient low red the whole way, without a single cold patch or flare. Whoever maintains this does it with a consistency that reads less like caretaking and more like devotion.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch2_start_walk' },
        ],
      },
      {
        id: 'think_about_fragment',
        label: 'Sit with what the fragment is really saying',
        reveal: [
          'You\'d assumed, walking in, that your job was to make sure nothing here burned out of control. It hadn\'t occurred to you that the actual, harder job — someone\'s actual, harder job — was making sure it never simply burned out.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch2_start_reflect' },
        ],
      },
    ],
    transition: [
      'You leave the tongs where you found them. Whatever tends this hall is still, apparently, tending it — and you\'d rather not be the survey crew that broke someone\'s forty-year streak.',
    ],
  },
  mid: {
    intro: [
      'Deeper into Cinder Hall, the banked vein widens into a shallow basin, coal-light rippling across its surface like the world\'s slowest water. Set at its edge, a fifth fragment, the ink here noticeably shakier than the others:',
      '"Ardis asked me to do this on a day I still remember too clearly. I said yes before I understood what I was saying yes to. I don\'t regret it. I want that written down, in case anyone ever finds these and wonders."',
    ],
    options: [
      {
        id: 'name_ardis',
        label: 'Write the name "Ardis" carefully into your own notes',
        reveal: [
          'You underline it twice. Whoever kept this fire before wasn\'t anonymous to the writer — Ardis was someone specific, someone who asked something enormous of another person and was, apparently, trusted enough to be given it.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch2_mid_name_ardis' },
        ],
      },
      {
        id: 'watch_basin',
        label: 'Watch the coal-basin ripple in silence for a while',
        reveal: [
          'There\'s no wind down here to explain the movement. The coals shift the way still water shifts under a very slow current — something underneath is moving it, deliberately, the way a hand stirs a pot to keep it from settling.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch2_mid_watch_basin' },
        ],
      },
      {
        id: 'consider_the_asking',
        label: 'Consider what it means that this was asked, not inherited',
        reveal: [
          'It changes the shape of the whole survey, somehow. This wasn\'t a duty someone was born into and couldn\'t refuse — it was a request, made to a person, who said yes. You find that harder to be neutral about than you expected.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch2_mid_consider' },
        ],
      },
    ],
    transition: [
      'Past the basin, the hall narrows toward a final alcove — and the coal-light there burns very slightly brighter, as if something in this chamber is closer to the surface than anywhere you\'ve been so far.',
    ],
  },
  claim: {
    intro: [
      'In the alcove, resting on a shelf of fused, glass-smooth stone, is a single ember — not banked, not dying, held in a small bronze cage shaped, you now recognize immediately, like the pavilion swan above. It has clearly been placed here, and clearly meant to be found.',
      'A last fragment, tucked beneath the cage: "If you\'ve read this far, you\'ve earned the right to carry a piece of it out. It won\'t burn you. It was never meant to burn anyone — only to keep, and to be kept."',
    ],
    options: [
      {
        id: 'lift_cage_gently',
        label: 'Lift the caged ember and study it before deciding',
        reveal: [
          'True to the note, it\'s warm but harmless in your palm — steady, unhurried, alive in the way a held breath is alive. You understand, holding it, why someone might spend a life making sure something this small never went out.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 20 },
          { type: 'artifact_odds_delta', value: 0.15 },
          { type: 'set_flag', key: 'cl_ch2_claim_lift' },
        ],
      },
      {
        id: 'note_the_cage_shape',
        label: 'Note that the cage is shaped like the pavilion swan',
        reveal: [
          'You set the observation down carefully in your report: whoever built this cage knew exactly what shape they were echoing. This ember was never meant to be anonymous cargo — it was meant to carry the same promise the swan carving does.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 20 },
          { type: 'artifact_odds_delta', value: 0.2 },
          { type: 'set_flag', key: 'cl_ch2_claim_note_shape' },
        ],
      },
      {
        id: 'leave_it_for_now',
        label: 'Leave the ember caged and note its location for the guild',
        reveal: [
          'You record the alcove precisely, sketch the cage, and leave everything exactly as it sat. Some things feel like they deserve to be found on purpose, later, rather than taken on a first pass through.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch2_claim_leave' },
        ],
      },
    ],
    transition: [
      'Whether or not you carry it out with you, one thing is clear leaving Cinder Hall: this place has a keeper, the keeper has a name half-recorded in fragments, and the keeper is not, as far as you can tell, gone.',
    ],
  },
}

const OBSIDIAN_COURT: ChamberStory = {
  start: {
    intro: [
      'The third chamber is unlike the first two — a wide, open court floored entirely in black glass, smooth as still water, reflecting the low coal-light back up at you from every angle at once. It is, you realize slowly, exactly the shape and size of the lake far above.',
      'A plaque of the same black glass stands at the court\'s center, letters pressed into it while it was still molten, now cooled hard and permanent — clearly meant to be read, not stumbled on:',
      '"This is the Vigil of Ardis and Senna. It is not a disaster. It was not an accident. It was chosen, on purpose, to hold something that asked to be held."',
    ],
    options: [
      {
        id: 'walk_the_glass',
        label: 'Walk the full black-glass floor, tracing its edges',
        reveal: [
          'It really is the lake\'s shape, precisely — you\'re standing directly beneath the water and the golden pavilion, on a floor made from whatever this place once was before it was made this. The reflection above and the glass below feel, uncomfortably, like the same water frozen at two different moments.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch3_start_walk_glass' },
        ],
      },
      {
        id: 'read_plaque_twice',
        label: 'Read the plaque a second time, slowly',
        reveal: [
          '"Chosen, on purpose, to hold something that asked to be held." Not danger, not disaster — a request, and an answer. Whatever the guild expected to log here, it wasn\'t a monument to two people keeping a promise.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch3_start_reread_plaque' },
        ],
      },
      {
        id: 'kneel_at_center',
        label: 'Kneel at the court\'s exact center',
        reveal: [
          'From here the reflected coal-light seems to gather rather than scatter, pooling faintly around where you kneel, like the room itself is acknowledging you\'ve found the one spot it was built to be seen from.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch3_start_kneel' },
        ],
      },
    ],
    transition: [
      'You leave the plaque exactly as it stands. Whoever named this the Vigil of Ardis and Senna clearly meant both names to be read together, permanently, by anyone who made it this far.',
    ],
  },
  mid: {
    intro: [
      'At the court\'s far edge, a low archway leads to a second, smaller room — and here, for the first time, the black glass floor is broken: a single, deliberate crack, old and long-settled, running from wall to wall.',
      'Beside the crack, weighted down with the same smooth river-stone style you saw in Ember Arch, is a longer fragment than any before it:',
      '"There was a year I nearly let it go out. Grief does that — makes you forget why you were keeping something warm in the first place. Ardis would have understood. Ardis, more than anyone, would have understood."',
    ],
    options: [
      {
        id: 'examine_the_crack',
        label: 'Examine the crack in the glass floor closely',
        reveal: [
          'It isn\'t damage from outside — the edges bow slightly upward, like something beneath pushed once, hard, and then stopped. A single bad year, made permanent in glass, and left unrepaired rather than hidden.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch3_mid_crack' },
        ],
      },
      {
        id: 'sit_with_grief_line',
        label: 'Sit with the line about grief for a while',
        reveal: [
          'You\'ve read a dozen fragments now that sound like duty. This is the first that sounds like cost. You find yourself hoping, more than you expected to, that whoever wrote this made it through that year.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch3_mid_grief' },
        ],
      },
      {
        id: 'leave_stone_undisturbed',
        label: 'Leave the weighting stone exactly where it rests',
        reveal: [
          'It was placed there to keep the fragment from moving, and you\'d rather it stay found by the next person exactly as you found it — steady, deliberate, unmoved by the year it describes.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch3_mid_leave_stone' },
        ],
      },
    ],
    transition: [
      'Past the crack, the passage narrows and begins, unmistakably, to climb — not toward the lake, but toward somewhere warmer still.',
    ],
  },
  claim: {
    intro: [
      'The chamber ends at a narrow gallery lined with small alcoves, each holding a single object — a tool, a folded cloth, a child\'s carved toy swan no bigger than a thumb — the accumulated, ordinary belongings of a life lived down here, on purpose, for a very long time.',
      'The last object, closest to the passage out, is a second plaque, smaller than the first: "Everything in this gallery was chosen to stay. Nothing here is lost. Please don\'t mistake a life for a grave."',
    ],
    options: [
      {
        id: 'catalogue_respectfully',
        label: 'Catalogue the gallery\'s contents without touching them',
        reveal: [
          'You note each object precisely, by position, and touch none of them. Whatever this place is, the plaque was clear — this is someone\'s home, curated on purpose, not a ruin to be picked over.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch3_claim_catalogue' },
        ],
      },
      {
        id: 'notice_the_toy_swan',
        label: 'Look closely at the little carved toy swan',
        reveal: [
          'It\'s worn soft at the edges the way only years of handling can wear wood — not preserved behind glass, but used, loved, kept. Whoever\'s life this gallery holds, it was a full one, not a sacrifice performed for an audience.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch3_claim_toy_swan' },
        ],
      },
      {
        id: 'reread_second_plaque',
        label: 'Read the second plaque\'s last line again',
        reveal: [
          '"Please don\'t mistake a life for a grave." You write it down word for word, unsure yet who it was written for — future explorers, or whoever wrote it, reminding themselves.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch3_claim_reread' },
        ],
      },
    ],
    transition: [
      'You leave the gallery the way you found it, carrying nothing but the growing certainty that the "keeper" of this place is not a ghost, a monument, or a myth. She is, in every sense the gallery suggests, still living here.',
    ],
  },
}

const ASHEN_KEEP: ChamberStory = {
  start: {
    intro: [
      'The fourth chamber is the hottest yet, though never uncomfortable — a keep of banked hearths, dozens of them, each tended, each burning at exactly the same patient low glow as the coal-vein in Cinder Hall far above.',
      'A workbench near the entrance holds tools mid-use, as though whoever was last here simply set them down to answer a question and hasn\'t come back yet. Beside them, a fragment, the hand now unmistakably the same one from every prior page:',
      '"Forty hearths, one for every year since Ardis asked me. I add one on the anniversary, not because it needs more fire, but because I need somewhere to put the year."',
    ],
    options: [
      {
        id: 'count_the_hearths',
        label: 'Count the hearths yourself',
        reveal: [
          'Forty, exactly, just as the fragment says — and a forty-first, cold and freshly built, sitting unlit and waiting at the row\'s end. Someone was partway through adding this year\'s.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch4_start_count' },
        ],
      },
      {
        id: 'examine_workbench',
        label: 'Examine the half-used tools on the workbench',
        reveal: [
          'Nothing here is abandoned — the tools are set down mid-task, not dropped in a hurry. Whoever left them expects to pick them back up. You find yourself, oddly, not wanting to be the reason they don\'t.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 10 },
          { type: 'set_flag', key: 'cl_ch4_start_workbench' },
        ],
      },
      {
        id: 'sit_with_forty_years',
        label: 'Sit with what "forty years" actually means here',
        reveal: [
          'Forty years of one person, alone, keeping a promise made to someone who is — the fragments increasingly suggest — no longer here to check on it. You\'re not sure your guild brief has a box to check for what you\'re starting to feel about that.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch4_start_forty_years' },
        ],
      },
    ],
    transition: [
      'You move deeper into the keep past the row of hearths, each one warm, each one tended, each one — you\'re fairly sure now — a year someone chose, deliberately, to keep rather than let go cold.',
    ],
  },
  mid: {
    intro: [
      'At the keep\'s heart is a single larger hearth, older than the rest, its stonework worn smooth at the edge where a hand — or two hands — must have rested countless times. This, you understand without needing a fragment to tell you, is the first one. The original.',
      'A fragment rests against its base anyway, shorter than the others, almost casual: "This was Ardis\'s favorite spot to sit and get nothing done. I still sit here for the same reason. It works exactly as well as it always did."',
    ],
    options: [
      {
        id: 'sit_at_original_hearth',
        label: 'Sit where the fragment says Ardis used to sit',
        reveal: [
          'The stone is warm, worn to a shape that fits a person who sat here often, for a long time, doing — per the note — nothing in particular. You understand, suddenly and completely, that this chamber isn\'t a shrine. It\'s a home someone still lives in.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch4_mid_sit' },
        ],
      },
      {
        id: 'trace_worn_stone',
        label: 'Trace the worn edge of the original hearth',
        reveal: [
          'Two slightly different wear-patterns, side by side — one shallower, more recent; one deep, old, long unrenewed. Two hands rested here once. Only one of them, it seems, still does.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch4_mid_trace' },
        ],
      },
      {
        id: 'do_nothing_deliberately',
        label: 'Do exactly what the fragment describes — sit and get nothing done',
        reveal: [
          'You lower your pack, sit, and simply let the warmth of the original hearth settle over you for a while, doing nothing useful at all. It is, unexpectedly, the most honest research you\'ve done all survey.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 20 },
          { type: 'set_flag', key: 'cl_ch4_mid_do_nothing' },
        ],
      },
    ],
    transition: [
      'Eventually you rise, sling your pack, and continue — toward whatever the fortieth-plus-one hearth was being built for, and toward whoever has been building it.',
    ],
  },
  claim: {
    intro: [
      'Past the original hearth, a final stair leads up toward brighter light and warmer air than anywhere else in the keep. At its foot, propped where it can\'t be missed, is a small, worn wooden sign, hand-lettered, clearly meant for exactly this moment:',
      '"If you\'ve read every fragment and you\'re standing here — you\'re not intruding. You\'re expected. Go on up."',
    ],
    options: [
      {
        id: 'go_up_immediately',
        label: 'Go up without hesitating',
        reveal: [
          'You climb the last stair quickly, sign clutched in one hand, forty years of fragments finally about to meet whoever wrote them. It doesn\'t feel like trespassing. It feels, exactly as promised, like being expected.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch4_claim_go_up' },
        ],
      },
      {
        id: 'reread_all_fragments',
        label: 'Pause to reread your collected fragments before going up',
        reveal: [
          'You flip back through your notes — the arch, the hall, the court, the keep — forty years compressed into a handful of pages you\'ve carried the whole way down. It seems right to remember all of it before meeting her.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 20 },
          { type: 'set_flag', key: 'cl_ch4_claim_reread' },
        ],
      },
      {
        id: 'leave_sign_untouched',
        label: 'Leave the sign exactly as it stands and climb past it',
        reveal: [
          'You climb past without moving it, letting it stand for whoever comes after you. If it worked for you, it will work for the next survey too.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch4_claim_leave_sign' },
        ],
      },
    ],
    transition: [
      'Light spills down from above — warmer, brighter, and closer than any coal-glow you\'ve seen so far. Whatever waits at the top of this stair, it isn\'t another empty chamber.',
    ],
  },
}

const PYROCLAST_VAULT: ChamberStory = {
  start: {
    intro: [
      'The stair opens into a vault unlike anything below it — not stone but the same fused black glass as the Obsidian Court, except here it glows faintly from within, lit by something vast and slow-burning banked directly beneath the floor.',
      'At the room\'s center, tending a wide, shallow hearth with the same worn iron tongs you saw wrapped in Cinder Hall, is a woman — unhurried, unsurprised, glancing up at your footsteps the way you\'d glance up at an expected guest arriving slightly early.',
      '"You made good time," she says. "Most people take a week to work up the nerve past the plaque. Sit, if you\'d like. I\'m Senna. I imagine you\'ve read enough of me by now to skip the introductions."',
    ],
    options: [
      {
        id: 'ask_about_ardis',
        label: 'Ask her, gently, about Ardis',
        reveal: [
          'Something in her face softens, not with pain exactly, but with the particular ease of a story told many times. "Ardis lit this, before I was born to the role. Asked me to keep it, the year I turned twenty. I said yes. Ardis has been gone longer than I keep track of, and it has never once occurred to me to stop."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch5_start_ask_ardis' },
        ],
      },
      {
        id: 'ask_if_shes_alright',
        label: 'Ask if she\'s alright, down here, alone',
        reveal: [
          'She laughs, warm and a little surprised. "Alone is doing a lot of work in that question. I have the lake, the pavilion, the fortieth hearth, and every explorer curious enough to read forty years of my handwriting. I\'m tended to. Don\'t worry on my behalf."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch5_start_ask_alright' },
        ],
      },
      {
        id: 'ask_what_it_holds_back',
        label: 'Ask what the Vigil is actually holding back',
        reveal: [
          '"Something patient," she says, stirring the hearth once, unhurried. "Something that doesn\'t want to burn the world — it wants the opposite. This fire isn\'t a wall against heat. It\'s a wall against cold that would very much like to spread. I\'ll say more, if you\'ve got the time to sit."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 15 },
          { type: 'set_flag', key: 'cl_ch5_start_ask_holdback' },
        ],
      },
    ],
    transition: [
      'She gestures at a second, smaller stool near the hearth, and — however you opened the conversation — waits, patiently, for you to actually sit down.',
    ],
  },
  mid: {
    intro: [
      'You sit. The hearth between you glows the same patient low red as every coal-vein you\'ve passed since Ember Arch — the whole mountain, you realize now, is one fire, banked and threaded and tended from the pavilion above down to this exact spot.',
      '"The old carvings have a name for what sleeps under enough cold and enough dark," Senna says, watching the coals rather than you. "They call it the place that dreams in fire instead of green — which always struck me as backwards, until I understood it meant here. This vault is the green world\'s answer to something that isn\'t green at all."',
    ],
    options: [
      {
        id: 'ask_whats_next',
        label: 'Ask what she means by "isn\'t green at all"',
        reveal: [
          '"There\'s a twin to this, under salt instead of stone," she says. "I\'ve never seen it. I\'ve only ever been told, the same way I was told to keep this. Someone, someday, tends that one too — or it doesn\'t stay asleep."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 20 },
          { type: 'set_flag', key: 'cl_ch5_mid_whats_next' },
        ],
      },
      {
        id: 'offer_to_help_tend',
        label: 'Offer to help her tend the hearth, just for now',
        reveal: [
          'She hands you the tongs without hesitation, guiding your hands through one slow, careful turn of the coals. "There," she says. "Now you\'ve kept it too, for exactly one motion. That counts. Everyone who keeps it starts with one motion."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 20 },
          { type: 'set_flag', key: 'cl_ch5_mid_offer_help' },
        ],
      },
      {
        id: 'ask_about_the_forty_first_hearth',
        label: 'Ask about the unfinished, fortieth-plus-one hearth',
        reveal: [
          '"I\'ll finish it tonight, same as every year," she says, and for the first time there\'s something almost shy in it. "Forty-one years of putting a year somewhere I can see it. I like that it makes the keep bigger instead of just older."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 20 },
          { type: 'set_flag', key: 'cl_ch5_mid_forty_first' },
        ],
      },
    ],
    transition: [
      'Eventually she sets the tongs down and rises, brushing ash from her knees, and nods toward a shelf you hadn\'t noticed — set into the glass wall, holding two objects, quietly waiting.',
    ],
  },
  claim: {
    intro: [
      '"Two things live on that shelf," Senna says. "One I give to anyone who sits and listens all the way through — that\'s you, now. The other I only give to someone who means to come back and check on me. No wrong answer. Just an honest one."',
      'The shelf holds a small cage of banked ember, twin to the one in Cinder Hall, and beside it, a single dark, glass-smooth coal that seems, faintly, to still be warm.',
    ],
    options: [
      {
        id: 'accept_first_gift_only',
        label: 'Accept the first gift, and thank her honestly for the story',
        reveal: [
          'She presses the small ember-cage into your hands. "For listening," she says simply. "That\'s worth more down here than you\'d think." You leave the second object untaken, and she doesn\'t seem to mind at all.',
        ],
        effects: [
          { type: 'xp_bonus', amount: 25 },
          { type: 'artifact_odds_delta', value: 0.2 },
          { type: 'grant_artifact', artifactName: "Senna's Ember" },
          { type: 'set_flag', key: 'cl_ch5_claim_first_only' },
        ],
      },
      {
        id: 'promise_to_return',
        label: 'Promise, honestly, that you\'ll come back to check on her',
        reveal: [
          'Senna studies you for a long moment, then nods once, satisfied, and presses both objects into your hands — the ember-cage, and the last coal beside it. "Then you\'ll want both," she says. "One to remember me by. One to prove, to yourself, that you meant it."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 30 },
          { type: 'artifact_odds_delta', value: 0.2 },
          { type: 'grant_artifact', artifactName: "Senna's Ember" },
          { type: 'grant_artifact', artifactName: "Senna's Last Coal" },
          { type: 'set_flag', key: 'cl_ch5_claim_promise_return' },
        ],
      },
      {
        id: 'ask_her_to_choose',
        label: 'Ask her to choose which one suits you better',
        reveal: [
          'She laughs, delighted by the question rather than put off by it, and picks up the small ember-cage without hesitation. "This one," she says. "The other asks something of you I don\'t think you\'ve decided yet. No shame in that. Take your time deciding — the lake isn\'t going anywhere."',
        ],
        effects: [
          { type: 'xp_bonus', amount: 25 },
          { type: 'artifact_odds_delta', value: 0.15 },
          { type: 'grant_artifact', artifactName: "Senna's Ember" },
          { type: 'set_flag', key: 'cl_ch5_claim_ask_her' },
        ],
      },
    ],
    transition: [
      'You climb back out past the original hearth, past the row of forty-one, past the black-glass court and the long cinder hall, up through Ember Arch and into evening light over the lake — carrying warmth that, you\'re fairly sure now, was never going to burn you at all. Somewhere ahead, past the edge of the guild\'s known maps, is a twin to this vigil, kept under salt instead of stone. You already know you\'re going to go looking for it.',
    ],
  },
}

// mapId 2 (Crystal Lake) -> chamberId -> ChamberStory
export const STORY_CONTENT: Record<number, Record<number, ChamberStory>> = {
  2: {
    1: EMBER_ARCH,
    2: CINDER_HALL,
    3: OBSIDIAN_COURT,
    4: ASHEN_KEEP,
    5: PYROCLAST_VAULT,
  },
}
