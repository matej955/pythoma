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
  fetchAppContent,
  fetchAppContentManifest,
  getCommunityMessagesCount,
  fetchLatestCommunityMessages,
  fetchCommunityMessagesBefore,
  subscribeToNewCommunityMessages,
  getUserActivePrograms,
  getUserSubscription,
  getUserProfile,
  saveUserProfile,
  uploadFileAsync,
  toggleMessageReaction,
  subscribeToMessageReactions,
} from "./firebaseConfig";
import DEFAULT_APP_CONTENT from "./appContent";

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

const FALLBACK_CONTENT = normalizeAppContent(DEFAULT_APP_CONTENT);
const image = FALLBACK_CONTENT.images;
const allPrograms = FALLBACK_CONTENT.programs;
const communityPosts = FALLBACK_CONTENT.communityPosts;
const potions = FALLBACK_CONTENT.potions;
const navItems = FALLBACK_CONTENT.navItems;

const APP_CONTENT_CACHE_KEY = "pythoma_app_content_cache_v1";

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

function arrayWithFallback(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function resolveImageValue(value, images, fallbackKey) {
  if (!value) return images[fallbackKey] || "";
  if (typeof value === "string" && images[value]) return images[value];
  return value;
}

function normalizePrograms(programs, images) {
  return arrayWithFallback(programs, DEFAULT_APP_CONTENT.programs).map((program) => ({
    ...program,
    img: resolveImageValue(program.img || program.image || program.imageUrl || program.imgKey, images, "glutes"),
  }));
}

function normalizePotions(items, images) {
  return arrayWithFallback(items, DEFAULT_APP_CONTENT.potions).map((potion) => ({
    ...potion,
    image: resolveImageValue(potion.image || potion.img || potion.imageUrl || potion.imageKey, images, "smoothie"),
    ingredients: arrayWithFallback(potion.ingredients, []),
  }));
}

function normalizeAppSettings(settings = {}) {
  const defaults = DEFAULT_APP_CONTENT.settings;
  const defaultCommunityReactions = defaults.communityReactions || {};
  const communityReactions = settings.communityReactions || {};
  const allCommunityReactions = arrayWithFallback(communityReactions.all, defaultCommunityReactions.all);
  const quickCommunityReactions = arrayWithFallback(communityReactions.quick, defaultCommunityReactions.quick).filter((emoji) =>
    allCommunityReactions.includes(emoji),
  );

  return {
    ...defaults,
    ...settings,
    trainingTabs: arrayWithFallback(settings.trainingTabs, defaults.trainingTabs),
    communityTabs: arrayWithFallback(settings.communityTabs, defaults.communityTabs),
    communityReactions: {
      ...defaultCommunityReactions,
      ...communityReactions,
      default: communityReactions.default || defaultCommunityReactions.default || allCommunityReactions[0] || "\u2764\ufe0f",
      quick: quickCommunityReactions.length ? quickCommunityReactions : allCommunityReactions.slice(0, 4),
      all: allCommunityReactions,
      enabled: communityReactions.enabled !== false,
    },
    quickActions: arrayWithFallback(settings.quickActions, defaults.quickActions),
    todayTasks: arrayWithFallback(settings.todayTasks, defaults.todayTasks),
    uploadModes: arrayWithFallback(settings.uploadModes, defaults.uploadModes),
    profileStats: arrayWithFallback(settings.profileStats, defaults.profileStats),
    dailyBoard: {
      ...defaults.dailyBoard,
      ...(settings.dailyBoard || {}),
      tabs: arrayWithFallback(settings.dailyBoard?.tabs, defaults.dailyBoard.tabs),
      messages: arrayWithFallback(settings.dailyBoard?.messages, defaults.dailyBoard.messages),
    },
    brandDiscount: {
      ...defaults.brandDiscount,
      ...(settings.brandDiscount || {}),
    },
  };
}

function normalizeAppContent(content = {}) {
  const images = {
    ...DEFAULT_APP_CONTENT.images,
    ...(content.images || content.image || {}),
  };
  const cache = {
    ...DEFAULT_APP_CONTENT.cache,
    ...(content.cache || {}),
  };
  const settings = normalizeAppSettings(content.settings || {});

  return {
    schemaVersion: content.schemaVersion || DEFAULT_APP_CONTENT.schemaVersion,
    modelVersion: content.modelVersion || 1,
    contentVersion: content.contentVersion || "",
    sectionVersions: content.sectionVersions || {},
    cache,
    images,
    programs: normalizePrograms(content.programs || content.allPrograms, images),
    communityPosts: arrayWithFallback(content.communityPosts, DEFAULT_APP_CONTENT.communityPosts),
    potions: normalizePotions(content.potions, images),
    navItems: arrayWithFallback(content.navItems, DEFAULT_APP_CONTENT.navItems),
    settings,
  };
}

function collectContentImageUris(content) {
  const images = content?.images || {};
  const imageValues = Object.values(images);
  const programImages = (content?.programs || []).map((program) => program.img || program.image || program.imageUrl);
  const potionImages = (content?.potions || []).map((potion) => potion.image || potion.img || potion.imageUrl);
  const discountImage = resolveImageValue(content?.settings?.brandDiscount?.image || content?.settings?.brandDiscount?.imageKey, images, "supplements");
  return [...new Set([...imageValues, ...programImages, ...potionImages, discountImage].filter(Boolean))];
}

function getContentCacheTtl(content) {
  const ttl = Number(content?.cache?.ttlMs);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_APP_CONTENT.cache.ttlMs;
}

async function writeContentCache(content) {
  const cachedAt = Date.now();
  const expiresAt = cachedAt + getContentCacheTtl(content);
  await AsyncStorage.setItem(APP_CONTENT_CACHE_KEY, JSON.stringify({ cachedAt, expiresAt, content }));
}

async function readContentCache() {
  const cached = await AsyncStorage.getItem(APP_CONTENT_CACHE_KEY);
  if (!cached) return { content: null, isFresh: false };

  try {
    const parsed = JSON.parse(cached);
    if (!parsed?.content || !parsed?.expiresAt) {
      await AsyncStorage.removeItem(APP_CONTENT_CACHE_KEY);
      return { content: null, isFresh: false };
    }

    const isFresh = parsed.expiresAt > Date.now();
    if (!isFresh) {
      await AsyncStorage.removeItem(APP_CONTENT_CACHE_KEY);
      return { content: null, isFresh: false };
    }

    return { content: normalizeAppContent(parsed.content), isFresh: true };
  } catch (error) {
    await AsyncStorage.removeItem(APP_CONTENT_CACHE_KEY).catch(() => {});
    return { content: null, isFresh: false };
  }
}

function hasCurrentContentVersion(cachedContent, manifest) {
  if (!cachedContent || !manifest?.contentVersion) return false;
  return cachedContent.contentVersion === manifest.contentVersion;
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

function useSyncedAppContent() {
  const [content, setContent] = useState(FALLBACK_CONTENT);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let hasFreshCache = false;
      let cachedContent = null;

      try {
        const cached = await readContentCache();
        hasFreshCache = cached.isFresh;
        cachedContent = cached.content;
        if (cancelled) return;

        if (cachedContent) {
          setContent(cachedContent);
        }
      } catch (error) {}

      if (!hasFirebaseConfig) {
        return;
      }

      try {
        const manifest = await fetchAppContentManifest();
        if (cancelled) return;

        if (hasFreshCache && hasCurrentContentVersion(cachedContent, manifest)) {
          return;
        }

        const remoteContent = await fetchAppContent();
        if (cancelled || !remoteContent) return;
        const nextContent = normalizeAppContent(remoteContent);
        setContent(nextContent);
        writeContentCache(nextContent).catch(() => {});
      } catch (error) {
        // Cached/default content keeps the app usable when Firestore is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const limit = Math.max(0, Number(content?.cache?.imagePrefetchLimit) || 0);
    collectContentImageUris(content)
      .slice(0, limit)
      .forEach((uri) => {
        Image.prefetch(uri).catch(() => {});
      });
  }, [content]);

  return content;
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
  const [subscriptionRecords, setSubscriptionRecords] = useState([]);
  const content = useSyncedAppContent();

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
          uid: credential.user.uid,
          name: profileNameFromUser({ displayName: credential.user.displayName, email: credential.user.email }),
          email: credential.user.email,
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
        uid: credential.user.uid,
        name: profileNameFromUser({ displayName: credential.user.displayName, email: credential.user.email }),
        email: credential.user.email,
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

  useEffect(() => {
    if (session?.type !== "firebase" || !session.uid) return;
    let cancelled = false;

    (async () => {
      try {
        const remoteProfile = await getUserProfile(session.uid);
        if (cancelled || !remoteProfile) return;
        setProfile((current) => ({
          ...current,
          ...remoteProfile,
          email: session.email || remoteProfile.email || current.email,
        }));
      } catch (error) {
        // Local profile remains usable if user sync is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.uid, session?.type]);

  useEffect(() => {
    if (session?.type !== "firebase") {
      setSubscriptionRecords([]);
      return undefined;
    }

    let cancelled = false;
    getUserSubscription({ uid: session.uid, email: session.email })
      .then((records) => {
        if (!cancelled) setSubscriptionRecords(records || []);
      })
      .catch(() => {
        if (!cancelled) setSubscriptionRecords([]);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.uid, session?.email, session?.type]);

  async function handleProfileSave(nextProfile) {
    const profileWithEmail = { ...nextProfile, email: session?.email || nextProfile.email || "" };
    setProfile(profileWithEmail);
    if (session?.type !== "firebase") return;

    try {
      await saveUserProfile(profileWithEmail);
    } catch (error) {
      Alert.alert("Profil", "Profil je spremljen lokalno, ali sync trenutno nije dostupan.");
    }
  }

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
        content={content}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <View style={styles.app}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {screen === "home" && <HomeScreen go={navigate} openMenu={() => setDrawerOpen(true)} profile={profile} content={content} />}
          {screen === "training" && (
            <TrainingScreen tab={trainingTab} setTab={setTrainingTab} goBack={goBack} openMenu={() => setDrawerOpen(true)} content={content} />
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
              content={content}
            />
          )}
          {screen === "program" && <ProgramDetailScreen program={screenParams} goBack={goBack} content={content} subscriptions={subscriptionRecords} />}
          {screen === "wellness" && <WellnessScreen goBack={goBack} content={content} />}
          {screen === "profile" && <ProfileScreen profile={profile} setProfile={handleProfileSave} goBack={goBack} onLogout={handleLogout} content={content} />}
        </ScrollView>
        <BottomNav active={screen} setActive={navigate} content={content} />
        <Drawer open={drawerOpen} close={() => setDrawerOpen(false)} go={navigate} onLogout={handleLogout} content={content} />
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({ mode, setMode, onGuest, onAuth, onGoogle, request, content = FALLBACK_CONTENT }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isForm = mode === "login" || mode === "register";
  const images = content.images || image;

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
        uid: credential.user.uid,
        name: profileNameFromUser({ displayName: credential.user.displayName, email: credential.user.email, fallback: name }),
        email: credential.user.email,
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
      <ImageBackground source={{ uri: images.login }} style={styles.login} imageStyle={styles.loginImage}>
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

function HomeScreen({ go, openMenu, profile, content = FALLBACK_CONTENT }) {
  const settings = content.settings || FALLBACK_CONTENT.settings;
  const quickActions = settings.quickActions || FALLBACK_CONTENT.settings.quickActions;
  const todayTasks = settings.todayTasks || FALLBACK_CONTENT.settings.todayTasks;
  return (
    <>
      <TopChrome title={`Dobrodosla, ${profile.name || "ratnice"}!`} subtitle="Danas je novi dan za tvoj rast." openMenu={openMenu} />
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <Quick key={`${action.screen}-${action.label}`} icon={action.icon} label={action.label} onPress={() => go(action.screen)} />
        ))}
      </View>
      <View style={styles.focusCard}>
        <View>
          <Text style={styles.tiny}>DNEVNI FOKUS</Text>
          <Text style={styles.focusText}>{settings.dailyFocus}</Text>
        </View>
        <View style={styles.leafMark}>
          <LeafLine />
        </View>
      </View>
      <Text style={styles.sectionLabel}>DANAS TE CEKA</Text>
      {todayTasks.map((task) => (
        <Task key={task.title} title={task.title} subtitle={task.subtitle} icon={task.icon} />
      ))}
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

function TrainingScreen({ tab, setTab, goBack, openMenu, content = FALLBACK_CONTENT }) {
  const programList = content.programs || allPrograms;
  const tabs = content.settings?.trainingTabs || FALLBACK_CONTENT.settings.trainingTabs;
  const programs = useMemo(() => {
    if (tab === "Svi programi") return programList;
    return programList.filter((program) => program.category === tab);
  }, [tab, programList]);

  return (
    <>
      <ScreenHeader title="TRENINZI" right="Sliders" onBack={goBack} onRight={openMenu} />
      <Tabs tabs={tabs} active={tab} setActive={setTab} />
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

function cleanReactionCounts(counts = {}) {
  return Object.entries(counts || {}).reduce((nextCounts, [emoji, count]) => {
    const numericCount = Number(count) || 0;
    if (emoji && numericCount > 0) {
      nextCounts[emoji] = numericCount;
    }
    return nextCounts;
  }, {});
}

function orderedReactionCounts(counts = {}, quickReactions = []) {
  const cleanCounts = cleanReactionCounts(counts);
  return Object.entries(cleanCounts).sort((left, right) => {
    const leftQuickIndex = quickReactions.indexOf(left[0]);
    const rightQuickIndex = quickReactions.indexOf(right[0]);
    const leftRank = leftQuickIndex === -1 ? quickReactions.length : leftQuickIndex;
    const rightRank = rightQuickIndex === -1 ? quickReactions.length : rightQuickIndex;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return right[1] - left[1];
  });
}

function hasActiveSubscription(records = [], requiredTier = "") {
  const required = String(requiredTier || "").toLowerCase();
  return records.some((record) => {
    const status = String(record.status || "").toLowerCase();
    const tier = String(record.tier || record.plan || record.subscriptionTier || "").toLowerCase();
    const active = record.active === true || ["active", "trialing", "paid"].includes(status);
    if (!active) return false;
    if (!required) return true;
    return tier === required || tier === "all" || tier === "premium";
  });
}

function CommunityScreen({ tab, setTab, message, setMessage, goBack, go, session, profile, uploadQueue, content = FALLBACK_CONTENT }) {
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
  const [messageReactions, setMessageReactions] = useState({});
  const [reactionPicker, setReactionPicker] = useState({ messageId: null, expanded: false });
  const [imageViewer, setImageViewer] = useState({ visible: false, images: [], index: 0 });
  const lastReactionTapRef = useRef({ messageId: null, timestamp: 0 });
  const images = content.images || image;
  const contentPotions = content.potions || potions;
  const contentPosts = content.communityPosts || communityPosts;
  const settings = content.settings || FALLBACK_CONTENT.settings;
  const communityReactions = settings.communityReactions || FALLBACK_CONTENT.settings.communityReactions;
  const reactionsEnabled = communityReactions.enabled !== false;
  const defaultReaction = communityReactions.default || communityReactions.quick?.[0] || "\u2764\ufe0f";
  const quickReactions = arrayWithFallback(communityReactions.quick, FALLBACK_CONTENT.settings.communityReactions.quick);
  const allReactions = arrayWithFallback(communityReactions.all, FALLBACK_CONTENT.settings.communityReactions.all);

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

  const posts = contentPosts.filter((post) => post.tab === tab);
  const isChat = tab === "Chat";
  const chatMessageIds = useMemo(() => chatMessages.map((chatMessage) => chatMessage.id).filter(Boolean), [chatMessages]);
  const chatMessageIdsKey = useMemo(() => chatMessageIds.join("|"), [chatMessageIds]);

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
        setMessageReactions((current) => {
          const nextReactions = { ...current };
          messages.forEach((loadedMessage) => {
            nextReactions[loadedMessage.id] = {
              counts: cleanReactionCounts(loadedMessage.reactionCounts),
              myReaction: nextReactions[loadedMessage.id]?.myReaction || "",
            };
          });
          return nextReactions;
        });
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
    if (!isChat || chatMessageIds.length === 0) return undefined;

    const unsubscribers = chatMessageIds.map((messageId) =>
      subscribeToMessageReactions(
        messageId,
        ({ counts, myReaction }) => {
          setMessageReactions((current) => ({
            ...current,
            [messageId]: {
              counts: cleanReactionCounts(counts),
              myReaction,
            },
          }));
        },
        (err) => {
          console.log("subscribe message reactions error", err);
        },
      ),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [isChat, chatMessageIdsKey]);

  async function loadOlderMessages() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { messages: older, lastVisible: newLast, hasMore: more } = await fetchCommunityMessagesBefore(lastVisible, 20);
      if (older && older.length) {
        setChatMessages((current) => [...older, ...current]);
        setMessageReactions((current) => {
          const nextReactions = { ...current };
          older.forEach((loadedMessage) => {
            nextReactions[loadedMessage.id] = {
              counts: cleanReactionCounts(loadedMessage.reactionCounts),
              myReaction: nextReactions[loadedMessage.id]?.myReaction || "",
            };
          });
          return nextReactions;
        });
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
        image: prog.img || prog.image || images.glutes,
        userName: profile?.name || session?.name || "",
        progressPercent: percent,
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
      image: recipe.image || recipe.img || images.smoothie,
      meta: recipe,
    };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAttachments((cur) => [...cur, att]);
    setLocalMessage((m) => (m ? `${m} Recipe: ${recipe.title}` : `Recipe: ${recipe.title}`));
    setRecipePickerOpen(false);
  }

  function getRecipeDetails(recipeAttachment) {
    if (!recipeAttachment) return null;
    const meta = recipeAttachment.meta || {};
    const recipeKey = recipeAttachment.recipeId || meta.recipeId || recipeAttachment.title || meta.title || "";
    const catalogRecipe = contentPotions.find((recipe) => recipe.id === recipeKey || recipe.title === recipeKey) || {};
    return {
      ...catalogRecipe,
      ...meta,
      ...recipeAttachment,
      title: recipeAttachment.title || meta.title || catalogRecipe.title || "Recipe",
      image: recipeAttachment.image || meta.image || catalogRecipe.image || images.smoothie,
      timing: recipeAttachment.timing || meta.timing || catalogRecipe.timing || "",
      ingredients: arrayWithFallback(recipeAttachment.ingredients || meta.ingredients, catalogRecipe.ingredients || []),
      preparation: recipeAttachment.preparation || meta.preparation || catalogRecipe.preparation || "",
      benefits: recipeAttachment.benefits || meta.benefits || catalogRecipe.benefits || "",
    };
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
            return { id: att.id, type: "recipe", recipeId: att.recipeId || att.meta?.id || att.title, title: att.title, image: att.image, meta: att.meta };
          }
          if (att.type === "progress") {
            return { id: att.id, type: "progress", programId: att.programId, title: att.title, image: att.image, userName: att.userName, progressPercent: att.progressPercent, meta: att.meta };
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

  function getReactionCountsForMessage(post) {
    return messageReactions[post.id]?.counts || cleanReactionCounts(post.reactionCounts);
  }

  function getMyReactionForMessage(post) {
    return messageReactions[post.id]?.myReaction || "";
  }

  function openReactionPicker(messageId) {
    if (!reactionsEnabled) return;
    setReactionPicker({ messageId, expanded: false });
  }

  function closeReactionPicker() {
    setReactionPicker({ messageId: null, expanded: false });
  }

  function handleMessageTap(messageId) {
    if (!reactionsEnabled) return;
    if (reactionPicker.messageId) {
      closeReactionPicker();
      lastReactionTapRef.current = { messageId: null, timestamp: 0 };
      return;
    }

    const now = Date.now();
    const lastTap = lastReactionTapRef.current;
    if (lastTap.messageId === messageId && now - lastTap.timestamp < 320) {
      lastReactionTapRef.current = { messageId: null, timestamp: 0 };
      reactToMessage(messageId, defaultReaction);
      return;
    }
    lastReactionTapRef.current = { messageId, timestamp: now };
  }

  async function reactToMessage(messageId, emoji) {
    if (!reactionsEnabled) return;
    if (session?.type !== "firebase") {
      Alert.alert("Reaction", "Prijavi se za reakcije na poruke.");
      return;
    }
    const previousState = messageReactions[messageId] || { counts: {}, myReaction: "" };
    const previousReaction = previousState.myReaction || "";
    const removingSameReaction = previousReaction === emoji;
    try {
      setMessageReactions((current) => {
        const currentState = current[messageId] || { counts: {}, myReaction: "" };
        const nextCounts = { ...currentState.counts };
        if (previousReaction) {
          nextCounts[previousReaction] = Math.max((nextCounts[previousReaction] || 0) - 1, 0);
        }
        if (!removingSameReaction) {
          nextCounts[emoji] = (nextCounts[emoji] || 0) + 1;
        }
        return {
          ...current,
          [messageId]: {
            counts: cleanReactionCounts(nextCounts),
            myReaction: removingSameReaction ? "" : emoji,
          },
        };
      });
      await toggleMessageReaction(messageId, emoji);
      closeReactionPicker();
    } catch (err) {
      setMessageReactions((current) => ({
        ...current,
        [messageId]: previousState,
      }));
      Alert.alert("Reaction", err?.message || String(err));
    }
  }

  function handleCommunityTabChange(nextTab) {
    closeReactionPicker();
    setTab(nextTab);
  }

  return (
    <>
      <ScreenHeader title="COMMUNITY" onBack={goBack} />
      <Tabs tabs={settings.communityTabs || FALLBACK_CONTENT.settings.communityTabs} active={tab} setActive={handleCommunityTabChange} />
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
            {chatMessages.map((post) => {
              const reactionCounts = getReactionCountsForMessage(post);
              const reactionEntries = orderedReactionCounts(reactionCounts, quickReactions);
              const myReaction = getMyReactionForMessage(post);
              const pickerOpen = reactionPicker.messageId === post.id;
              const pickerReactions = reactionPicker.expanded ? allReactions : quickReactions;

              return (
                <Pressable key={post.id} style={styles.postCard} onPress={() => handleMessageTap(post.id)} onLongPress={() => openReactionPicker(post.id)} delayLongPress={260}>
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
                                <Pressable style={styles.messageImageWrap} onPress={() => (typeof go === "function" ? go("program", att.meta || att) : setOpenProgram(att))}>
                                  <Image source={{ uri: att.image }} style={styles.messageImage} />
                                  <View style={styles.attachmentBadge}><Text style={styles.attachmentBadgeText}>Progress</Text></View>
                                </Pressable>
                                <View style={styles.progressShareInfo}>
                                  <Text style={styles.progressShareName}>{att.userName || post.name || "Ratnica"}</Text>
                                  <Text style={styles.progressShareTitle}>{att.title || "Program"}</Text>
                                  <Text style={styles.progressSharePercent}>{att.progressPercent ?? 0}%</Text>
                                </View>
                                <Pressable style={[styles.reactionChip, myReaction === defaultReaction && styles.reactionChipActive]} onPress={() => reactToMessage(post.id, defaultReaction)}>
                                  <Text style={styles.reactionChipText}>{defaultReaction}</Text>
                                </Pressable>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  {reactionEntries.length > 0 && (
                    <View style={styles.reactionSummary}>
                      {reactionEntries.map(([emoji, count]) => (
                        <Pressable key={emoji} style={[styles.reactionChip, myReaction === emoji && styles.reactionChipActive]} onPress={() => reactToMessage(post.id, emoji)}>
                          <Text style={styles.reactionChipText}>{emoji}{count > 1 ? ` ${count}` : ""}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {pickerOpen && reactionsEnabled && (
                    <View style={[styles.reactionPickerBubble, reactionPicker.expanded && styles.reactionPickerBubbleExpanded]}>
                      <View style={[styles.reactionPickerRow, reactionPicker.expanded && styles.reactionPickerRowExpanded]}>
                        {pickerReactions.map((emoji) => (
                          <Pressable key={emoji} style={[styles.reactionPickerButton, myReaction === emoji && styles.reactionPickerButtonActive]} onPress={() => reactToMessage(post.id, emoji)}>
                            <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                          </Pressable>
                        ))}
                        {!reactionPicker.expanded && (
                          <Pressable style={styles.reactionPickerButton} onPress={() => setReactionPicker({ messageId: post.id, expanded: true })}>
                            <Text style={styles.reactionPickerPlus}>+</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  )}
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : (
          <>
            {(posts.length ? posts : contentPosts).map((post) => (
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
            <ImageBackground source={{ uri: images.group }} style={styles.communityPhoto} imageStyle={styles.communityPhotoImage}>
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
            <Pressable style={styles.attachButton} onPress={() => {
              closeReactionPicker();
              setAttachModalOpen(true);
            }}>
              <Text style={styles.attachText}>+</Text>
            </Pressable>
              <TextInput
                value={localMessage}
                onChangeText={setLocalMessage}
                onFocus={closeReactionPicker}
                placeholder="Napisi poruku..."
                placeholderTextColor={colors.muted}
                style={styles.messageInput}
              />
            <Pressable style={[styles.sendCircle, sending && styles.disabledButton]} onPress={() => {
              closeReactionPicker();
              sendMessage();
            }} disabled={sending}>
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
                  {(settings.uploadModes || FALLBACK_CONTENT.settings.uploadModes).map(({ value, label }) => (
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
                {contentPotions.map((p) => (
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
              <View style={[styles.drawer, { width: 320, margin: 40 }]}>
                {openProgram && (
                  <>
                    <Image source={{ uri: openProgram.image }} style={{ width: "100%", height: 140, borderRadius: 12 }} />
                    <Text style={styles.potionSectionTitle}>{openProgram.title}</Text>
                    <Text style={styles.body}>{openProgram.meta?.weeks || openProgram.meta?.duration || "-"}</Text>
                    <Text style={styles.potionBody}>{openProgram.meta?.level || ""}</Text>
                  </>
                )}
              </View>
            </Pressable>
          </Modal>

          {/* recipe detail modal */}
          <Modal visible={!!openRecipe} transparent animationType="slide" onRequestClose={() => setOpenRecipe(null)}>
            <Pressable style={styles.drawerShade} onPress={() => setOpenRecipe(null)}>
              <Pressable style={[styles.drawer, styles.recipeDetailDrawer]} onPress={(event) => event.stopPropagation()}>
                {openRecipe && (() => {
                  const recipeDetails = getRecipeDetails(openRecipe);
                  return (
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <Image source={{ uri: recipeDetails.image }} style={{ width: "100%", height: 140, borderRadius: 12 }} />
                      <Text style={styles.potionSectionTitle}>{recipeDetails.title}</Text>
                      {!!recipeDetails.timing && <Text style={styles.potionTiming}>{recipeDetails.timing}</Text>}
                      {recipeDetails.ingredients.length > 0 && <PotionSection title="Sastojci" items={recipeDetails.ingredients} />}
                      {!!recipeDetails.preparation && (
                        <>
                          <Text style={styles.potionSectionTitle}>Priprema</Text>
                          <Text style={styles.potionBody}>{recipeDetails.preparation}</Text>
                        </>
                      )}
                      {!!recipeDetails.benefits && (
                        <>
                          <Text style={styles.potionSectionTitle}>Benefiti</Text>
                          <Text style={styles.potionBody}>{recipeDetails.benefits}</Text>
                        </>
                      )}
                    </ScrollView>
                  );
                })()}
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

function WellnessScreen({ goBack, content = FALLBACK_CONTENT }) {
  const contentPotions = content.potions || potions;
  const dailyBoard = content.settings?.dailyBoard || FALLBACK_CONTENT.settings.dailyBoard;
  const [dailyTab, setDailyTab] = useState(dailyBoard.tabs[0]);
  const [drinkTab, setDrinkTab] = useState(contentPotions[0]?.title);
  const selectedPotion = contentPotions.find((potion) => potion.title === drinkTab) || contentPotions[0] || {};

  useEffect(() => {
    if (!dailyBoard.tabs.includes(dailyTab)) setDailyTab(dailyBoard.tabs[0]);
    if (!contentPotions.some((potion) => potion.title === drinkTab)) setDrinkTab(contentPotions[0]?.title);
  }, [dailyBoard.tabs, contentPotions, dailyTab, drinkTab]);

  return (
    <>
      <ScreenHeader title="DAILY BOARD" right="Leaf" onBack={goBack} />
      <Tabs tabs={dailyBoard.tabs} active={dailyTab} setActive={setDailyTab} />
      <View style={styles.dailyCard}>
        <Text style={styles.sun}>{dailyTab === "Jutro" ? "SUN" : "MOON"}</Text>
        <Text style={styles.dailyTitle}>{dailyTab.toUpperCase()}</Text>
        {dailyBoard.messages.map((line) => (
          <Text key={line} style={styles.dailyText}>{line}</Text>
        ))}
      </View>
      <ScreenHeader title="CAROBNI NAPITCI" right="Leaf" compact onBack={goBack} />
      <Tabs tabs={contentPotions.map((potion) => potion.title)} active={drinkTab} setActive={setDrinkTab} />
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

function ProfileScreen({ profile, setProfile, goBack, onLogout, content = FALLBACK_CONTENT }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const images = content.images || image;
  const stats = content.settings?.profileStats || FALLBACK_CONTENT.settings.profileStats;
  const discount = content.settings?.brandDiscount || FALLBACK_CONTENT.settings.brandDiscount;
  const discountImage = resolveImageValue(discount.image || discount.imageKey, images, "supplements");

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
        <Image source={{ uri: images.woman }} style={styles.profileImage} />
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
        {stats.map((stat) => (
          <ProfileStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </View>
      <View style={styles.gazzCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.gazzTitle}>{discount.title}</Text>
          <Text style={styles.bottle}>G</Text>
        </View>
        <Text style={styles.gazzText}>{discount.text}</Text>
        <View style={styles.gazzBody}>
          <View style={styles.discountBadge}>
            <Text style={styles.discountMain}>{discount.code}</Text>
            <Text style={styles.discountSub}>{discount.subtext}</Text>
          </View>
          <Image source={{ uri: discountImage }} style={styles.supplements} />
        </View>
      </View>
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Odjavi se</Text>
      </Pressable>
    </>
  );
}

function Drawer({ open, close, go, onLogout, content = FALLBACK_CONTENT }) {
  const items = content.navItems || navItems;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.drawerShade} onPress={close}>
        <Pressable style={styles.drawer}>
          <BrandLogo />
          {items.map((item) => (
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

function ProgramDetailScreen({ program, goBack, content = FALLBACK_CONTENT, subscriptions = [] }) {
  const prog = program || {};
  const images = content.images || image;
  const requiresSubscription = prog.subscriptionRequired !== false;
  const requiredTier = prog.requiredSubscriptionTier || prog.subscriptionTier || "";
  const hasAccess = !requiresSubscription || hasActiveSubscription(subscriptions, requiredTier);

  if (requiresSubscription && !hasAccess) {
    return (
      <>
        <ScreenHeader title={prog.title || "Program"} onBack={goBack} />
        <View style={styles.gazzCard}>
          <Text style={styles.potionSectionTitle}>Subscription required</Text>
          <Text style={styles.potionBody}>
            This program is part of the subscriber library. Activate your subscription to view workouts, schedule, and program details.
          </Text>
          {!!requiredTier && <Text style={styles.uploadModeLabel}>Required plan: {requiredTier}</Text>}
        </View>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title={prog.title || "Program"} onBack={goBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <Image source={{ uri: prog.img || prog.image || prog.imageUrl || images.glutes }} style={{ width: "100%", height: 220, borderRadius: 12, marginBottom: 12 }} />
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

function BottomNav({ active, setActive, content = FALLBACK_CONTENT }) {
  const items = content.navItems || navItems;
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
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
  reactionSummary: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  reactionChip: {
    minHeight: 30,
    minWidth: 36,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    backgroundColor: "rgba(255, 250, 240, 0.68)",
  },
  reactionChipActive: { borderColor: colors.olive, backgroundColor: "rgba(216, 199, 170, 0.78)" },
  reactionChipText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  reactionPickerBubble: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    marginTop: 10,
    padding: 5,
    backgroundColor: colors.white,
    shadowColor: colors.forest,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  reactionPickerBubbleExpanded: { borderRadius: 24, padding: 7 },
  reactionPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, maxWidth: 205 },
  reactionPickerRowExpanded: { maxWidth: 190 },
  reactionPickerButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 227, 208, 0.7)",
  },
  reactionPickerButtonActive: { backgroundColor: colors.sage },
  reactionPickerEmoji: { fontSize: 18 },
  reactionPickerPlus: { color: colors.forest, fontSize: 20, fontWeight: "700" },
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
  recipeDetailDrawer: { width: 320, maxHeight: "82%", margin: 40, paddingTop: 24, paddingBottom: 24, borderRadius: 18 },
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
  progressMiniWrap: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  progressShareInfo: { flexShrink: 1, minWidth: 112, maxWidth: 170 },
  progressShareName: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  progressShareTitle: { color: colors.ink, fontSize: 13, fontWeight: "700", marginTop: 2 },
  progressSharePercent: { color: colors.forest, fontSize: 18, fontWeight: "700", marginTop: 3 },
  progressLike: { marginLeft: 8, padding: 6 },
  likesCount: { color: colors.muted, marginLeft: 6, fontSize: 12 },
});
