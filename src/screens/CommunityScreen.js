import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, ImageBackground, LayoutAnimation, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { fetchCommunityMessagesBefore, fetchLatestCommunityMessages, getCommunityMessagesCount, getLikesCount, getUserActivePrograms, sendCommunityMessage, subscribeToNewCommunityMessages, toggleMessageLike } from "../../firebaseConfig";
import { FALLBACK_CONTENT, image, potions, communityPosts, colors, styles, ScreenHeader, Tabs } from "./common";
function formatMessageTime(createdAt) {
  const date = createdAt?.toDate?.();
  if (!date) return "sada";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const [likes, setLikes] = useState({});
  const [likesCounts, setLikesCounts] = useState({});
  const [imageViewer, setImageViewer] = useState({ visible: false, images: [], index: 0 });
  const images = content.images || image;
  const contentPotions = content.potions || potions;
  const contentPosts = content.communityPosts || communityPosts;
  const settings = content.settings || FALLBACK_CONTENT.settings;

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

  return (
    <>
      <ScreenHeader title="COMMUNITY" onBack={goBack} />
      <Tabs tabs={settings.communityTabs || FALLBACK_CONTENT.settings.communityTabs} active={tab} setActive={setTab} />
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
                              <Pressable style={styles.messageImageWrap} onPress={() => (typeof go === "function" ? go("program", att.meta || att) : setOpenProgram(att))}>
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
              <View style={[styles.drawer, { width: 320, margin: 40 }]}>
                {openRecipe && (
                  <>
                    <Image source={{ uri: openRecipe.image }} style={{ width: "100%", height: 140, borderRadius: 12 }} />
                    <Text style={styles.potionSectionTitle}>{openRecipe.title}</Text>
                  </>
                )}
              </View>
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


export default CommunityScreen;
