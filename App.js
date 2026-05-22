import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path } from "react-native-svg";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  googleClientIds,
  firebaseConfigStatus,
  hasFirebaseConfig,
  loginWithEmail,
  loginWithGoogleIdToken,
  logout,
  registerWithEmail,
} from "./firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

const colors = {
  paper: "#f4ead9",
  card: "#f8f0e3",
  cardDeep: "#efe2cd",
  forest: "#243719",
  olive: "#55612d",
  moss: "#7d8157",
  sage: "#ddd2bb",
  tan: "#cbb589",
  ink: "#241f17",
  muted: "#766f61",
  line: "rgba(36, 55, 25, 0.16)",
  white: "#fffaf0",
  danger: "#9c493d",
};

const image = {
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
};

const allPrograms = [
  { title: "GLUTEUS PROGRAM", category: "Teretana", weeks: "12 tjedana", level: "Srednje - Napredno", img: image.glutes },
  { title: "FAT LOSS PROGRAM", category: "Kod kuce", weeks: "8 tjedana", level: "Pocetni - Srednje", img: image.strength },
  { title: "FULL BODY STRENGTH", category: "Teretana", weeks: "6 tjedana", level: "Srednje - Napredno", img: image.strength },
  { title: "BOXER CONDITIONING", category: "Teretana", weeks: "4 tjedna", level: "Srednje - Napredno", img: image.boxing },
  { title: "MOBILITY & STRETCH", category: "Mobilnost", weeks: "4 tjedna", level: "Pocetni - Srednje", img: image.mobility },
];

const communityPosts = [
  { name: "Ana", tab: "Chat", time: "11:23", text: "Danas smashed trening!", likes: 20, comments: 5 },
  { name: "Mia", tab: "Grupe", time: "11:25", text: "Ponosna na nas! Idemo dalje!", likes: 15, comments: 3 },
  { name: "Lea", tab: "Aktivnosti", time: "11:30", text: "Hvala vam na podrsci, najbolje ste!", likes: 18, comments: 4 },
];

const potions = [
  {
    title: "Paula's secret potion",
    tab: "Energija",
    image: image.smoothie,
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
    image: image.leaf,
    timing: "Piti ujutro odmah nakon budenja na prazan zeludac.",
    ingredients: ["500ml vode", "prstohvat himalajske soli"],
    preparation: "U 500ml vode staviti prstohvat himalajske soli i promijesati.",
    benefits:
      "Prirodno vracanje izgubljenih elektrolita, bolja hidratacija, manje vrtoglavice i slabosti, tijelo lakse zadrzava vodu, vise energije tijekom treninga, manje grceva u misicima, podrska nadbubreznim zlijezdama, manje glavobolja.",
  },
  {
    title: "Within you",
    tab: "Hormoni",
    image: image.smoothie,
    timing: "Piti navecer za smirenje i craving control.",
    ingredients: ["maca, ne matcha", "kakao", "cimet", "mlijeko po zelji", "med opcionalno"],
    preparation:
      "U salicu toplog mlijeka po zelji dodati 1-2 cajne zlicice sirovog prirodnog kakaa, 1/2-1 cajnu zlicicu mace u prahu i 1/3 cajne zlicice cimeta. Po zelji dodati 1 cajnu zlicicu meda. Promijesati i popiti toplo.",
    benefits:
      "Podrska libidu, smanjuje craving za slatkim, podrska hormonima i zivcanom sustavu, vise energije, bolji mood.",
  },
  {
    title: "Golden hour",
    tab: "San",
    image: image.smoothie,
    timing: "Piti navecer.",
    ingredients: ["mlijeko po zelji", "kurkuma", "cimet", "crni papar", "med opcionalno"],
    preparation:
      "U salicu toplog mlijeka staviti 1/2 cajne zlicice kurkume, 1/3 cajne zlicice cimeta, mali prstohvat crnog papra i po zelji 1 zlicicu meda. Promijesati i piti toplo.",
    benefits:
      "Podrska zivcanom sustavu i stresu, smanjuje upalne procese, ubrzava regeneraciju, poboljsava kvalitetu sna, podrzava hormonalni balans, pomaze kod PMS simptoma, antioksidansi pomazu kozi i stanicama.",
  },
];

const navItems = [
  { key: "home", label: "Pocetna", icon: "H" },
  { key: "training", label: "Treninzi", icon: "T" },
  { key: "community", label: "Community", icon: "C" },
  { key: "wellness", label: "Wellness", icon: "W" },
  { key: "profile", label: "Profil", icon: "P" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("welcome");
  const [screen, setScreen] = useState("home");
  const [history, setHistory] = useState(["home"]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trainingTab, setTrainingTab] = useState("Svi programi");
  const [communityTab, setCommunityTab] = useState("Chat");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({ name: "Ratnica.", goal: "Disciplina. Fokus. Sloboda.", age: "", level: "Pocetnica" });

  const googleConfigured = Object.values(googleClientIds).some(Boolean);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleClientIds);

  useEffect(() => {
    async function finishGoogleLogin() {
      if (response?.type !== "success") return;
      const idToken = response.params?.id_token;
      if (!idToken || !hasFirebaseConfig) return;
      try {
        const credential = await loginWithGoogleIdToken(idToken);
        setSession({ type: "firebase", name: credential.user.displayName || "Ratnica", email: credential.user.email });
      } catch (error) {
        Alert.alert("Google sign in", error.message);
      }
    }
    finishGoogleLogin();
  }, [response]);

  function enterAsGuest() {
    setSession({ type: "guest", name: profile.name, email: "" });
  }

  function navigate(next) {
    setScreen(next);
    setHistory((current) => [...current, next]);
    setDrawerOpen(false);
  }

  function goBack() {
    setHistory((current) => {
      if (current.length <= 1) {
        setScreen("home");
        return ["home"];
      }
      const nextHistory = current.slice(0, -1);
      setScreen(nextHistory[nextHistory.length - 1]);
      return nextHistory;
    });
  }

  async function handleLogout() {
    if (session?.type === "firebase" && hasFirebaseConfig) {
      await logout();
    }
    setSession(null);
    setAuthMode("welcome");
    setScreen("home");
    setHistory(["home"]);
  }

  if (!session) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        onGuest={enterAsGuest}
        onAuth={setSession}
        onGoogle={() => {
          if (!hasFirebaseConfig || !googleConfigured) {
            Alert.alert("Firebase setup needed", "Paste Firebase keys and Google client IDs in firebaseConfig.js first.");
            return;
          }
          promptAsync();
        }}
        request={request}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <View style={styles.app}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {screen === "home" && <HomeScreen go={navigate} openMenu={() => setDrawerOpen(true)} profile={profile} />}
          {screen === "training" && (
            <TrainingScreen tab={trainingTab} setTab={setTrainingTab} goBack={goBack} openMenu={() => setDrawerOpen(true)} />
          )}
          {screen === "community" && (
            <CommunityScreen tab={communityTab} setTab={setCommunityTab} message={message} setMessage={setMessage} goBack={goBack} />
          )}
          {screen === "wellness" && <WellnessScreen goBack={goBack} />}
          {screen === "profile" && <ProfileScreen profile={profile} setProfile={setProfile} goBack={goBack} onLogout={handleLogout} />}
        </ScrollView>
        <BottomNav active={screen} setActive={navigate} />
        <Drawer open={drawerOpen} close={() => setDrawerOpen(false)} go={navigate} onLogout={handleLogout} />
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({ mode, setMode, onGuest, onAuth, onGoogle, request }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isForm = mode === "login" || mode === "register";

  async function submit() {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password.");
      return;
    }
    if (!hasFirebaseConfig) {
      onAuth({ type: "demo", name: name || "Ratnica", email });
      return;
    }
    try {
      const credential =
        mode === "register" ? await registerWithEmail({ email, password, name }) : await loginWithEmail(email, password);
      onAuth({ type: "firebase", name: credential.user.displayName || name || "Ratnica", email: credential.user.email });
    } catch (error) {
      Alert.alert(
        "Firebase auth",
        `${error.message}\n\nLoaded project: ${firebaseConfigStatus.projectId}\nAPI key starts: ${firebaseConfigStatus.apiKeyPrefix}`,
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeDark}>
      <StatusBar barStyle="light-content" backgroundColor={colors.forest} />
      <ImageBackground source={{ uri: image.login }} style={styles.login} imageStyle={styles.loginImage}>
        <View style={styles.loginVeil} />
        <BrandLogo light large />
        {!isForm ? (
          <>
            <View style={styles.loginCopy}>
              <Text style={styles.loginPhrase}>Tvoj prostor.</Text>
              <Text style={styles.loginPhrase}>Tvoja snaga.</Text>
              <Text style={styles.loginPhrase}>Tvoja zajednica.</Text>
            </View>
            <View style={styles.loginButtons}>
              <PillButton label="PRIJAVI SE" onPress={() => setMode("login")} dark />
              <PillButton label="REGISTRIRAJ SE" onPress={() => setMode("register")} />
              <GoogleButton onPress={onGoogle} disabled={!request && hasFirebaseConfig} />
              <Pressable onPress={onGuest}>
                <Text style={styles.guest}>Nastavi kao gost</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.authPanel}>
            <Text style={styles.authTitle}>{mode === "register" ? "Kreiraj profil" : "Prijava"}</Text>
            {mode === "register" && (
              <AuthInput value={name} onChangeText={setName} placeholder="Ime profila" />
            )}
            <AuthInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
            <AuthInput value={password} onChangeText={setPassword} placeholder="Lozinka" secureTextEntry />
            <PillButton label={mode === "register" ? "REGISTRIRAJ SE" : "PRIJAVI SE"} onPress={submit} dark />
            <GoogleButton onPress={onGoogle} disabled={!request && hasFirebaseConfig} />
            <Pressable onPress={() => setMode("welcome")}>
              <Text style={styles.formBack}>Nazad</Text>
            </Pressable>
          </View>
        )}
      </ImageBackground>
    </SafeAreaView>
  );
}

function HomeScreen({ go, openMenu, profile }) {
  return (
    <>
      <TopChrome title={`Dobrodosla, ${profile.name || "ratnice"}!`} subtitle="Danas je novi dan za tvoj rast." openMenu={openMenu} />
      <View style={styles.quickGrid}>
        <Quick icon="T" label="Treninzi" onPress={() => go("training")} />
        <Quick icon="N" label="Prehrana" onPress={() => go("wellness")} />
        <Quick icon="C" label="Community" onPress={() => go("community")} />
        <Quick icon="W" label="Wellness" onPress={() => go("wellness")} />
        <Quick icon="P" label="Profil" onPress={() => go("profile")} />
      </View>
      <View style={styles.focusCard}>
        <View>
          <Text style={styles.tiny}>DNEVNI FOKUS</Text>
          <Text style={styles.focusText}>Disciplina je most izmedu ciljeva i ostvarenja.</Text>
        </View>
        <Text style={styles.leafMark}>L</Text>
      </View>
      <Text style={styles.sectionLabel}>DANAS TE CEKA</Text>
      <Task title="Trening - Glute Focus" subtitle="45 min" icon="1" />
      <Task title="Dnevni zadatak" subtitle="Odradi trening i popij 2L vode." icon="2" />
      <Task title="Jutarnja poruka" subtitle="Snaga raste iznutra." icon="3" />
      <View style={styles.progressCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.tiny}>PROGRESS TRACKER</Text>
          <Text style={styles.leafSmall}>L</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.body}>Tjedan 4</Text>
          <Text style={styles.body}>62%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
      </View>
    </>
  );
}

function TrainingScreen({ tab, setTab, goBack, openMenu }) {
  const programs = useMemo(() => {
    if (tab === "Svi programi") return allPrograms;
    return allPrograms.filter((program) => program.category === tab);
  }, [tab]);

  return (
    <>
      <ScreenHeader title="TRENINZI" right="Sliders" onBack={goBack} onRight={openMenu} />
      <Tabs tabs={["Svi programi", "Teretana", "Kod kuce", "Mobilnost"]} active={tab} setActive={setTab} />
      <View style={styles.trainingList}>
        {programs.map((program) => (
          <View key={program.title} style={styles.trainingCard}>
            <Image source={{ uri: program.img }} style={styles.trainingImage} />
            <View style={styles.trainingInfo}>
              <Text style={styles.trainingTitle}>{program.title}</Text>
              <Text style={styles.trainingText}>{program.weeks}</Text>
              <Text style={styles.trainingText}>{program.level}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function CommunityScreen({ tab, setTab, message, setMessage, goBack }) {
  const posts = tab === "Chat" ? communityPosts : communityPosts.filter((post) => post.tab === tab);
  return (
    <>
      <ScreenHeader title="COMMUNITY" onBack={goBack} />
      <Tabs tabs={["Chat", "Grupe", "Aktivnosti", "Izazovi"]} active={tab} setActive={setTab} />
      <View style={styles.communityList}>
        {(posts.length ? posts : communityPosts).map((post) => (
          <View key={post.name} style={styles.postCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{post.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.postBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.postName}>{post.name}</Text>
                <Text style={styles.postTime}>{post.time}</Text>
              </View>
              <Text style={styles.postText}>{post.text}</Text>
              <Text style={styles.reactions}>love {post.likes}    chat {post.comments}</Text>
            </View>
          </View>
        ))}
        <ImageBackground source={{ uri: image.group }} style={styles.communityPhoto} imageStyle={styles.communityPhotoImage}>
          <View style={styles.photoShade} />
        </ImageBackground>
        <Text style={styles.caption}>Tko ide na vecernji challenge?</Text>
        <Text style={styles.reactions}>love 12    chat 2</Text>
      </View>
      <View style={styles.messageBar}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Napisi poruku..."
          placeholderTextColor={colors.muted}
          style={styles.messageInput}
        />
        <Pressable style={styles.sendCircle} onPress={() => setMessage("")}>
          <Text style={styles.sendText}>Go</Text>
        </Pressable>
      </View>
    </>
  );
}

function WellnessScreen({ goBack }) {
  const [dailyTab, setDailyTab] = useState("Jutro");
  const [drinkTab, setDrinkTab] = useState(potions[0].title);
  const selectedPotion = potions.find((potion) => potion.title === drinkTab) || potions[0];
  return (
    <>
      <ScreenHeader title="DAILY BOARD" right="Leaf" onBack={goBack} />
      <Tabs tabs={["Jutro", "Vecer"]} active={dailyTab} setActive={setDailyTab} />
      <View style={styles.dailyCard}>
        <Text style={styles.sun}>{dailyTab === "Jutro" ? "SUN" : "MOON"}</Text>
        <Text style={styles.dailyTitle}>{dailyTab.toUpperCase()}</Text>
        <Text style={styles.dailyText}>Danas biram sebe.</Text>
        <Text style={styles.dailyText}>Danas biram svoj mir.</Text>
        <Text style={styles.dailyText}>Danas biram rast.</Text>
      </View>
      <ScreenHeader title="CAROBNI NAPITCI" right="Leaf" compact onBack={goBack} />
      <Tabs tabs={potions.map((potion) => potion.title)} active={drinkTab} setActive={setDrinkTab} />
      <View style={styles.potionCard}>
        <ImageBackground source={{ uri: selectedPotion.image }} style={styles.potionHero} imageStyle={styles.potionHeroImage}>
          <View style={styles.potionHeroShade} />
          <Text style={styles.potionCategory}>{selectedPotion.tab}</Text>
          <Text style={styles.potionHeroTitle}>{selectedPotion.title}</Text>
        </ImageBackground>
        <Text style={styles.potionTiming}>{selectedPotion.timing}</Text>
        <PotionSection title="Sastojci" items={selectedPotion.ingredients} />
        <Text style={styles.potionSectionTitle}>Priprema</Text>
        <Text style={styles.potionBody}>{selectedPotion.preparation}</Text>
        <Text style={styles.potionSectionTitle}>Benefiti</Text>
        <Text style={styles.potionBody}>{selectedPotion.benefits}</Text>
      </View>
    </>
  );
}

function PotionSection({ title, items }) {
  return (
    <View>
      <Text style={styles.potionSectionTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.potionBullet}>
          - {item}
        </Text>
      ))}
    </View>
  );
}

function ProfileScreen({ profile, setProfile, goBack, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  return (
    <>
      <ScreenHeader title="MOJ PROFIL" right={editing ? "Save" : "Edit"} onBack={goBack} onRight={() => {
        if (editing) setProfile(draft);
        setEditing((current) => !current);
      }} />
      <View style={styles.profileCard}>
        <Image source={{ uri: image.woman }} style={styles.profileImage} />
        <View style={styles.profileText}>
          {editing ? (
            <>
              <TextInput style={styles.profileInput} value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
              <TextInput style={styles.profileInput} value={draft.goal} onChangeText={(goal) => setDraft({ ...draft, goal })} />
            </>
          ) : (
            <>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileMotto}>{profile.goal}</Text>
            </>
          )}
        </View>
      </View>
      {editing && (
        <View style={styles.editGrid}>
          <AuthInput value={draft.age} onChangeText={(age) => setDraft({ ...draft, age })} placeholder="Godine" keyboardType="number-pad" />
          <AuthInput value={draft.level} onChangeText={(level) => setDraft({ ...draft, level })} placeholder="Level" />
        </View>
      )}
      <View style={styles.profileStats}>
        <ProfileStat label="Treninzi" value="32" />
        <ProfileStat label="Aktivni dani" value="18" />
        <ProfileStat label="Napredak" value="72%" />
      </View>
      <View style={styles.gazzCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.gazzTitle}>GAZZ NUTRITION</Text>
          <Text style={styles.bottle}>G</Text>
        </View>
        <Text style={styles.gazzText}>Ekskluzivni popusti za Pythoma ratnice. Koristi svoj kod i ustedi!</Text>
        <View style={styles.gazzBody}>
          <View style={styles.discountBadge}>
            <Text style={styles.discountMain}>PYTHOMA20</Text>
            <Text style={styles.discountSub}>-20% POPUSTA</Text>
          </View>
          <Image source={{ uri: image.supplements }} style={styles.supplements} />
        </View>
      </View>
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Odjavi se</Text>
      </Pressable>
    </>
  );
}

function Drawer({ open, close, go, onLogout }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.drawerShade} onPress={close}>
        <Pressable style={styles.drawer}>
          <BrandLogo />
          {navItems.map((item) => (
            <Pressable key={item.key} style={styles.drawerItem} onPress={() => go(item.key)}>
              <Text style={styles.drawerIcon}>{item.icon}</Text>
              <Text style={styles.drawerText}>{item.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.drawerItem} onPress={onLogout}>
            <Text style={styles.drawerIcon}>X</Text>
            <Text style={styles.drawerText}>Odjava</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TopChrome({ title, subtitle, openMenu }) {
  return (
    <View style={styles.topChrome}>
      <Pressable onPress={openMenu}>
        <Text style={styles.menu}>☰</Text>
      </Pressable>
      <View style={styles.topText}>
        <Text style={styles.homeTitle}>{title}</Text>
        <Text style={styles.homeSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.bell}>L</Text>
    </View>
  );
}

function ScreenHeader({ title, right, compact, onBack, onRight }) {
  return (
    <View style={[styles.screenHeader, compact && styles.screenHeaderCompact]}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.screenHeaderTitle}>{title}</Text>
      <Pressable onPress={onRight}>
        <Text style={styles.headerIcon}>{right || ""}</Text>
      </Pressable>
    </View>
  );
}

function BrandLogo({ light, large }) {
  const ink = light ? colors.white : colors.forest;
  const gold = light ? colors.tan : colors.clay;
  const size = large ? 170 : 116;
  return (
    <View style={[styles.brandWrap, large && styles.brandWrapLarge]}>
      <Svg width={size} height={large ? 126 : 88} viewBox="0 0 220 150">
        <G>
          <Path
            d="M110 10 C82 39 83 70 110 100 C137 70 138 39 110 10 Z"
            fill={ink}
            opacity={0.95}
          />
          <Path d="M110 22 L110 98" stroke={colors.paper} strokeWidth="2" opacity={0.55} />
          <Path d="M110 38 C101 45 96 51 91 62" stroke={colors.paper} strokeWidth="1.2" opacity={0.5} />
          <Path d="M110 53 C120 59 126 66 132 78" stroke={colors.paper} strokeWidth="1.2" opacity={0.5} />

          <Path
            d="M50 55 C72 53 88 67 99 95 C69 99 50 84 50 55 Z"
            fill={ink}
            opacity={0.9}
          />
          <Path d="M57 61 C73 71 86 81 99 95" stroke={colors.paper} strokeWidth="1.2" opacity={0.45} />
          <Path
            d="M170 55 C148 53 132 67 121 95 C151 99 170 84 170 55 Z"
            fill={ink}
            opacity={0.9}
          />
          <Path d="M163 61 C147 71 134 81 121 95" stroke={colors.paper} strokeWidth="1.2" opacity={0.45} />

          <Path d="M37 93 C70 118 150 118 183 93" stroke={gold} strokeWidth="3" fill="none" />
          <Path d="M50 86 C63 102 85 110 110 110 C135 110 157 102 170 86" stroke={ink} strokeWidth="4" fill="none" />
          <Ellipse cx="110" cy="100" rx="23" ry="16" fill={colors.paper} opacity={0.92} />
          <Circle cx="110" cy="100" r="13" fill={ink} />
          <Circle cx="110" cy="100" r="7" fill={colors.olive} />
          <Circle cx="105" cy="94" r="3.5" fill={colors.white} />

          <Path d="M28 78 C23 64 26 50 36 39" stroke={gold} strokeWidth="2" fill="none" />
          <Path d="M192 78 C197 64 194 50 184 39" stroke={gold} strokeWidth="2" fill="none" />
          <Path d="M66 112 C56 119 45 122 34 120" stroke={gold} strokeWidth="1.8" fill="none" />
          <Path d="M154 112 C164 119 175 122 186 120" stroke={gold} strokeWidth="1.8" fill="none" />
          <Circle cx="31" cy="53" r="3" fill={gold} />
          <Circle cx="189" cy="53" r="3" fill={gold} />
          <Circle cx="110" cy="4" r="3" fill={gold} />
          <Line x1="110" y1="126" x2="110" y2="142" stroke={gold} strokeWidth="2" />
          <Circle cx="110" cy="145" r="3" fill={gold} />
        </G>
      </Svg>
      <Text style={[styles.brandTitle, light && styles.lightText, large && styles.brandTitleLarge]}>PYTHOMA</Text>
      <Text style={[styles.brandSub, light && styles.lightText, large && styles.brandSubLarge]}>SANCTUARY</Text>
      {large && <Text style={styles.brandTag}>TVOJ PROSTOR. TVOJA SNAGA. TVOJA ZAJEDNICA.</Text>}
    </View>
  );
}

function Quick({ icon, label, onPress }) {
  return (
    <Pressable style={styles.quick} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function Task({ title, subtitle, icon }) {
  return (
    <View style={styles.taskCard}>
      <Text style={styles.taskIcon}>{icon}</Text>
      <View style={styles.taskTextWrap}>
        <Text style={styles.taskTitle}>{title}</Text>
        <Text style={styles.taskSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </View>
  );
}

function Tabs({ tabs, active, setActive }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {tabs.map((tab) => (
        <Pressable key={tab} style={[styles.tabPill, active === tab && styles.tabPillActive]} onPress={() => setActive(tab)}>
          <Text style={[styles.tabPillText, active === tab && styles.tabPillTextActive]}>{tab}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function PillButton({ label, onPress, dark }) {
  return (
    <Pressable style={[styles.pillButton, dark && styles.pillButtonDark]} onPress={onPress}>
      <Text style={[styles.pillButtonText, dark && styles.pillButtonTextDark]}>{label}</Text>
    </Pressable>
  );
}

function GoogleButton({ onPress, disabled }) {
  return (
    <Pressable style={[styles.googleButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      <Text style={styles.googleText}>G  Continue with Google</Text>
    </Pressable>
  );
}

function AuthInput(props) {
  return <TextInput {...props} autoCapitalize="none" placeholderTextColor={colors.muted} style={[styles.authInput, props.style]} />;
}

function ProfileStat({ label, value }) {
  return (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatLabel}>{label}</Text>
      <Text style={styles.profileStatValue}>{value}</Text>
    </View>
  );
}

function BottomNav({ active, setActive }) {
  return (
    <View style={styles.bottomNav}>
      {navItems.map((item) => (
        <Pressable key={item.key} style={styles.navItem} onPress={() => setActive(item.key)}>
          <Text style={[styles.navIcon, active === item.key && styles.navActive]}>{item.icon}</Text>
          <Text style={[styles.navLabel, active === item.key && styles.navActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  safeDark: { flex: 1, backgroundColor: colors.forest },
  app: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 18, paddingBottom: 104 },
  login: { flex: 1, justifyContent: "space-between", padding: 24 },
  loginImage: { borderRadius: 0 },
  loginVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(21, 29, 12, 0.42)" },
  loginCopy: { alignItems: "flex-end", marginTop: "auto", marginBottom: 34 },
  loginPhrase: { color: colors.white, fontSize: 19, fontWeight: "500", lineHeight: 26 },
  loginButtons: { gap: 12, marginBottom: 18 },
  authPanel: { gap: 12, marginTop: "auto", marginBottom: 18 },
  authTitle: { color: colors.white, fontSize: 28, fontWeight: "300", letterSpacing: 1 },
  authInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  formBack: { color: colors.white, textAlign: "center", paddingVertical: 8, fontWeight: "700" },
  pillButton: { minHeight: 55, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  pillButtonDark: { backgroundColor: colors.forest },
  pillButtonText: { color: colors.forest, fontSize: 13, fontWeight: "700", letterSpacing: 0.7 },
  pillButtonTextDark: { color: colors.white },
  googleButton: {
    minHeight: 53,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  googleText: { color: colors.ink, fontWeight: "700" },
  disabledButton: { opacity: 0.55 },
  guest: { color: colors.white, fontSize: 15, fontWeight: "600", paddingVertical: 8, textAlign: "center" },
  brandWrap: { alignItems: "center" },
  brandWrapLarge: { marginTop: 18 },
  symbol: { alignItems: "center", height: 78, justifyContent: "center" },
  symbolLeaf: { color: colors.forest, fontSize: 48, lineHeight: 50, fontWeight: "300" },
  symbolEye: { color: colors.forest, fontSize: 13, lineHeight: 18, marginTop: -12, letterSpacing: 2 },
  lightText: { color: colors.white },
  brandTitle: { color: colors.forest, fontSize: 32, fontWeight: "300", letterSpacing: 5 },
  brandTitleLarge: { fontSize: 42, marginTop: 2 },
  brandSub: { color: colors.forest, fontSize: 15, fontWeight: "400", letterSpacing: 8 },
  brandSubLarge: { fontSize: 18 },
  brandTag: { color: colors.white, fontSize: 10, letterSpacing: 1.7, marginTop: 10, textAlign: "center" },
  topChrome: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 18 },
  menu: { color: colors.forest, fontSize: 28, marginTop: -4 },
  bell: { color: colors.forest, fontSize: 24, marginLeft: "auto" },
  topText: { flex: 1 },
  homeTitle: { color: colors.ink, fontSize: 19, fontWeight: "500" },
  homeSubtitle: { color: colors.ink, fontSize: 12, marginTop: 4 },
  quickGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  quick: { alignItems: "center", width: 62 },
  quickIcon: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    color: colors.forest,
    fontSize: 15,
    lineHeight: 44,
    textAlign: "center",
    backgroundColor: colors.card,
    fontWeight: "700",
  },
  quickLabel: { color: colors.ink, fontSize: 10, marginTop: 7 },
  focusCard: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: colors.card,
  },
  tiny: { color: colors.muted, fontSize: 10, letterSpacing: 0.6 },
  focusText: { color: colors.ink, fontSize: 18, lineHeight: 24, marginTop: 8, maxWidth: 230 },
  leafMark: { color: colors.olive, fontSize: 46, alignSelf: "flex-end" },
  leafSmall: { color: colors.olive, fontSize: 22 },
  sectionLabel: { color: colors.muted, fontSize: 11, letterSpacing: 0.6, marginBottom: 8, marginTop: 18 },
  taskCard: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  taskIcon: { color: colors.forest, fontSize: 15, width: 28, fontWeight: "700" },
  taskTextWrap: { flex: 1 },
  taskTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  taskSubtitle: { color: colors.ink, fontSize: 11, marginTop: 3 },
  arrow: { color: colors.forest, fontSize: 23 },
  progressCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, marginTop: 8, padding: 14, backgroundColor: colors.card },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  body: { color: colors.ink, fontSize: 13, marginTop: 12 },
  progressBar: { height: 7, borderRadius: 999, marginTop: 9, backgroundColor: colors.sage, overflow: "hidden" },
  progressFill: { width: "62%", height: "100%", backgroundColor: colors.olive },
  screenHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 17 },
  screenHeaderCompact: { marginTop: 24 },
  back: { color: colors.forest, fontSize: 30, width: 34 },
  screenHeaderTitle: { color: colors.ink, fontSize: 17, fontWeight: "400", letterSpacing: 0.7 },
  headerIcon: { color: colors.forest, fontSize: 13, width: 60, textAlign: "right", fontWeight: "700" },
  tabs: { gap: 12, paddingBottom: 16 },
  tabPill: {
    minHeight: 31,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.card,
  },
  tabPillActive: { backgroundColor: colors.forest },
  tabPillText: { color: colors.ink, fontSize: 11, fontWeight: "500" },
  tabPillTextActive: { color: colors.white },
  trainingList: { gap: 12 },
  trainingCard: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  trainingImage: { width: 112, height: 104 },
  trainingInfo: { flex: 1, paddingHorizontal: 14 },
  trainingTitle: { color: colors.ink, fontSize: 14, fontWeight: "600", marginBottom: 8 },
  trainingText: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  communityList: { gap: 10 },
  postCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 15, flexDirection: "row", gap: 10, padding: 12, backgroundColor: colors.card },
  avatar: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.olive },
  avatarText: { color: colors.white, fontWeight: "700" },
  postBody: { flex: 1 },
  postName: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  postTime: { color: colors.ink, fontSize: 11 },
  postText: { color: colors.ink, fontSize: 13, marginTop: 4 },
  reactions: { color: colors.muted, fontSize: 12, marginTop: 7 },
  communityPhoto: { height: 150, borderRadius: 16, overflow: "hidden", marginTop: 4 },
  communityPhotoImage: { borderRadius: 16 },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(27, 35, 15, 0.08)" },
  caption: { color: colors.ink, fontSize: 13, marginTop: 2 },
  messageBar: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14 },
  messageInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  sendCircle: { width: 46, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.olive },
  sendText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  dailyCard: {
    minHeight: 194,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.card,
  },
  sun: { color: colors.tan, fontSize: 18, letterSpacing: 2 },
  dailyTitle: { color: colors.ink, fontSize: 20, letterSpacing: 1, marginBottom: 14, marginTop: 5 },
  dailyText: { color: colors.ink, fontSize: 16, lineHeight: 25 },
  drinkCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, flexDirection: "row", gap: 12, padding: 10, backgroundColor: colors.card },
  drinkImage: { width: 128, height: 142, borderRadius: 13 },
  drinkInfo: { flex: 1, paddingTop: 9 },
  drinkTitle: { color: colors.ink, fontSize: 16, fontWeight: "600", lineHeight: 21 },
  drinkText: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 12 },
  heart: { color: colors.forest, fontSize: 23, paddingTop: 5 },
  potionCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 12,
    backgroundColor: colors.card,
  },
  potionHero: {
    height: 150,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.olive,
  },
  potionHeroImage: { borderRadius: 14 },
  potionHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(24, 33, 13, 0.25)" },
  potionCategory: {
    color: colors.tan,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  potionHeroTitle: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "500",
    marginTop: 4,
  },
  potionTiming: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 10,
  },
  potionSectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  potionBullet: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  potionBody: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 18 },
  profileImage: { width: 84, height: 84, borderRadius: 999 },
  profileText: { flex: 1 },
  profileName: { color: colors.ink, fontSize: 22, fontWeight: "500" },
  profileMotto: { color: colors.ink, fontSize: 13, marginTop: 5 },
  profileInput: { borderBottomWidth: 1, borderColor: colors.line, color: colors.ink, minHeight: 34 },
  editGrid: { gap: 10, marginBottom: 14 },
  profileStats: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 18,
    paddingVertical: 14,
    backgroundColor: colors.card,
  },
  profileStat: { alignItems: "center", flex: 1 },
  profileStatLabel: { color: colors.muted, fontSize: 11 },
  profileStatValue: { color: colors.ink, fontSize: 22, marginTop: 6 },
  gazzCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, backgroundColor: colors.card },
  gazzTitle: { color: colors.ink, fontSize: 18, letterSpacing: 0.8 },
  bottle: { color: colors.forest, fontSize: 24, fontWeight: "700" },
  gazzText: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 10, maxWidth: 240 },
  gazzBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  discountBadge: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.olive },
  discountMain: { color: colors.white, fontSize: 15, letterSpacing: 0.7 },
  discountSub: { color: colors.white, fontSize: 12, marginTop: 5 },
  supplements: { width: 122, height: 98, borderRadius: 12 },
  logoutButton: { minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 16, backgroundColor: colors.forest },
  logoutText: { color: colors.white, fontWeight: "700" },
  drawerShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  drawer: { width: 278, flex: 1, paddingTop: 58, paddingHorizontal: 18, backgroundColor: colors.paper },
  drawerItem: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line },
  drawerIcon: { color: colors.forest, width: 24, fontWeight: "700" },
  drawerText: { color: colors.ink, fontSize: 16 },
  bottomNav: {
    position: "absolute",
    right: 12,
    bottom: 12,
    left: 12,
    height: 70,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    backgroundColor: "rgba(248, 240, 227, 0.96)",
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  navIcon: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  navLabel: { color: colors.muted, fontSize: 10 },
  navActive: { color: colors.forest, fontWeight: "700" },
});
