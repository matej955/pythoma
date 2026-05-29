export const DEFAULT_APP_CONTENT = {
  schemaVersion: 1,
  cache: {
    ttlMs: 5 * 24 * 60 * 60 * 1000,
    imagePrefetchLimit: 18,
  },
  images: {
    jungle: "https://images.pexels.com/photos/4571925/pexels-photo-4571925.jpeg?auto=compress&cs=tinysrgb&w=1000",
    login: "https://images.pexels.com/photos/4571925/pexels-photo-4571925.jpeg?auto=compress&cs=tinysrgb&w=1000",
    leaf: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80",
    woman: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80",
    glutes: "https://images.pexels.com/photos/6455835/pexels-photo-6455835.jpeg?auto=compress&cs=tinysrgb&w=900",
    strength: "https://images.pexels.com/photos/6456300/pexels-photo-6456300.jpeg?auto=compress&cs=tinysrgb&w=900",
    boxing: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=900&q=80",
    mobility: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
    smoothie: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80",
    group: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
    supplements: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=900&q=80",
  },
  programs: [
    { title: "GLUTEUS PROGRAM", category: "Teretana", weeks: "12 tjedana", level: "Srednje - Napredno", imgKey: "glutes" },
    { title: "FAT LOSS PROGRAM", category: "Kod kuce", weeks: "8 tjedana", level: "Pocetni - Srednje", imgKey: "strength" },
    { title: "FULL BODY STRENGTH", category: "Teretana", weeks: "6 tjedana", level: "Srednje - Napredno", imgKey: "strength" },
    { title: "BOXER CONDITIONING", category: "Teretana", weeks: "4 tjedna", level: "Srednje - Napredno", imgKey: "boxing" },
    { title: "MOBILITY & STRETCH", category: "Mobilnost", weeks: "4 tjedna", level: "Pocetni - Srednje", imgKey: "mobility" },
  ],
  communityPosts: [
    { name: "Ana", tab: "Chat", time: "11:23", text: "Danas smashed trening!", likes: 20, comments: 5 },
    { name: "Mia", tab: "Grupe", time: "11:25", text: "Ponosna na nas! Idemo dalje!", likes: 15, comments: 3 },
    { name: "Lea", tab: "Aktivnosti", time: "11:30", text: "Hvala vam na podrsci, najbolje ste!", likes: 18, comments: 4 },
  ],
  potions: [
    {
      title: "Paula's secret potion",
      tab: "Energija",
      imageKey: "smoothie",
      timing: "Piti ujutro toplo, na prazan zeludac.",
      ingredients: ["zeleni caj, pravi ne u vrecicama", "dumbir", "kurkuma", "limun", "kajenski papar", "cimet", "med"],
      preparation:
        "Za 0,5l napitka prvo prokuhati narezani dumbir. Ostaviti 2-3 minute da se temperatura vode spusti, zatim dodati cajnu zlicicu zelenog caja, 1/3 cajne zlicice kurkume, cimeta i kajenskog papra. Ostaviti 10 minuta i procijediti. Dodati cijeli iscijedeni limun i med.",
      benefits:
        "Energija, potice topljenje masti, bolja probava, ciscenje od toksina, kontrola apetita, oporavak i smanjenje upala, cirkulacija.",
    },
    {
      title: "Good morning, electrolytes",
      tab: "Detox",
      imageKey: "leaf",
      timing: "Piti ujutro odmah nakon budenja na prazan zeludac.",
      ingredients: ["500ml vode", "prstohvat himalajske soli"],
      preparation: "U 500ml vode staviti prstohvat himalajske soli i promijesati.",
      benefits:
        "Prirodno vracanje izgubljenih elektrolita, bolja hidratacija, manje vrtoglavice i slabosti, tijelo lakse zadrzava vodu, vise energije tijekom treninga, manje grceva u misicima, podrska nadbubreznim zlijezdama, manje glavobolja.",
    },
    {
      title: "Within you",
      tab: "Hormoni",
      imageKey: "smoothie",
      timing: "Piti navecer za smirenje i craving control.",
      ingredients: ["maca, ne matcha", "kakao", "cimet", "mlijeko po zelji", "med opcionalno"],
      preparation:
        "U salicu toplog mlijeka po zelji dodati 1-2 cajne zlicice sirovog prirodnog kakaa, 1/2-1 cajnu zlicicu mace u prahu i 1/3 cajne zlicice cimeta. Po zelji dodati 1 cajnu zlicicu meda. Promijesati i popiti toplo.",
      benefits: "Podrska libidu, smanjuje craving za slatkim, podrska hormonima i zivcanom sustavu, vise energije, bolji mood.",
    },
    {
      title: "Golden hour",
      tab: "San",
      imageKey: "smoothie",
      timing: "Piti navecer.",
      ingredients: ["mlijeko po zelji", "kurkuma", "cimet", "crni papar", "med opcionalno"],
      preparation:
        "U salicu toplog mlijeka staviti 1/2 cajne zlicice kurkume, 1/3 cajne zlicice cimeta, mali prstohvat crnog papra i po zelji 1 zlicicu meda. Promijesati i piti toplo.",
      benefits:
        "Podrska zivcanom sustavu i stresu, smanjuje upalne procese, ubrzava regeneraciju, poboljsava kvalitetu sna, podrzava hormonalni balans, pomaze kod PMS simptoma, antioksidansi pomazu kozi i stanicama.",
    },
  ],
  navItems: [
    { key: "home", label: "Pocetna", icon: "H" },
    { key: "training", label: "Treninzi", icon: "T" },
    { key: "community", label: "Community", icon: "C" },
    { key: "wellness", label: "Wellness", icon: "W" },
    { key: "profile", label: "Profil", icon: "P" },
  ],
  settings: {
    trainingTabs: ["Svi programi", "Teretana", "Kod kuce", "Mobilnost"],
    communityTabs: ["Chat", "Grupe", "Aktivnosti", "Izazovi"],
    quickActions: [
      { icon: "T", label: "Treninzi", screen: "training" },
      { icon: "N", label: "Prehrana", screen: "wellness" },
      { icon: "C", label: "Community", screen: "community" },
      { icon: "W", label: "Wellness", screen: "wellness" },
      { icon: "P", label: "Profil", screen: "profile" },
    ],
    dailyFocus: "Disciplina je most izmedu ciljeva i ostvarenja.",
    todayTasks: [
      { title: "Trening - Glute Focus", subtitle: "45 min", icon: "1" },
      { title: "Dnevni zadatak", subtitle: "Odradi trening i popij 2L vode.", icon: "2" },
      { title: "Jutarnja poruka", subtitle: "Snaga raste iznutra.", icon: "3" },
    ],
    dailyBoard: {
      tabs: ["Jutro", "Vecer"],
      messages: ["Danas biram sebe.", "Danas biram svoj mir.", "Danas biram rast."],
    },
    uploadModes: [
      { value: "auto", label: "Auto" },
      { value: "fast", label: "Fast" },
      { value: "dataSaver", label: "Saver" },
    ],
    profileStats: [
      { label: "Treninzi", value: "32" },
      { label: "Aktivni dani", value: "18" },
      { label: "Napredak", value: "72%" },
    ],
    brandDiscount: {
      title: "GAZZ NUTRITION",
      text: "Ekskluzivni popusti za Pythoma ratnice. Koristi svoj kod i ustedi!",
      code: "PYTHOMA20",
      subtext: "-20% POPUSTA",
      imageKey: "supplements",
    },
  },
};

export default DEFAULT_APP_CONTENT;
