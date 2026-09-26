/* =========================================================
   NEURAL NINJAS — APP.JS
   Username + 6-Digit PIN
   Realtime Chat + Media + Voice + Reply + Reactions
   Search + Presence + Last Seen + Themes
   ========================================================= */

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentProfile = null;

let messageChannel = null;
let reactionChannel = null;
let typingChannel = null;
let presenceChannel = null;

let typingTimeout = null;
let lastSeenInterval = null;

let replyingToMessage = null;

const messageCache = new Map();
const reactionCache = new Map();

let presenceUsers = {};

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let isRecordingVoice = false;

/* =========================================================
   DOM
   ========================================================= */

let loginScreen;
let chatScreen;

let usernameInput;
let pinInput;
let joinBtn;
let loginStatus;

let onlineStatus;

let menuBtn;
let logoutBtn;

let membersSidebar;
let closeSidebarBtn;
let sidebarOverlay;
let membersList;
let memberCount;
let deleteAccountBtn;

let themeBtn;
let themePanel;
let closeThemeBtn;

let searchBar;
let messageSearchInput;
let clearSearchBtn;

let messages;
let typingIndicator;

let replyBar;
let replySender;
let replyPreview;
let cancelReplyBtn;

let mediaBtn;
let fileInput;
let messageInput;
let sendBtn;

/* =========================================================
   INIT
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);

function init() {
  loginScreen = document.getElementById("loginScreen");
  chatScreen = document.getElementById("chatScreen");

  usernameInput = document.getElementById("usernameInput");
  pinInput = document.getElementById("pinInput");
  joinBtn = document.getElementById("joinBtn");
  loginStatus = document.getElementById("loginStatus");

  onlineStatus = document.getElementById("onlineStatus");

  menuBtn = document.getElementById("menuBtn");
  logoutBtn = document.getElementById("logoutBtn");

  membersSidebar = document.getElementById("membersSidebar");
  closeSidebarBtn = document.getElementById("closeSidebarBtn");
  sidebarOverlay = document.getElementById("sidebarOverlay");
  membersList = document.getElementById("membersList");
  memberCount = document.getElementById("memberCount");
  deleteAccountBtn = document.getElementById("deleteAccountBtn");

  themeBtn = document.getElementById("themeBtn");
  themePanel = document.getElementById("themePanel");
  closeThemeBtn = document.getElementById("closeThemeBtn");

  searchBar = document.getElementById("searchBar");
  messageSearchInput = document.getElementById("messageSearchInput");
  clearSearchBtn = document.getElementById("clearSearchBtn");

  messages = document.getElementById("messages");
  typingIndicator = document.getElementById("typingIndicator");

  replyBar = document.getElementById("replyBar");
  replySender = document.getElementById("replySender");
  replyPreview = document.getElementById("replyPreview");
  cancelReplyBtn = document.getElementById("cancelReplyBtn");

  mediaBtn = document.getElementById("mediaBtn");
  fileInput = document.getElementById("fileInput");
  messageInput = document.getElementById("messageInput");
  sendBtn = document.getElementById("sendBtn");

  /* LOGIN */
  joinBtn?.addEventListener("click", handleLogin);

  usernameInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") pinInput?.focus();
  });

  pinInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") handleLogin();
  });

  /* LOGOUT */
  logoutBtn?.addEventListener("click", exitChat);

  /* SIDEBAR */
  menuBtn?.addEventListener("click", openSidebar);
  closeSidebarBtn?.addEventListener("click", closeSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);

  deleteAccountBtn?.addEventListener("click", deleteAccount);

  /* THEME */
  themeBtn?.addEventListener("click", () => {
    themePanel?.classList.toggle("hidden");
  });

  closeThemeBtn?.addEventListener("click", () => {
    themePanel?.classList.add("hidden");
  });

  document.querySelectorAll(".theme-option").forEach(button => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;
      if (theme) applyTheme(theme);
      themePanel?.classList.add("hidden");
    });
  });

  /* SEARCH */
  messageSearchInput?.addEventListener("input", filterMessages);

  clearSearchBtn?.addEventListener("click", () => {
    if (messageSearchInput) messageSearchInput.value = "";
    filterMessages();
    messageSearchInput?.focus();
  });

  /* SEND */
  sendBtn?.addEventListener("click", sendMessage);

  messageInput?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  messageInput?.addEventListener("input", handleTyping);

  /* REPLY */
  cancelReplyBtn?.addEventListener("click", cancelReply);

  /* MEDIA */
  mediaBtn?.addEventListener("click", () => {
    if (!currentUser) return;
    fileInput?.click();
  });

  fileInput?.addEventListener("change", async e => {
    const file = e.target.files?.[0];

    if (file) {
      await handleFileUpload(file);
    }

    e.target.value = "";
  });

  /* ESCAPE */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSidebar();
      themePanel?.classList.add("hidden");
      closeReactionPopup();
    }
  });

  /* VISIBILITY */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      updateLastSeen();
    } else {
      updateLastSeen();
      updateOnlineStatus();
    }
  });

  /* THEME RESTORE */
  const savedTheme = localStorage.getItem("neural-ninjas-theme");

  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme("default");
  }

  restoreSession();

  console.log("NEURAL NINJAS APP INITIALIZED");
}

/* =========================================================
   AUTH
   ========================================================= */

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

async function handleLogin() {
  const username = usernameInput?.value.trim() || "";
  const pin = pinInput?.value.trim() || "";

  if (username.length < 2) {
    setLoginStatus("Username must contain at least 2 characters.");
    return;
  }

  if (!/^\d{6}$/.test(pin)) {
    setLoginStatus("PIN must be exactly 6 digits.");
    return;
  }

  if (joinBtn) {
    joinBtn.disabled = true;
    joinBtn.textContent = "Connecting...";
  }

  setLoginStatus("");

  try {
    const email = makeAuthEmail(username);

    /* TRY LOGIN */
    let result = await supabaseClient.auth.signInWithPassword({
      email,
      password: pin
    });

    /* IF LOGIN FAILS, TRY SIGNUP */
    if (result.error) {
      result = await supabaseClient.auth.signUp({
        email,
        password: pin,
        options: {
          data: {
            username
          }
        }
      });
    }

    if (result.error) {
      throw result.error;
    }

    if (!result.data?.user) {
      throw new Error("No user account was returned by Supabase.");
    }

    if (!result.data.session) {
      throw new Error(
        "No active session. Disable email confirmation in Supabase Auth."
      );
    }

    currentUser = result.data.user;

    await loadCurrentProfile(username);
    await startChat();

    if (pinInput) pinInput.value = "";

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    setLoginStatus(error.message || "Login failed.");
  } finally {
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = "Enter Neural Ninjas";
    }
  }
}

function setLoginStatus(message) {
  if (loginStatus) {
    loginStatus.textContent = message || "";
  }
}

/* =========================================================
   PROFILE
   ========================================================= */

async function loadCurrentProfile(fallbackUsername = "") {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("PROFILE FETCH ERROR:", error);
    throw error;
  }

  if (data) {
    currentProfile = data;
    return;
  }

  const username =
    fallbackUsername ||
    currentUser.user_metadata?.username ||
    "User";

  const { data: created, error: createError } =
    await supabaseClient
      .from("profiles")
      .insert({
        id: currentUser.id,
        username,
        last_seen_at: new Date().toISOString()
      })
      .select("*")
      .single();

  if (createError) {
    console.error("PROFILE CREATE ERROR:", createError);
    throw createError;
  }

  currentProfile = created;
}

/* =========================================================
   RESTORE SESSION
   ========================================================= */

async function restoreSession() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    const session = data?.session;

    if (!session?.user) return;

    currentUser = session.user;

    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (profileError) {
      console.error("RESTORE PROFILE ERROR:", profileError);
      throw profileError;
    }

    currentProfile = profile;

    if (currentProfile) {
      await startChat();
    }

  } catch (error) {
    console.error("RESTORE SESSION ERROR:", error);
  }
}

/* =========================================================
   START CHAT
   ========================================================= */

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

  try {
    await loadMessages();
    await loadReactions();
    await loadMembers();

    await updateLastSeen();

    startLastSeenTimer();

    updateOnlineStatus();

    messageInput?.focus();

  } catch (error) {
    console.error("START CHAT ERROR:", error);
    showChatError(error.message || "Failed to load chat.");
  }
}

/* =========================================================
   CLEAR STATE
   ========================================================= */

function clearOldState() {
  messageCache.clear();
  reactionCache.clear();

  presenceUsers = {};

  if (messages) {
    messages.innerHTML = "";
  }

  cancelReply();

  if (typingIndicator) {
    typingIndicator.textContent = "";
    typingIndicator.classList.remove("show");
  }
}

/* =========================================================
   LOAD MESSAGES
   ========================================================= */

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("LOAD MESSAGES ERROR:", error);
    throw new Error(
      "Messages load failed: " + error.message
    );
  }

  const rows = data || [];

  const senderIds = [
    ...new Set(
      rows
        .map(row => row.sender_id)
        .filter(Boolean)
    )
  ];

  let profiles = [];

  if (senderIds.length) {
    const { data: profileData, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("id, username, bio, last_seen_at")
        .in("id", senderIds);

    if (profileError) {
      console.warn(
        "MESSAGE PROFILE LOAD ERROR:",
        profileError
      );
    } else {
      profiles = profileData || [];
    }
  }

  const profileMap = new Map(
    profiles.map(profile => [
      profile.id,
      profile
    ])
  );

  if (messages) {
    messages.innerHTML = "";
  }

  rows.forEach(row => {
    const profile = profileMap.get(row.sender_id);

    const enriched = {
      ...row,
      username:
        profile?.username ||
        (row.sender_id === currentUser?.id
          ? currentProfile?.username
          : "Unknown user"),
      profile
    };

    messageCache.set(enriched.id, enriched);

    renderMessage(enriched, false);
  });

  scrollMessagesToBottom();
}

/* =========================================================
   REALTIME
   ========================================================= */

function setupRealtime() {
  cleanupRealtimeChannels();

  messageChannel = supabaseClient
    .channel("neural-ninjas-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      async payload => {
        try {
          const row = payload.new;

          if (!row?.id) return;

          /*
             Own message is already rendered by sendMessage().
             Avoid duplicate.
          */
          if (messageCache.has(row.id)) return;

          let username = "Unknown user";
          let profile = null;

          if (row.sender_id) {
            const { data } =
              await supabaseClient
                .from("profiles")
                .select(
                  "id, username, bio, last_seen_at"
                )
                .eq("id", row.sender_id)
                .maybeSingle();

            profile = data || null;

            username =
              data?.username ||
              "Unknown user";
          }

          const message = {
            ...row,
            username,
            profile
          };

          messageCache.set(message.id, message);

          renderMessage(message, true);

        } catch (error) {
          console.error(
            "REALTIME MESSAGE ERROR:",
            error
          );
        }
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
        const id = payload.old?.id;

        if (!id) return;

        messageCache.delete(id);
        removeMessageElement(id);
      }
    )
    .subscribe(status => {
      console.log(
        "MESSAGE CHANNEL:",
        status
      );
    });

  /* REACTIONS */

  reactionChannel = supabaseClient
    .channel("neural-ninjas-reactions")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reactions"
      },
      async payload => {
        const messageId =
          payload.new?.message_id ||
          payload.old?.message_id;

        if (!messageId) return;

        await loadReactionsForMessage(messageId);

        const message = messageCache.get(messageId);

        if (message) {
          rerenderMessage(message);
        }
      }
    )
    .subscribe(status => {
      console.log(
        "REACTION CHANNEL:",
        status
      );
    });
}

/* =========================================================
   CLEANUP REALTIME
   ========================================================= */

function cleanupRealtimeChannels() {
  if (messageChannel) {
    supabaseClient.removeChannel(messageChannel);
    messageChannel = null;
  }

  if (reactionChannel) {
    supabaseClient.removeChannel(reactionChannel);
    reactionChannel = null;
  }

  if (typingChannel) {
    supabaseClient.removeChannel(typingChannel);
    typingChannel = null;
  }

  if (presenceChannel) {
    supabaseClient.removeChannel(presenceChannel);
    presenceChannel = null;
  }

  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
}

/* =========================================================
   RENDER MESSAGE
   ========================================================= */

function renderMessage(data, shouldScroll = true) {
  if (!data || !messages || !data.id) return;

  const existing = document.querySelector(
    `.message[data-message-id="${escapeSelector(data.id)}"]`
  );

  if (existing) {
    return;
  }

  const wrapper = document.createElement("div");

  wrapper.className = "message";

  wrapper.dataset.messageId = data.id;

  if (data.sender_id === currentUser?.id) {
    wrapper.classList.add("mine");
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  /* SENDER */

  const sender = document.createElement("div");

  sender.className = "sender sender-name";

  sender.textContent =
    data.username ||
    currentProfile?.username ||
    "Unknown";

  bubble.appendChild(sender);

  /* REPLY PREVIEW */

  if (data.reply_to) {
    const reply = createReplyPreview(data.reply_to);

    if (reply) {
      bubble.appendChild(reply);
    }
  }

  /* CONTENT */

  const type = String(
    data.message_type || "text"
  ).toLowerCase();

  if (type === "image" && data.file_url) {
    bubble.appendChild(
      createImageContent(data.file_url, data.content)
    );

  } else if (type === "video" && data.file_url) {
    bubble.appendChild(
      createVideoContent(data.file_url)
    );

  } else if (
    (type === "audio" || type === "voice") &&
    data.file_url
  ) {
    bubble.appendChild(
      createAudioContent(data.file_url)
    );

  } else if (
    type === "code" ||
    looksLikeCode(data.content || "")
  ) {
    bubble.appendChild(
      createCodeContent(data.content || "")
    );

  } else {
    bubble.appendChild(
      createTextContent(data.content || "")
    );
  }

  /* TIME */

  const time = document.createElement("span");

  time.className = "time message-time";

  time.textContent = formatMessageTime(
    data.created_at
  );

  bubble.appendChild(time);

  /* REPLY BUTTON */

  const replyButton =
    document.createElement("button");

  replyButton.type = "button";
  replyButton.className = "reply-message";
  replyButton.textContent = "↩ Reply";

  replyButton.addEventListener("click", () => {
    startReply(data);
  });

  bubble.appendChild(replyButton);

  /* DELETE */

  if (data.sender_id === currentUser?.id) {
    const deleteButton =
      document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "delete-message";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      deleteMessage(data.id);
    });

    bubble.appendChild(deleteButton);
  }

  /* REACTIONS */

  const reactionArea =
    document.createElement("div");

  reactionArea.className = "reaction-area";

  bubble.appendChild(reactionArea);

  wrapper.appendChild(bubble);

  messages.appendChild(wrapper);

  renderReactionCounts(
    reactionArea,
    data.id
  );

  setupReactionPicker(
    wrapper,
    data.id
  );

  if (shouldScroll) {
    scrollMessagesToBottom();
  }
}

/* =========================================================
   TEXT
   ========================================================= */

function createTextContent(text) {
  const container =
    document.createElement("div");

  container.className = "text message-text";

  appendSafeTextWithLinks(
    container,
    String(text)
  );

  return container;
}

function appendSafeTextWithLinks(
  container,
  text
) {
  const urlRegex =
    /(https?:\/\/[^\s]+)/g;

  let lastIndex = 0;

  text.replace(
    urlRegex,
    (url, offset) => {
      if (offset > lastIndex) {
        container.appendChild(
          document.createTextNode(
            text.slice(lastIndex, offset)
          )
        );
      }

      const link =
        document.createElement("a");

      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      link.className = "message-link";

      link.textContent = url;

      container.appendChild(link);

      lastIndex =
        offset + url.length;

      return url;
    }
  );

  if (lastIndex < text.length) {
    container.appendChild(
      document.createTextNode(
        text.slice(lastIndex)
      )
    );
  }
}

/* =========================================================
   CODE
   ========================================================= */

function looksLikeCode(text) {
  if (!text) return false;

  return (
    text.includes("```") ||
    /<html[\s>]/i.test(text) ||
    /<\/html>/i.test(text) ||
    text.includes("function ") ||
    text.includes("const ") ||
    text.includes("let ") ||
    text.includes("=>") ||
    text.includes("console.log") ||
    text.includes("SELECT ") ||
    text.includes("CREATE TABLE") ||
    text.includes("INSERT INTO")
  );
}

function cleanCode(text) {
  let code = String(text || "");

  code = code.replace(
    /^```[a-zA-Z0-9_-]*\s*/,
    ""
  );

  code = code.replace(
    /\s*```$/,
    ""
  );

  return code;
}

function createCodeContent(text) {
  const box =
    document.createElement("div");

  box.className = "code-box";

  const copy =
    document.createElement("button");

  copy.type = "button";
  copy.className = "copy-code";
  copy.textContent = "Copy code";

  const pre =
    document.createElement("pre");

  const code =
    document.createElement("code");

  code.textContent =
    cleanCode(text);

  pre.appendChild(code);

  copy.addEventListener(
    "click",
    async () => {
      const value =
        cleanCode(text);

      try {
        if (
          navigator.clipboard &&
          navigator.clipboard.writeText
        ) {
          await navigator.clipboard.writeText(
            value
          );
        } else {
          fallbackCopy(value);
        }

        copy.textContent = "Copied ✓";

        setTimeout(() => {
          copy.textContent = "Copy code";
        }, 1200);

      } catch (error) {
        console.error(
          "COPY ERROR:",
          error
        );

        fallbackCopy(value);

        copy.textContent = "Copied ✓";

        setTimeout(() => {
          copy.textContent = "Copy code";
        }, 1200);
      }
    }
  );

  box.appendChild(copy);
  box.appendChild(pre);

  if (
    window.hljs &&
    typeof window.hljs.highlightElement ===
      "function"
  ) {
    try {
      window.hljs.highlightElement(code);
    } catch (error) {
      console.warn(
        "HIGHLIGHT ERROR:",
        error
      );
    }
  }

  return box;
}

function fallbackCopy(text) {
  const textarea =
    document.createElement("textarea");

  textarea.value = text;

  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";

  document.body.appendChild(textarea);

  textarea.select();

  try {
    document.execCommand("copy");
  } catch (error) {
    console.error(
      "FALLBACK COPY ERROR:",
      error
    );
  }

  textarea.remove();
}

/* =========================================================
   MEDIA
   ========================================================= */

function createImageContent(url, filename) {
  const container =
    document.createElement("div");

  const image =
    document.createElement("img");

  image.className = "chat-media";
  image.src = url;
  image.alt = filename || "Image";
  image.loading = "lazy";

  image.addEventListener("click", () => {
    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  });

  container.appendChild(image);

  const save =
    document.createElement("a");

  save.href = url;
  save.target = "_blank";
  save.rel = "noopener noreferrer";
  save.download = filename || "media";

  save.className = "save-media";
  save.textContent = "Open / Save";

  container.appendChild(save);

  return container;
}

function createVideoContent(url) {
  const video =
    document.createElement("video");

  video.className = "chat-media";

  video.src = url;

  video.controls = true;
  video.playsInline = true;

  return video;
}

function createAudioContent(url) {
  const audio =
    document.createElement("audio");

  audio.className = "chat-media";

  audio.src = url;

  audio.controls = true;

  return audio;
}

/* =========================================================
   UPLOAD
   ========================================================= */

async function handleFileUpload(file) {
  if (!currentUser || !file) return;

  if (file.size > 50 * 1024 * 1024) {
    showChatError(
      "Maximum file size is 50 MB."
    );
    return;
  }

  const allowed =
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/");

  if (!allowed) {
    showChatError(
      "Only image, video and audio files are supported."
    );
    return;
  }

  showChatError(
    "Uploading " + file.name + "..."
  );

  try {
    const extension =
      getFileExtension(file.name);

    const path =
      `${currentUser.id}/${Date.now()}-${randomId()}${extension}`;

    const { error: uploadError } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .upload(path, file, {
          upsert: false,
          contentType: file.type
        });

    if (uploadError) {
      throw new Error(
        "Storage upload failed: " +
        uploadError.message
      );
    }

    const { data: signedData, error: signedError } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .createSignedUrl(
          path,
          60 * 60 * 24 * 30
        );

    if (signedError) {
      throw new Error(
        "Signed URL failed: " +
        signedError.message
      );
    }

    const fileUrl =
      signedData?.signedUrl;

    if (!fileUrl) {
      throw new Error(
        "Supabase did not return a file URL."
      );
    }

    const messageType =
      file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "audio";

    const payload = {
      sender_id: currentUser.id,
      content: file.name,
      message_type: messageType,
      file_url: fileUrl,
      reply_to: replyingToMessage?.id || null
    };

    const { data, error } =
      await supabaseClient
        .from("messages")
        .insert(payload)
        .select("*")
        .single();

    if (error) {
      throw new Error(
        "Message insert failed: " +
        error.message
      );
    }

    const message = {
      ...data,
      username:
        currentProfile?.username ||
        currentUser.user_metadata?.username ||
        "You",
      profile: currentProfile
    };

    messageCache.set(
      message.id,
      message
    );

    renderMessage(
      message,
      true
    );

    cancelReply();

    showChatError(
      "Uploaded successfully ✓"
    );

  } catch (error) {
    console.error(
      "FILE UPLOAD ERROR:",
      error
    );

    showChatError(
      error.message ||
      "File upload failed."
    );
  }
}

/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {
  if (!currentUser) {
    showChatError("Please login first.");
    return;
  }

  const content =
    messageInput?.value.trim() || "";

  if (!content) return;

  if (sendBtn) {
    sendBtn.disabled = true;
  }

  const replyTo =
    replyingToMessage?.id || null;

  try {
    const messageType =
      looksLikeCode(content)
        ? "code"
        : "text";

    const payload = {
      sender_id: currentUser.id,
      content,
      message_type: messageType,
      reply_to: replyTo
    };

    const { data, error } =
      await supabaseClient
        .from("messages")
        .insert(payload)
        .select("*")
        .single();

    if (error) {
      throw new Error(
        "Message send failed: " +
        error.message
      );
    }

    const message = {
      ...data,
      username:
        currentProfile?.username ||
        currentUser.user_metadata?.username ||
        "You",
      profile: currentProfile
    };

    messageCache.set(
      message.id,
      message
    );

    renderMessage(
      message,
      true
    );

    if (messageInput) {
      messageInput.value = "";
    }

    cancelReply();

    stopTypingBroadcast();

  } catch (error) {
    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    showChatError(
      error.message ||
      "Failed to send message."
    );

  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
    }

    messageInput?.focus();
  }
}

/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(id) {
  if (!currentUser || !id) return;

  const message =
    messageCache.get(id);

  if (
    !message ||
    message.sender_id !== currentUser.id
  ) {
    return;
  }

  if (!confirm("Delete this message?")) {
    return;
  }

  try {
    const { error } =
      await supabaseClient
        .from("messages")
        .delete()
        .eq("id", id)
        .eq("sender_id", currentUser.id);

    if (error) {
      throw error;
    }

    messageCache.delete(id);

    removeMessageElement(id);

  } catch (error) {
    console.error(
      "DELETE MESSAGE ERROR:",
      error
    );

    showChatError(
      "Delete failed: " +
      error.message
    );
  }
}

function removeMessageElement(id) {
  const element =
    document.querySelector(
      `.message[data-message-id="${escapeSelector(id)}"]`
    );

  element?.remove();
}

/* =========================================================
   REPLY
   ========================================================= */

function startReply(message) {
  if (!message) return;

  replyingToMessage = message;

  replyBar?.classList.remove("hidden");

  if (replySender) {
    replySender.textContent =
      message.username ||
      "Unknown";
  }

  if (replyPreview) {
    replyPreview.textContent =
      getMessagePreview(message);
  }

  messageInput?.focus();
}

function cancelReply() {
  replyingToMessage = null;

  replyBar?.classList.add("hidden");

  if (replySender) {
    replySender.textContent = "";
  }

  if (replyPreview) {
    replyPreview.textContent = "";
  }
}

function createReplyPreview(messageId) {
  const original =
    messageCache.get(messageId);

  const box =
    document.createElement("div");

  box.className =
    "message-reply-preview";

  const sender =
    document.createElement("div");

  sender.className =
    "message-reply-sender";

  sender.textContent =
    original?.username ||
    "Unknown";

  const content =
    document.createElement("div");

  content.className =
    "message-reply-content";

  content.textContent =
    original
      ? getMessagePreview(original)
      : "Original message unavailable";

  box.appendChild(sender);
  box.appendChild(content);

  box.addEventListener("click", () => {
    jumpToMessage(messageId);
  });

  return box;
}

function getMessagePreview(message) {
  if (!message) return "";

  if (message.message_type === "image") {
    return "📷 Image";
  }

  if (message.message_type === "video") {
    return "🎥 Video";
  }

  if (
    message.message_type === "audio" ||
    message.message_type === "voice"
  ) {
    return "🎵 Audio";
  }

  return String(
    message.content || ""
  ).slice(0, 120);
}

function jumpToMessage(id) {
  const element =
    document.querySelector(
      `.message[data-message-id="${escapeSelector(id)}"]`
    );

  if (!element) return;

  element.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  element.classList.remove(
    "reply-target-highlight"
  );

  void element.offsetWidth;

  element.classList.add(
    "reply-target-highlight"
  );
}

/* =========================================================
   REACTIONS
   ========================================================= */

const REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "🔥",
  "😮",
  "😢"
];

async function loadReactions() {
  reactionCache.clear();

  const { data, error } =
    await supabaseClient
      .from("message_reactions")
      .select(
        "user_id, message_id, reaction, profiles(username)"
      );

  if (error) {
    console.warn(
      "LOAD REACTIONS ERROR:",
      error
    );
    return;
  }

  (data || []).forEach(row => {
    addReactionToCache(row);
  });

  refreshAllReactionDisplays();
}

async function loadReactionsForMessage(messageId) {
  const { data, error } =
    await supabaseClient
      .from("message_reactions")
      .select(
        "user_id, message_id, reaction, profiles(username)"
      )
      .eq("message_id", messageId);

  if (error) {
    console.warn(
      "LOAD MESSAGE REACTIONS ERROR:",
      error
    );
    return;
  }

  reactionCache.set(
    messageId,
    data || []
  );

  refreshReactionDisplay(messageId);
}

function addReactionToCache(row) {
  if (!row?.message_id) return;

  const list =
    reactionCache.get(row.message_id) || [];

  list.push(row);

  reactionCache.set(
    row.message_id,
    list
  );
}

function setupReactionPicker(
  wrapper,
  messageId
) {
  let pressTimer = null;

  wrapper.addEventListener(
    "contextmenu",
    event => {
      event.preventDefault();

      showReactionPicker(
        event.clientX,
        event.clientY,
        messageId
      );
    }
  );

  wrapper.addEventListener(
    "touchstart",
    event => {
      const touch =
        event.touches?.[0];

      if (!touch) return;

      pressTimer = setTimeout(() => {
        showReactionPicker(
          touch.clientX,
          touch.clientY,
          messageId
        );
      }, 550);
    },
    { passive: true }
  );

  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  wrapper.addEventListener(
    "touchend",
    cancelPress
  );

  wrapper.addEventListener(
    "touchmove",
    cancelPress
  );

  wrapper.addEventListener(
    "touchcancel",
    cancelPress
  );
}

function showReactionPicker(
  x,
  y,
  messageId
) {
  closeReactionPopup();

  const popup =
    document.createElement("div");

  popup.className =
    "reaction-picker-popup";

  Object.assign(
    popup.style,
    {
      position: "fixed",
      left: Math.max(
        8,
        Math.min(
          x,
          window.innerWidth - 250
        )
      ) + "px",
      top: Math.max(
        8,
        Math.min(
          y,
          window.innerHeight - 60
        )
      ) + "px",
      zIndex: "99999",
      display: "flex",
      gap: "5px",
      padding: "7px",
      borderRadius: "12px",
      background: "#111827",
      border: "1px solid rgba(125,211,252,.3)",
      boxShadow: "0 12px 35px rgba(0,0,0,.5)"
    }
  );

  REACTIONS.forEach(reaction => {
    const button =
      document.createElement("button");

    button.type = "button";

    button.textContent = reaction;

    Object.assign(
      button.style,
      {
        width: "34px",
        height: "34px",
        border: "none",
        borderRadius: "8px",
        background: "rgba(255,255,255,.07)",
        fontSize: "18px",
        cursor: "pointer"
      }
    );

    button.addEventListener(
      "click",
      async () => {
        await toggleReaction(
          messageId,
          reaction
        );

        closeReactionPopup();
      }
    );

    popup.appendChild(button);
  });

  document.body.appendChild(popup);

  setTimeout(() => {
    document.addEventListener(
      "click",
      closeReactionPopup,
      {
        once: true
      }
    );
  }, 0);
}

function closeReactionPopup() {
  document
    .querySelectorAll(
      ".reaction-picker-popup"
    )
    .forEach(el => el.remove());
}

async function toggleReaction(
  messageId,
  reaction
) {
  if (!currentUser) return;

  try {
    const { data: existing, error: findError } =
      await supabaseClient
        .from("message_reactions")
        .select("user_id")
        .eq("message_id", messageId)
        .eq("user_id", currentUser.id)
        .eq("reaction", reaction)
        .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existing) {
      const { error } =
        await supabaseClient
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", currentUser.id)
          .eq("reaction", reaction);

      if (error) throw error;

    } else {
      const { error } =
        await supabaseClient
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: currentUser.id,
            reaction
          });

      if (error) throw error;
    }

    await loadReactionsForMessage(
      messageId
    );

  } catch (error) {
    console.error(
      "REACTION ERROR:",
      error
    );

    showChatError(
      "Reaction failed: " +
      error.message
    );
  }
}

function renderReactionCounts(
  area,
  messageId
) {
  if (!area) return;

  area.innerHTML = "";

  const list =
    reactionCache.get(messageId) || [];

  if (!list.length) return;

  const grouped = new Map();

  list.forEach(row => {
    const emoji =
      row.reaction || "";

    grouped.set(
      emoji,
      (grouped.get(emoji) || 0) + 1
    );
  });

  const bar =
    document.createElement("div");

  bar.className =
    "reaction-counts";

  grouped.forEach(
    (count, emoji) => {
      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "reaction-count";

      button.textContent =
        `${emoji} ${count}`;

      button.addEventListener(
        "click",
        () => {
          showReactionUsers(
            messageId,
            emoji
          );
        }
      );

      bar.appendChild(button);
    }
  );

  area.appendChild(bar);
}

function refreshReactionDisplay(
  messageId
) {
  const wrapper =
    document.querySelector(
      `.message[data-message-id="${escapeSelector(messageId)}"]`
    );

  if (!wrapper) return;

  const area =
    wrapper.querySelector(
      ".reaction-area"
    );

  if (area) {
    renderReactionCounts(
      area,
      messageId
    );
  }
}

function refreshAllReactionDisplays() {
  messageCache.forEach(
    (_, messageId) => {
      refreshReactionDisplay(
        messageId
      );
    }
  );
}

function showReactionUsers(
  messageId,
  reaction
) {
  const list =
    reactionCache.get(messageId) || [];

  const users =
    list.filter(
      row => row.reaction === reaction
    );

  const overlay =
    document.createElement("div");

  overlay.className =
    "reaction-users-overlay";

  const popup =
    document.createElement("div");

  popup.className =
    "reaction-users-popup";

  const header =
    document.createElement("div");

  header.className =
    "reaction-users-header";

  header.textContent =
    `${reaction} Reactions`;

  popup.appendChild(header);

  if (!users.length) {
    const empty =
      document.createElement("div");

    empty.className =
      "reaction-users-empty";

    empty.textContent =
      "No reactions yet.";

    popup.appendChild(empty);

  } else {
    users.forEach(row => {
      const item =
        document.createElement("div");

      item.className =
        "reaction-user-row";

      const name =
        document.createElement("span");

      name.className =
        "reaction-user-name";

      name.textContent =
        row.profiles?.username ||
        "Unknown user";

      const emoji =
        document.createElement("span");

      emoji.className =
        "reaction-user-emoji";

      emoji.textContent =
        reaction;

      item.appendChild(name);
      item.appendChild(emoji);

      popup.appendChild(item);
    });
  }

  const close =
    document.createElement("button");

  close.type = "button";

  close.className =
    "reaction-users-close";

  close.textContent = "Close";

  close.addEventListener(
    "click",
    () => overlay.remove()
  );

  popup.appendChild(close);

  overlay.appendChild(popup);

  overlay.addEventListener(
    "click",
    e => {
      if (e.target === overlay) {
        overlay.remove();
      }
    }
  );

  document.body.appendChild(overlay);
}

/* =========================================================
   TYPING
   ========================================================= */

function setupTyping() {
  if (typingChannel) {
    supabaseClient.removeChannel(
      typingChannel
    );
  }

  typingChannel =
    supabaseClient.channel(
      "neural-ninjas-typing"
    );

  typingChannel
    .on(
      "broadcast",
      {
        event: "typing"
      },
      payload => {
        const username =
          payload.payload?.username;

        const userId =
          payload.payload?.userId;

        if (
          !username ||
          userId === currentUser?.id
        ) {
          return;
        }

        showTypingUser(username);
      }
    )
    .subscribe();
}

function handleTyping() {
  if (!currentUser || !typingChannel) {
    return;
  }

  clearTimeout(typingTimeout);

  typingChannel.send({
    type: "broadcast",
    event: "typing",
    payload: {
      username:
        currentProfile?.username ||
        "Someone",
      userId: currentUser.id
    }
  });

  typingTimeout = setTimeout(() => {
    hideTypingIndicator();
  }, 1800);
}

function stopTypingBroadcast() {
  clearTimeout(typingTimeout);
  hideTypingIndicator();
}

function showTypingUser(username) {
  if (!typingIndicator) return;

  typingIndicator.textContent =
    `${username} is typing...`;

  typingIndicator.classList.add("show");

  clearTimeout(
    typingIndicator._hideTimer
  );

  typingIndicator._hideTimer =
    setTimeout(() => {
      hideTypingIndicator();
    }, 1800);
}

function hideTypingIndicator() {
  typingIndicator?.classList.remove(
    "show"
  );

  if (typingIndicator) {
    typingIndicator.textContent = "";
  }
}

/* =========================================================
   PRESENCE
   ========================================================= */

function setupPresence() {
  if (!currentUser) return;

  if (presenceChannel) {
    supabaseClient.removeChannel(
      presenceChannel
    );
  }

  presenceChannel =
    supabaseClient.channel(
      "neural-ninjas-presence",
      {
        config: {
          presence: {
            key: currentUser.id
          }
        }
      }
    );

  presenceChannel
    .on(
      "presence",
      {
        event: "sync"
      },
      refreshPresenceState
    )
    .on(
      "presence",
      {
        event: "join"
      },
      refreshPresenceState
    )
    .on(
      "presence",
      {
        event: "leave"
      },
      refreshPresenceState
    )
    .subscribe(
      async status => {
        console.log(
          "PRESENCE CHANNEL:",
          status
        );

        if (status === "SUBSCRIBED") {
          try {
            await presenceChannel.track({
              userId:
                currentUser.id,
              username:
                currentProfile?.username ||
                "User",
              online: true,
              joinedAt: Date.now()
            });
          } catch (error) {
            console.error(
              "PRESENCE TRACK ERROR:",
              error
            );
          }
        }
      }
    );
}

function refreshPresenceState() {
  if (!presenceChannel) return;

  presenceUsers =
    presenceChannel.presenceState() || {};

  renderMembers();
  updateOnlineStatus();
}

function isUserOnline(userId) {
  if (!userId) return false;

  const entries =
    presenceUsers[userId];

  return Array.isArray(entries) &&
    entries.length > 0;
}

function updateOnlineStatus() {
  if (!onlineStatus) return;

  const count =
    Object.keys(presenceUsers || {})
      .length;

  onlineStatus.textContent =
    `● ${count} ${
      count === 1
        ? "member"
        : "members"
    } online`;
}

/* =========================================================
   MEMBERS
   ========================================================= */

async function loadMembers() {
  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, username, bio, last_seen_at"
      )
      .order("username", {
        ascending: true
      });

  if (error) {
    console.error(
      "LOAD MEMBERS ERROR:",
      error
    );

    if (membersList) {
      membersList.innerHTML = "";

      const errorBox =
        document.createElement("div");

      errorBox.style.padding = "15px";
      errorBox.style.color = "#ff8a8a";
      errorBox.style.fontSize = "12px";

      errorBox.textContent =
        "Could not load members: " +
        error.message;

      membersList.appendChild(errorBox);
    }

    return;
  }

  window.neuralNinjasMembers =
    data || [];

  renderMembers();
}

function renderMembers() {
  if (!membersList) return;

  const members =
    window.neuralNinjasMembers || [];

  membersList.innerHTML = "";

  if (memberCount) {
    memberCount.textContent =
      `${members.length} ${
        members.length === 1
          ? "member"
          : "members"
      }`;
  }

  if (!members.length) {
    const empty =
      document.createElement("div");

    empty.style.padding = "15px";
    empty.style.opacity = "0.65";
    empty.style.fontSize = "12px";

    empty.textContent =
      "No members found.";

    membersList.appendChild(empty);

    return;
  }

  members.forEach(member => {
    const row =
      document.createElement("div");

    row.className = "member";

    const avatar =
      document.createElement("div");

    avatar.className =
      "member-avatar";

    avatar.textContent =
      (
        member.username ||
        "?"
      )
        .charAt(0)
        .toUpperCase();

    const info =
      document.createElement("div");

    info.className =
      "member-info";

    const name =
      document.createElement("div");

    name.className =
      "member-name";

    name.textContent =
      member.username ||
      "Unknown";

    const status =
      document.createElement("div");

    status.className =
      "member-status";

    const dot =
      document.createElement("span");

    dot.className = "status-dot";

    const online =
      isUserOnline(member.id);

    if (online) {
      dot.classList.add("online");
    }

    const statusText =
      document.createElement("span");

    statusText.textContent =
      online
        ? "Online"
        : formatLastSeen(
            member.last_seen_at
          );

    status.appendChild(dot);
    status.appendChild(statusText);

    info.appendChild(name);
    info.appendChild(status);

    row.appendChild(avatar);
    row.appendChild(info);

    membersList.appendChild(row);
  });
}

/* =========================================================
   LAST SEEN
   ========================================================= */

async function updateLastSeen() {
  if (!currentUser) return;

  const now =
    new Date().toISOString();

  const { error } =
    await supabaseClient
      .from("profiles")
      .update({
        last_seen_at: now
      })
      .eq("id", currentUser.id);

  if (error) {
    console.warn(
      "LAST SEEN ERROR:",
      error
    );
    return;
  }

  if (currentProfile) {
    currentProfile.last_seen_at =
      now;
  }

  const members =
    window.neuralNinjasMembers;

  if (Array.isArray(members)) {
    const me =
      members.find(
        member =>
          member.id === currentUser.id
      );

    if (me) {
      me.last_seen_at = now;
    }
  }

  renderMembers();
}

function startLastSeenTimer() {
  if (lastSeenInterval) {
    clearInterval(
      lastSeenInterval
    );
  }

  lastSeenInterval =
    setInterval(() => {
      if (!document.hidden) {
        updateLastSeen();
      }
    }, 30000);
}

function formatLastSeen(value) {
  if (!value) {
    return "Last seen unknown";
  }

  const time =
    new Date(value).getTime();

  if (Number.isNaN(time)) {
    return "Last seen unknown";
  }

  const diff =
    Date.now() - time;

  const seconds =
    Math.floor(diff / 1000);

  if (seconds < 30) {
    return "Just now";
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(hours / 24);

  return `${days}d ago`;
}

/* =========================================================
   SEARCH
   ========================================================= */

function filterMessages() {
  const query =
    (
      messageSearchInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  document
    .querySelectorAll(".message")
    .forEach(message => {
      const text =
        message.textContent
          .toLowerCase();

      message.style.display =
        !query ||
        text.includes(query)
          ? ""
          : "none";
    });
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {
  membersSidebar?.classList.add(
    "open"
  );

  sidebarOverlay?.classList.add(
    "show"
  );
}

function closeSidebar() {
  membersSidebar?.classList.remove(
    "open"
  );

  sidebarOverlay?.classList.remove(
    "show"
  );
}

/* =========================================================
   THEMES
   ========================================================= */

function applyTheme(theme) {
  const validThemes = [
    "default",
    "cyber",
    "space",
    "amber"
  ];

  if (!validThemes.includes(theme)) {
    theme = "default";
  }

  document.body.dataset.theme =
    theme;

  localStorage.setItem(
    "neural-ninjas-theme",
    theme
  );

  document
    .querySelectorAll(".theme-option")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.theme === theme
      );
    });
}

/* =========================================================
   ACCOUNT DELETE
   ========================================================= */

async function deleteAccount() {
  if (!currentUser) return;

  const first =
    confirm(
      "Delete your Neural Ninjas account permanently?"
    );

  if (!first) return;

  const second =
    confirm(
      "This cannot be undone. Continue?"
    );

  if (!second) return;

  if (deleteAccountBtn) {
    deleteAccountBtn.disabled = true;
    deleteAccountBtn.textContent =
      "Deleting...";
  }

  try {
    const {
      data: sessionData,
      error: sessionError
    } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const token =
      sessionData?.session?.access_token;

    if (!token) {
      throw new Error(
        "No active access token."
      );
    }

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/super-responder`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
            apikey:
              SUPABASE_PUBLISHABLE_KEY,
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            action: "delete_account"
          })
        }
      );

    const result =
      await response.json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result?.error ||
        result?.message ||
        `HTTP ${response.status}`
      );
    }

    await supabaseClient.auth.signOut();

    cleanupAfterLogout();

    alert(
      "Your account has been deleted."
    );

  } catch (error) {
    console.error(
      "DELETE ACCOUNT ERROR:",
      error
    );

    alert(
      "Account deletion failed:\n" +
      error.message
    );

  } finally {
    if (deleteAccountBtn) {
      deleteAccountBtn.disabled = false;
      deleteAccountBtn.textContent =
        "Delete Account";
    }
  }
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function exitChat() {
  if (!currentUser) return;

  if (!confirm("Logout from Neural Ninjas?")) {
    return;
  }

  try {
    await updateLastSeen();

    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

  } catch (error) {
    console.error(
      "LOGOUT ERROR:",
      error
    );

  } finally {
    cleanupAfterLogout();
  }
}

function cleanupAfterLogout() {
  cleanupRealtimeChannels();

  if (lastSeenInterval) {
    clearInterval(
      lastSeenInterval
    );

    lastSeenInterval = null;
  }

  stopVoiceRecording();

  currentUser = null;
  currentProfile = null;

  messageCache.clear();
  reactionCache.clear();

  presenceUsers = {};

  window.neuralNinjasMembers =
    [];

  if (messages) {
    messages.innerHTML = "";
  }

  if (messageInput) {
    messageInput.value = "";
  }

  if (pinInput) {
    pinInput.value = "";
  }

  cancelReply();

  closeSidebar();

  themePanel?.classList.add(
    "hidden"
  );

  chatScreen?.classList.add(
    "hidden"
  );

  loginScreen?.classList.remove(
    "hidden"
  );

  if (loginStatus) {
    loginStatus.textContent = "";
  }

  if (onlineStatus) {
    onlineStatus.textContent =
      "● Offline";
  }

  usernameInput?.focus();
}

/* =========================================================
   VOICE RECORDING
   ========================================================= */

async function startVoiceRecording() {
  if (
    isRecordingVoice ||
    !currentUser
  ) {
    return;
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    showChatError(
      "Microphone is not supported on this browser."
    );
    return;
  }

  try {
    recordingStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true
        });

    recordedChunks = [];

    let options = {};

    if (
      window.MediaRecorder &&
      MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
    ) {
      options.mimeType =
        "audio/webm;codecs=opus";
    }

    mediaRecorder =
      new MediaRecorder(
        recordingStream,
        options
      );

    mediaRecorder.ondataavailable =
      event => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          recordedChunks.push(
            event.data
          );
        }
      };

    mediaRecorder.onstop =
      async () => {
        const type =
          mediaRecorder.mimeType ||
          "audio/webm";

        const blob =
          new Blob(
            recordedChunks,
            { type }
          );

        await uploadVoiceBlob(blob);

        stopRecordingStream();
      };

    mediaRecorder.start();

    isRecordingVoice = true;

    showChatError(
      "🎙️ Recording voice..."
    );

  } catch (error) {
    console.error(
      "VOICE START ERROR:",
      error
    );

    stopRecordingStream();

    showChatError(
      "Microphone error: " +
      error.message
    );
  }
}

function stopVoiceRecording() {
  if (mediaRecorder) {
    try {
      if (
        mediaRecorder.state !==
        "inactive"
      ) {
        mediaRecorder.stop();
      }
    } catch (error) {
      console.error(
        "VOICE STOP ERROR:",
        error
      );
    }
  }

  isRecordingVoice = false;

  stopRecordingStream();
}

function stopRecordingStream() {
  if (recordingStream) {
    recordingStream
      .getTracks()
      .forEach(track => {
        try {
          track.stop();
        } catch {}
      });
  }

  recordingStream = null;
}

async function uploadVoiceBlob(blob) {
  if (!currentUser || !blob) return;

  try {
    const extension =
      blob.type.includes("mp4")
        ? ".mp4"
        : ".webm";

    const path =
      `${currentUser.id}/voice-${Date.now()}${extension}`;

    const { error: uploadError } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .upload(
          path,
          blob,
          {
            upsert: false,
            contentType:
              blob.type
          }
        );

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: signedData,
      error: signedError
    } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .createSignedUrl(
          path,
          60 * 60 * 24 * 30
        );

    if (signedError) {
      throw signedError;
    }

    const fileUrl =
      signedData?.signedUrl;

    if (!fileUrl) {
      throw new Error(
        "No voice URL returned."
      );
    }

    const { data, error } =
      await supabaseClient
        .from("messages")
        .insert({
          sender_id: currentUser.id,
          content: "Voice message",
          message_type: "voice",
          file_url: fileUrl,
          reply_to:
            replyingToMessage?.id ||
            null
        })
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    const message = {
      ...data,
      username:
        currentProfile?.username ||
        "You",
      profile: currentProfile
    };

    messageCache.set(
      message.id,
      message
    );

    renderMessage(
      message,
      true
    );

    cancelReply();

  } catch (error) {
    console.error(
      "VOICE UPLOAD ERROR:",
      error
    );

    showChatError(
      "Voice upload failed: " +
      error.message
    );
  }
}

/* =========================================================
   UTILITIES
   ========================================================= */

function formatMessageTime(value) {
  if (!value) return "";

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function getFileExtension(filename) {
  const index =
    String(filename)
      .lastIndexOf(".");

  if (index === -1) return "";

  return String(filename)
    .slice(index)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
}

function randomId() {
  return Math.random()
    .toString(36)
    .slice(2, 10);
}

function escapeSelector(value) {
  const string =
    String(value);

  if (
    window.CSS &&
    typeof window.CSS.escape ===
      "function"
  ) {
    return window.CSS.escape(
      string
    );
  }

  return string.replace(
    /([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
    "\\$1"
  );
}

function scrollMessagesToBottom() {
  if (!messages) return;

  requestAnimationFrame(() => {
    messages.scrollTop =
      messages.scrollHeight;
  });
}

function rerenderMessage(message) {
  if (!message) return;

  const old =
    document.querySelector(
      `.message[data-message-id="${escapeSelector(message.id)}"]`
    );

  if (!old) {
    renderMessage(
      message,
      false
    );
    return;
  }

  const wasMine =
    message.sender_id ===
    currentUser?.id;

  old.remove();

  renderMessage(
    message,
    false
  );

  if (wasMine) {
    scrollMessagesToBottom();
  }
}

function showChatError(message) {
  console.warn(
    "CHAT:",
    message
  );

  if (!chatScreen ||
      chatScreen.classList.contains("hidden")) {
    return;
  }

  if (!typingIndicator) return;

  typingIndicator.textContent =
    String(message);

  typingIndicator.classList.add(
    "show"
  );

  clearTimeout(
    typingIndicator._hideTimer
  );

  typingIndicator._hideTimer =
    setTimeout(() => {
      hideTypingIndicator();
    }, 3500);
}

/* =========================================================
   GLOBAL ERROR LOGGING
   ========================================================= */

window.addEventListener(
  "error",
  event => {
    console.error(
      "GLOBAL ERROR:",
      event.error ||
      event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  event => {
    console.error(
      "UNHANDLED PROMISE:",
      event.reason
    );
  }
);

/* =========================================================
   PUBLIC API
   ========================================================= */

window.NeuralNinjas = {
  get currentUser() {
    return currentUser;
  },

  get currentProfile() {
    return currentProfile;
  },

  startVoiceRecording,
  stopVoiceRecording,
  sendMessage,
  clearSearch: () => {
    if (messageSearchInput) {
      messageSearchInput.value = "";
    }

    filterMessages();
  },
  applyTheme,
  logout: exitChat
};

console.log(
  "⚡ Neural Ninjas ready."
);
