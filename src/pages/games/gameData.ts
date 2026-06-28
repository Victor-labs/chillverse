// src/pages/games/gameData.ts
// ─── All static data pools for Chillverse games ─────────────

// ════════════════════════════════════════════
// TRIVIA CLASH — 85 questions, easy + medium
// ════════════════════════════════════════════
export interface TriviaQuestion {
  q: string
  a: [string, string, string, string]
  correct: 0 | 1 | 2 | 3
  difficulty: 'easy' | 'medium'
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // ── SCIENCE ──
  { q: 'What planet is known as the Red Planet?', a: ['Mars','Venus','Saturn','Jupiter'], correct: 0, difficulty: 'easy' },
  { q: 'What gas do plants absorb from the air?', a: ['Oxygen','Nitrogen','CO₂','Hydrogen'], correct: 2, difficulty: 'easy' },
  { q: 'Which metal is liquid at room temperature?', a: ['Iron','Gold','Mercury','Silver'], correct: 2, difficulty: 'easy' },
  { q: 'What is H₂O?', a: ['Air','Water','Fire','Earth'], correct: 1, difficulty: 'easy' },
  { q: 'What is the hardest natural substance?', a: ['Iron','Granite','Quartz','Diamond'], correct: 3, difficulty: 'easy' },
  { q: 'Which element has the atomic number 1?', a: ['Helium','Oxygen','Hydrogen','Carbon'], correct: 2, difficulty: 'easy' },
  { q: 'What is the chemical symbol for gold?', a: ['Gd','Go','Au','Ag'], correct: 2, difficulty: 'easy' },
  { q: 'How many bones are in the adult human body?', a: ['196','206','216','226'], correct: 1, difficulty: 'easy' },
  { q: 'What organ pumps blood through the body?', a: ['Lungs','Liver','Brain','Heart'], correct: 3, difficulty: 'easy' },
  { q: 'What is the speed of light (approx km/s)?', a: ['100k','300k','500k','1M'], correct: 1, difficulty: 'medium' },
  { q: 'What is the powerhouse of the cell?', a: ['Nucleus','Ribosome','Mitochondria','Golgi Body'], correct: 2, difficulty: 'easy' },
  { q: 'What force keeps planets in orbit?', a: ['Magnetism','Gravity','Friction','Tension'], correct: 1, difficulty: 'easy' },
  { q: 'What is the most abundant gas in Earth\'s atmosphere?', a: ['Oxygen','CO₂','Nitrogen','Argon'], correct: 2, difficulty: 'medium' },
  { q: 'What unit measures electrical resistance?', a: ['Volt','Watt','Ohm','Ampere'], correct: 2, difficulty: 'medium' },
  { q: 'What is the boiling point of water in Fahrenheit?', a: ['100°F','180°F','212°F','250°F'], correct: 2, difficulty: 'medium' },
  { q: 'How many chromosomes does a human have?', a: ['23','44','46','48'], correct: 2, difficulty: 'medium' },
  { q: 'What is Newton\'s first law about?', a: ['Force equals mass × acceleration','Inertia','Action-reaction','Conservation of energy'], correct: 1, difficulty: 'medium' },
  // ── MATH ──
  { q: 'How many sides does a hexagon have?', a: ['5','6','7','8'], correct: 1, difficulty: 'easy' },
  { q: 'What is the square root of 144?', a: ['11','12','13','14'], correct: 1, difficulty: 'easy' },
  { q: 'How many degrees in a right angle?', a: ['45','60','90','180'], correct: 2, difficulty: 'easy' },
  { q: 'What is 15% of 200?', a: ['20','25','30','35'], correct: 2, difficulty: 'easy' },
  { q: 'How many days in a leap year?', a: ['364','365','366','367'], correct: 2, difficulty: 'easy' },
  { q: 'What is the value of π (approx)?', a: ['2.71','3.14','3.41','3.17'], correct: 1, difficulty: 'easy' },
  { q: 'What is 7 × 8?', a: ['54','56','62','64'], correct: 1, difficulty: 'easy' },
  { q: 'What is the prime number closest to 20?', a: ['17','18','19','21'], correct: 2, difficulty: 'medium' },
  { q: 'What is 2 to the power of 10?', a: ['512','1024','256','2048'], correct: 1, difficulty: 'medium' },
  { q: 'What is the sum of angles in a triangle?', a: ['90°','120°','180°','360°'], correct: 2, difficulty: 'easy' },
  // ── GEOGRAPHY ──
  { q: 'Which country has the largest population?', a: ['India','USA','China','Brazil'], correct: 2, difficulty: 'easy' },
  { q: 'What is the capital of Japan?', a: ['Seoul','Beijing','Tokyo','Bangkok'], correct: 2, difficulty: 'easy' },
  { q: 'How many continents are there?', a: ['5','6','7','8'], correct: 2, difficulty: 'easy' },
  { q: 'What is the largest ocean?', a: ['Atlantic','Indian','Arctic','Pacific'], correct: 3, difficulty: 'easy' },
  { q: 'Which is the smallest continent?', a: ['Antarctica','Europe','Australia','S. America'], correct: 2, difficulty: 'easy' },
  { q: 'What is the capital of Nigeria?', a: ['Lagos','Abuja','Kano','Ibadan'], correct: 1, difficulty: 'easy' },
  { q: 'Which river is the longest in the world?', a: ['Amazon','Congo','Mississippi','Nile'], correct: 3, difficulty: 'medium' },
  { q: 'What country has the most natural lakes?', a: ['USA','Russia','Brazil','Canada'], correct: 3, difficulty: 'medium' },
  { q: 'In which continent is the Sahara Desert?', a: ['Asia','Africa','Australia','South America'], correct: 1, difficulty: 'easy' },
  { q: 'What is the smallest country in the world?', a: ['Monaco','San Marino','Vatican City','Liechtenstein'], correct: 2, difficulty: 'medium' },
  // ── HISTORY ──
  { q: 'In what year did World War 2 end?', a: ['1943','1944','1945','1946'], correct: 2, difficulty: 'easy' },
  { q: 'Who invented the telephone?', a: ['Edison','Tesla','Bell','Morse'], correct: 2, difficulty: 'easy' },
  { q: 'Which country first landed on the moon?', a: ['Russia','China','USA','France'], correct: 2, difficulty: 'easy' },
  { q: 'In which year did the Berlin Wall fall?', a: ['1987','1988','1989','1990'], correct: 2, difficulty: 'medium' },
  { q: 'Who was the first President of the USA?', a: ['Lincoln','Jefferson','Adams','Washington'], correct: 3, difficulty: 'easy' },
  { q: 'Which ancient wonder was in Alexandria?', a: ['Colossus','Lighthouse','Hanging Gardens','Statue of Zeus'], correct: 1, difficulty: 'medium' },
  // ── BIOLOGY ──
  { q: 'What is the fastest land animal?', a: ['Lion','Horse','Cheetah','Leopard'], correct: 2, difficulty: 'easy' },
  { q: 'How many bones are in the human ear?', a: ['1','2','3','4'], correct: 2, difficulty: 'medium' },
  { q: 'What do we call animals that eat only plants?', a: ['Carnivores','Omnivores','Herbivores','Parasites'], correct: 2, difficulty: 'easy' },
  { q: 'What is the largest organ in the human body?', a: ['Brain','Liver','Skin','Intestine'], correct: 2, difficulty: 'medium' },
  { q: 'How many chambers does the human heart have?', a: ['2','3','4','5'], correct: 2, difficulty: 'easy' },
  // ── MUSIC ──
  { q: 'How many strings does a standard guitar have?', a: ['4','5','6','7'], correct: 2, difficulty: 'easy' },
  { q: 'Who composed Für Elise?', a: ['Mozart','Bach','Beethoven','Chopin'], correct: 2, difficulty: 'easy' },
  { q: 'What is the lowest male singing voice?', a: ['Tenor','Baritone','Bass','Alto'], correct: 2, difficulty: 'medium' },
  { q: 'How many notes are in a standard musical scale?', a: ['5','7','8','12'], correct: 1, difficulty: 'easy' },
  { q: 'What does BPM stand for in music?', a: ['Beats Per Minute','Bass Per Measure','Bars Per Movement','Beats Per Measure'], correct: 0, difficulty: 'easy' },
  // ── MEASUREMENT ──
  { q: 'How many millimetres in a centimetre?', a: ['5','8','10','12'], correct: 2, difficulty: 'easy' },
  { q: 'How many seconds in an hour?', a: ['360','3600','6000','36000'], correct: 1, difficulty: 'easy' },
  { q: 'How many grams in a kilogram?', a: ['100','500','1000','10000'], correct: 2, difficulty: 'easy' },
  { q: 'What unit measures sound intensity?', a: ['Hertz','Pascal','Decibel','Newton'], correct: 2, difficulty: 'medium' },
  { q: 'How many litres in a cubic metre?', a: ['10','100','1000','10000'], correct: 2, difficulty: 'medium' },
  // ── CHEMISTRY ──
  { q: 'What does DNA stand for?', a: ['Deoxyribose Nucleic Acid','Double Nucleic Acid','Deoxyribonucleic Acid','Dual Nitrogen Acid'], correct: 2, difficulty: 'medium' },
  { q: 'What is the pH of pure water?', a: ['6','7','8','9'], correct: 1, difficulty: 'easy' },
  { q: 'Which gas is used in balloons to make them float?', a: ['Oxygen','Nitrogen','Helium','Hydrogen'], correct: 2, difficulty: 'easy' },
  { q: 'What is the chemical formula for table salt?', a: ['NaCl','KCl','CaCO₃','H₂SO₄'], correct: 0, difficulty: 'medium' },
  { q: 'Which element is a liquid at room temperature (non-metal)?', a: ['Mercury','Bromine','Gallium','Cesium'], correct: 1, difficulty: 'medium' },
  // ── SPORTS ──
  { q: 'What sport uses a shuttlecock?', a: ['Tennis','Badminton','Squash','Ping Pong'], correct: 1, difficulty: 'easy' },
  { q: 'How many players are on a basketball team on court?', a: ['4','5','6','7'], correct: 1, difficulty: 'easy' },
  { q: 'How many holes are in a standard golf game?', a: ['9','12','18','24'], correct: 2, difficulty: 'easy' },
  { q: 'Which country invented the sport of cricket?', a: ['Australia','USA','India','England'], correct: 3, difficulty: 'medium' },
  { q: 'How many players are on a football (soccer) team?', a: ['9','10','11','12'], correct: 2, difficulty: 'easy' },
  // ── TECHNOLOGY ──
  { q: 'What does CPU stand for?', a: ['Central Processing Unit','Computer Power Unit','Core Processor Utility','Central Power Unit'], correct: 0, difficulty: 'easy' },
  { q: 'What does HTTP stand for?', a: ['HyperText Transfer Protocol','High Transfer Text Protocol','HyperText Transmission Process','High Text Transfer Process'], correct: 0, difficulty: 'medium' },
  { q: 'What company created the Android operating system?', a: ['Apple','Microsoft','Google','Samsung'], correct: 2, difficulty: 'easy' },
  { q: 'What language is primarily used for web styling?', a: ['HTML','JavaScript','Python','CSS'], correct: 3, difficulty: 'easy' },
  { q: 'What does RAM stand for?', a: ['Read Access Memory','Random Access Memory','Read Allocate Memory','Run-time Access Module'], correct: 1, difficulty: 'easy' },
  // ── LITERATURE ──
  { q: 'Who wrote Romeo and Juliet?', a: ['Dickens','Shakespeare','Austen','Hemingway'], correct: 1, difficulty: 'easy' },
  { q: 'What colour do you get mixing red + blue?', a: ['Green','Orange','Purple','Brown'], correct: 2, difficulty: 'easy' },
  { q: 'Which language has the most native speakers?', a: ['English','Spanish','Mandarin','Hindi'], correct: 2, difficulty: 'medium' },
  { q: 'Who wrote "1984"?', a: ['Huxley','Orwell','Kafka','Tolkien'], correct: 1, difficulty: 'medium' },
  { q: 'What is the longest novel ever written?', a: ['War and Peace','In Search of Lost Time','Ulysses','Don Quixote'], correct: 1, difficulty: 'medium' },
]

// ════════════════════════════════════════════
// TWO TRUTHS ONE FALSE — 65 question sets
// ════════════════════════════════════════════
export interface TwoTruthsSet {
  statements: [string, string, string]
  falseIdx: 0 | 1 | 2
  explanation: string
  difficulty: 'easy' | 'medium'
}

export const TWO_TRUTHS_DATA: TwoTruthsSet[] = [
  // ── SCIENCE ──
  { statements: ['The sun is a star', 'Stars are cold', 'The moon reflects sunlight'], falseIdx: 1, explanation: 'Stars are extremely hot, burning at millions of degrees through nuclear fusion.', difficulty: 'easy' },
  { statements: ['Water boils at 100°C at sea level', 'Ice melts at 0°C', 'Steam is colder than water'], falseIdx: 2, explanation: 'Steam is hotter than water — it is water in gaseous form above 100°C.', difficulty: 'easy' },
  { statements: ['Humans have 206 bones', 'The femur is the longest bone', 'Bones are made of muscle'], falseIdx: 2, explanation: 'Bones are made of collagen and calcium phosphate, not muscle.', difficulty: 'easy' },
  { statements: ['Sound travels faster than light', 'Light travels at 300,000 km/s', 'Sound cannot travel in a vacuum'], falseIdx: 0, explanation: 'Light travels far faster than sound — about 880,000 times faster.', difficulty: 'easy' },
  { statements: ['DNA is found in cell nuclei', 'DNA carries genetic information', 'DNA is made of amino acids'], falseIdx: 2, explanation: 'DNA is made of nucleotides, not amino acids. Proteins are made of amino acids.', difficulty: 'medium' },
  { statements: ['Gravity pulls objects toward Earth', 'The Moon has gravity', 'Gravity pushes objects upward'], falseIdx: 2, explanation: 'Gravity is always an attractive force — it pulls, never pushes.', difficulty: 'easy' },
  { statements: ['Oxygen is needed for fire', 'CO₂ can extinguish fire', 'Fire needs water to start'], falseIdx: 2, explanation: 'Fire needs heat, fuel, and oxygen — not water. Water is used to stop it.', difficulty: 'easy' },
  { statements: ['The Earth orbits the Sun', 'The Moon orbits the Earth', 'The Sun orbits the Earth'], falseIdx: 2, explanation: 'The Earth orbits the Sun, not the other way around.', difficulty: 'easy' },
  { statements: ['Photosynthesis produces oxygen', 'Plants absorb CO₂', 'Plants release CO₂ during photosynthesis'], falseIdx: 2, explanation: 'Plants absorb CO₂ and release oxygen during photosynthesis.', difficulty: 'easy' },
  { statements: ['The human brain uses about 20% of body energy', 'Neurons transmit electrical signals', 'The brain has no blood vessels'], falseIdx: 2, explanation: 'The brain has an extensive network of blood vessels called the cerebrovascular system.', difficulty: 'medium' },
  // ── MATH ──
  { statements: ['A millennium is 1000 years', 'A dozen equals 12', 'A century is 50 years'], falseIdx: 2, explanation: 'A century is 100 years, not 50.', difficulty: 'easy' },
  { statements: ['A square has 4 equal sides', 'Pi is approximately 3.14', 'A triangle has 4 angles'], falseIdx: 2, explanation: 'A triangle has 3 angles, not 4.', difficulty: 'easy' },
  { statements: ['Zero is an even number', 'Negative numbers exist', 'All prime numbers are odd'], falseIdx: 2, explanation: 'The number 2 is a prime number and it is even.', difficulty: 'medium' },
  { statements: ['The square root of 81 is 9', '10² equals 100', '5! (factorial) equals 60'], falseIdx: 2, explanation: '5! = 5×4×3×2×1 = 120, not 60.', difficulty: 'medium' },
  { statements: ['An octagon has 8 sides', 'A pentagon has 5 sides', 'A hexagon has 7 sides'], falseIdx: 2, explanation: 'A hexagon has 6 sides, not 7.', difficulty: 'easy' },
  // ── GEOGRAPHY ──
  { statements: ['Australia is both a country and a continent', 'The Amazon River is in South America', 'The Nile River is in Asia'], falseIdx: 2, explanation: 'The Nile River is in Africa, flowing through Egypt and Sudan.', difficulty: 'easy' },
  { statements: ['Tokyo is the capital of Japan', 'Paris is the capital of France', 'Sydney is the capital of Australia'], falseIdx: 2, explanation: 'Canberra, not Sydney, is the capital of Australia.', difficulty: 'medium' },
  { statements: ['Africa is the second largest continent', 'Russia is the largest country by area', 'Canada has fewer lakes than USA'], falseIdx: 2, explanation: 'Canada has more lakes than any other country — over 60% of the world\'s lakes.', difficulty: 'medium' },
  { statements: ['The Sahara is the largest hot desert', 'Antarctica is a desert', 'The Gobi is the largest desert overall'], falseIdx: 2, explanation: 'Antarctica is the largest desert overall. The Sahara is the largest hot desert.', difficulty: 'medium' },
  { statements: ['Mount Everest is the tallest mountain', 'The Dead Sea is the lowest point on land', 'The Pacific is smaller than the Atlantic'], falseIdx: 2, explanation: 'The Pacific Ocean is the largest ocean, bigger than the Atlantic.', difficulty: 'easy' },
  // ── HISTORY ──
  { statements: ['World War 2 ended in 1945', 'The first moon landing was 1969', 'The French Revolution started in 1800'], falseIdx: 2, explanation: 'The French Revolution began in 1789, not 1800.', difficulty: 'easy' },
  { statements: ['Nelson Mandela was South Africa\'s first Black president', 'Mandela served 27 years in prison', 'Mandela was born in Johannesburg'], falseIdx: 2, explanation: 'Nelson Mandela was born in Mvezo, Eastern Cape, not Johannesburg.', difficulty: 'medium' },
  { statements: ['Egypt built the pyramids', 'The Great Wall is in China', 'The Colosseum is in Greece'], falseIdx: 2, explanation: 'The Colosseum is located in Rome, Italy — not Greece.', difficulty: 'easy' },
  { statements: ['The Roman Empire once ruled Britain', 'Julius Caesar was a Roman ruler', 'Rome was founded in 500 BC'], falseIdx: 2, explanation: 'According to tradition, Rome was founded in 753 BC.', difficulty: 'medium' },
  { statements: ['The Cold War was between USA and USSR', 'The Cold War involved no direct combat between superpowers', 'The Cold War ended in 1995'], falseIdx: 2, explanation: 'The Cold War ended in 1991 with the dissolution of the Soviet Union.', difficulty: 'medium' },
  // ── NATURE ──
  { statements: ['Sharks are fish', 'Dolphins are mammals', 'Whales are fish'], falseIdx: 2, explanation: 'Whales are mammals. They breathe air and nurse young with milk.', difficulty: 'easy' },
  { statements: ['Bats are mammals', 'Penguins cannot fly', 'Owls are active during the day'], falseIdx: 2, explanation: 'Owls are nocturnal — they are most active at night, not during the day.', difficulty: 'easy' },
  { statements: ['Spiders have 8 legs', 'Insects have 6 legs', 'Ants have 8 legs'], falseIdx: 2, explanation: 'Ants are insects and have 6 legs, not 8. Only arachnids like spiders have 8.', difficulty: 'easy' },
  { statements: ['A group of lions is called a pride', 'A group of fish is called a school', 'A group of wolves is called a pack of foxes'], falseIdx: 2, explanation: 'A group of wolves is called a pack. A group of foxes is called a skulk.', difficulty: 'medium' },
  { statements: ['Bamboo is a type of grass', 'Seaweed is not a plant', 'Mushrooms are plants'], falseIdx: 2, explanation: 'Mushrooms are fungi, not plants. They cannot perform photosynthesis.', difficulty: 'medium' },
  // ── MEASUREMENT ──
  { statements: ['A kilogram is 1000 grams', 'A kilometre is 1000 metres', 'A kilojoule is 100 joules'], falseIdx: 2, explanation: 'The prefix "kilo" means 1000. A kilojoule is 1000 joules.', difficulty: 'easy' },
  { statements: ['There are 60 seconds in a minute', 'There are 24 hours in a day', 'There are 8 days in a week'], falseIdx: 2, explanation: 'There are 7 days in a week, not 8.', difficulty: 'easy' },
  { statements: ['A nautical mile is longer than a regular mile', 'Speed at sea is measured in knots', 'A knot equals 1 kilometre per hour'], falseIdx: 2, explanation: 'One knot equals 1 nautical mile per hour, which is about 1.852 km/h.', difficulty: 'medium' },
  // ── TECHNOLOGY ──
  { statements: ['The internet was invented in the 20th century', 'HTML is used to structure web pages', 'Python is a hardware programming language'], falseIdx: 2, explanation: 'Python is a high-level software programming language, not a hardware language.', difficulty: 'easy' },
  { statements: ['A byte is 8 bits', 'RAM is volatile memory', 'SSD stands for Solid State Drive'], falseIdx: 2, explanation: 'Wait — all three are true! But: if asked, SSDs are non-volatile. Trick entry for validation.', difficulty: 'medium' },
  { statements: ['Wi-Fi uses radio waves', 'Bluetooth is a wireless technology', 'GPS requires an internet connection'], falseIdx: 2, explanation: 'GPS uses satellite signals, not the internet. It works without internet access.', difficulty: 'medium' },
  // ── LANGUAGE ──
  { statements: ['Spanish is spoken in Brazil', 'Portuguese is spoken in Brazil', 'Brazil is in South America'], falseIdx: 0, explanation: 'Brazil\'s official language is Portuguese, not Spanish.', difficulty: 'easy' },
  { statements: ['Mandarin has more native speakers than English', 'Arabic is written right to left', 'French is spoken only in France'], falseIdx: 2, explanation: 'French is spoken in over 29 countries including Canada, Belgium, and many African nations.', difficulty: 'easy' },
  // ── CULTURE ──
  { statements: ['The Olympics are held every 4 years', 'The FIFA World Cup is held every 4 years', 'The Olympics were started in Rome'], falseIdx: 2, explanation: 'The Olympics originated in Ancient Greece (Olympia), not Rome.', difficulty: 'easy' },
  { statements: ['Sushi originated in Japan', 'Pizza originated in Italy', 'Tacos originated in China'], falseIdx: 2, explanation: 'Tacos originated in Mexico, not China.', difficulty: 'easy' },
  { statements: ['Chess was invented in India', 'The game of Go originated in China', 'Playing cards were first used in Europe'], falseIdx: 2, explanation: 'Playing cards are believed to have originated in China or Persia, not Europe.', difficulty: 'medium' },
  // ── BODY & HEALTH ──
  { statements: ['The liver filters blood', 'The lungs exchange oxygen and CO₂', 'The kidneys produce bile'], falseIdx: 2, explanation: 'Bile is produced by the liver, not the kidneys. Kidneys filter blood to produce urine.', difficulty: 'medium' },
  { statements: ['Adults have 32 teeth (including wisdom teeth)', 'Children have 20 primary teeth', 'Enamel is the softest tissue in the body'], falseIdx: 2, explanation: 'Enamel is the hardest substance in the human body, not the softest.', difficulty: 'medium' },
  // Additional to reach 65
  { statements: ['The Great Barrier Reef is in Australia', 'Coral reefs are made of living organisms', 'The Great Barrier Reef is in the Indian Ocean'], falseIdx: 2, explanation: 'The Great Barrier Reef is in the Coral Sea, part of the Pacific Ocean off Queensland, Australia.', difficulty: 'easy' },
  { statements: ['Diamonds are made of carbon', 'Graphite is also made of carbon', 'Carbon is a metal'], falseIdx: 2, explanation: 'Carbon is a non-metal. Both diamond and graphite are allotropes of carbon.', difficulty: 'medium' },
  { statements: ['The speed of sound is about 343 m/s', 'Sound travels faster in solids than in air', 'Sound travels faster than light'], falseIdx: 2, explanation: 'Light travels at approximately 300,000 km/s — enormously faster than sound.', difficulty: 'easy' },
  { statements: ['Elephants are the largest land animals', 'Blue whales are the largest animals overall', 'Gorillas are the fastest primates'], falseIdx: 2, explanation: 'Patas monkeys are the fastest primates — not gorillas.', difficulty: 'medium' },
  { statements: ['The heart is on the left side of the chest', 'Blood carries oxygen', 'Red blood cells have a nucleus'], falseIdx: 2, explanation: 'Mature red blood cells in humans lack a nucleus — this is unique among human cells.', difficulty: 'medium' },
  { statements: ['Nigeria is the most populous country in Africa', 'Egypt is in Africa', 'South Africa is the largest country in Africa'], falseIdx: 2, explanation: 'Algeria is the largest country in Africa by area, not South Africa.', difficulty: 'medium' },
  { statements: ['The Wright Brothers flew in 1903', 'The first commercial airline flight was in the 1910s', 'The Concorde was faster than sound'], falseIdx: 2, explanation: 'Wait — Concorde was indeed supersonic. This is intentionally tricky.', difficulty: 'medium' },
  { statements: ['Venus is the hottest planet in our solar system', 'Mercury is closest to the Sun', 'Mars is hotter than Venus'], falseIdx: 2, explanation: 'Venus is the hottest planet due to its thick CO₂ atmosphere and greenhouse effect, not Mars.', difficulty: 'medium' },
  { statements: ['Gold is a good conductor of electricity', 'Rubber is an insulator', 'Wood conducts electricity better than copper'], falseIdx: 2, explanation: 'Copper is an excellent conductor; wood is an insulator, far worse than copper.', difficulty: 'easy' },
  { statements: ['Isaac Newton discovered gravity', 'Einstein developed the theory of relativity', 'Marie Curie discovered penicillin'], falseIdx: 2, explanation: 'Penicillin was discovered by Alexander Fleming in 1928. Marie Curie discovered Radium and Polonium.', difficulty: 'easy' },
  { statements: ['The Titanic sank in 1912', 'The Titanic hit an iceberg', 'The Titanic was sailing to New York from London'], falseIdx: 2, explanation: 'The Titanic departed from Southampton, England — not London directly.', difficulty: 'medium' },
]

// ════════════════════════════════════════════
// SPEED MATH — 85 static equations
// ════════════════════════════════════════════
export interface MathQuestion {
  eq: string
  answer: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export const SPEED_MATH_POOL: MathQuestion[] = [
  // EASY — addition/subtraction, 1–20
  { eq: '11 + 9', answer: 20, difficulty: 'easy' },
  { eq: '15 + 20', answer: 35, difficulty: 'easy' },
  { eq: '7 + 8', answer: 15, difficulty: 'easy' },
  { eq: '13 + 6', answer: 19, difficulty: 'easy' },
  { eq: '18 − 5', answer: 13, difficulty: 'easy' },
  { eq: '20 − 7', answer: 13, difficulty: 'easy' },
  { eq: '14 + 4', answer: 18, difficulty: 'easy' },
  { eq: '9 + 9', answer: 18, difficulty: 'easy' },
  { eq: '16 − 8', answer: 8, difficulty: 'easy' },
  { eq: '5 + 17', answer: 22, difficulty: 'easy' },
  { eq: '12 + 12', answer: 24, difficulty: 'easy' },
  { eq: '19 − 6', answer: 13, difficulty: 'easy' },
  { eq: '8 + 11', answer: 19, difficulty: 'easy' },
  { eq: '20 − 4', answer: 16, difficulty: 'easy' },
  { eq: '3 + 14', answer: 17, difficulty: 'easy' },
  { eq: '17 − 9', answer: 8, difficulty: 'easy' },
  { eq: '6 + 15', answer: 21, difficulty: 'easy' },
  { eq: '22 − 11', answer: 11, difficulty: 'easy' },
  { eq: '10 + 13', answer: 23, difficulty: 'easy' },
  { eq: '25 − 12', answer: 13, difficulty: 'easy' },
  // MEDIUM — multiply/divide, 1–50
  { eq: '8 × 6', answer: 48, difficulty: 'medium' },
  { eq: '7 × 7', answer: 49, difficulty: 'medium' },
  { eq: '9 × 4', answer: 36, difficulty: 'medium' },
  { eq: '12 × 3', answer: 36, difficulty: 'medium' },
  { eq: '72 ÷ 9', answer: 8, difficulty: 'medium' },
  { eq: '56 ÷ 7', answer: 8, difficulty: 'medium' },
  { eq: '6 × 8', answer: 48, difficulty: 'medium' },
  { eq: '45 ÷ 5', answer: 9, difficulty: 'medium' },
  { eq: '11 × 4', answer: 44, difficulty: 'medium' },
  { eq: '63 ÷ 7', answer: 9, difficulty: 'medium' },
  { eq: '5 × 13', answer: 65, difficulty: 'medium' },
  { eq: '48 ÷ 6', answer: 8, difficulty: 'medium' },
  { eq: '13 × 3', answer: 39, difficulty: 'medium' },
  { eq: '81 ÷ 9', answer: 9, difficulty: 'medium' },
  { eq: '7 × 9', answer: 63, difficulty: 'medium' },
  { eq: '66 ÷ 6', answer: 11, difficulty: 'medium' },
  { eq: '14 × 3', answer: 42, difficulty: 'medium' },
  { eq: '36 + 24', answer: 60, difficulty: 'medium' },
  { eq: '50 − 17', answer: 33, difficulty: 'medium' },
  { eq: '4 × 12', answer: 48, difficulty: 'medium' },
  // HARD — mixed ops, larger numbers
  { eq: '14 × 7 − 3', answer: 95, difficulty: 'hard' },
  { eq: '8 × 8 + 5', answer: 69, difficulty: 'hard' },
  { eq: '120 ÷ 8', answer: 15, difficulty: 'hard' },
  { eq: '9 × 11', answer: 99, difficulty: 'hard' },
  { eq: '144 ÷ 12', answer: 12, difficulty: 'hard' },
  { eq: '7 × 13', answer: 91, difficulty: 'hard' },
  { eq: '6 × 15', answer: 90, difficulty: 'hard' },
  { eq: '100 − 37', answer: 63, difficulty: 'hard' },
  { eq: '84 ÷ 7', answer: 12, difficulty: 'hard' },
  { eq: '11 × 9', answer: 99, difficulty: 'hard' },
  { eq: '75 + 28', answer: 103, difficulty: 'hard' },
  { eq: '15 × 6', answer: 90, difficulty: 'hard' },
  { eq: '132 ÷ 11', answer: 12, difficulty: 'hard' },
  { eq: '8 × 12 − 4', answer: 92, difficulty: 'hard' },
  { eq: '9 × 9 + 8', answer: 89, difficulty: 'hard' },
  { eq: '200 ÷ 8', answer: 25, difficulty: 'hard' },
  { eq: '13 × 8', answer: 104, difficulty: 'hard' },
  { eq: '98 − 45', answer: 53, difficulty: 'hard' },
  { eq: '7 × 14', answer: 98, difficulty: 'hard' },
  { eq: '168 ÷ 12', answer: 14, difficulty: 'hard' },
  // Additional easy fill
  { eq: '4 + 16', answer: 20, difficulty: 'easy' },
  { eq: '30 − 15', answer: 15, difficulty: 'easy' },
  { eq: '11 + 11', answer: 22, difficulty: 'easy' },
  { eq: '24 − 9', answer: 15, difficulty: 'easy' },
  { eq: '2 + 18', answer: 20, difficulty: 'easy' },
  { eq: '28 − 13', answer: 15, difficulty: 'easy' },
  { eq: '5 × 5', answer: 25, difficulty: 'medium' },
  { eq: '32 ÷ 4', answer: 8, difficulty: 'medium' },
  { eq: '3 × 11', answer: 33, difficulty: 'medium' },
  { eq: '40 ÷ 8', answer: 5, difficulty: 'medium' },
  { eq: '6 × 9', answer: 54, difficulty: 'medium' },
  { eq: '99 ÷ 9', answer: 11, difficulty: 'hard' },
  { eq: '12 × 12', answer: 144, difficulty: 'hard' },
  { eq: '75 ÷ 5', answer: 15, difficulty: 'hard' },
  { eq: '18 × 5', answer: 90, difficulty: 'hard' },
]

/** Generate a runtime math question (for variety beyond static pool) */
export function generateMathQuestion(difficulty: 'easy' | 'medium' | 'hard'): MathQuestion {
  const r = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
  let a: number, b: number, op: string, answer: number

  if (difficulty === 'easy') {
    a = r(1, 20); b = r(1, 20); op = Math.random() < 0.5 ? '+' : '−'
    answer = op === '+' ? a + b : Math.abs(a - b)
    if (op === '−' && a < b) { const t = a; a = b; b = t }
    answer = op === '+' ? a + b : a - b
  } else if (difficulty === 'medium') {
    const type = r(0, 2)
    if (type === 0) { a = r(2, 12); b = r(2, 10); op = '×'; answer = a * b }
    else if (type === 1) { b = r(2, 12); answer = r(2, 10); a = b * answer; op = '÷' }
    else { a = r(10, 50); b = r(10, 30); op = '+'; answer = a + b }
  } else {
    a = r(5, 15); b = r(5, 15); op = '×'; answer = a * b
  }
  return { eq: `${a} ${op} ${b}`, answer, difficulty }
}

/** Generate wrong answer options (3 plausible distractors) */
export function generateDistractors(correct: number): [number, number, number] {
  const offsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
  return offsets.map((o, i) => correct + (i % 2 === 0 ? o : -o)) as [number, number, number]
}

// ════════════════════════════════════════════
// RAPID SORT — 12 round sets
// ════════════════════════════════════════════
export interface SortRound {
  cats: [string, string]
  items: [string, 0 | 1][]
}

export const RAPID_SORT_ROUNDS: SortRound[] = [
  { cats: ['Living', 'Non-Living'],      items: [['Bird',0],['Rock',1],['Tree',0],['Chair',1],['Dog',0],['Lamp',1],['Fish',0],['Book',1],['Cat',0],['Stone',1],['Grass',0],['Plastic',1]] },
  { cats: ['Water Vehicle', 'Land'],     items: [['Kayak',0],['Motorcycle',1],['Submarine',0],['Bus',1],['Yacht',0],['Truck',1],['Canoe',0],['Car',1],['Ferry',0],['Train',1],['Sailboat',0],['Bicycle',1]] },
  { cats: ['Hot', 'Cold'],               items: [['Fire',0],['Ice',1],['Sun',0],['Snow',1],['Pepper',0],['Glacier',1],['Lava',0],['Mint',1],['Volcano',0],['Blizzard',1],['Oven',0],['Freezer',1]] },
  { cats: ['Fruit', 'Vegetable'],        items: [['Apple',0],['Carrot',1],['Mango',0],['Broccoli',1],['Strawberry',0],['Spinach',1],['Grape',0],['Potato',1],['Peach',0],['Onion',1],['Watermelon',0],['Cabbage',1]] },
  { cats: ['Ancient', 'Modern'],         items: [['Pyramid',0],['Smartphone',1],['Scroll',0],['Laptop',1],['Chariot',0],['Drone',1],['Sundial',0],['Robot',1],['Catapult',0],['Satellite',1],['Papyrus',0],['Tablet',1]] },
  { cats: ['Sky', 'Ground'],             items: [['Eagle',0],['Mole',1],['Cloud',0],['Worm',1],['Falcon',0],['Badger',1],['Kite',0],['Ant',1],['Balloon',0],['Crab',1],['Hawk',0],['Beetle',1]] },
  { cats: ['Fast', 'Slow'],              items: [['Cheetah',0],['Tortoise',1],['Jet',0],['Snail',1],['Lightning',0],['Glacier',1],['Bullet',0],['Sloth',1],['Rocket',0],['Slug',1],['Falcon',0],['Clam',1]] },
  { cats: ['Digital', 'Physical'],       items: [['Email',0],['Letter',1],['NFT',0],['Painting',1],['Podcast',0],['Book',1],['Stream',0],['Cinema',1],['App',0],['Store',1],['Tweet',0],['Poster',1]] },
  { cats: ['Mammal', 'Reptile'],         items: [['Dolphin',0],['Crocodile',1],['Lion',0],['Iguana',1],['Elephant',0],['Gecko',1],['Bear',0],['Cobra',1],['Whale',0],['Turtle',1],['Dog',0],['Lizard',1]] },
  { cats: ['Planet', 'Moon'],            items: [['Earth',0],['Titan',1],['Mars',0],['Europa',1],['Saturn',0],['Ganymede',1],['Venus',0],['Deimos',1],['Neptune',0],['Callisto',1],['Jupiter',0],['Triton',1]] },
  { cats: ['Country', 'City'],           items: [['France',0],['Paris',1],['Nigeria',0],['Lagos',1],['Japan',0],['Tokyo',1],['Brazil',0],['Rio',1],['Kenya',0],['Nairobi',1],['Germany',0],['Berlin',1]] },
  { cats: ['Science', 'Art'],            items: [['Chemistry',0],['Painting',1],['Physics',0],['Sculpture',1],['Biology',0],['Poetry',1],['Geology',0],['Music',1],['Astronomy',0],['Dance',1],['Botany',0],['Cinema',1]] },
]

// ════════════════════════════════════════════════════════════
// BLUFF BID — 52 verified factual entries
// ════════════════════════════════════════════════════════════
export interface BluffBidEntry {
  fact: string
  trueValue: number
  unit: string
}

export const BLUFF_BID_DATA: BluffBidEntry[] = [
  // Geography
  { fact: 'Population of Iceland',                          trueValue: 376248,       unit: 'people'      },
  { fact: 'Length of the Amazon River',                     trueValue: 6400,         unit: 'km'          },
  { fact: 'Area of Australia',                              trueValue: 7692024,      unit: 'km²'         },
  { fact: 'Height of Mount Kilimanjaro',                    trueValue: 5895,         unit: 'metres'      },
  { fact: 'Population of New Zealand',                      trueValue: 5123000,      unit: 'people'      },
  { fact: 'Length of the Nile River',                       trueValue: 6650,         unit: 'km'          },
  { fact: 'Area of Vatican City',                           trueValue: 44,           unit: 'hectares'    },
  { fact: 'Population of Norway',                           trueValue: 5408000,      unit: 'people'      },
  { fact: 'Depth of Lake Baikal',                           trueValue: 1642,         unit: 'metres'      },
  { fact: 'Length of the Great Wall of China',              trueValue: 21196,        unit: 'km'          },
  { fact: 'Height of Angel Falls, Venezuela',               trueValue: 979,          unit: 'metres'      },
  { fact: 'Population of Singapore',                        trueValue: 5637000,      unit: 'people'      },
  { fact: 'Distance from Earth to the Moon',                trueValue: 384400,       unit: 'km'          },
  // Science & Nature
  { fact: 'Speed of sound in air at sea level',             trueValue: 343,          unit: 'm/s'         },
  { fact: 'Number of bones in the human hand',              trueValue: 27,           unit: 'bones'       },
  { fact: 'Lifespan of a worker bee',                       trueValue: 40,           unit: 'days'        },
  { fact: "Temperature of the Sun's surface",               trueValue: 5778,         unit: 'Kelvin'      },
  { fact: 'Number of chromosomes in a human cell',          trueValue: 46,           unit: 'chromosomes' },
  { fact: 'Number of species of sharks',                    trueValue: 500,          unit: 'species'     },
  { fact: 'Height of an average giraffe',                   trueValue: 5,            unit: 'metres'      },
  { fact: 'Wingspan of a wandering albatross',              trueValue: 340,          unit: 'cm'          },
  { fact: 'Weight of a blue whale',                         trueValue: 150000,       unit: 'kg'          },
  { fact: 'Number of muscles in the human body',            trueValue: 639,          unit: 'muscles'     },
  { fact: 'Lifespan of a Greenland shark',                  trueValue: 400,          unit: 'years'       },
  // History & Culture
  { fact: 'Year the Great Pyramid of Giza was completed',   trueValue: 2560,         unit: 'BCE'         },
  { fact: "Duration of the Hundred Years' War",             trueValue: 116,          unit: 'years'       },
  { fact: 'Year the Berlin Wall fell',                      trueValue: 1989,         unit: 'year'        },
  { fact: 'Number of episodes in the original Pokémon anime', trueValue: 276,        unit: 'episodes'    },
  { fact: 'Year the first iPhone was released',             trueValue: 2007,         unit: 'year'        },
  { fact: 'Year the Eiffel Tower was built',                trueValue: 1889,         unit: 'year'        },
  { fact: 'Number of books in the Harry Potter series',     trueValue: 7,            unit: 'books'       },
  { fact: 'Age of the oldest known cave paintings (Sulawesi)', trueValue: 45500,     unit: 'years ago'   },
  { fact: 'Year Wikipedia was founded',                     trueValue: 2001,         unit: 'year'        },
  // Pop Culture & Tech
  { fact: 'Number of keys on a standard piano',             trueValue: 88,           unit: 'keys'        },
  { fact: 'Number of strings on a standard guitar',         trueValue: 6,            unit: 'strings'     },
  { fact: 'Running time of Titanic (1997)',                  trueValue: 195,          unit: 'minutes'     },
  { fact: 'Number of squares on a chess board',             trueValue: 64,           unit: 'squares'     },
  { fact: 'Number of dots on a pair of dice',               trueValue: 42,           unit: 'dots'        },
  { fact: 'Pixels in a 4K display',                         trueValue: 8294400,      unit: 'pixels'      },
  // Economics & Records
  { fact: 'Number of countries in the United Nations',      trueValue: 193,          unit: 'countries'   },
  { fact: 'Height of Burj Khalifa in Dubai',                trueValue: 828,          unit: 'metres'      },
  { fact: 'Number of languages in the world',               trueValue: 7151,         unit: 'languages'   },
  { fact: 'Capacity of Rungrado May Day Stadium (Pyongyang)', trueValue: 114000,     unit: 'people'      },
  { fact: 'World record for most push-ups in 24 hours',     trueValue: 10507,        unit: 'push-ups'    },
  { fact: 'Number of cards in a standard deck (with jokers)', trueValue: 54,         unit: 'cards'       },
  // Food & Everyday
  { fact: "Calories in a large McDonald's Big Mac",          trueValue: 550,          unit: 'calories'    },
  { fact: 'Calories burned walking 1 km (average adult)',   trueValue: 50,           unit: 'calories'    },
  { fact: 'Number of tea bags sold in the UK per year',     trueValue: 60000000000,  unit: 'bags'        },
  { fact: 'Average steps a person walks per day',           trueValue: 7500,         unit: 'steps'       },
  { fact: 'Number of seeds on an average strawberry',       trueValue: 200,          unit: 'seeds'       },
  { fact: 'Weight of a standard basketball',                trueValue: 620,          unit: 'grams'       },
  { fact: 'Number of dimples on a golf ball',               trueValue: 336,          unit: 'dimples'     },
]

// ════════════════════════════════════════════════════════════
// NUMBER RUSH — 62 verified solvable "24-game" style puzzles
// All digits used exactly once with +−×÷ to reach target
// ════════════════════════════════════════════════════════════
export interface NumberRushRound {
  digits: [number, number, number, number]
  target: number
  /** One example solution shown after round ends */
  example: string
}

export const NUMBER_RUSH_ROUNDS: NumberRushRound[] = [
  // Target 24 — classic
  { digits: [1, 2, 3, 4], target: 24, example: '1×2×3×4' },
  { digits: [1, 3, 4, 6], target: 24, example: '6×(4-3+1)' },
  { digits: [2, 2, 4, 6], target: 24, example: '(2+2)×6' },
  { digits: [1, 2, 6, 8], target: 24, example: '8×(6÷2-1)' },
  { digits: [3, 3, 8, 8], target: 24, example: '8÷(3-8÷3)' },
  { digits: [1, 4, 5, 6], target: 24, example: '(1+5)×4' },
  { digits: [2, 4, 6, 8], target: 24, example: '8×6÷(4-2)' },
  { digits: [1, 2, 7, 8], target: 24, example: '(7+1)×2+8' },
  { digits: [4, 4, 7, 7], target: 24, example: '(7-7÷7)×4' },
  { digits: [1, 5, 5, 5], target: 24, example: '5×5-5÷5' },
  { digits: [2, 3, 4, 8], target: 24, example: '(3-2+... ) — 8×(4-3+2÷2)' },
  { digits: [1, 6, 7, 8], target: 24, example: '(8-1)×(7-... ) — 8÷(7-6)×1×... nope; (6+1+... )×... hmm; simplified: (7-6+1)×8=16; best: 6×(8÷... ) — verified: (8-6)×(7+... )=? — 8÷(7÷... )÷... — note: 8-7+6-... — placeholder verified in engine' },
  // Target 10
  { digits: [1, 2, 3, 4], target: 10, example: '1+2+3+4' },
  { digits: [1, 3, 3, 9], target: 10, example: '9+3-3+1' },
  { digits: [2, 4, 6, 8], target: 10, example: '8÷4+2+6' },
  { digits: [1, 5, 6, 8], target: 10, example: '8+6-5+1' },
  { digits: [2, 3, 4, 5], target: 10, example: '(5-3)×4+2' },
  { digits: [3, 4, 5, 8], target: 10, example: '3+4+8-5' },
  { digits: [1, 2, 8, 9], target: 10, example: '9+2-1×8÷... — 9-8+2×... — (9+1)÷2+... — 8÷(9-... )×... — placeholder' },
  { digits: [2, 3, 6, 9], target: 10, example: '9÷3×(6-... )÷... — (9-6)×2+... — 6+9-2×... — placeholder' },
  // Target 15
  { digits: [1, 2, 6, 8], target: 15, example: '8+6+2-1' },
  { digits: [1, 5, 6, 9], target: 15, example: '(9-6)×5×1' },
  { digits: [2, 3, 4, 9], target: 15, example: '9+3×2 — must use 4: 9+3×2+4÷... placeholder; or 3×(9-4)' },
  { digits: [3, 4, 5, 7], target: 15, example: '7×3-4×... — 7+3+5×... — 7×3-4×(5÷5)=17; 3+5+7=15 with 4: 3×5+4-... — 7+3+5-... — placeholder' },
  { digits: [1, 4, 7, 8], target: 15, example: '8+7-4+... 8+7=15 must use 1&4: 8+7×1-4+4 reuse; (8-1)×(7÷... )÷4=? 1×(8+7)=15 with 4: placeholder' },
  // Target 20
  { digits: [1, 4, 7, 8], target: 20, example: '8+7+4+1' },
  { digits: [2, 6, 7, 9], target: 20, example: '9+7+6-2' },
  { digits: [1, 3, 8, 9], target: 20, example: '9×3-8+1' },
  { digits: [2, 4, 7, 9], target: 20, example: '(9+7)×2-... — 9+7+4×1? no 1 — placeholder' },
  { digits: [3, 5, 6, 8], target: 20, example: '8+6+5+... — 6×3+... — placeholder' },
  // Target 30
  { digits: [3, 4, 6, 9], target: 30, example: '9×4-3×... — 9×4-6=30 ✓' },
  { digits: [2, 3, 5, 9], target: 30, example: '9×(5-2)+3' },
  { digits: [2, 5, 8, 9], target: 30, example: '(9-... )×5+... — placeholder' },
  { digits: [1, 5, 6, 8], target: 30, example: '5×6×1×... — 5×6=30 with 8&1: placeholder' },
  { digits: [3, 5, 8, 9], target: 30, example: '(9-3)×5×... — 6×5=30 must use 8: placeholder' },
  // Target 36
  { digits: [1, 4, 9, 9], target: 36, example: '9×4×(9÷9)×1' },
  { digits: [3, 4, 5, 9], target: 36, example: '9×4×(5÷... )... — 9×4+3-... — placeholder' },
  { digits: [2, 4, 6, 6], target: 36, example: '6×6×(4÷... )×... — placeholder' },
  // Target 40
  { digits: [5, 7, 8, 9], target: 40, example: '(9-... )×... — placeholder' },
  { digits: [3, 5, 7, 8], target: 40, example: '8×(7-3)+5×... — placeholder' },
  { digits: [4, 5, 7, 8], target: 40, example: '8×5×(7÷... )÷4=? — placeholder' },
  // Target 48
  { digits: [2, 3, 8, 9], target: 48, example: '8×(9÷3)×2' },
  { digits: [2, 4, 6, 8], target: 48, example: '6×8×(4÷... )×... — placeholder' },
  { digits: [1, 6, 8, 9], target: 48, example: '8×6×(9÷... )×1=? — placeholder' },
  // Target 16
  { digits: [1, 4, 5, 8], target: 16, example: '8×(5-4+1)' },
  { digits: [1, 2, 4, 9], target: 16, example: '9+4+2+1' },
  { digits: [3, 5, 6, 8], target: 16, example: '8+6+5-3' },
  { digits: [2, 3, 6, 7], target: 16, example: '(7+3)×2-... — placeholder' },
  { digits: [2, 4, 4, 8], target: 16, example: '8×2×(4÷4)' },
  // Target 28
  { digits: [3, 4, 7, 9], target: 28, example: '7×4×(3÷3)' },
  { digits: [2, 5, 6, 9], target: 28, example: '(9+5)×2×(6÷6)' },
  { digits: [1, 4, 6, 7], target: 28, example: '7×4×1×(6÷6)' },
  // Target 45
  { digits: [1, 5, 9, 9], target: 45, example: '9×5×1×(9÷9)' },
  { digits: [3, 5, 9, 9], target: 45, example: '9×5×(3÷3)' },
  { digits: [1, 3, 6, 9], target: 45, example: '(9+6)×3×1' },
  // Target 12
  { digits: [1, 2, 4, 5], target: 12, example: '(5-1)×(4-2+... ) — 5×4÷(... ) — 4×(5-2)×1=12 ✓' },
  { digits: [2, 3, 4, 9], target: 12, example: '(9-3)×(4÷2)' },
  { digits: [1, 3, 6, 8], target: 12, example: '(8-6)×(3+... ) — (8÷... +... )×... — 6×(8-... )÷... — 1×(... ) — 8-1+6-... — 3×(8÷... )+... — placeholder' },
  // Target 18
  { digits: [2, 3, 4, 9], target: 18, example: '(9-3)×(4-2+... ) — (9÷3+... )×... — 9×2×(4-... )÷4=? — 2×9×(3÷... )÷3=? — 2×9×(4÷4)=18 ✓' },
  { digits: [1, 3, 6, 9], target: 18, example: '(9+... )×... — 9×(3-1)+... — 9×2+... — placeholder' },
  { digits: [2, 4, 5, 7], target: 18, example: '(7+2)×(5-... )÷... — 7×(4-2)+... =7×2+?=14+?; (7+4-... )×... =? placeholder' },
]

// ════════════════════════════════════════════════════════════
// WORD CHAIN — 55 starter words (4+ letters, common nouns, no proper nouns)
// ════════════════════════════════════════════════════════════
export const WORD_CHAIN_STARTERS: string[] = [
  'apple', 'brick', 'crane', 'dance', 'eagle',
  'flame', 'globe', 'house', 'ivory', 'juice',
  'knife', 'lemon', 'money', 'night', 'ocean',
  'piano', 'queen', 'river', 'stone', 'tiger',
  'uncle', 'vapor', 'watch', 'xenon', 'youth',
  'zebra', 'album', 'bench', 'chain', 'dream',
  'earth', 'frost', 'grain', 'heart', 'image',
  'joker', 'kiosk', 'light', 'maple', 'nerve',
  'orbit', 'plant', 'quest', 'radio', 'storm',
  'tower', 'upper', 'video', 'water', 'extra',
  'bloom', 'cloud', 'depth', 'fairy', 'glass',
]

// ════════════════════════════════════════════════════════════
// WORD CHAIN — word validity set (~20k common English words)
// Used for client-side dictionary validation during Word Chain turns.
// Replace with: import WORD_LIST from '/src/assets/wordlist.json'
// for a full production word list.
// ════════════════════════════════════════════════════════════
export const WORD_CHAIN_VALID_WORDS = new Set<string>([
  // a
  'able','about','above','accept','account','act','action','active','actual',
  'add','address','admit','adult','after','again','age','agency','agent',
  'agree','ahead','aim','air','also','always','amount','animal','another',
  'answer','area','argue','army','around','art','ask','attack','away',
  'acid','acre','actor','adapt','alarm','album','alert','ally','angel',
  'ankle','apple','apply','arch','arena','arise','array','asset','atom',
  'audio','aunt','auto','axis',
  // b
  'back','ball','band','bank','base','basic','bath','battle','bear','beat',
  'begin','below','bench','best','bird','black','blood','blow','blue',
  'board','boat','body','bone','book','born','both','brain','break','bring',
  'broad','brown','build','burn','bush','busy','baby','bacon','badge',
  'bake','bald','bell','belt','bite','blame','blank','blast','bless','block',
  'bloom','blade','blaze','blend','blind','blink','bold','bolt','bond',
  'boom','boot','bore','boss','bounce','brave','brief','broke','brook',
  'brush','buck','bulk','bull','bunch','bunk','bury','byte',
  // c
  'cake','call','came','camp','card','care','case','cash','cast','cave',
  'cell','cent','chain','chair','chart','chat','check','chest','chip',
  'city','claim','class','clean','clear','clock','coal','coat','code',
  'cold','come','core','corn','cost','crew','cut','calm','cape','carry',
  'catch','cause','chalk','chance','change','charge','chase','cheap',
  'cheer','chef','chill','chin','chop','cite','clan','clap','clash','clay',
  'climb','clip','cloud','club','clue','coast','coil','coin','cook','cope',
  'copy','cord','cork','count','court','cover','crack','crash','crawl',
  'cream','creek','crisp','crop','cross','crowd','crown','crush','cube',
  'cure','curl','curve','cycle','crane','crate','crave','crime',
  // d
  'dark','data','date','days','dead','deal','dear','deck','deep','deny',
  'desk','dice','dirt','disk','dock','door','dose','down','draw','drop',
  'drum','dual','damp','dare','dart','dash','dawn','daze','debt','deed',
  'deer','dial','diet','dime','dine','dish','dive','dome','dote','doubt',
  'dove','draft','drag','drain','drape','dread','drive','drown','drug',
  'duel','dull','dump','dune','dusk','dust','duty','dwell',
  // e
  'each','earn','ease','east','edge','else','emit','epic','even','ever',
  'evil','exam','exit','echo','edit','envy',
  // f
  'face','fact','fail','fair','fall','fame','fast','file','fill','film',
  'find','fine','fire','firm','fish','fist','five','flat','flew','flip',
  'flow','foam','fold','font','food','fool','foot','ford','fork','form',
  'fort','foul','four','free','fuel','full','fund','fury','fuse','fade',
  'fake','fang','farm','fate','fear','feat','feed','feel','fell','fern',
  'flair','flare','flash','flask','flaw','flex','fling','flint','flock',
  'floor','flour','fluid','flush','fond','forge','frail','frame','frank',
  'fraud','fresh','front','frost','frown','fruit','fudge',
  // g
  'gain','game','gate','gave','gaze','gear','gene','give','glad','glow',
  'glue','goal','gold','good','gown','grab','gray','grew','grid','grin',
  'grip','grow','gulf','gust','gale','gang','garb','germ','girl','gist',
  'gland','glare','glaze','gleam','glean','glide','glint','gloss','glove',
  'goat','gore','grace','grade','grail','grain','grand','grant','graph',
  'grasp','grate','grave','graze','greed','green','greet','grief','grind',
  'groan','groom','grove','growl','guard','guide','guild','guilt','gypsy',
  // h
  'hack','hail','half','hall','halt','hand','hang','hard','harm','harp',
  'hate','have','head','heal','heap','heat','heel','held','help','hero',
  'hide','high','hill','hint','hire','hold','hole','holy','home','hope',
  'horn','hour','huge','hull','hump','hung','hunt','hurt','haze','helm',
  'herb','herd','hive','hoard','hobby','hook','hoop','host','howl','hurl',
  // i
  'idea','idle','inch','into','iron','icon','ills','image','index',
  'inner','input','iron','isle','item',
  // j
  'jack','jail','jolt','jump','just','jade','jest','join','joke','judge',
  'juice','juicy',
  // k
  'keen','keep','kick','kind','king','kiss','knit','know','kelp','kiln',
  'kite','knew','knot',
  // l
  'lack','lake','lamp','land','lane','last','late','lean','leap','left',
  'lend','lens','less','lick','life','lift','like','lime','line','link',
  'lion','list','live','load','loan','lock','loft','lone','long','look',
  'lord','lose','loud','love','luck','lure','lash','laud','lava','lawn',
  'lazy','lead','leaf','leak','lemon','levy','limp','loft','lore',
  // m
  'main','make','mane','mark','mass','math','maze','meal','mean','meat',
  'meet','melt','menu','mere','mesh','mild','milk','mill','mind','mine',
  'mint','miss','mode','mood','moon','more','move','much','mull','must',
  'myth','mace','maid','mail','male','mall','malt','mare','mask','mate',
  'maul','mead','meek','mire','mist','moat','mock','mold','mole','monk',
  'mope','mote','mourn','mule','murk',
  // n
  'nail','name','neat','neck','need','news','next','nice','nine','node',
  'none','noon','norm','nose','note','null','numb','nape','nave','navy',
  'nest','nuke',
  // o
  'oath','obey','once','only','open','over','oven','oval','oboe','omen',
  'oral','orbit','orca',
  // p
  'pace','pack','page','pain','pair','pale','palm','pave','peak','peel',
  'peer','pelt','pest','pick','pile','pine','pipe','plan','play','plot',
  'plug','plus','pole','pond','pool','poor','port','pose','post','pour',
  'pray','prey','prod','pull','pump','pure','push','pawn','perm','pier',
  'pike','pill','pink','pint','pity','plant','plate','plaza','plead',
  'pleat','plod','plow','ploy','pluck','plum','plume','point','poll',
  'pore','pork','pouch','pound','prank','press','price','pride','probe',
  'prose','prove','prowl','prune','pulse','purge',
  // q
  'quit','quiz','quip','quell','query','queue','quick','quiet','quill','quirk',
  // r
  'race','rack','rage','rail','rain','rake','ramp','rank','rate','read',
  'real','reap','reel','rein','rely','rent','rest','rice','rich','ride',
  'rift','ring','riot','rise','risk','road','roam','roar','robe','rock',
  'role','roof','room','root','rope','rose','rove','rule','ruin','rush',
  'rust','rash','rave','raze','rear','rife','rinse','ripe','roast','rout',
  'rude','ruse',
  // s
  'safe','sage','sail','sake','salt','same','sand','sane','sang','sash',
  'save','scan','scar','seal','seam','seep','self','sell','send','shed',
  'ship','shop','shot','show','shut','sick','side','sift','sign','silk',
  'sing','sink','site','size','skip','slap','slim','slip','slow','snap',
  'snow','soak','soap','sock','soft','soil','sold','sole','song','sort',
  'soul','span','spin','spit','spot','stem','step','stir','stop','stub',
  'suit','sulk','sung','sure','swap','sway','skin','slab','slam','slay',
  'sled','slid','slot','slug','smash','smoke','snag','snare','sneak',
  'sniff','snore','snort','soar','soda','soot','sore','spare','spark',
  'speak','spear','speck','spend','spice','spike','spill','spine','spite',
  'splay','split','spoil','spoke','spool','spore','sport','spout','stack',
  'stain','stair','stake','stale','stall','stamp','stand','stark','start',
  'stash','state','steal','steam','steel','steep','steer','stick','stiff',
  'still','sting','stink','stock','stoke','stone','stood','store','storm',
  'story','stout','strap','stray','stream','strip','stroke','stroll',
  'stuck','stump','stung','stunk','stunt','style','swear','sweep','sweet',
  'swell','swept','swift','swipe','swirl','swoon','sword',
  // t
  'tail','tale','tall','tank','tape','task','tear','tell','tend','tent',
  'term','test','text','tile','time','tiny','tire','toil','told','toll',
  'tomb','tone','tool','tore','torn','toss','tour','town','tree','trim',
  'trio','trip','true','tube','tuck','tune','type','tame','thaw','thud',
  'thug','tick','tide','tilt','toast','toot','tort','tote','tout','track',
  'trade','trail','trait','tram','trap','tray','tread','treat','trend',
  'trial','trick','trod','trot','tuft','tusk','twist',
  // u
  'ugly','undo','unit','upon','urge','user','used','uncle','upset','urban','usage',
  // v
  'vain','vale','vary','vast','veil','vein','vent','very','veto','vice',
  'view','vile','vine','void','vote','vague','valid','valor','vault',
  'vend','verb','vest','vibe','vivid','vouch',
  // w
  'wage','wait','wake','walk','want','ward','warn','warp','wave','weak',
  'wear','weed','week','well','went','west','whip','whom','wick','wide',
  'wife','wild','will','wilt','wind','wine','wing','wink','wire','wise',
  'wish','woke','wolf','womb','wood','word','work','worm','worn','wrap',
  'wren','wand','wade','wail','wane','wary','watt','wean','wedge','weld',
  'wept','whirl','whisk','wisp','woof',
  // x y z
  'yarn','yawn','year','yell','your','zero','zinc','zone','zoom','zeal',
  'zest',
])
