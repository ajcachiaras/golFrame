/* Kiera Anderson — catalogue.
   A fictional brand: every product, price, review and policy below is invented
   for this demo. Nothing here is for sale and no order can be placed. */
window.KA = window.KA || {};

KA.CATEGORIES = [
  { id: "tops",        label: "Tops" },
  { id: "bottoms",     label: "Bottoms" },
  { id: "dresses",     label: "Dresses & jumpsuits" },
  { id: "knitwear",    label: "Knitwear" },
  { id: "outerwear",   label: "Outerwear" },
  { id: "accessories", label: "Accessories" }
];

KA.AGES = [
  { id: "baby",    label: "Baby",     note: "0–12m" },
  { id: "toddler", label: "Toddler",  note: "1–3y" },
  { id: "kid",     label: "Little",   note: "4–6y" },
  { id: "big",     label: "Big kid",  note: "7–10y" }
];

/* tint = card backdrop, main = fabric, accent = trims */
KA.PRODUCTS = [
  {
    id: "orchard-stripe-tee",
    name: "Orchard Stripe Tee",
    price: 28,
    shape: "g-tee",
    category: "tops",
    ages: ["baby", "toddler", "kid", "big"],
    badge: "new",
    blurb: "A soft, slightly slouchy everyday tee with a neckline that actually goes over a big head.",
    story:
      "We cut this one a touch roomier than most, because the first thing a three-year-old does in a new " +
      "shirt is lift both arms over their head. Garment-washed so it is soft on day one, not day thirty.",
    fabric: "100% organic combed cotton, 165gsm single jersey",
    care: "Machine wash cold, tumble dry low. It will shrink about 2% and then stop.",
    details: [
      "Lap-shoulder neckline on baby sizes, wide rib crew above 2y",
      "Flat-locked side seams so nothing rubs",
      "Grow-with-me hem: one folded inch to let down"
    ],
    colors: [
      { name: "Apple Clay",   main: "#C56A4C", accent: "#F7EDDF", tint: "#F6E6DC" },
      { name: "Orchard Sage", main: "#7D9A74", accent: "#F4F0E2", tint: "#E7EDE2" },
      { name: "Chalk Sky",    main: "#9BC0D4", accent: "#FBF6EF", tint: "#E4EDF3" }
    ],
    sizes: ["0–3m", "3–6m", "6–12m", "1–2y", "2–3y", "3–4y", "5–6y", "7–8y", "9–10y"],
    soldOut: ["3–6m"]
  },
  {
    id: "cord-overalls",
    name: "Cord Overalls",
    price: 58,
    shape: "g-overalls",
    category: "bottoms",
    ages: ["baby", "toddler", "kid"],
    blurb: "Fine-wale corduroy with real brass hardware and knees built for gravel.",
    story:
      "Double-layered at the knee, because that is where every pair of trousers we have ever owned gave up " +
      "first. The straps adjust across four buttons, which is roughly a year of growing.",
    fabric: "98% organic cotton corduroy, 2% elastane",
    care: "Wash inside out, cold. Line dry to keep the wale crisp.",
    details: [
      "Four-position adjustable straps with brass buttons",
      "Reinforced double knees",
      "One deep bib pocket, sized for rocks and acorns"
    ],
    colors: [
      { name: "Field Blue",  main: "#7D8FA8", accent: "#F4EFE4", tint: "#E6EAF0" },
      { name: "Toffee",      main: "#A8773F", accent: "#F7EFE0", tint: "#F0E6D5" }
    ],
    sizes: ["6–12m", "1–2y", "2–3y", "3–4y", "5–6y"],
    soldOut: []
  },
  {
    id: "garden-pinafore",
    name: "Garden Pinafore Dress",
    price: 52,
    shape: "g-pinafore",
    category: "dresses",
    ages: ["toddler", "kid", "big"],
    blurb: "Layer it over a tee in October, wear it bare-armed in June. Pockets, obviously.",
    story:
      "The pinafore is the hardest-working thing in the drawer: one dress, two seasons, no fuss about " +
      "tights. The skirt is cut full enough to sit cross-legged in.",
    fabric: "Mid-weight organic cotton twill, 240gsm",
    care: "Machine wash cold with like colours. Warm iron if you care about that sort of thing.",
    details: [
      "Crossover back straps that will not slip off a shoulder",
      "Two side seam pockets, deep enough to lose a snack in",
      "Hidden side snap for getting it on over a jumper"
    ],
    colors: [
      { name: "Damson",     main: "#8C6E8F", accent: "#F6F0E6", tint: "#EDE5EE" },
      { name: "Moss",       main: "#6F8A66", accent: "#F4F0E2", tint: "#E5EBE0" },
      { name: "Oat",        main: "#C9B08A", accent: "#FBF6EF", tint: "#F2E9DA" }
    ],
    sizes: ["1–2y", "2–3y", "3–4y", "5–6y", "7–8y", "9–10y"],
    soldOut: ["9–10y"]
  },
  {
    id: "hand-knit-cardigan",
    name: "Hand-Knit Cardigan",
    price: 64,
    shape: "g-cardigan",
    category: "knitwear",
    ages: ["baby", "toddler", "kid"],
    badge: "few",
    blurb: "Knitted in small runs by a six-person studio. No two are identical, which is the point.",
    story:
      "Our smallest-batch piece. The yarn is a cotton–merino blend chosen because it does not itch and " +
      "does not pill after four washes, which took us a shamefully long time to get right.",
    fabric: "70% organic cotton, 30% extra-fine merino wool",
    care: "Hand wash cool, dry flat. Reshape while damp.",
    details: [
      "Coconut-shell buttons",
      "Raglan sleeve, so it layers under a coat without bunching",
      "Each piece carries the knitter's initials on the inside label"
    ],
    colors: [
      { name: "Butter",    main: "#EFC75E", accent: "#FBF6EF", tint: "#F7EEDA" },
      { name: "Cloud",     main: "#D9D3C8", accent: "#FBF6EF", tint: "#F1EDE5" }
    ],
    sizes: ["3–6m", "6–12m", "1–2y", "2–3y", "3–4y", "5–6y"],
    soldOut: ["5–6y"]
  },
  {
    id: "play-shorts",
    name: "Everyday Play Shorts",
    price: 26,
    shape: "g-shorts",
    category: "bottoms",
    ages: ["baby", "toddler", "kid", "big"],
    blurb: "A flat-front short on a soft rib waistband. Easy on, easy off, no buttons to fight.",
    story:
      "Designed around one requirement from our test group of four-year-olds: be able to go to the " +
      "bathroom without calling for help.",
    fabric: "Organic cotton canvas, 190gsm, washed soft",
    care: "Machine wash cold, tumble dry low.",
    details: [
      "Covered rib waistband with an internal drawcord above 3y",
      "Two side pockets and one back patch pocket",
      "Hem sits just above the knee"
    ],
    colors: [
      { name: "Sunflower",  main: "#EFC75E", accent: "#FBF6EF", tint: "#F8EFD9" },
      { name: "Pebble",     main: "#9A948A", accent: "#FBF6EF", tint: "#EDEAE4" },
      { name: "Clay",       main: "#C56A4C", accent: "#FBF6EF", tint: "#F6E5DB" }
    ],
    sizes: ["6–12m", "1–2y", "2–3y", "3–4y", "5–6y", "7–8y", "9–10y"],
    soldOut: []
  },
  {
    id: "puddle-raincoat",
    name: "Puddle-Stomp Raincoat",
    price: 72,
    shape: "g-coat",
    category: "outerwear",
    ages: ["toddler", "kid", "big"],
    badge: "new",
    blurb: "Properly waterproof, PFAS-free, and cut long enough to cover the top of a welly.",
    story:
      "We tested this against a garden hose, a Welsh February and one child who deliberately sat down in " +
      "a puddle to check. It passed all three.",
    fabric: "Recycled polyester with a PFAS-free water-repellent finish, 5,000mm",
    care: "Wipe clean or machine wash cold. Do not iron the seam tape.",
    details: [
      "Taped seams and a storm placket over the zip",
      "Lined hood with a soft brushed peak",
      "Reflective trim along the back yoke"
    ],
    colors: [
      { name: "Rain Sky",   main: "#9BC0D4", accent: "#FBF6EF", tint: "#E3EDF3" },
      { name: "Marigold",   main: "#E8A33C", accent: "#FBF6EF", tint: "#F8E8CE" }
    ],
    sizes: ["1–2y", "2–3y", "3–4y", "5–6y", "7–8y", "9–10y"],
    soldOut: []
  },
  {
    id: "acorn-beanie",
    name: "Acorn Beanie",
    price: 22,
    shape: "g-beanie",
    category: "accessories",
    ages: ["baby", "toddler", "kid", "big"],
    blurb: "A ribbed beanie with a pompom that survives being pulled. We checked.",
    story:
      "The brim folds twice, which buys you an extra winter. The pompom is stitched through the crown " +
      "rather than glued on.",
    fabric: "Organic cotton rib with a merino blend lining",
    care: "Hand wash cool, dry flat.",
    details: [
      "Double-fold brim",
      "Hand-stitched pompom",
      "Four head sizes rather than the usual two"
    ],
    colors: [
      { name: "Clay",      main: "#C56A4C", accent: "#F7EDDF", tint: "#F6E6DC" },
      { name: "Moss",      main: "#6F8A66", accent: "#F4F0E2", tint: "#E6ECE1" },
      { name: "Damson",    main: "#8C6E8F", accent: "#F6F0E6", tint: "#EDE5EE" }
    ],
    sizes: ["0–12m", "1–2y", "3–5y", "6–10y"],
    soldOut: []
  },
  {
    id: "wobbly-stripe-socks",
    name: "Wobbly Stripe Socks",
    price: 18,
    shape: "g-socks",
    category: "accessories",
    ages: ["baby", "toddler", "kid", "big"],
    blurb: "Three pairs, one box. Stripes drawn freehand by a seven-year-old called Nora.",
    story:
      "Nora is our founder's niece. She was paid in ice cream and is credited on the packaging, which " +
      "she insists is the better part of the deal.",
    fabric: "78% organic cotton, 20% polyamide, 2% elastane",
    care: "Machine wash warm. Pair them before washing; you know why.",
    details: [
      "Three pairs per box",
      "Reinforced heel and toe",
      "Grip dots on baby sizes"
    ],
    colors: [
      { name: "Mixed Brights", main: "#9BC0D4", accent: "#EFC75E", tint: "#E6EEF3" },
      { name: "Mixed Earth",   main: "#C09A6B", accent: "#C56A4C", tint: "#F1E7D8" }
    ],
    sizes: ["0–12m", "1–2y", "3–5y", "6–10y"],
    soldOut: ["0–12m"]
  },
  {
    id: "campfire-sweatshirt",
    name: "Campfire Sweatshirt",
    price: 46,
    shape: "g-sweat",
    category: "tops",
    ages: ["toddler", "kid", "big"],
    badge: "few",
    blurb: "Brushed-back loopback fleece. Heavy enough to be the only layer on a cool morning.",
    story:
      "Loopback fleece from a mill in Portugal that has been doing it for forty years. We kept the inside " +
      "unbrushed on the smallest sizes so it does not overheat a toddler.",
    fabric: "85% organic cotton, 15% recycled cotton loopback, 320gsm",
    care: "Wash cold inside out, dry low.",
    details: [
      "Wide rib cuffs and hem that stay put",
      "Set-in sleeve for a less bulky shoulder",
      "No hood, by request of several parents with car seats"
    ],
    colors: [
      { name: "Ember",      main: "#B4573F", accent: "#F6EADF", tint: "#F3E2DA" },
      { name: "Deep Sage",  main: "#5F7A5C", accent: "#F2EFE1", tint: "#E3E9E1" },
      { name: "Night",      main: "#3A4150", accent: "#F2EFE6", tint: "#E3E5EA" }
    ],
    sizes: ["1–2y", "2–3y", "3–4y", "5–6y", "7–8y", "9–10y"],
    soldOut: ["3–4y", "5–6y"]
  },
  {
    id: "second-skin-leggings",
    name: "Second-Skin Leggings",
    price: 24,
    shape: "g-leggings",
    category: "bottoms",
    ages: ["baby", "toddler", "kid", "big"],
    blurb: "The layer that goes under everything else all winter. Knees reinforced from the inside.",
    story:
      "We sell more of these than anything else, which tells you something about how children dress " +
      "themselves between October and April.",
    fabric: "92% organic cotton, 8% elastane interlock",
    care: "Machine wash cold. Avoid fabric softener; it kills the stretch.",
    details: [
      "Invisible inner knee patch",
      "Soft encased waistband, no elastic edge",
      "Ankle cuff that does not leave a mark"
    ],
    colors: [
      { name: "Ink",        main: "#5E6F8C", accent: "#F2EFE6", tint: "#E6E9EF" },
      { name: "Plum",       main: "#7E5C72", accent: "#F6F0E6", tint: "#EBE2E8" },
      { name: "Oat",        main: "#C9B08A", accent: "#FBF6EF", tint: "#F2E9DA" }
    ],
    sizes: ["0–3m", "3–6m", "6–12m", "1–2y", "2–3y", "3–4y", "5–6y", "7–8y", "9–10y"],
    soldOut: []
  },
  {
    id: "meadow-jumpsuit",
    name: "Meadow Jumpsuit",
    price: 56,
    shape: "g-jumpsuit",
    category: "dresses",
    ages: ["baby", "toddler", "kid"],
    blurb: "One piece, one zip, done. The getting-out-the-door garment.",
    story:
      "A long two-way zip, so a nappy change does not mean undressing a whole person. Sized with a " +
      "generous rise, because the usual ones are not.",
    fabric: "Organic cotton chambray, 160gsm",
    care: "Machine wash cold, tumble dry low.",
    details: [
      "Two-way zip from collar to ankle",
      "Fold-over cuffs at wrist and ankle",
      "Chest pocket for the one small thing that must come along"
    ],
    colors: [
      { name: "Meadow",     main: "#7D9A74", accent: "#F4F0E2", tint: "#E7EDE2" },
      { name: "Chambray",   main: "#8CA3BC", accent: "#FBF6EF", tint: "#E6ECF2" }
    ],
    sizes: ["0–3m", "3–6m", "6–12m", "1–2y", "2–3y", "3–4y"],
    soldOut: ["0–3m"]
  },
  {
    id: "quilted-barn-jacket",
    name: "Quilted Barn Jacket",
    price: 88,
    shape: "g-coat",
    category: "outerwear",
    ages: ["toddler", "kid", "big"],
    blurb: "Our warmest layer. Recycled fill, cotton shell, cuffs that keep the wind out.",
    story:
      "Built to be handed down. Everything that normally fails first — the cuff, the zip pull, the pocket " +
      "corner — is reinforced, and we will repair it free for as long as we are making them.",
    fabric: "Organic cotton canvas shell, 100% recycled polyester fill",
    care: "Machine wash cold, dry low to re-loft the fill.",
    details: [
      "Diamond-quilted body with a soft jersey-lined collar",
      "Two zip hand pockets plus an inside stash pocket",
      "Free repairs for life — send it back and we will fix it"
    ],
    colors: [
      { name: "Olive",      main: "#6E7352", accent: "#F2EFE1", tint: "#E8E9DD" },
      { name: "Chestnut",   main: "#8E5A42", accent: "#F6EADF", tint: "#EFE1D8" }
    ],
    sizes: ["1–2y", "2–3y", "3–4y", "5–6y", "7–8y", "9–10y"],
    soldOut: ["1–2y"]
  }
];

KA.REVIEWS = [
  {
    quote: "The overalls have been through two children and a compost heap and still look like overalls.",
    who: "Priya M.", where: "Bristol", stars: 5
  },
  {
    quote: "First raincoat my son has not taken off in the car park. The hood actually stays up.",
    who: "Dan O.", where: "Portland, OR", stars: 5
  },
  {
    quote: "I let the hem down on the stripe tee after a growth spurt and got another summer out of it.",
    who: "Hélène R.", where: "Lyon", stars: 4
  }
];
