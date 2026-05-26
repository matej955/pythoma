import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  LayoutAnimation,
  PanResponder,
  UIManager,
} from "react-native";
import { Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Ellipse, G, Line, Path } from "react-native-svg";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import {
  googleClientIds,
  firebaseConfigStatus,
  hasFirebaseConfig,
  loginWithEmail,
  loginWithGoogleIdToken,
  logout,
  registerWithEmail,
  sendCommunityMessage,
  getCommunityMessagesCount,
  fetchLatestCommunityMessages,
  fetchCommunityMessagesBefore,
  subscribeToNewCommunityMessages,
  getUserActivePrograms,
  getUserSubscription,
  uploadFileAsync,
  toggleMessageLike,
  getLikesCount,
} from "./firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

GoogleSignin.configure({
  webClientId: googleClientIds.webClientId,
  iosClientId: googleClientIds.iosClientId || undefined,
  offlineAccess: false,
});

const colors = {
  paper: "#efe3d0",
  card: "#fbf3e7",
  cardDeep: "#eadcc5",
  forest: "#243719",
  olive: "#55612d",
  moss: "#73794b",
  sage: "#d8c7aa",
  tan: "#b99d69",
  ink: "#241f17",
  muted: "#81735f",
  line: "rgba(36, 55, 25, 0.18)",
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

const UPLOAD_QUEUE_KEY = "pythoma_upload_queue_v2";
const UPLOAD_MODE_KEY = "pythoma_upload_mode_v1";
const MAX_UPLOAD_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1200;
const BACKOFF_MAX_MS = 30000;
const UPLOAD_CONCURRENCY = {
  wifi: 4,
  ethernet: 4,
  cellular: 1,
  unknown: 2,
  default: 2,
};

const UPLOAD_PENDING_STATUSES = new Set(["queued", "uploading"]);
const RECIPE_REQUIRED_SUBSCRIPTION = "Wellness";
const PROGRAM_REQUIRED_SUBSCRIPTION = "Training";

function normalizeSubscriptionValue(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(normalizeSubscriptionValue).join(" ");
  if (typeof value === "object") {
    const entitlementKeys = Object.entries(value)
      .filter(([, entry]) => entry === true)
      .map(([key]) => key);
    return normalizeSubscriptionValue([
      ...entitlementKeys,
      value.type,
      value.plan,
      value.tier,
      value.name,
      value.productId,
      value.subscriptionType,
      value.status,
    ]);
  }
  return String(value).trim().toLowerCase();
}

function isSubscriptionRecordActive(record) {
  if (!record) return false;
  if (record.subscriptionActive === true || record.hasSubscription === true || record.isSubscribed === true || record.active === true) return true;
  if (record.purchased === true || normalizeSubscriptionValue(record.purchaseStatus).includes("purchased")) return true;

  const status = normalizeSubscriptionValue(record.subscriptionStatus || record.status || record.state || record.subscription?.status);
  return ["active", "trialing", "paid", "subscribed", "valid", "purchased"].some((activeStatus) => status.includes(activeStatus));
}

function getRecipeRequiredSubscription(recipe) {
  return recipe?.requiredSubscription || recipe?.meta?.requiredSubscription || RECIPE_REQUIRED_SUBSCRIPTION;
}

function hasRequiredSubscription(record, requiredSubscription) {
  if (!isSubscriptionRecordActive(record)) return false;
  const planText = normalizeSubscriptionValue([
    record.subscriptionType,
    record.plan,
    record.tier,
    record.productId,
    record.entitlements,
    record.subscription,
  ]);
  const requiredPlan = normalizeSubscriptionValue(requiredSubscription);
  return !planText || [requiredPlan, "premium", "all", "full"].some((token) => token && planText.includes(token));
}

function hasRecipeSubscription(record, requiredSubscription = RECIPE_REQUIRED_SUBSCRIPTION) {
  return hasRequiredSubscription(record, requiredSubscription);
}

function getProgramRequiredSubscription(program) {
  return program?.requiredSubscription || program?.meta?.requiredSubscription || PROGRAM_REQUIRED_SUBSCRIPTION;
}

function hasProgramSubscription(record, requiredSubscription = PROGRAM_REQUIRED_SUBSCRIPTION) {
  return hasRequiredSubscription(record, requiredSubscription);
}

function getRecipeText(recipe) {
  const recipeKey = recipe?.recipeId || recipe?.title || recipe?.meta?.title || "";
  const catalogRecipe = potions.find((potion) => potion.title === recipeKey);
  const meta = { ...(catalogRecipe || {}), ...(recipe?.meta || {}), ...(recipe || {}) };
  return {
    title: meta.title || recipeKey || "Recipe",
    image: meta.image || meta.img || image.smoothie,
    timing: meta.timing || "",
    ingredients: meta.ingredients || [],
    preparation: meta.preparation || meta.recipe || meta.text || meta.body || "",
    benefits: meta.benefits || "",
  };
}

function getProgramText(program) {
  const programKey = program?.programId || program?.title || program?.meta?.title || "";
  const catalogProgram = allPrograms.find((item) => item.title === programKey);
  const meta = { ...(catalogProgram || {}), ...(program?.meta || {}), ...(program || {}) };
  return {
    title: meta.title || meta.name || programKey || "Program",
    image: meta.image || meta.img || meta.imageUrl || image.glutes,
    duration: meta.weeks || meta.duration || meta.length || "",
    level: meta.level || "",
    progressPercent: meta.progressPercent ?? meta.progress ?? meta.percent ?? meta.completed ?? "",
    description: meta.description || meta.text || meta.body || "Detalji programa nisu dostupni.",
  };
}

function backoffDelayForAttempt(attempt) {
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, Math.max(attempt - 1, 0))) + jitter;
}

function sanitizeUploadQueue(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter((item) => item && item.id && item.uri)
    .map((item) => ({
      ...item,
      attempts: Number.isFinite(item.attempts) ? item.attempts : 0,
      progress: Number.isFinite(item.progress) ? item.progress : 0,
      status: item.status === "uploading" ? "queued" : item.status || "queued",
    }));
}

async function readNetworkType() {
  try {
    let NetInfo = null;
    try {
      NetInfo = eval("require")("@react-native-community/netinfo");
    } catch (e) {
      NetInfo = null;
    }
    if (NetInfo?.fetch) {
      const state = await NetInfo.fetch();
      if (state?.isConnected === false) return "none";
      return state?.type || "unknown";
    }
  } catch (error) {
    // Optional dependency fallback below.
  }

  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.type) return connection.type;
    if (connection?.effectiveType && /2g|3g|4g|5g/.test(connection.effectiveType)) return "cellular";
  }

  return "unknown";
}

function concurrencyForUploadMode(mode, networkType) {
  if (mode === "fast") return 4;
  if (mode === "dataSaver") return 1;
  if (networkType === "none") return 0;
  return UPLOAD_CONCURRENCY[networkType] || UPLOAD_CONCURRENCY.default;
}

function getUploadErrorMessage(error) {
  return error?.message || error?.code || String(error || "Upload failed");
}

function usePersistentUploadQueue() {
  const [items, setItems] = useState([]);
  const [mode, setModeState] = useState("auto");
  const [networkType, setNetworkType] = useState("unknown");
  const queueRef = useRef([]);
  const modeRef = useRef("auto");
  const activeRef = useRef(false);
  const uploadTasksRef = useRef({});
  const waitersRef = useRef([]);
  const timerRef = useRef(null);

  function notifyWaiters() {
    if (!waitersRef.current.length) return;
    waitersRef.current = waitersRef.current.filter((waiter) => {
      const pending = queueRef.current.some((item) => {
        const inScope = !waiter.ids || waiter.ids.includes(item.id);
        return inScope && UPLOAD_PENDING_STATUSES.has(item.status);
      });
      if (!pending) waiter.resolve();
      return pending;
    });
  }

  async function persistQueue(nextQueue) {
    try {
      await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(nextQueue));
    } catch (error) {
      // Queue persistence should never block the user from uploading.
    }
  }

  function replaceQueue(updater) {
    const nextQueue = typeof updater === "function" ? updater(queueRef.current) : updater;
    const cleanQueue = sanitizeUploadQueue(nextQueue);
    queueRef.current = cleanQueue;
    setItems(cleanQueue);
    persistQueue(cleanQueue);
    notifyWaiters();
  }

  function updateQueueItem(id, updater) {
    replaceQueue((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return typeof updater === "function" ? updater(item) : { ...item, ...updater };
      }),
    );
  }

  function scheduleProcess(delay = 0) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      processUploadQueue();
    }, Math.max(delay, 0));
  }

  async function uploadOne(item) {
    try {
      updateQueueItem(item.id, { status: "uploading", error: "", progress: item.progress || 0, startedAt: Date.now() });
      const promise = uploadFileAsync(item.uri, (progress) => {
        updateQueueItem(item.id, { status: "uploading", progress });
      });
      uploadTasksRef.current[item.id] = promise;
      const { url, path } = await promise;
      delete uploadTasksRef.current[item.id];
      updateQueueItem(item.id, {
        status: "uploaded",
        url,
        storagePath: path,
        progress: 100,
        error: "",
        nextRetryAt: null,
        uploadedAt: Date.now(),
      });
    } catch (error) {
      delete uploadTasksRef.current[item.id];
      if (!queueRef.current.some((queuedItem) => queuedItem.id === item.id)) return;

      const previous = queueRef.current.find((queuedItem) => queuedItem.id === item.id) || item;
      const attempts = (previous.attempts || 0) + 1;
      if (attempts >= MAX_UPLOAD_ATTEMPTS) {
        updateQueueItem(item.id, {
          status: "failed",
          attempts,
          progress: 0,
          error: getUploadErrorMessage(error),
          failedAt: Date.now(),
          nextRetryAt: null,
        });
        return;
      }

      const nextRetryAt = Date.now() + backoffDelayForAttempt(attempts);
      updateQueueItem(item.id, {
        status: "queued",
        attempts,
        progress: 0,
        error: getUploadErrorMessage(error),
        nextRetryAt,
      });
      scheduleProcess(nextRetryAt - Date.now());
    }
  }

  async function processUploadQueue() {
    if (activeRef.current) return;
    activeRef.current = true;

    try {
      while (true) {
        const type = await readNetworkType();
        setNetworkType(type);
        const concurrency = concurrencyForUploadMode(modeRef.current, type);
        if (concurrency <= 0) break;

        const now = Date.now();
        const readyItems = queueRef.current
          .filter((item) => item.status === "queued" && (!item.nextRetryAt || item.nextRetryAt <= now))
          .slice(0, concurrency);

        if (!readyItems.length) {
          const nextRetryAt = queueRef.current
            .filter((item) => item.status === "queued" && item.nextRetryAt)
            .reduce((soonest, item) => Math.min(soonest, item.nextRetryAt), Number.POSITIVE_INFINITY);
          if (Number.isFinite(nextRetryAt)) scheduleProcess(nextRetryAt - now);
          break;
        }

        await Promise.all(readyItems.map((item) => uploadOne(item)));
      }
    } finally {
      activeRef.current = false;
      notifyWaiters();
    }
  }

  function enqueue(attachment) {
    if (!attachment?.id || !attachment?.uri) return;
    if (queueRef.current.some((item) => item.id === attachment.id)) return;
    replaceQueue((current) => [
      ...current,
      {
        id: attachment.id,
        uri: attachment.uri,
        type: attachment.type || "image",
        status: "queued",
        attempts: 0,
        progress: 0,
        createdAt: Date.now(),
      },
    ]);
    scheduleProcess();
  }

  function remove(ids) {
    const idList = Array.isArray(ids) ? ids : [ids];
    idList.forEach((id) => {
      const task = uploadTasksRef.current[id];
      if (task?.cancel) task.cancel();
      delete uploadTasksRef.current[id];
    });
    replaceQueue((current) => current.filter((item) => !idList.includes(item.id)));
  }

  function retry(id) {
    updateQueueItem(id, {
      status: "queued",
      attempts: 0,
      progress: 0,
      error: "",
      nextRetryAt: null,
      failedAt: null,
    });
    scheduleProcess();
  }

  function waitForUploadsComplete(ids) {
    const idList = ids?.length ? ids : null;
    const hasPending = queueRef.current.some((item) => {
      const inScope = !idList || idList.includes(item.id);
      return inScope && UPLOAD_PENDING_STATUSES.has(item.status);
    });
    if (!hasPending) return Promise.resolve();
    return new Promise((resolve) => waitersRef.current.push({ ids: idList, resolve }));
  }

  function getItem(id) {
    return queueRef.current.find((item) => item.id === id) || null;
  }

  async function setMode(nextMode) {
    modeRef.current = nextMode;
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(UPLOAD_MODE_KEY, nextMode);
    } catch (error) {
      // Ignore mode persistence errors.
    }
    scheduleProcess();
  }

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    (async () => {
      try {
        const [storedQueue, storedMode] = await Promise.all([
          AsyncStorage.getItem(UPLOAD_QUEUE_KEY),
          AsyncStorage.getItem(UPLOAD_MODE_KEY),
        ]);
        if (cancelled) return;

        const nextMode = ["auto", "fast", "dataSaver"].includes(storedMode) ? storedMode : "auto";
        modeRef.current = nextMode;
        setModeState(nextMode);

        const parsedQueue = storedQueue ? JSON.parse(storedQueue) : [];
        replaceQueue(sanitizeUploadQueue(parsedQueue));
        scheduleProcess();
      } catch (error) {
        replaceQueue([]);
      }
    })();

    try {
      let NetInfo = null;
      try {
        NetInfo = eval("require")("@react-native-community/netinfo");
      } catch (e) {
        NetInfo = null;
      }
      if (NetInfo?.addEventListener) {
        unsubscribe = NetInfo.addEventListener((state) => {
          const type = state?.isConnected === false ? "none" : state?.type || "unknown";
          setNetworkType(type);
          if (type !== "none") scheduleProcess();
        });
      }
    } catch (error) {
      // Optional dependency fallback.
    }

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const pendingCount = items.filter((item) => UPLOAD_PENDING_STATUSES.has(item.status)).length;

  return {
    items,
    mode,
    networkType,
    pendingCount,
    enqueue,
    remove,
    retry,
    waitForUploadsComplete,
    getItem,
    setMode,
  };
}

function profileNameFromEmail(email) {
  if (!email) return "Ratnica";
  const localPart = email.split("@")[0] || "Ratnica";
  const words = localPart.split(/[._-]+/).filter(Boolean);
  return words.map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(" ") || "Ratnica";
}

function profileNameFromUser({ displayName, email, fallback }) {
  const cleanName = displayName?.trim();
  if (cleanName) return cleanName;
  return fallback?.trim() || profileNameFromEmail(email);
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("welcome");
  const [screen, setScreen] = useState("home");
  const [screenParams, setScreenParams] = useState(null);
  const uploadQueue = usePersistentUploadQueue();
  const [history, setHistory] = useState(["home"]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trainingTab, setTrainingTab] = useState("Svi programi");
  const [communityTab, setCommunityTab] = useState("Chat");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({ name: "Ratnica", goal: "Disciplina. Fokus. Sloboda.", email: "", age: "", level: "Pocetnica" });

  const googleConfigured = Object.values(googleClientIds).some(Boolean);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleClientIds);

  useEffect(() => {
    async function finishGoogleLogin() {
      if (Platform.OS !== "web") return;
      if (response?.type !== "success") return;
      const idToken = response.params?.id_token;
      if (!idToken || !hasFirebaseConfig) return;
      try {
        const credential = await loginWithGoogleIdToken(idToken);
        setSession({
          type: "firebase",
          name: profileNameFromUser({ displayName: credential.user.displayName, email: credential.user.email }),
          email: credential.user.email,
          uid: credential.user.uid,
        });
      } catch (error) {
        Alert.alert("Google sign in", error.message);
      }
    }
    finishGoogleLogin();
  }, [response]);

  async function handleGoogleLogin() {
    if (!hasFirebaseConfig || !googleConfigured) {
      Alert.alert("Firebase setup needed", "Paste Firebase keys and Google client IDs in firebaseConfig.js first.");
      return;
    }

    if (Platform.OS === "web") {
      promptAsync();
      return;
    }

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;

      const idToken = response.data.idToken || (await GoogleSignin.getTokens()).idToken;
      if (!idToken) {
        throw new Error("Google did not return an ID token. Check the Web client ID in .env.");
      }

      const credential = await loginWithGoogleIdToken(idToken);
      setSession({
        type: "firebase",
        name: profileNameFromUser({ displayName: credential.user.displayName, email: credential.user.email }),
        email: credential.user.email,
        uid: credential.user.uid,
      });
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
        if (error.code === statusCodes.IN_PROGRESS) return;
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert("Google sign in", "Google Play Services are not available or need an update.");
          return;
        }
      }
      Alert.alert("Google sign in", error.message);
    }
  }

  function enterAsGuest() {
    setSession({ type: "guest", name: profile.name, email: "" });
  }

  useEffect(() => {
    if (!session) return;
    setProfile((current) => {
      const shouldUseSessionName = !current.name || current.name === "Ratnica";
      return {
        ...current,
        name: shouldUseSessionName ? session.name || profileNameFromEmail(session.email) : current.name,
        email: session.email || current.email,
      };
    });
  }, [session]);

  function navigate(next) {
    // support optional params: navigate(name, params)
    const params = arguments[1];
    setScreen(next);
    setScreenParams(params || null);
    setHistory((current) => [...current, next]);
    setDrawerOpen(false);
  }

  function goBack() {
    setHistory((current) => {
      if (current.length <= 1) {
        setScreen("home");
        setScreenParams(null);
        return ["home"];
      }
      const nextHistory = current.slice(0, -1);
      setScreen(nextHistory[nextHistory.length - 1]);
      setScreenParams(null);
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
        onGoogle={handleGoogleLogin}
        request={Platform.OS === "web" ? request : googleConfigured}
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
            <CommunityScreen
              tab={communityTab}
              setTab={setCommunityTab}
              message={message}
              setMessage={setMessage}
              goBack={goBack}
              go={navigate}
              session={session}
              profile={profile}
              uploadQueue={uploadQueue}
            />
          )}
          {screen === "program" && <ProgramDetailScreen program={screenParams} goBack={goBack} />}
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
      onAuth({ type: "demo", name: profileNameFromUser({ email, fallback: name }), email });
      return;
    }
    try {
      const credential =
        mode === "register" ? await registerWithEmail({ email, password, name }) : await loginWithEmail(email, password);
      onAuth({
        type: "firebase",
        name: profileNameFromUser({ displayName: credential.user.displayName, email: credential.user.email, fallback: name }),
        email: credential.user.email,
        uid: credential.user.uid,
      });
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
        <View style={styles.leafMark}>
          <LeafLine />
        </View>
      </View>
      <Text style={styles.sectionLabel}>DANAS TE CEKA</Text>
      <Task title="Trening - Glute Focus" subtitle="45 min" icon="1" />
      <Task title="Dnevni zadatak" subtitle="Odradi trening i popij 2L vode." icon="2" />
      <Task title="Jutarnja poruka" subtitle="Snaga raste iznutra." icon="3" />
      <View style={styles.progressCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.tiny}>PROGRESS TRACKER</Text>
          <LeafLine small />
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

function formatMessageTime(createdAt) {
  const date = createdAt?.toDate?.();
  if (!date) return "sada";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CommunityScreen({ tab, setTab, message, setMessage, goBack, go, session, profile, uploadQueue }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [localMessage, setLocalMessage] = useState(message || "");
  const [openProgram, setOpenProgram] = useState(null);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [programAccess, setProgramAccess] = useState({ loading: false, checked: false, hasAccess: false });
  const [recipeAccess, setRecipeAccess] = useState({ loading: false, checked: false, hasAccess: false });
  const [likes, setLikes] = useState({});
  const [likesCounts, setLikesCounts] = useState({});
  const [imageViewer, setImageViewer] = useState({ visible: false, images: [], index: 0 });

  function openImageViewer(images, index) {
    setImageViewer({ visible: true, images: images || [], index: index || 0 });
  }

  function closeImageViewer() {
    setImageViewer({ visible: false, images: [], index: 0 });
  }

  useEffect(() => {
    setAttachments((current) => {
      const byId = new Map(uploadQueue.items.map((item) => [item.id, item]));
      const currentIds = new Set(current.map((attachment) => attachment.id));
      const nextAttachments = current.map((attachment) => {
        const queued = byId.get(attachment.id);
        if (!queued) return attachment;
        return {
          ...attachment,
          uri: attachment.uri || queued.uri,
          url: queued.url || attachment.url,
          storagePath: queued.storagePath || attachment.storagePath,
          uploading: queued.status === "queued" || queued.status === "uploading",
          uploadFailed: queued.status === "failed",
          progress: queued.progress || 0,
          uploadError: queued.error || "",
          attempts: queued.attempts || 0,
        };
      });

      uploadQueue.items.forEach((item) => {
        if (!currentIds.has(item.id)) {
          nextAttachments.push({
            id: item.id,
            type: item.type || "image",
            uri: item.uri,
            url: item.url,
            storagePath: item.storagePath,
            uploading: item.status === "queued" || item.status === "uploading",
            uploadFailed: item.status === "failed",
            progress: item.progress || 0,
            uploadError: item.error || "",
            attempts: item.attempts || 0,
          });
        }
      });

      return nextAttachments;
    });
  }, [uploadQueue.items]);

  const posts = communityPosts.filter((post) => post.tab === tab);
  const isChat = tab === "Chat";

  useEffect(() => {
    if (!isChat) return undefined;

    let unsubNew = null;
    let cancelled = false;
    setChatLoading(true);

    (async () => {
      try {
        const total = await getCommunityMessagesCount();
        const { messages, lastVisible: last } = await fetchLatestCommunityMessages(20);
        if (cancelled) return;
        setChatMessages(messages);
        // fetch likes counts for loaded messages (page)
        (async () => {
          try {
            const counts = {};
            await Promise.all(
              messages.map(async (m) => {
                try {
                  counts[m.id] = await getLikesCount(m.id);
                } catch (err) {
                  counts[m.id] = 0;
                }
              }),
            );
            setLikesCounts(counts);
          } catch (err) {
            // ignore
          }
        })();
        setLastVisible(last);
        setHasMore(!!last && total > messages.length);
        setChatError("");
      } catch (error) {
        setChatError(error.message);
      } finally {
        setChatLoading(false);
      }

      // subscribe to newest message only (realtime append)
      unsubNew = subscribeToNewCommunityMessages(
        (newMsg) => {
          setChatMessages((current) => {
            if (current.some((m) => m.id === newMsg.id)) return current;
            return [...current, newMsg];
          });
        },
        (err) => {
          console.log("subscribe new message error", err);
        },
      );
    })();

    return () => {
      cancelled = true;
      if (unsubNew) unsubNew();
      // discard messages from device when leaving community screen
      setChatMessages([]);
      setLastVisible(null);
      setHasMore(false);
    };
  }, [isChat]);

  useEffect(() => {
    if (!openRecipe) {
      setRecipeAccess({ loading: false, checked: false, hasAccess: false });
      return undefined;
    }

    let cancelled = false;

    async function checkRecipeAccess() {
      const requiredSubscription = getRecipeRequiredSubscription(openRecipe);
      const localRecords = [profile, session, profile?.subscription, session?.subscription].filter(Boolean);
      if (localRecords.some((record) => hasRecipeSubscription(record, requiredSubscription))) {
        setRecipeAccess({ loading: false, checked: true, hasAccess: true });
        return;
      }

      if (session?.type !== "firebase") {
        setRecipeAccess({ loading: false, checked: true, hasAccess: false });
        return;
      }

      setRecipeAccess({ loading: true, checked: false, hasAccess: false });
      try {
        const subscriptionRecords = await getUserSubscription({ uid: session?.uid, email: session?.email || profile?.email });
        if (!cancelled) {
          setRecipeAccess({
            loading: false,
            checked: true,
            hasAccess: subscriptionRecords.some((record) => hasRecipeSubscription(record, requiredSubscription)),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRecipeAccess({ loading: false, checked: true, hasAccess: false });
        }
      }
    }

    checkRecipeAccess();

    return () => {
      cancelled = true;
    };
  }, [openRecipe, profile, session]);

  useEffect(() => {
    if (!openProgram) {
      setProgramAccess({ loading: false, checked: false, hasAccess: false });
      return undefined;
    }

    let cancelled = false;

    async function checkProgramAccess() {
      const requiredSubscription = getProgramRequiredSubscription(openProgram);
      const localRecords = [profile, session, profile?.subscription, session?.subscription].filter(Boolean);
      if (localRecords.some((record) => hasProgramSubscription(record, requiredSubscription))) {
        setProgramAccess({ loading: false, checked: true, hasAccess: true });
        return;
      }

      if (session?.type !== "firebase") {
        setProgramAccess({ loading: false, checked: true, hasAccess: false });
        return;
      }

      setProgramAccess({ loading: true, checked: false, hasAccess: false });
      try {
        const subscriptionRecords = await getUserSubscription({ uid: session?.uid, email: session?.email || profile?.email });
        if (!cancelled) {
          setProgramAccess({
            loading: false,
            checked: true,
            hasAccess: subscriptionRecords.some((record) => hasProgramSubscription(record, requiredSubscription)),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setProgramAccess({ loading: false, checked: true, hasAccess: false });
        }
      }
    }

    checkProgramAccess();

    return () => {
      cancelled = true;
    };
  }, [openProgram, profile, session]);

  async function loadOlderMessages() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { messages: older, lastVisible: newLast, hasMore: more } = await fetchCommunityMessagesBefore(lastVisible, 20);
      if (older && older.length) {
        setChatMessages((current) => [...older, ...current]);
        // fetch likes counts for newly loaded older messages
        (async () => {
          try {
            const counts = {};
            await Promise.all(
              older.map(async (m) => {
                try {
                  counts[m.id] = await getLikesCount(m.id);
                } catch (err) {
                  counts[m.id] = 0;
                }
              }),
            );
            setLikesCounts((cur) => ({ ...counts, ...cur }));
          } catch (err) {
            // ignore
          }
        })();
        setLastVisible(newLast);
        setHasMore(more);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      setChatError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePickLibrary() {
    setAttachModalOpen(false);
    try {
      const ImagePicker = require("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photo", "Permission to access photos is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions?.Images || ImagePicker.MediaType.Images, quality: 0.7 });
      // handle both old (`cancelled`) and new (`canceled` + `assets`) API shapes
      const canceled = result.cancelled === true || result.canceled === true;
      if (canceled) return;
      const uri = result.uri || (result.assets && result.assets[0] && result.assets[0].uri);
      if (!uri) return;
      const att = { id: `img-${Date.now()}`, type: "image", uri, uploading: true, progress: 0 };
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAttachments((cur) => [...cur, att]);
      uploadQueue.enqueue(att);
    } catch (err) {
      Alert.alert("Photo", "Image picker not available. Install expo-image-picker.");
    }
  }

  async function handleTakePhoto() {
    setAttachModalOpen(false);
    try {
      const ImagePicker = require("expo-image-picker");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera", "Permission to access camera is required.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions?.Images || ImagePicker.MediaType.Images, quality: 0.7 });
      const canceled = result.cancelled === true || result.canceled === true;
      if (canceled) return;
      const uri = result.uri || (result.assets && result.assets[0] && result.assets[0].uri);
      if (!uri) return;
      const att = { id: `img-${Date.now()}`, type: "image", uri, uploading: true, progress: 0 };
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAttachments((cur) => [...cur, att]);
      uploadQueue.enqueue(att);
    } catch (err) {
      Alert.alert("Camera", "Camera not available. Install expo-image-picker/expo-camera.");
    }
  }

  async function handleProgressShare() {
    setAttachModalOpen(false);
    try {
      const identifier = session?.email || profile?.email || "";
      const programs = await getUserActivePrograms(identifier);
      if (!programs.length) {
        Alert.alert("Progress share", "No active programs found to share.");
        return;
      }
      // For simplicity pick first program as shareable progress snippet
      const prog = programs[0];
      // create a progress attachment instead of stuffing text into the input
      const percent = prog.progress ?? prog.percent ?? prog.completed ?? 0;
      const att = {
        id: `prog-${Date.now()}`,
        type: "progress",
        programId: prog.id || prog.title,
        title: prog.title || prog.name || "Program",
        image: prog.img || prog.image || image.glutes,
        userName: profile?.name || session?.name || "",
        progressPercent: percent,
        requiredSubscription: prog.requiredSubscription || PROGRAM_REQUIRED_SUBSCRIPTION,
        meta: prog,
      };
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAttachments((cur) => [...cur, att]);
      // also append a short summary in the textbox for context
      const summary = `${att.title} - ${att.progressPercent}%`;
      setLocalMessage((m) => (m ? `${m} ${summary}` : summary));
    } catch (err) {
      Alert.alert("Progress share", err.message);
    }
  }

  function openRecipePicker() {
    setAttachModalOpen(false);
    setRecipePickerOpen(true);
  }

  function chooseRecipe(recipe) {
    // attach recipe as an attachment (with thumbnail + watermark)
    const att = {
      id: `recipe-${Date.now()}`,
      type: "recipe",
      recipeId: recipe.title,
      title: recipe.title,
      image: recipe.image || recipe.img || image.smoothie,
      requiredSubscription: recipe.requiredSubscription || RECIPE_REQUIRED_SUBSCRIPTION,
      meta: recipe,
    };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAttachments((cur) => [...cur, att]);
    setLocalMessage((m) => (m ? `${m} Recipe: ${recipe.title}` : `Recipe: ${recipe.title}`));
    setRecipePickerOpen(false);
  }

  async function sendMessage() {
    const cleanMessage = (localMessage || "").trim();
    if (!cleanMessage && attachments.length === 0) return;
    if (session?.type !== "firebase") {
      Alert.alert("Chat", "Prijavi se s emailom ili Google racunom za slanje poruka.");
      return;
    }

    setSending(true);
    try {
      const imageIds = attachments.filter((att) => att.type === "image").map((att) => att.id);
      await uploadQueue.waitForUploadsComplete(imageIds);

      const finalAttachments = attachments
        .map((att) => {
          if (att.type === "image") {
            const queued = uploadQueue.getItem(att.id);
            const uploaded = queued || att;
            if (uploaded.status === "failed" || att.uploadFailed) {
              throw new Error("Jedna fotografija nije uploadana. Pokusaj ponovno ili je ukloni.");
            }
            if (uploaded.url) return { id: att.id, type: "image", url: uploaded.url, storagePath: uploaded.storagePath || null };
            if (att.url) return { id: att.id, type: "image", url: att.url, storagePath: att.storagePath || null };
            if (att.image) return { id: att.id, type: "image", url: att.image, storagePath: att.storagePath || null };
            throw new Error("Pricekaj da upload fotografije zavrsi prije slanja.");
          }
          if (att.type === "recipe") {
            return {
              id: att.id,
              type: "recipe",
              recipeId: att.recipeId || att.meta?.id || att.title,
              title: att.title,
              image: att.image,
              requiredSubscription: att.requiredSubscription || att.meta?.requiredSubscription || RECIPE_REQUIRED_SUBSCRIPTION,
              meta: att.meta,
            };
          }
          if (att.type === "progress") {
            return {
              id: att.id,
              type: "progress",
              programId: att.programId,
              title: att.title,
              image: att.image,
              userName: att.userName,
              progressPercent: att.progressPercent,
              requiredSubscription: att.requiredSubscription || att.meta?.requiredSubscription || PROGRAM_REQUIRED_SUBSCRIPTION,
              meta: att.meta,
            };
          }
          return att;
        })
        .filter(Boolean);

      await sendCommunityMessage({
        text: cleanMessage,
        attachments: finalAttachments,
        user: {
          name: profile.name || session.name,
          email: session.email,
        },
      });

      setLocalMessage("");
      setAttachments([]);
      uploadQueue.remove(imageIds);
    } catch (error) {
      Alert.alert("Chat", error?.message || String(error));
    } finally {
      setSending(false);
    }
  }

  function removeAttachment(id) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    uploadQueue.remove(id);
    setAttachments((cur) => cur.filter((a) => a.id !== id));
  }

  async function toggleLike(messageId) {
    if (session?.type !== "firebase") {
      Alert.alert("Like", "Please sign in to like posts.");
      return;
    }
    try {
      const res = await toggleMessageLike(messageId);
      setLikes((cur) => ({ ...cur, [messageId]: res.liked }));
      setLikesCounts((cur) => ({ ...cur, [messageId]: Math.max((cur[messageId] || 0) + (res.liked ? 1 : -1), 0) }));
    } catch (err) {
      Alert.alert("Like", err?.message || String(err));
    }
  }

  function offerRecipeSubscription() {
    const requiredSubscription = getRecipeRequiredSubscription(openRecipe);
    Alert.alert(
      `${requiredSubscription} subscription`,
      `This shared recipe is included with the ${requiredSubscription} subscription. Purchase or restore that subscription to unlock the full recipe text.`,
    );
  }

  function offerProgramSubscription() {
    const requiredSubscription = getProgramRequiredSubscription(openProgram);
    Alert.alert(
      `${requiredSubscription} subscription`,
      `This shared program update is included with the ${requiredSubscription} subscription. Purchase or restore that subscription to unlock the full update.`,
    );
  }

  return (
    <>
      <ScreenHeader title="COMMUNITY" onBack={goBack} />
      <Tabs tabs={["Chat", "Grupe", "Aktivnosti", "Izazovi"]} active={tab} setActive={setTab} />
      <View style={styles.communityList}>
        {isChat ? (
          <>
            {chatLoading && <Text style={styles.chatStatus}>Ucitavam chat...</Text>}
            {!!chatError && <Text style={styles.chatStatus}>Chat nije dostupan: {chatError}</Text>}
            {!chatLoading && !chatError && chatMessages.length === 0 && (
              <Text style={styles.chatStatus}>Budi prva koja salje poruku.</Text>
            )}
            {hasMore && (
              <Pressable style={styles.loadMore} onPress={loadOlderMessages} disabled={loadingMore}>
                <Text style={styles.chatStatus}>{loadingMore ? "Ucitavam..." : "Ucitaj ranije poruke"}</Text>
              </Pressable>
            )}
            {chatMessages.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(post.name || "R").slice(0, 1)}</Text>
                </View>
                <View style={styles.postBody}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.postName}>{post.name || "Ratnica"}</Text>
                    <Text style={styles.postTime}>{formatMessageTime(post.createdAt)}</Text>
                  </View>
                  <Text style={styles.postText}>{post.text}</Text>
                  {/* render attachments inside messages */}
                  {post.attachments && post.attachments.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {post.attachments.map((att, i) => (
                        <View key={att.id || i} style={{ marginBottom: 8 }}>
                          {att.type === "image" && (
                            <Pressable onPress={() => {
                              const imgs = (post.attachments || []).filter((a) => a.type === "image").map((a) => a.url || a.image || a.uri);
                              const current = att.url || att.image || att.uri;
                              const idx = imgs.findIndex((u) => u === current);
                              openImageViewer(imgs, idx >= 0 ? idx : 0);
                            }}>
                              <Image source={{ uri: att.uri || att.image || att.url }} style={styles.messageImage} />
                            </Pressable>
                          )}
                          {att.type === "recipe" && (
                            <Pressable onPress={() => setOpenRecipe(att)} style={styles.messageImageWrap}>
                              <Image source={{ uri: att.image }} style={styles.messageImage} />
                              <View style={styles.attachmentBadge}><Text style={styles.attachmentBadgeText}>Recipe</Text></View>
                            </Pressable>
                          )}
                          {att.type === "progress" && (
                            <View style={styles.progressMiniWrap}>
                              <Pressable style={styles.messageImageWrap} onPress={() => setOpenProgram(att)}>
                                <Image source={{ uri: att.image }} style={styles.messageImage} />
                                <View style={styles.attachmentBadge}><Text style={styles.attachmentBadgeText}>Progress</Text></View>
                              </Pressable>
                              <Pressable style={styles.progressLike} onPress={() => toggleLike(post.id)}>
                                <Text style={{ color: likes[post.id] ? colors.danger : colors.muted }}>{likes[post.id] ? "♥" : "♡"}</Text>
                              </Pressable>
                              <Text style={styles.likesCount}>{likesCounts[post.id] || 0}</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
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
          </>
        )}
      </View>

      {isChat && (
        <>
          <View style={styles.messageBar}>
            <Pressable style={styles.attachButton} onPress={() => setAttachModalOpen(true)}>
              <Text style={styles.attachText}>+</Text>
            </Pressable>
              <TextInput
                value={localMessage}
                onChangeText={setLocalMessage}
                placeholder="Napisi poruku..."
                placeholderTextColor={colors.muted}
                style={styles.messageInput}
              />
            <Pressable style={[styles.sendCircle, sending && styles.disabledButton]} onPress={sendMessage} disabled={sending}>
              <Text style={styles.sendText}>{sending ? "..." : "✈"}</Text>
            </Pressable>
          </View>

            {/* attachments preview above message bar */}
            {attachments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsPreview} contentContainerStyle={{ gap: 8 }}>
                {attachments.map((att) => (
                  <View key={att.id} style={styles.attachmentThumbWrap}>
                    {att.type === "image" ? (
                      <Pressable onPress={() => {
                        const imgs = attachments.filter((a) => a.type === "image").map((a) => a.url || a.image || a.uri);
                        const current = att.url || att.image || att.uri;
                        const idx = imgs.findIndex((u) => u === current);
                        openImageViewer(imgs, idx >= 0 ? idx : 0);
                      }}>
                        <Image source={{ uri: att.uri || att.image || att.url }} style={styles.attachmentThumb} />
                      </Pressable>
                    ) : (
                      <Image source={{ uri: att.uri || att.image || att.url }} style={styles.attachmentThumb} />
                    )}
                    <Pressable style={styles.attachmentRemove} onPress={() => removeAttachment(att.id)}>
                      <Text style={styles.attachmentRemoveText}>×</Text>
                    </Pressable>
                    {(att.uploading || att.uploadFailed || att.url) && (
                      <View style={styles.attachmentUploadingOverlay} pointerEvents={att.uploadFailed ? "auto" : "none"}>
                        <Text style={styles.uploadProgressText}>{att.progress ? `${att.progress}%` : "…"}</Text>
                      </View>
                    )}
                    {att.uploadFailed && (
                      <Pressable style={styles.uploadRetryButtonFloating} onPress={() => uploadQueue.retry(att.id)}>
                        <Text style={styles.uploadRetryText}>Retry</Text>
                      </Pressable>
                    )}
                    {att.type === "recipe" && <View style={styles.attachmentBadge}><Text style={styles.attachmentBadgeText}>Recipe</Text></View>}
                    {att.type === "progress" && <View style={styles.attachmentBadge}><Text style={styles.attachmentBadgeText}>Progress</Text></View>}
                  </View>
                ))}
              </ScrollView>
            )}

          <Modal visible={attachModalOpen} transparent animationType="fade" onRequestClose={() => setAttachModalOpen(false)}>
            <Pressable style={styles.drawerShade} onPress={() => setAttachModalOpen(false)}>
              <View style={[styles.drawer, { width: 300, margin: 40 }]}>
                <Text style={styles.potionSectionTitle}>Dodaj u poruku</Text>
                <Pressable style={{ paddingVertical: 12 }} onPress={handlePickLibrary}><Text>Photo from library</Text></Pressable>
                <Pressable style={{ paddingVertical: 12 }} onPress={handleTakePhoto}><Text>Take photo</Text></Pressable>
                <Pressable style={{ paddingVertical: 12 }} onPress={handleProgressShare}><Text>Progress share</Text></Pressable>
                <Pressable style={{ paddingVertical: 12 }} onPress={openRecipePicker}><Text>Recipe</Text></Pressable>
                <Text style={styles.uploadModeLabel}>Upload speed: {uploadQueue.networkType}</Text>
                <View style={styles.uploadModeRow}>
                  {[
                    ["auto", "Auto"],
                    ["fast", "Fast"],
                    ["dataSaver", "Saver"],
                  ].map(([value, label]) => (
                    <Pressable
                      key={value}
                      style={[styles.uploadModePill, uploadQueue.mode === value && styles.uploadModePillActive]}
                      onPress={() => uploadQueue.setMode(value)}
                    >
                      <Text style={[styles.uploadModeText, uploadQueue.mode === value && styles.uploadModeTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Pressable>
          </Modal>

          <Modal visible={recipePickerOpen} transparent animationType="fade" onRequestClose={() => setRecipePickerOpen(false)}>
            <Pressable style={styles.drawerShade} onPress={() => setRecipePickerOpen(false)}>
              <View style={[styles.drawer, { width: 320, margin: 40 }]}>
                <Text style={styles.potionSectionTitle}>Choose recipe</Text>
                {potions.map((p) => (
                  <Pressable key={p.title} style={{ paddingVertical: 12 }} onPress={() => chooseRecipe(p)}>
                    <Text>{p.title}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
          {/* program detail modal */}
          <Modal visible={!!openProgram} transparent animationType="slide" onRequestClose={() => setOpenProgram(null)}>
            <Pressable style={styles.drawerShade} onPress={() => setOpenProgram(null)}>
              <Pressable style={[styles.drawer, styles.recipeDrawer]}>
                {openProgram && (
                  <ProgramUpdateContent program={openProgram} access={programAccess} onSubscribe={offerProgramSubscription} />
                )}
              </Pressable>
            </Pressable>
          </Modal>

          {/* recipe detail modal */}
          <Modal visible={!!openRecipe} transparent animationType="slide" onRequestClose={() => setOpenRecipe(null)}>
            <Pressable style={styles.drawerShade} onPress={() => setOpenRecipe(null)}>
              <Pressable style={[styles.drawer, styles.recipeDrawer]}>
                {openRecipe && (
                  <RecipeDetailContent recipe={openRecipe} access={recipeAccess} onSubscribe={offerRecipeSubscription} />
                )}
              </Pressable>
            </Pressable>
          </Modal>
          {/* full screen image viewer */}
          <Modal visible={imageViewer.visible} transparent animationType="fade" onRequestClose={closeImageViewer}>
            <FullScreenImageViewer
              images={imageViewer.images}
              index={imageViewer.index}
              onClose={closeImageViewer}
              onIndexChange={(index) => setImageViewer((current) => ({ ...current, index }))}
            />
          </Modal>
        </>
      )}
    </>
  );
}

function getTouchDistance(touches) {
  if (!touches || touches.length < 2) return 0;
  const [first, second] = touches;
  const dx = first.pageX - second.pageX;
  const dy = first.pageY - second.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function FullScreenImageViewer({ images = [], index = 0, onClose, onIndexChange }) {
  const safeImages = images.filter(Boolean);
  const currentIndex = Math.min(Math.max(index, 0), Math.max(safeImages.length - 1, 0));
  const currentImage = safeImages[currentIndex];
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const baseScaleRef = useRef(1);
  const currentScaleRef = useRef(1);
  const baseTranslateRef = useRef({ x: 0, y: 0 });
  const pinchStartRef = useRef(0);

  function resetImage(animated = true) {
    baseScaleRef.current = 1;
    currentScaleRef.current = 1;
    baseTranslateRef.current = { x: 0, y: 0 };
    const updates = [
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ];
    if (animated) Animated.parallel(updates).start();
    else {
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  }

  function moveTo(nextIndex) {
    if (nextIndex < 0 || nextIndex >= safeImages.length) {
      resetImage();
      return;
    }
    resetImage(false);
    onIndexChange(nextIndex);
  }

  useEffect(() => {
    resetImage(false);
  }, [currentImage]);

  const panResponder = useMemo(
    () =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches || [];
        pinchStartRef.current = getTouchDistance(touches);
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches || [];
        if (touches.length >= 2) {
          const nextDistance = getTouchDistance(touches);
          if (!pinchStartRef.current) pinchStartRef.current = nextDistance;
          const nextScale = Math.min(4, Math.max(1, baseScaleRef.current * (nextDistance / pinchStartRef.current)));
          currentScaleRef.current = nextScale;
          scale.setValue(nextScale);
          return;
        }

        if (baseScaleRef.current > 1.05) {
          translateX.setValue(baseTranslateRef.current.x + gesture.dx);
          translateY.setValue(baseTranslateRef.current.y + gesture.dy);
          return;
        }

        translateX.setValue(gesture.dx);
        translateY.setValue(Math.max(gesture.dy, -40));
      },
      onPanResponderRelease: (event, gesture) => {
        const touches = event.nativeEvent.touches || [];
        if (touches.length >= 2) return;

        const settledScale = Math.min(4, Math.max(1, currentScaleRef.current));
        baseScaleRef.current = settledScale;
        scale.setValue(settledScale);

        if (settledScale > 1.05) {
          baseTranslateRef.current = {
            x: baseTranslateRef.current.x + gesture.dx,
            y: baseTranslateRef.current.y + gesture.dy,
          };
          return;
        }

        if (gesture.dy > 110 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
          onClose();
          return;
        }

        if (Math.abs(gesture.dx) > 70 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25) {
          moveTo(gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1);
          return;
        }

        resetImage();
      },
      onPanResponderTerminate: () => resetImage(),
    }),
    [currentIndex, safeImages.length, onClose, onIndexChange],
  );

  if (!currentImage) {
    return (
      <View style={styles.viewerContainer}>
        <Pressable style={styles.viewerClose} onPress={onClose}>
          <Text style={styles.viewerCloseText}>x</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.viewerContainer} {...panResponder.panHandlers}>
      <Animated.Image
        source={{ uri: currentImage }}
        style={[styles.viewerImage, { transform: [{ translateX }, { translateY }, { scale }] }]}
      />
      <Pressable style={styles.viewerClose} onPress={onClose}>
        <Text style={styles.viewerCloseText}>x</Text>
      </Pressable>
      {safeImages.length > 1 && (
        <>
          <Pressable style={styles.viewerPrev} onPress={() => moveTo(currentIndex - 1)}>
            <Text style={styles.viewerArrowText}>{"<"}</Text>
          </Pressable>
          <Pressable style={styles.viewerNext} onPress={() => moveTo(currentIndex + 1)}>
            <Text style={styles.viewerArrowText}>{">"}</Text>
          </Pressable>
          <Text style={styles.viewerCounter}>{currentIndex + 1}/{safeImages.length}</Text>
        </>
      )}
    </View>
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

function RecipeDetailContent({ recipe, access, onSubscribe }) {
  const details = getRecipeText(recipe);
  const requiredSubscription = getRecipeRequiredSubscription(recipe);
  const ingredients = Array.isArray(details.ingredients)
    ? details.ingredients
    : String(details.ingredients || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return (
    <>
      <Image source={{ uri: recipe.image || details.image }} style={styles.recipeDetailImage} />
      <Text style={styles.potionSectionTitle}>{recipe.title || details.title}</Text>
      {access.loading && <Text style={styles.recipeGateText}>Provjeravam pretplatu...</Text>}
      {!access.loading && access.hasAccess && (
        <ScrollView style={styles.recipeDetailScroll} contentContainerStyle={styles.recipeDetailContent} nestedScrollEnabled showsVerticalScrollIndicator>
          {!!details.timing && <Text style={styles.potionTiming}>{details.timing}</Text>}
          {ingredients.length > 0 && <PotionSection title="Sastojci" items={ingredients} />}
          {!!details.preparation && (
            <>
              <Text style={styles.potionSectionTitle}>Priprema</Text>
              <Text style={styles.potionBody}>{details.preparation}</Text>
            </>
          )}
          {!!details.benefits && (
            <>
              <Text style={styles.potionSectionTitle}>Benefiti</Text>
              <Text style={styles.potionBody}>{details.benefits}</Text>
            </>
          )}
        </ScrollView>
      )}
      {!access.loading && access.checked && !access.hasAccess && (
        <View style={styles.subscriptionGate}>
          <Text style={styles.recipeGateTitle}>{requiredSubscription} pretplata</Text>
          <Text style={styles.recipeGateText}>Za otvaranje cijelog recepta potrebna je {requiredSubscription} pretplata.</Text>
          <Pressable style={styles.subscriptionButton} onPress={onSubscribe}>
            <Text style={styles.subscriptionButtonText}>Pogledaj pretplatu</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

function ProgramUpdateContent({ program, access, onSubscribe }) {
  const details = getProgramText(program);
  const requiredSubscription = getProgramRequiredSubscription(program);
  const hasProgress = details.progressPercent !== "" && details.progressPercent !== null && details.progressPercent !== undefined;
  const progressLabel = `${details.progressPercent}${String(details.progressPercent).includes("%") ? "" : "%"}`;

  return (
    <>
      <Image source={{ uri: program.image || details.image }} style={styles.recipeDetailImage} />
      <Text style={styles.potionSectionTitle}>{program.title || details.title}</Text>
      {access.loading && <Text style={styles.recipeGateText}>Provjeravam pretplatu...</Text>}
      {!access.loading && access.hasAccess && (
        <ScrollView style={styles.recipeDetailScroll} contentContainerStyle={styles.recipeDetailContent} nestedScrollEnabled showsVerticalScrollIndicator>
          {!!details.duration && <Text style={styles.body}>{details.duration}</Text>}
          {!!details.level && <Text style={styles.potionBody}>{details.level}</Text>}
          {hasProgress && (
            <>
              <Text style={styles.potionSectionTitle}>Napredak</Text>
              <Text style={styles.potionBody}>{progressLabel} dovrseno</Text>
            </>
          )}
          <Text style={styles.potionSectionTitle}>Opis</Text>
          <Text style={styles.potionBody}>{details.description}</Text>
        </ScrollView>
      )}
      {!access.loading && access.checked && !access.hasAccess && (
        <View style={styles.subscriptionGate}>
          <Text style={styles.recipeGateTitle}>{requiredSubscription} pretplata</Text>
          <Text style={styles.recipeGateText}>Za otvaranje cijelog programskog updatea potrebna je {requiredSubscription} pretplata.</Text>
          <Pressable style={styles.subscriptionButton} onPress={onSubscribe}>
            <Text style={styles.subscriptionButtonText}>Pogledaj pretplatu</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

function ProfileScreen({ profile, setProfile, goBack, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

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
              {!!profile.email && <Text style={styles.profileEmail}>{profile.email}</Text>}
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

function ProgramDetailScreen({ program, goBack }) {
  const prog = program || {};
  return (
    <>
      <ScreenHeader title={prog.title || "Program"} onBack={goBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <Image source={{ uri: prog.img || prog.image || prog.imageUrl || image.glutes }} style={{ width: "100%", height: 220, borderRadius: 12, marginBottom: 12 }} />
        <Text style={styles.potionSectionTitle}>{prog.title}</Text>
        <Text style={styles.body}>{prog.weeks || prog.meta?.weeks || prog.meta?.duration || ""}</Text>
        <Text style={styles.potionBody}>{prog.meta?.level || prog.level || ""}</Text>
        <Text style={styles.potionSectionTitle}>Opis</Text>
        <Text style={styles.potionBody}>{prog.meta?.description || prog.description || "Detalji programa nisu dostupni."}</Text>
      </ScrollView>
    </>
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
      <View style={styles.quickIcon}>
        <Text style={styles.quickIconText}>{icon}</Text>
      </View>
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

function LeafLine({ small }) {
  const size = small ? 30 : 58;
  const stroke = colors.olive;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 55 C33 40 33 26 32 10" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M32 18 C22 16 15 22 12 34 C24 34 31 28 32 18 Z" stroke={stroke} strokeWidth="1.8" fill="none" />
      <Path d="M32 27 C43 24 51 31 53 44 C40 43 33 37 32 27 Z" stroke={stroke} strokeWidth="1.8" fill="none" />
      <Path d="M31 38 C23 37 17 42 15 52 C25 51 31 47 31 38 Z" stroke={stroke} strokeWidth="1.6" fill="none" />
      <Path d="M33 17 C27 22 21 27 14 34" stroke={stroke} strokeWidth="1" fill="none" opacity={0.6} />
      <Path d="M33 28 C40 33 46 38 52 44" stroke={stroke} strokeWidth="1" fill="none" opacity={0.6} />
    </Svg>
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
  scroll: { padding: 20, paddingBottom: 106 },
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
  topChrome: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 20 },
  menu: { color: colors.forest, fontSize: 30, marginTop: -5 },
  bell: { color: colors.forest, fontSize: 26, marginLeft: "auto", fontWeight: "300" },
  topText: { flex: 1 },
  homeTitle: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  homeSubtitle: { color: colors.ink, fontSize: 12, marginTop: 4 },
  quickGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  quick: { alignItems: "center", width: 62 },
  quickIcon: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 243, 231, 0.74)",
    shadowColor: colors.forest,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickIconText: {
    color: colors.forest,
    fontSize: 15,
    textAlign: "center",
    fontWeight: "700",
  },
  quickLabel: { color: colors.ink, fontSize: 10, marginTop: 8 },
  focusCard: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 17,
    backgroundColor: "rgba(251, 243, 231, 0.72)",
    shadowColor: colors.forest,
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  tiny: { color: colors.muted, fontSize: 10, letterSpacing: 0.6 },
  focusText: { color: colors.ink, fontSize: 18, lineHeight: 24, marginTop: 8, maxWidth: 230 },
  leafMark: { alignSelf: "flex-end", marginBottom: -4 },
  sectionLabel: { color: colors.muted, fontSize: 11, letterSpacing: 0.6, marginBottom: 8, marginTop: 18 },
  taskCard: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(251, 243, 231, 0.74)",
  },
  taskIcon: { color: colors.forest, fontSize: 15, width: 28, fontWeight: "700" },
  taskTextWrap: { flex: 1 },
  taskTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  taskSubtitle: { color: colors.ink, fontSize: 11, marginTop: 3 },
  arrow: { color: colors.forest, fontSize: 23 },
  progressCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    marginTop: 10,
    padding: 15,
    backgroundColor: "rgba(251, 243, 231, 0.74)",
  },
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
  chatStatus: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    padding: 14,
    backgroundColor: "rgba(251, 243, 231, 0.74)",
  },
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
  attachButton: { width: 46, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  attachText: { color: colors.forest, fontSize: 22, fontWeight: "700" },
  loadMore: { alignItems: "center", marginBottom: 8 },
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
  profileCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
    padding: 14,
    backgroundColor: "rgba(251, 243, 231, 0.78)",
  },
  profileImage: { width: 86, height: 86, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  profileText: { flex: 1 },
  profileName: { color: colors.ink, fontSize: 22, fontWeight: "500" },
  profileMotto: { color: colors.ink, fontSize: 13, marginTop: 5 },
  profileEmail: { color: colors.muted, fontSize: 11, marginTop: 6 },
  profileInput: { borderBottomWidth: 1, borderColor: colors.line, color: colors.ink, minHeight: 34 },
  editGrid: { gap: 10, marginBottom: 14 },
  profileStats: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 18,
    paddingVertical: 14,
    backgroundColor: "rgba(251, 243, 231, 0.74)",
  },
  profileStat: { alignItems: "center", flex: 1 },
  profileStatLabel: { color: colors.muted, fontSize: 11 },
  profileStatValue: { color: colors.ink, fontSize: 22, marginTop: 6 },
  gazzCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, backgroundColor: "rgba(251, 243, 231, 0.78)" },
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
  recipeDrawer: {
    flex: 0,
    width: 320,
    maxHeight: "82%",
    margin: 40,
    borderRadius: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
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
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    backgroundColor: "rgba(251, 243, 231, 0.94)",
    shadowColor: colors.forest,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  navIcon: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  navLabel: { color: colors.muted, fontSize: 10 },
  navActive: { color: colors.forest, fontWeight: "700" },
  attachmentsPreview: { marginTop: 10, marginBottom: 6 },
  attachmentThumbWrap: { width: 96, height: 96, borderRadius: 12, overflow: "hidden", marginRight: 8, position: "relative", backgroundColor: colors.card, shadowColor: colors.forest, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  attachmentThumb: { width: 96, height: 96, resizeMode: "cover" },
  attachmentRemove: { width: 28, height: 28, borderRadius: 14, position: "absolute", top: -8, right: -8, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger },
  attachmentRemoveText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  attachmentBadge: { position: "absolute", left: 6, bottom: 6, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  attachmentBadgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  attachmentUploadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center" },
  uploadProgressText: { color: colors.white, fontWeight: "700" },
  uploadRetryButtonFloating: { position: "absolute", right: 8, bottom: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.white },
  uploadRetryText: { color: colors.danger, fontSize: 11, fontWeight: "700" },
  uploadModeLabel: { color: colors.muted, fontSize: 12, marginTop: 14, marginBottom: 8 },
  uploadModeRow: { flexDirection: "row", gap: 8 },
  uploadModePill: { minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  uploadModePillActive: { backgroundColor: colors.forest },
  uploadModeText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  uploadModeTextActive: { color: colors.white },
  viewerContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "100%", resizeMode: "contain" },
  viewerClose: { position: "absolute", top: 40, right: 20, backgroundColor: "transparent" },
  viewerCloseText: { color: colors.white, fontSize: 22, fontWeight: "700" },
  viewerPrev: { position: "absolute", left: 20, top: "50%", transform: [{ translateY: -24 }] },
  viewerNext: { position: "absolute", right: 20, top: "50%", transform: [{ translateY: -24 }] },
  viewerArrowText: { color: colors.white, fontSize: 36, fontWeight: "700" },
  viewerCounter: { position: "absolute", bottom: 40, color: colors.white, fontSize: 14 },
  messageImage: { width: 180, height: 110, borderRadius: 10, resizeMode: "cover" },
  messageImageWrap: { borderRadius: 10, overflow: "hidden" },
  progressMiniWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressLike: { marginLeft: 8, padding: 6 },
  likesCount: { color: colors.muted, marginLeft: 6, fontSize: 12 },
  recipeDetailImage: { width: "100%", height: 140, borderRadius: 12, resizeMode: "cover" },
  recipeDetailScroll: { maxHeight: 340, marginTop: 6 },
  recipeDetailContent: { paddingBottom: 12 },
  subscriptionGate: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    marginTop: 10,
    padding: 14,
    backgroundColor: colors.card,
  },
  recipeGateTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginBottom: 6 },
  recipeGateText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  subscriptionButton: { minHeight: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 12, backgroundColor: colors.forest },
  subscriptionButtonText: { color: colors.white, fontSize: 12, fontWeight: "700" },
});
