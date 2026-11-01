/* =========================================================
   NEURAL NINJAS - OPTIMIZED APP.JS
   Auth + Realtime Chat + Presence + Last Seen
   Reply + Reactions + Search + Themes
   Images + Videos + Audio + Voice Notes
   Code Highlighting + Copy
   Egress Optimization + Message Pagination
   ========================================================= */

/* ================= SUPABASE CONFIG ================= */

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

/* ================= CONFIGURATION ================= */

const MESSAGE_PAGE_SIZE = 50;
const STORAGE_CACHE_SECONDS = "86400";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;
const LAST_SEEN_INTERVAL = 60000;

/* ================= GLOBAL STATE ================= */

let currentUser = null;
let currentProfile = null;

let messageChannel = null;
let reactionChannel = null;
let typingChannel = null;
let presenceChannel = null;

let typingTimeout = null;
let lastSeenInterval = null;

let isCurrentlyTyping = false;
let replyingToMessage = null;

const messageCache = new Map();
const reactionCache = new Map();

let presenceUsers = {};
let loadedMembers = [];

let oldestMessageTime = null;
let hasMoreMessages = true;
let isLoadingOlderMessages = false;

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let isRecordingVoice = false;

/* ================= DOM ELEMENTS ================= */

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");

const usernameInput = document.getElementById("usernameInput");
const pinInput = document.getElementById("pinInput");
const joinBtn = document.getElementById("joinBtn");
const loginStatus = document.getElementById("loginStatus");

const onlineStatus = document.getElementById("onlineStatus");

const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");

const membersSidebar = document.getElementById("membersSidebar");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const membersList = document.getElementById("membersList");
const memberCount = document.getElementById("memberCount");

const deleteAccountBtn =
  document.getElementById("deleteAccountBtn");

const themeBtn = document.getElementById("themeBtn");
const themePanel = document.getElementById("themePanel");
const closeThemeBtn = document.getElementById("closeThemeBtn");

const messageSearchInput =
  document.getElementById("messageSearchInput");

const clearSearchBtn =
  document.getElementById("clearSearchBtn");

const messages = document.getElementById("messages");
const typingIndicator =
  document.getElementById("typingIndicator");

const replyBar = document.getElementById("replyBar");
const replySender = document.getElementById("replySender");
const replyPreview = document.getElementById("replyPreview");
const cancelReplyBtn =
  document.getElementById("cancelReplyBtn");

const mediaBtn = document.getElementById("mediaBtn");
const fileInput = document.getElementById("fileInput");

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

/* ================= INITIALIZATION ================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  joinBtn?.addEventListener("click", handleLogin);

  usernameInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") pinInput?.focus();
  });

  pinInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") handleLogin();
  });

  logoutBtn?.addEventListener("click", exitChat);
  menuBtn?.addEventListener("click", openSidebar);
  closeSidebarBtn?.addEventListener("click", closeSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);

  deleteAccountBtn?.addEventListener("click", deleteAccount);

  themeBtn?.addEventListener("click", openThemePanel);
  closeThemeBtn?.addEventListener("click", closeThemePanel);

  messageSearchInput?.addEventListener(
    "input",
    performMessageSearch
  );

  clearSearchBtn?.addEventListener(
    "click",
    clearMessageSearch
  );

  sendBtn?.addEventListener("click", sendMessage);

  messageInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  messageInput?.addEventListener("input", handleTyping);

  cancelReplyBtn?.addEventListener("click", cancelReply);

  mediaBtn?.addEventListener("click", () => fileInput?.click());

  fileInput?.addEventListener("change", handleFileUpload);

  restoreTheme();
  setupThemeButtons();

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeSidebar();
      closeThemePanel();
      closeAllReactionPickers();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      updateLastSeen();
    }
  });

  await restoreSession();
}

/* ================= AUTH HELPERS ================= */

function makeAuthEmail(username) {
  return (
    username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 40) +
    "@neuralninjas.local"
  );
}

/* ================= LOGIN ================= */

async function handleLogin() {
  const username = usernameInput?.value.trim();
  const pin = pinInput?.value.trim();

  if (!username || username.length < 2) {
    showLoginStatus(
      "Username must contain at least 2 characters.",
      true
    );
    return;
  }

  if (!/^\d{6}$/.test(pin || "")) {
    showLoginStatus("PIN must be exactly 6 digits.", true);
    return;
  }

  if (joinBtn) {
    joinBtn.disabled = true;
    joinBtn.textContent = "Joining...";
  }

  showLoginStatus("Connecting...");

  try {
    const email = makeAuthEmail(username);

    let authResult =
      await supabaseClient.auth.signInWithPassword({
        email,
        password: pin
      });

    if (authResult.error) {
      const signUpResult =
        await supabaseClient.auth.signUp({
          email,
          password: pin,
          options: {
            data: { username }
          }
        });

      if (signUpResult.error) {
        throw signUpResult.error;
      }

      if (!signUpResult.data.session) {
        throw new Error(
          "Account created, but email confirmation is enabled. " +
          "Disable email confirmation in Supabase Authentication settings."
        );
      }

      authResult = signUpResult;
    }

    currentUser = authResult.data.user;

    if (!currentUser) {
      throw new Error("User session was not created.");
    }

    await loadCurrentProfile(username);
    await startChat();

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    showLoginStatus(error.message || "Login failed.", true);

  } finally {
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = "Join";
    }
  }
}

/* ================= CURRENT PROFILE ================= */

async function loadCurrentProfile(fallbackUsername = "") {
  if (!currentUser) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, username, created_at, last_seen_at")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    currentProfile = data;
    return data;
  }

  const username =
    fallbackUsername ||
    currentUser.user_metadata?.username ||
    "Unknown user";

  const { data: insertedProfile, error: insertError } =
    await supabaseClient
      .from("profiles")
      .insert({
        id: currentUser.id,
        username,
        last_seen_at: new Date().toISOString()
      })
      .select()
      .single();

  if (insertError) throw insertError;

  currentProfile = insertedProfile;
  return insertedProfile;
}

/* ================= RESTORE SESSION ================= */

async function restoreSession() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;
    if (!data.session) return;

    currentUser = data.session.user;

    await loadCurrentProfile();

    if (!currentProfile) {
      currentUser = null;
      return;
    }

    await startChat();

  } catch (error) {
    console.error("RESTORE SESSION ERROR:", error);
  }
}

/* ================= START CHAT ================= */

async function startChat() {
  if (!currentUser) return;

  clearOldState();

  loginScreen?.classList.add("hidden");
  chatScreen?.classList.remove("hidden");

  if (onlineStatus) {
    onlineStatus.textContent = "● Connecting...";
  }

  setupRealtime();
  setupTyping();
  setupPresence();

  await Promise.all([
    loadMessages(),
    loadMembers()
  ]);

  await loadReactions();
  await updateLastSeen();

  startLastSeenTimer();
  updateOnlineStatus();

  messageInput?.focus();
}

/* ================= CLEAR STATE ================= */

function clearOldState() {
  messageCache.clear();
  reactionCache.clear();

  presenceUsers = {};
  loadedMembers = [];

  oldestMessageTime = null;
  hasMoreMessages = true;

  if (messages) messages.innerHTML = "";
}

/* ================= MESSAGE PAGINATION ================= */

function createLoadOlderButton() {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "load-older-messages";
  button.textContent = "Load older messages";

  button.addEventListener("click", loadOlderMessages);

  return button;
}

async function loadMessages() {
  if (!messages) return;

  messages.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("messages")
    .select(
      "id, sender_id, sender_name, message, message_type, file_url, reply_to_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) {
    console.error("LOAD MESSAGES ERROR:", error);
    showChatError("Failed to fetch messages.");
    return;
  }

  const rows = data || [];

  hasMoreMessages = rows.length === MESSAGE_PAGE_SIZE;

  if (rows.length) {
    oldestMessageTime = rows[rows.length - 1].created_at;
  }

  const orderedRows = rows.reverse();

  const senderIds = [
    ...new Set(orderedRows.map(row => row.sender_id).filter(Boolean))
  ];

  let profiles = [];

  if (senderIds.length) {
    const { data: profileData, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("id, username")
        .in("id", senderIds);

    if (profileError) {
      console.error("MESSAGE PROFILE ERROR:", profileError);
    } else {
      profiles = profileData || [];
    }
  }

  const profileMap = new Map(
    profiles.map(profile => [profile.id, profile])
  );

  for (const message of orderedRows) {
    const profile = profileMap.get(message.sender_id);

    const enriched = {
      ...message,
      username:
        profile?.username ||
        message.sender_name ||
        "Unknown user",
      profile
    };

    messageCache.set(String(message.id), enriched);
    renderMessage(enriched, false);
  }

  if (hasMoreMessages) {
    messages.prepend(createLoadOlderButton());
  }

  scrollMessagesToBottom();
}

/* ================= LOAD OLDER MESSAGES ================= */

async function loadOlderMessages() {
  if (
    isLoadingOlderMessages ||
    !hasMoreMessages ||
    !oldestMessageTime
  ) {
    return;
  }

  isLoadingOlderMessages = true;

  const button =
    messages?.querySelector(".load-older-messages");

  if (button) {
    button.disabled = true;
    button.textContent = "Loading...";
  }

  const previousHeight = messages.scrollHeight;
  const previousTop = messages.scrollTop;

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select(
        "id, sender_id, sender_name, message, message_type, file_url, reply_to_id, created_at"
      )
      .lt("created_at", oldestMessageTime)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);

    if (error) throw error;

    const rows = data || [];

    hasMoreMessages = rows.length === MESSAGE_PAGE_SIZE;

    if (rows.length) {
      oldestMessageTime = rows[rows.length - 1].created_at;
    }

    const orderedRows = rows.reverse();

    const senderIds = [
      ...new Set(orderedRows.map(row => row.sender_id).filter(Boolean))
    ];

    let profiles = [];

    if (senderIds.length) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("id, username")
        .in("id", senderIds);

      profiles = profileData || [];
    }

    const profileMap = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    const fragment = document.createDocumentFragment();

    for (const message of orderedRows) {
      const enriched = {
        ...message,
        username:
          profileMap.get(message.sender_id)?.username ||
          message.sender_name ||
          "Unknown user"
      };

      messageCache.set(String(message.id), enriched);

      const oldMessages = messages;
      const temporaryContainer = document.createElement("div");

      // Render into a temporary container, then move the new message.
      const originalMessages = messages;
      const originalAppend = originalMessages.appendChild;

      renderMessageIntoContainer(
        enriched,
        temporaryContainer
      );

      if (temporaryContainer.firstChild) {
        fragment.appendChild(temporaryContainer.firstChild);
      }
    }

    if (button) button.remove();

    messages.prepend(fragment);

    if (hasMoreMessages) {
      messages.prepend(createLoadOlderButton());
    }

    messages.scrollTop =
      messages.scrollHeight - previousHeight + previousTop;

    await loadReactions();

  } catch (error) {
    console.error("LOAD OLDER ERROR:", error);

    if (button) {
      button.disabled = false;
      button.textContent = "Retry loading older messages";
    }

  } finally {
    isLoadingOlderMessages = false;
  }
}

/* ================= LOAD MEMBERS ================= */

async function loadMembers() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, username, created_at, last_seen_at")
    .order("username", { ascending: true });

  if (error) {
    console.error("LOAD MEMBERS ERROR:", error);

    if (membersList) {
      membersList.textContent = "Unable to load members.";
    }

    return;
  }

  loadedMembers = data || [];
  renderMembers(loadedMembers);
}

/* ================= RENDER MEMBERS ================= */

function renderMembers(memberList = []) {
  if (!membersList) return;

  membersList.innerHTML = "";

  if (memberCount) {
    memberCount.textContent = memberList.length;
  }

  if (!memberList.length) {
    membersList.textContent = "No members found.";
    return;
  }

  memberList.forEach(member => {
    const wrapper = document.createElement("div");
    wrapper.className = "member";

    const avatar = document.createElement("div");
    avatar.className = "member-avatar";
    avatar.textContent = getInitials(member.username);

    const info = document.createElement("div");
    info.className = "member-info";

    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = member.username || "Unknown user";

    const status = document.createElement("div");
    status.className = "member-status";

    const dot = document.createElement("span");
    dot.className = "status-dot";

    const isOnline = isMemberOnline(member.id);

    if (isOnline) dot.classList.add("online");

    const statusText = document.createElement("span");
    statusText.textContent = isOnline
      ? "Online"
      : formatLastSeen(member.last_seen_at);

    status.append(dot, statusText);
    info.append(name, status);
    wrapper.append(avatar, info);

    membersList.appendChild(wrapper);
  });
}

/* ================= RENDER MESSAGE ================= */

function renderMessage(data, shouldScroll = true) {
  if (!messages || !data) return;

  renderMessageIntoContainer(data, messages, shouldScroll);
}

function renderMessageIntoContainer(
  data,
  container,
  shouldScroll = false
) {
  const wrapper = document.createElement("div");

  wrapper.className = "message";
  wrapper.dataset.messageId = data.id;

  if (currentUser && data.sender_id === currentUser.id) {
    wrapper.classList.add("mine");
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const sender = document.createElement("div");
  sender.className = "sender sender-name";
  sender.textContent =
    data.username || data.sender_name || "Unknown user";

  bubble.appendChild(sender);

  /* REPLY PREVIEW */

  if (data.reply_to_id) {
    const replyMessage =
      messageCache.get(String(data.reply_to_id));

    const replyBox = document.createElement("div");
    replyBox.className = "message-reply";

    if (replyMessage) {
      const replyUser = document.createElement("div");
      replyUser.className = "reply-user";
      replyUser.textContent =
        replyMessage.username || replyMessage.sender_name || "Unknown user";

      const replyText = document.createElement("div");
      replyText.className = "reply-text";
      replyText.textContent =
        replyMessage.message || "Media message";

      replyBox.append(replyUser, replyText);
    } else {
      replyBox.textContent = "Reply to a previous message";
    }

    bubble.appendChild(replyBox);
  }

  /* MESSAGE CONTENT */

  const content = document.createElement("div");
  content.className = "text message-text";

  const messageText = data.message || "";
  const messageType = data.message_type || "text";

  if (messageType === "image" && data.file_url) {
    content.appendChild(
      createImageContent(data.file_url, messageText)
    );

  } else if (messageType === "video" && data.file_url) {
    content.appendChild(createVideoContent(data.file_url));

  } else if (
    (messageType === "audio" || messageType === "voice") &&
    data.file_url
  ) {
    content.appendChild(createAudioContent(data.file_url));

  } else if (
    messageType === "code" ||
    looksLikeCode(messageText)
  ) {
    content.appendChild(createCodeContent(messageText));

  } else {
    appendSafeTextWithLinks(content, messageText);
  }

  bubble.appendChild(content);

  /* TIME */

  const footer = document.createElement("div");
  footer.className = "message-footer";

  const time = document.createElement("span");
  time.className = "time message-time";
  time.textContent = formatMessageTime(data.created_at);

  footer.appendChild(time);
  bubble.appendChild(footer);

  /* ACTIONS */

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const replyButton = document.createElement("button");
  replyButton.className = "message-action";
  replyButton.type = "button";
  replyButton.textContent = "↩ Reply";
  replyButton.title = "Reply";
  replyButton.addEventListener("click", () => startReply(data));

  actions.appendChild(replyButton);

  const reactionButton = document.createElement("button");
  reactionButton.className = "message-action";
  reactionButton.type = "button";
  reactionButton.textContent = "😊";
  reactionButton.title = "React";

  reactionButton.addEventListener("click", event => {
    event.stopPropagation();
    toggleReactionPicker(wrapper, data.id);
  });

  actions.appendChild(reactionButton);

  if (currentUser && data.sender_id === currentUser.id) {
    const deleteButton = document.createElement("button");

    deleteButton.className =
      "message-action delete-message";

    deleteButton.type = "button";
    deleteButton.textContent = "🗑 Delete";
    deleteButton.title = "Delete";

    deleteButton.addEventListener("click", () => {
      deleteMessage(data);
    });

    actions.appendChild(deleteButton);
  }

  bubble.appendChild(actions);
  wrapper.appendChild(bubble);

  container.appendChild(wrapper);

  renderMessageReactions(wrapper, data.id);

  if (shouldScroll) scrollMessagesToBottom();
}

/* ================= SEND MESSAGE ================= */

async function sendMessage() {
  if (!currentUser) return;

  const content = messageInput?.value.trim();
  if (!content) return;

  const replyTo = replyingToMessage
    ? Number(replyingToMessage.id)
    : null;

  if (sendBtn) sendBtn.disabled = true;

  try {
    const payload = {
      sender_id: currentUser.id,

      sender_name:
        currentProfile?.username ||
        currentUser.user_metadata?.username ||
        "Unknown user",

      message: content,

      message_type: looksLikeCode(content)
        ? "code"
        : "text",

      reply_to_id: replyTo
    };

    const { data, error } = await supabaseClient
      .from("messages")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    if (messageInput) messageInput.value = "";

    cancelReply();
    stopTyping();

    if (data && !messageCache.has(String(data.id))) {
      const enriched = {
        ...data,
        username:
          currentProfile?.username ||
          data.sender_name ||
          "Unknown user"
      };

      messageCache.set(String(data.id), enriched);
      renderMessage(enriched);
    }

  } catch (error) {
    console.error("SEND MESSAGE ERROR:", error);

    alert(
      "Message send failed: " +
      (error.message || "Unknown error")
    );

  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

/* ================= FILE UPLOAD ================= */

async function handleFileUpload(event) {
  const file = event.target.files?.[0];

  if (!file || !currentUser) return;

  const maxSize = 50 * 1024 * 1024;

  if (file.size > maxSize) {
    alert("File is too large. Maximum size is 50 MB.");
    fileInput.value = "";
    return;
  }

  let messageType = null;

  if (file.type.startsWith("image/")) {
    messageType = "image";
  } else if (file.type.startsWith("video/")) {
    messageType = "video";
  } else if (file.type.startsWith("audio/")) {
    messageType = "audio";
  } else {
    alert("Only images, videos and audio files are supported.");
    fileInput.value = "";
    return;
  }

  try {
    if (mediaBtn) mediaBtn.disabled = true;

    const extension = getFileExtension(file.name);

    const randomPart = Math.random()
      .toString(36)
      .slice(2, 10);

    const filePath =
      `${currentUser.id}/${Date.now()}-${randomPart}${extension}`;

    const { error: uploadError } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .upload(filePath, file, {
          cacheControl: STORAGE_CACHE_SECONDS,
          contentType: file.type,
          upsert: false
        });

    if (uploadError) throw uploadError;

    const { data: signedData, error: signedError } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .createSignedUrl(
          filePath,
          SIGNED_URL_SECONDS
        );

    if (signedError) throw signedError;

    const fileUrl = signedData?.signedUrl;

    if (!fileUrl) {
      throw new Error("Could not create file URL.");
    }

    const replyTo = replyingToMessage
      ? Number(replyingToMessage.id)
      : null;

    const payload = {
      sender_id: currentUser.id,

      sender_name:
        currentProfile?.username ||
        currentUser.user_metadata?.username ||
        "Unknown user",

      message: file.name,
      message_type: messageType,
      file_url: fileUrl,
      reply_to_id: replyTo
    };

    const { data, error } = await supabaseClient
      .from("messages")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    cancelReply();

    if (data && !messageCache.has(String(data.id))) {
      const enriched = {
        ...data,
        username:
          currentProfile?.username ||
          data.sender_name ||
          "Unknown user"
      };

      messageCache.set(String(data.id), enriched);
      renderMessage(enriched);
    }

  } catch (error) {
    console.error("FILE UPLOAD ERROR:", error);

    alert(
      "File upload failed: " +
      (error.message || "Unknown error")
    );

  } finally {
    if (fileInput) fileInput.value = "";
    if (mediaBtn) mediaBtn.disabled = false;
  }
}

/* ================= VOICE RECORDING ================= */

async function startVoiceRecording() {
  if (isRecordingVoice) return;

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    alert("Voice recording is not supported in this browser.");
    return;
  }

  try {
    recordingStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    recordedChunks = [];

    mediaRecorder = new MediaRecorder(recordingStream);

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(recordedChunks, {
          type: mediaRecorder?.mimeType || "audio/webm"
        });

        if (blob.size > 0) {
          await uploadVoiceBlob(blob);
        }
      } finally {
        recordingStream
          ?.getTracks()
          .forEach(track => track.stop());

        recordingStream = null;
        mediaRecorder = null;
        recordedChunks = [];
      }
    };

    mediaRecorder.start();
    isRecordingVoice = true;

    if (onlineStatus) {
      onlineStatus.textContent = "● Recording...";
    }

  } catch (error) {
    console.error("VOICE RECORD ERROR:", error);
    alert("Microphone permission is required.");
  }
}

function stopVoiceRecording() {
  if (!isRecordingVoice || !mediaRecorder) return;

  isRecordingVoice = false;

  if (mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

/* ================= UPLOAD VOICE ================= */

async function uploadVoiceBlob(blob) {
  if (!currentUser) return;

  try {
    const filePath =
      `${currentUser.id}/voice-${Date.now()}.webm`;

    const { error: uploadError } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .upload(filePath, blob, {
          contentType: "audio/webm",
          cacheControl: STORAGE_CACHE_SECONDS,
          upsert: false
        });

    if (uploadError) throw uploadError;

    const { data, error } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .createSignedUrl(
          filePath,
          SIGNED_URL_SECONDS
        );

    if (error) throw error;

    const fileUrl = data?.signedUrl;

    if (!fileUrl) {
      throw new Error("Voice URL could not be created.");
    }

    const { data: messageData, error: messageError } =
      await supabaseClient
        .from("messages")
        .insert({
          sender_id: currentUser.id,

          sender_name:
            currentProfile?.username ||
            "Unknown user",

          message: "Voice message",
          message_type: "voice",
          file_url: fileUrl
        })
        .select("*")
        .single();

    if (messageError) throw messageError;

    if (
      messageData &&
      !messageCache.has(String(messageData.id))
    ) {
      const enriched = {
        ...messageData,
        username:
          currentProfile?.username ||
          messageData.sender_name ||
          "Unknown user"
      };

      messageCache.set(String(messageData.id), enriched);
      renderMessage(enriched);
    }

  } catch (error) {
    console.error("VOICE UPLOAD ERROR:", error);

    alert(
      "Voice upload failed: " +
      (error.message || "Unknown error")
    );

  } finally {
    updateOnlineStatus();
  }
}

/* ================= MEDIA ELEMENTS ================= */

function createImageContent(url, filename) {
  const wrapper = document.createElement("div");
  wrapper.className = "media-wrapper";

  const img = document.createElement("img");

  img.className = "chat-image";
  img.alt = filename || "Image";

  // Reduce unnecessary image loading.
  img.loading = "lazy";
  img.decoding = "async";
  img.fetchPriority = "low";

  img.src = url;

  img.addEventListener("click", () => {
    window.open(url, "_blank", "noopener,noreferrer");
  });

  wrapper.appendChild(img);

  return wrapper;
}

function createVideoContent(url) {
  const video = document.createElement("video");

  video.className = "chat-video";
  video.src = url;
  video.controls = true;
  video.preload = "none";
  video.playsInline = true;

  return video;
}

function createAudioContent(url) {
  const audio = document.createElement("audio");

  audio.className = "chat-audio";
  audio.src = url;
  audio.controls = true;
  audio.preload = "none";

  return audio;
}

/* ================= CODE DETECTION ================= */

function looksLikeCode(text) {
  if (!text) return false;

  const patterns = [
    /```/,
    /<html[\s>]/i,
    /<script[\s>]/i,
    /<div[\s>]/i,
    /function\s+\w+\s*\(/,
    /\b(const|let|var)\s+\w+\s*=/,
    /=>/,
    /\bSELECT\s+.+\bFROM\b/i,
    /console\.log\s*\(/,
    /<\/?[a-z][^>]*>/i
  ];

  return patterns.some(pattern => pattern.test(text));
}

/* ================= CODE RENDERING ================= */

function createCodeContent(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "code-wrapper";

  let codeText = text || "";
  let language = "";

  const match = codeText.match(
    /^```(\w+)?\s*\n([\s\S]*?)\n```$/
  );

  if (match) {
    language = match[1] || "";
    codeText = match[2];
  }

  const pre = document.createElement("pre");
  const code = document.createElement("code");

  if (language) {
    code.className = `language-${language}`;
  }

  code.textContent = codeText;

  pre.appendChild(code);

  const copyButton = document.createElement("button");

  copyButton.type = "button";
  copyButton.className = "copy-code-btn";
  copyButton.textContent = "Copy Code";

  copyButton.addEventListener("click", async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = codeText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        textarea.remove();

        if (!copied) {
          throw new Error("Copy is not supported.");
        }
      }

      copyButton.textContent = "Code Copied!";

      setTimeout(() => {
        copyButton.textContent = "Copy Code";
      }, 1500);

    } catch (error) {
      console.error("COPY ERROR:", error);
      copyButton.textContent = "Copy Failed";
    }
  });

  wrapper.append(copyButton, pre);

  if (
    window.hljs &&
    typeof window.hljs.highlightElement === "function"
  ) {
    try {
      window.hljs.highlightElement(code);
    } catch (error) {
      console.error("HIGHLIGHT ERROR:", error);
    }
  }

  return wrapper;
}

/* ================= SAFE TEXT + LINKS ================= */

function appendSafeTextWithLinks(element, text) {
  if (!text) return;

  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  parts.forEach(part => {
    if (/^https?:\/\//i.test(part)) {
      const link = document.createElement("a");

      link.href = part;
      link.textContent = part;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      element.appendChild(link);

    } else {
      element.appendChild(
        document.createTextNode(part)
      );
    }
  });
}

/* ================= DELETE MESSAGE ================= */

async function deleteMessage(message) {
  if (!currentUser) return;

  if (message.sender_id !== currentUser.id) return;

  if (!confirm("Delete this message?")) return;

  try {
    const { error } = await supabaseClient
      .from("messages")
      .delete()
      .eq("id", message.id)
      .eq("sender_id", currentUser.id);

    if (error) throw error;

    const element = document.querySelector(
      `[data-message-id="${CSS.escape(String(message.id))}"]`
    );

    element?.remove();

    messageCache.delete(String(message.id));
    reactionCache.delete(String(message.id));

  } catch (error) {
    console.error("DELETE MESSAGE ERROR:", error);

    alert(
      "Failed to delete message: " +
      (error.message || "Unknown error")
    );
  }
}

/* ================= REPLY ================= */

function startReply(message) {
  replyingToMessage = message;

  replyBar?.classList.remove("hidden");

  if (replySender) {
    replySender.textContent =
      message.username ||
      message.sender_name ||
      "Unknown user";
  }

  if (replyPreview) {
    const preview = message.message || "Media message";

    replyPreview.textContent =
      preview.length > 100
        ? preview.slice(0, 100) + "..."
        : preview;
  }

  messageInput?.focus();
}

function cancelReply() {
  replyingToMessage = null;

  replyBar?.classList.add("hidden");

  if (replySender) replySender.textContent = "";
  if (replyPreview) replyPreview.textContent = "";
}

/* ================= REACTIONS ================= */

async function loadReactions() {
  const messageIds = [...messageCache.keys()];

  reactionCache.clear();

  // No messages loaded = no reaction query needed.
  if (!messageIds.length) return;

  const { data, error } = await supabaseClient
    .from("message_reactions")
    .select(
      "id, message_id, user_id, reaction, profiles(username)"
    )
    .in("message_id", messageIds);

  if (error) {
    console.error("LOAD REACTIONS ERROR:", error);
    return;
  }

  (data || []).forEach(reaction => {
    const key = String(reaction.message_id);

    if (!reactionCache.has(key)) {
      reactionCache.set(key, []);
    }

    reactionCache.get(key).push(reaction);
  });

  document.querySelectorAll(".message").forEach(element => {
    renderMessageReactions(
      element,
      element.dataset.messageId
    );
  });
}

function toggleReactionPicker(wrapper, messageId) {
  closeAllReactionPickers();

  const picker = document.createElement("div");
  picker.className = "reaction-picker";

  const reactions = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "🔥",
    "👏"
  ];

  reactions.forEach(emoji => {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = emoji;

    button.addEventListener("click", async () => {
      await toggleReaction(messageId, emoji);
      picker.remove();
    });

    picker.appendChild(button);
  });

  wrapper.appendChild(picker);
}

function closeAllReactionPickers() {
  document
    .querySelectorAll(".reaction-picker")
    .forEach(picker => picker.remove());
}

async function toggleReaction(messageId, reaction) {
  if (!currentUser) return;

  try {
    const { data: existing, error: findError } =
      await supabaseClient
        .from("message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", currentUser.id)
        .eq("reaction", reaction)
        .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      const { error } = await supabaseClient
        .from("message_reactions")
        .delete()
        .eq("id", existing.id);

      if (error) throw error;

    } else {
      const { error } = await supabaseClient
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: currentUser.id,
          reaction
        });

      if (error) throw error;
    }

    await loadReactions();

  } catch (error) {
    console.error("REACTION ERROR:", error);
  }
}

function renderMessageReactions(wrapper, messageId) {
  if (!wrapper) return;

  wrapper.querySelector(".reactions")?.remove();

  const list =
    reactionCache.get(String(messageId)) || [];

  if (!list.length) return;

  const container = document.createElement("div");
  container.className = "reactions";

  const counts = {};

  list.forEach(item => {
    counts[item.reaction] =
      (counts[item.reaction] || 0) + 1;
  });

  Object.entries(counts).forEach(([emoji, count]) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "reaction";
    button.textContent = `${emoji} ${count}`;

    button.title = list
      .filter(item => item.reaction === emoji)
      .map(item => item.profiles?.username || "Unknown user")
      .join(", ");

    button.addEventListener("click", () => {
      toggleReaction(messageId, emoji);
    });

    container.appendChild(button);
  });

  wrapper.appendChild(container);
}

/* ================= REALTIME ================= */

function setupRealtime() {
  if (!currentUser) return;

  if (messageChannel) {
    supabaseClient.removeChannel(messageChannel);
  }

  if (reactionChannel) {
    supabaseClient.removeChannel(reactionChannel);
  }

  /* MESSAGE CHANNEL */

  messageChannel = supabaseClient
    .channel("neural-ninjas-messages")

    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      payload => {
        handleRealtimeMessage(payload.new);
      }
    )

    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages"
      },
      payload => {
        const id = String(payload.old?.id);

        messageCache.delete(id);
        reactionCache.delete(id);

        document
          .querySelector(
            `[data-message-id="${CSS.escape(id)}"]`
          )
          ?.remove();
      }
    )

    .subscribe(status => {
      if (status === "SUBSCRIBED") {
        if (onlineStatus) {
          onlineStatus.textContent = "● Online";
        }
      }
    });

  /* REACTION CHANNEL */

  reactionChannel = supabaseClient
    .channel("neural-ninjas-reactions")

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reactions"
      },
      () => {
        loadReactions();
      }
    )

    .subscribe();
}

async function handleRealtimeMessage(row) {
  if (!row) return;

  const id = String(row.id);

  if (messageCache.has(id)) return;

  let username = row.sender_name || "Unknown user";

  // Use already loaded member data before querying profiles.
  const cachedMember = loadedMembers.find(
    member => member.id === row.sender_id
  );

  if (cachedMember?.username) {
    username = cachedMember.username;

  } else if (row.sender_id) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, username")
      .eq("id", row.sender_id)
      .maybeSingle();

    if (!error && data?.username) {
      username = data.username;
    }
  }

  const enriched = {
    ...row,
    username
  };

  messageCache.set(id, enriched);
  renderMessage(enriched);
}

/* ================= TYPING INDICATOR ================= */

function setupTyping() {
  if (typingChannel) {
    supabaseClient.removeChannel(typingChannel);
  }

  typingChannel = supabaseClient
    .channel("neural-ninjas-typing")

    .on(
      "broadcast",
      { event: "typing" },
      payload => {
        if (payload.payload?.userId === currentUser?.id) {
          return;
        }

        showTypingUser(payload.payload?.username);
      }
    )

    .subscribe();
}

function handleTyping() {
  if (!typingChannel || !currentUser) return;

  if (!isCurrentlyTyping) {
    isCurrentlyTyping = true;
  }

  typingChannel.send({
    type: "broadcast",
    event: "typing",
    payload: {
      userId: currentUser.id,
      username: currentProfile?.username || "Someone"
    }
  });

  clearTimeout(typingTimeout);

  typingTimeout = setTimeout(stopTyping, 1500);
}

function stopTyping() {
  isCurrentlyTyping = false;

  clearTimeout(typingTimeout);
  typingTimeout = null;

  if (typingIndicator) {
    typingIndicator.textContent = "";
    typingIndicator.classList.add("hidden");
  }
}

function showTypingUser(username) {
  if (!typingIndicator) return;

  typingIndicator.textContent =
    `${username || "Someone"} is typing...`;

  typingIndicator.classList.remove("hidden");

  clearTimeout(typingIndicator._hideTimer);

  typingIndicator._hideTimer = setTimeout(() => {
    typingIndicator.classList.add("hidden");
  }, 1800);
}

/* ================= PRESENCE ================= */

function setupPresence() {
  if (!currentUser) return;

  if (presenceChannel) {
    supabaseClient.removeChannel(presenceChannel);
  }

  presenceChannel = supabaseClient
    .channel(
      "neural-ninjas-presence",
      {
        config: {
          presence: {
            key: currentUser.id
          }
        }
      }
    )

    .on(
      "presence",
      { event: "sync" },
      () => {
        updatePresenceUsers();
      }
    )

    .on(
      "presence",
      { event: "join" },
      () => {
        updatePresenceUsers();
      }
    )

    .on(
      "presence",
      { event: "leave" },
      () => {
        updatePresenceUsers();
      }
    )

    .subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          userId: currentUser.id,
          username: currentProfile?.username || "Unknown user",
          online: true,
          joinedAt: Date.now()
        });

        updatePresenceUsers();
      }
    });
}

function updatePresenceUsers() {
  if (!presenceChannel) return;

  const state = presenceChannel.presenceState();

  presenceUsers = {};

  Object.keys(state).forEach(key => {
    const entries = state[key];

    if (entries && entries.length) {
      presenceUsers[key] = entries[0];
    }
  });

  updateOnlineStatus();

  // Important: use cached members instead of querying profiles
  // after every presence event.
  renderMembers(loadedMembers);
}

function isMemberOnline(userId) {
  return Boolean(presenceUsers[userId]);
}

function updateOnlineStatus() {
  if (!onlineStatus) return;

  const count = Object.keys(presenceUsers).length;

  onlineStatus.textContent =
    `${count ? " • " + count : ""} Member Online`;
}

/* ================= LAST SEEN ================= */

async function updateLastSeen() {
  if (!currentUser) return;

  try {
    const { error } = await supabaseClient
      .from("profiles")
      .update({
        last_seen_at: new Date().toISOString()
      })
      .eq("id", currentUser.id);

    if (error) throw error;

    const member = loadedMembers.find(
      item => item.id === currentUser.id
    );

    if (member) {
      member.last_seen_at = new Date().toISOString();
    }

  } catch (error) {
    console.error("LAST SEEN ERROR:", error);
  }
}

function startLastSeenTimer() {
  clearInterval(lastSeenInterval);

  lastSeenInterval = setInterval(
    updateLastSeen,
    LAST_SEEN_INTERVAL
  );
}

/* ================= SIDEBAR ================= */

function openSidebar() {
  membersSidebar?.classList.add("open");
  sidebarOverlay?.classList.add("open");
}

function closeSidebar() {
  membersSidebar?.classList.remove("open");
  sidebarOverlay?.classList.remove("open");
}

/* ================= THEMES ================= */

function openThemePanel() {
  themePanel?.classList.remove("hidden");
}

function closeThemePanel() {
  themePanel?.classList.add("hidden");
}

function setupThemeButtons() {
  document.querySelectorAll("[data-theme]").forEach(button => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;

      if (theme) {
        applyTheme(theme);
      }
    });
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;

  localStorage.setItem(
    "neural-ninjas-theme",
    theme
  );
}

function restoreTheme() {
  const theme = localStorage.getItem(
    "neural-ninjas-theme"
  );

  if (theme) {
    applyTheme(theme);
  }
}

/* ================= MESSAGE SEARCH ================= */

function performMessageSearch() {
  const query = messageSearchInput?.value
    .trim()
    .toLowerCase();

  document.querySelectorAll(".message").forEach(element => {
    if (!query) {
      element.style.display = "";
      return;
    }

    const id = element.dataset.messageId;
    const message = messageCache.get(String(id));

    const text = [
      message?.message,
      message?.sender_name,
      message?.username
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    element.style.display =
      text.includes(query) ? "" : "none";
  });
}

function clearMessageSearch() {
  if (messageSearchInput) {
    messageSearchInput.value = "";
  }

  performMessageSearch();
}

/* ================= LOGOUT ================= */

async function exitChat() {
  try {
    if (presenceChannel) {
      try {
        await presenceChannel.untrack();
      } catch (_) {}
    }

    const channels = [
      messageChannel,
      reactionChannel,
      typingChannel,
      presenceChannel
    ];

    for (const channel of channels) {
      if (channel) {
        await supabaseClient.removeChannel(channel);
      }
    }

    await supabaseClient.auth.signOut();

  } catch (error) {
    console.error("LOGOUT ERROR:", error);
  }

  clearInterval(lastSeenInterval);
  clearTimeout(typingTimeout);

  currentUser = null;
  currentProfile = null;

  messageChannel = null;
  reactionChannel = null;
  typingChannel = null;
  presenceChannel = null;

  messageCache.clear();
  reactionCache.clear();

  presenceUsers = {};
  loadedMembers = [];

  chatScreen?.classList.add("hidden");
  loginScreen?.classList.remove("hidden");

  if (usernameInput) usernameInput.value = "";
  if (pinInput) pinInput.value = "";
  if (messages) messages.innerHTML = "";

  cancelReply();
  closeSidebar();
  closeThemePanel();
}

/* ================= DELETE ACCOUNT ================= */

async function deleteAccount() {
  if (!currentUser) return;

  const confirmed = confirm(
    "Are you sure you want to permanently delete your account?"
  );

  if (!confirmed) return;

  const secondConfirm = confirm(
    "This action cannot be easily undone. Continue?"
  );

  if (!secondConfirm) return;

  try {
    const sessionResult =
      await supabaseClient.auth.getSession();

    const accessToken =
      sessionResult.data.session?.access_token;

    if (!accessToken) {
      throw new Error("No active session.");
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/super-responder`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },

        body: JSON.stringify({
          action: "delete_account"
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        "Account deletion failed."
      );
    }

    alert("Account deleted successfully.");

    await exitChat();

  } catch (error) {
    console.error("DELETE ACCOUNT ERROR:", error);

    alert(
      "Account deletion failed: " +
      error.message
    );
  }
}

/* ================= HELPERS ================= */

function getInitials(username) {
  if (!username) return "?";

  const words = username
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] +
    words[1][0]
  ).toUpperCase();
}

function formatMessageTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLastSeen(timestamp) {
  if (!timestamp) return "Offline";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Offline";

  const diff = Date.now() - date.getTime();

  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `Last seen ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Last seen ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `Last seen ${days}d ago`;
}

function getFileExtension(filename) {
  const index = filename.lastIndexOf(".");

  if (index === -1) return "";

  return filename.slice(index).toLowerCase();
}

function scrollMessagesToBottom() {
  if (!messages) return;

  requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
  });
}

function showLoginStatus(text, isError = false) {
  if (!loginStatus) return;

  loginStatus.textContent = text;
  loginStatus.classList.toggle("error", isError);
}

function showChatError(text) {
  if (!messages) return;

  const error = document.createElement("div");

  error.className = "chat-error";
  error.textContent = text;

  messages.appendChild(error);
}

/* ================= GLOBAL ERROR HANDLING ================= */

window.addEventListener("unhandledrejection", event => {
  console.error("UNHANDLED PROMISE:", event.reason);
});

window.addEventListener("error", event => {
  console.error(
    "GLOBAL ERROR:",
    event.error || event.message
  );
});
/* ================= END OF APP.JS ================= */
