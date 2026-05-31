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
} from "../../firebaseConfig";
import DEFAULT_APP_CONTENT from "../../appContent";

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
});


export { FALLBACK_CONTENT, image, allPrograms, communityPosts, potions, navItems, colors, styles, resolveImageValue, profileNameFromUser, Drawer, TopChrome, ScreenHeader, BrandLogo, Quick, Task, Tabs, PillButton, GoogleButton, AuthInput, ProfileStat, LeafLine, BottomNav };
