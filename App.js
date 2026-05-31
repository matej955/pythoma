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
  getUserProfile,
  saveUserProfile,
  uploadFileAsync,
  toggleMessageLike,
  getLikesCount,
} from "./firebaseConfig";
import DEFAULT_APP_CONTENT from "./appContent";
import { AuthScreen, HomeScreen, TrainingScreen, CommunityScreen, ProgramDetailScreen, WellnessScreen, ProfileScreen, BottomNav, Drawer, styles } from "./src/screens";

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
  return {
    ...defaults,
    ...settings,
    trainingTabs: arrayWithFallback(settings.trainingTabs, defaults.trainingTabs),
    communityTabs: arrayWithFallback(settings.communityTabs, defaults.communityTabs),
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
          {screen === "program" && <ProgramDetailScreen program={screenParams} goBack={goBack} content={content} />}
          {screen === "wellness" && <WellnessScreen goBack={goBack} content={content} />}
          {screen === "profile" && <ProfileScreen profile={profile} setProfile={handleProfileSave} goBack={goBack} onLogout={handleLogout} content={content} />}
        </ScrollView>
        <BottomNav active={screen} setActive={navigate} content={content} />
        <Drawer open={drawerOpen} close={() => setDrawerOpen(false)} go={navigate} onLogout={handleLogout} content={content} />
      </View>
    </SafeAreaView>
  );
}

