const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");
const { FieldValue, initializeFirestore } = require("firebase-admin/firestore");

const DEFAULT_SERVICE_ACCOUNT_PATH = path.join(os.homedir(), ".firebase-keys", "pythoma-service-account.json");
const CONTENT_ROOT_COLLECTION = "appContent";
const CONTENT_ROOT_DOCUMENT = "sanctuary";
const CONTENT_SUBCOLLECTIONS = ["images", "programs", "potions", "navItems", "communityPosts"];

function readDefaultContent() {
  const source = fs.readFileSync(path.join(__dirname, "..", "appContent.js"), "utf8");
  const marker = "export const DEFAULT_APP_CONTENT = ";
  const start = source.indexOf(marker);
  const end = source.indexOf("\n\nexport default DEFAULT_APP_CONTENT", start);

  if (start === -1 || end === -1) {
    throw new Error("Could not find DEFAULT_APP_CONTENT in appContent.js");
  }

  const objectSource = source.slice(start + marker.length, end).trim().replace(/;$/, "");
  return Function(`"use strict"; return (${objectSource});`)();
}

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (raw.startsWith("{")) return JSON.parse(raw);
    return JSON.parse(fs.readFileSync(path.resolve(raw), "utf8"));
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(fs.readFileSync(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS), "utf8"));
  }

  if (fs.existsSync(DEFAULT_SERVICE_ACCOUNT_PATH)) {
    return JSON.parse(fs.readFileSync(DEFAULT_SERVICE_ACCOUNT_PATH, "utf8"));
  }

  return null;
}

function initializeAdmin() {
  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      [
        "Missing Firebase Admin credentials.",
        "",
        "Create a Firebase service account key, keep it out of git, then run one of:",
        "  $env:GOOGLE_APPLICATION_CREDENTIALS='C:\\\\path\\\\to\\\\service-account.json'; npm run seed:content",
        "  $env:FIREBASE_SERVICE_ACCOUNT='C:\\\\path\\\\to\\\\service-account.json'; npm run seed:content",
        `  or place it at: ${DEFAULT_SERVICE_ACCOUNT_PATH}`,
        "",
        "Do not put the service account JSON in the app bundle.",
      ].join("\n"),
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
}

function slugify(value, fallback) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function sortForHash(value) {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortForHash(value[key]);
      return acc;
    }, {});
}

function contentVersionFor(content) {
  const versionSource = {
    schemaVersion: content.schemaVersion,
    cache: content.cache,
    images: content.images,
    programs: content.programs,
    potions: content.potions,
    navItems: content.navItems,
    communityPosts: content.communityPosts,
    settings: content.settings,
  };
  return crypto.createHash("sha256").update(JSON.stringify(sortForHash(versionSource))).digest("hex");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(JSON.stringify(sortForHash(value))).digest("hex");
}

function sectionVersionsFor(content) {
  return {
    cache: hashValue(content.cache || {}),
    images: hashValue(content.images || {}),
    programs: hashValue(content.programs || []),
    potions: hashValue(content.potions || []),
    navItems: hashValue(content.navItems || []),
    communityPosts: hashValue(content.communityPosts || []),
    settings: hashValue(content.settings || {}),
  };
}

async function deleteSubcollection(db, rootRef, collectionName) {
  const snapshot = await rootRef.collection(collectionName).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((contentDoc) => batch.delete(contentDoc.ref));
  await batch.commit();
}

async function writeSubcollection(db, rootRef, collectionName, items, idForItem) {
  await deleteSubcollection(db, rootRef, collectionName);
  if (!items.length) return;

  const batch = db.batch();
  items.forEach((item, index) => {
    const documentId = idForItem(item, index);
    batch.set(rootRef.collection(collectionName).doc(documentId), {
      ...item,
      contentType: collectionName,
      order: index,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

async function main() {
  initializeAdmin();
  const db = initializeFirestore(admin.app(), { preferRest: true });
  const content = readDefaultContent();
  const rootRef = db.collection(CONTENT_ROOT_COLLECTION).doc(CONTENT_ROOT_DOCUMENT);
  const imageItems = Object.entries(content.images || {}).map(([key, url], order) => ({ key, url, order }));
  const contentVersion = contentVersionFor(content);
  const sectionVersions = sectionVersionsFor(content);

  await rootRef.set(
    {
      schemaVersion: content.schemaVersion || 1,
      modelVersion: 2,
      contentVersion,
      sectionVersions,
      contentType: "appContentRoot",
      cache: content.cache || {},
      updatedAt: FieldValue.serverTimestamp(),
    },
  );

  await deleteSubcollection(db, rootRef, "settings");
  await rootRef.collection("settings").doc("main").set({
    ...(content.settings || {}),
    contentType: "settings",
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeSubcollection(db, rootRef, "images", imageItems, (item) => item.key);
  await writeSubcollection(db, rootRef, "programs", content.programs || [], (item, index) => slugify(item.id || item.title, `program-${index}`));
  await writeSubcollection(db, rootRef, "potions", content.potions || [], (item, index) => slugify(item.id || item.title, `potion-${index}`));
  await writeSubcollection(db, rootRef, "navItems", content.navItems || [], (item, index) => slugify(item.key || item.label, `nav-${index}`));
  await writeSubcollection(
    db,
    rootRef,
    "communityPosts",
    content.communityPosts || [],
    (item, index) => slugify(item.id || `${item.tab}-${item.name}-${index}`, `community-post-${index}`),
  );

  console.log(`Seeded Firestore content model: ${CONTENT_ROOT_COLLECTION}/${CONTENT_ROOT_DOCUMENT}`);
  console.log(`Content version: ${contentVersion.slice(0, 12)}`);
  console.log(`Subcollections: settings/main, ${CONTENT_SUBCOLLECTIONS.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
