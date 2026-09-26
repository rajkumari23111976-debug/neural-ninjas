/* =========================================================
   NEURAL NINJAS - APP.JS
   Username + 6-Digit PIN Authentication
   Realtime Chat + Presence + Last Seen
   Reply + Reactions + Search + Themes
   Images + Videos + Audio + Voice Notes
   Code Detection + Highlight.js + Copy
   ========================================================= */


/* =========================================================
   SUPABASE CONFIG
   ========================================================= */

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================================
   GLOBAL STATE
   ========================================================= */

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

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let isRecordingVoice = false;


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const loginScreen =
  document.getElementById("loginScreen");

const chatScreen =
  document.getElementById("chatScreen");

const usernameInput =
  document.getElementById("usernameInput");

const pinInput =
  document.getElementById("pinInput");

const joinBtn =
  document.getElementById("joinBtn");

const loginStatus =
  document.getElementById("loginStatus");

const onlineStatus =
  document.getElementById("onlineStatus");

const menuBtn =
  document.getElementById("menuBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const membersSidebar =
  document.getElementById("membersSidebar");

const closeSidebarBtn =
  document.getElementById("closeSidebarBtn");

const sidebarOverlay =
  document.getElementById("sidebarOverlay");

const membersList =
  document.getElementById("membersList");

const memberCount =
  document.getElementById("memberCount");

const deleteAccountBtn =
  document.getElementById("deleteAccountBtn");

const themeBtn =
  document.getElementById("themeBtn");

const themePanel =
  document.getElementById("themePanel");

const closeThemeBtn =
  document.getElementById("closeThemeBtn");

const searchBar =
  document.getElementById("searchBar");

const messageSearchInput =
  document.getElementById("messageSearchInput");

const clearSearchBtn =
  document.getElementById("clearSearchBtn");

const messages =
  document.getElementById("messages");

const typingIndicator =
  document.getElementById("typingIndicator");

const replyBar =
  document.getElementById("replyBar");

const replySender =
  document.getElementById("replySender");

const replyPreview =
  document.getElementById("replyPreview");

const cancelReplyBtn =
  document.getElementById("cancelReplyBtn");

const mediaBtn =
  document.getElementById("mediaBtn");

const fileInput =
  document.getElementById("fileInput");

const messageInput =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {

  if (joinBtn) {
    joinBtn.addEventListener("click", handleLogin);
  }

  if (usernameInput) {
    usernameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        pinInput?.focus();
      }
    });
  }

  if (pinInput) {
    pinInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        handleLogin();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", exitChat);
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", openSidebar);
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
  }

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener(
      "click",
      deleteAccount
    );
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", openThemePanel);
  }

  if (closeThemeBtn) {
    closeThemeBtn.addEventListener(
      "click",
      closeThemePanel
    );
  }

  if (messageSearchInput) {
    messageSearchInput.addEventListener(
      "input",
      performMessageSearch
    );
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener(
      "click",
      clearMessageSearch
    );
  }

  if (sendBtn) {
    sendBtn.addEventListener(
      "click",
      sendMessage
    );
  }

  if (messageInput) {

    messageInput.addEventListener(
      "keydown",
      function (e) {

        if (
          e.key === "Enter" &&
          !e.shiftKey
        ) {
          e.preventDefault();
          sendMessage();
        }

      }
    );

    messageInput.addEventListener(
      "input",
      handleTyping
    );
  }

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener(
      "click",
      cancelReply
    );
  }

  if (mediaBtn) {
    mediaBtn.addEventListener(
      "click",
      function () {
        fileInput?.click();
      }
    );
  }

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      handleFileUpload
    );
  }

  restoreTheme();
  setupThemeButtons();

  document.addEventListener(
    "keydown",
    function (e) {

      if (e.key === "Escape") {
        closeSidebar();
        closeThemePanel();
        closeAllReactionPickers();
      }

    }
  );

  document.addEventListener(
    "visibilitychange",
    function () {

      if (
        document.visibilityState === "hidden"
      ) {
        updateLastSeen();
      }

    }
  );

  await restoreSession();
}


/* =========================================================
   AUTH HELPERS
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


/* =========================================================
   LOGIN
   ========================================================= */

async function handleLogin() {

  const username =
    usernameInput?.value.trim();

  const pin =
    pinInput?.value.trim();

  if (!username || username.length < 2) {
    showLoginStatus(
      "Username must contain at least 2 characters.",
      true
    );
    return;
  }

  if (!/^\d{6}$/.test(pin)) {
    showLoginStatus(
      "PIN must be exactly 6 digits.",
      true
    );
    return;
  }

  if (joinBtn) {
    joinBtn.disabled = true;
    joinBtn.textContent = "Joining...";
  }

  showLoginStatus(
    "Connecting..."
  );

  try {

    const email =
      makeAuthEmail(username);

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
            data: {
              username: username
            }
          }
        });

      if (signUpResult.error) {
        throw signUpResult.error;
      }

      if (!signUpResult.data.session) {

        throw new Error(
          "Account created, but Supabase email confirmation is enabled. Disable email confirmation in Supabase Authentication settings."
        );

      }

      authResult = signUpResult;
    }

    currentUser =
      authResult.data.user;

    if (!currentUser) {
      throw new Error(
        "User session was not created."
      );
    }

    await loadCurrentProfile(username);

    await startChat();

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    showLoginStatus(
      error.message ||
      "Login failed.",
      true
    );

  } finally {

    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = "Join";
    }

  }

}


/* =========================================================
   LOAD CURRENT PROFILE
   ========================================================= */

async function loadCurrentProfile(
  fallbackUsername = ""
) {

  if (!currentUser) {
    return null;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, username, created_at, last_seen_at"
      )
      .eq("id", currentUser.id)
      .maybeSingle();

  if (error) {
    console.error(
      "PROFILE LOAD ERROR:",
      error
    );
    throw error;
  }

  if (data) {

    currentProfile = data;

    return data;
  }

  const username =
    fallbackUsername ||
    currentUser.user_metadata?.username ||
    "Unknown user";

  const {
    data: insertedProfile,
    error: insertError
  } =
    await supabaseClient
      .from("profiles")
      .insert({
        id: currentUser.id,
        username: username,
        last_seen_at: new Date().toISOString()
      })
      .select()
      .single();

  if (insertError) {
    console.error(
      "PROFILE INSERT ERROR:",
      insertError
    );
    throw insertError;
  }

  currentProfile =
    insertedProfile;

  return insertedProfile;
}


/* =========================================================
   RESTORE SESSION
   ========================================================= */

async function restoreSession() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data.session) {
      return;
    }

    currentUser =
      data.session.user;

    await loadCurrentProfile();

    if (!currentProfile) {
      currentUser = null;
      return;
    }

    await startChat();

  } catch (error) {

    console.error(
      "RESTORE SESSION ERROR:",
      error
    );

  }

}


/* =========================================================
   START CHAT
   ========================================================= */

async function startChat() {

  if (!currentUser) {
    return;
  }

  clearOldState();

  loginScreen?.classList.add("hidden");
  chatScreen?.classList.remove("hidden");

  if (onlineStatus) {
    onlineStatus.textContent =
      "● Connecting...";
  }

  setupRealtime();
  setupTyping();
  setupPresence();

  await Promise.all([
    loadMessages(),
    loadReactions(),
    loadMembers()
  ]);

  await updateLastSeen();

  startLastSeenTimer();

  updateOnlineStatus();

  if (messageInput) {
    messageInput.focus();
  }

}


/* =========================================================
   CLEAR OLD STATE
   ========================================================= */

function clearOldState() {

  messageCache.clear();
  reactionCache.clear();

  presenceUsers = {};

  if (messages) {
    messages.innerHTML = "";
  }

}


/* =========================================================
   LOAD MESSAGES
   ========================================================= */

async function loadMessages() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("messages")
      .select("*")
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {

    console.error(
      "LOAD MESSAGES ERROR:",
      error
    );

    showChatError(
      "Failed to fetch messages."
    );

    return;
  }

  const messageRows =
    data || [];

  const senderIds =
    [
      ...new Set(
        messageRows
          .map(m => m.sender_id)
          .filter(Boolean)
      )
    ];

  let profiles = [];

  if (senderIds.length) {

    const {
      data: profileData,
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .select(
          "id, username, last_seen_at"
        )
        .in(
          "id",
          senderIds
        );

    if (profileError) {

      console.error(
        "MESSAGE PROFILE ERROR:",
        profileError
      );

    } else {

      profiles =
        profileData || [];
    }
  }

  const profileMap =
    new Map(
      profiles.map(profile => [
        profile.id,
        profile
      ])
    );

  if (messages) {
    messages.innerHTML = "";
  }

  messageCache.clear();

  messageRows.forEach(message => {

    const profile =
      profileMap.get(
        message.sender_id
      );

    const enrichedMessage = {
      ...message,

      username:
        profile?.username ||
        message.sender_name ||
        "Unknown user",

      profile
    };

    messageCache.set(
      String(message.id),
      enrichedMessage
    );

    renderMessage(
      enrichedMessage,
      false
    );

  });

  scrollMessagesToBottom();

}


/* =========================================================
   LOAD MEMBERS
   ========================================================= */

async function loadMembers() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, username, created_at, last_seen_at"
      )
      .order(
        "username",
        {
          ascending: true
        }
      );

  if (error) {

    console.error(
      "LOAD MEMBERS ERROR:",
      error
    );

    if (membersList) {
      membersList.innerHTML =
        `<div class="empty-members">
          Unable to load members.
        </div>`;
    }

    return;
  }

  const members =
    data || [];

  renderMembers(
    members
  );

}


/* =========================================================
   RENDER MEMBERS
   ========================================================= */

function renderMembers(
  members = []
) {

  if (!membersList) {
    return;
  }

  membersList.innerHTML = "";

  if (memberCount) {
    memberCount.textContent =
      members.length;
  }

  if (!members.length) {

    membersList.innerHTML =
      `<div class="empty-members">
        No members found.
      </div>`;

    return;
  }

  members.forEach(member => {

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "member";

    const avatar =
      document.createElement("div");

    avatar.className =
      "member-avatar";

    avatar.textContent =
      getInitials(
        member.username
      );

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
      "Unknown user";

    const status =
      document.createElement("div");

    status.className =
      "member-status";

    const dot =
      document.createElement("span");

    dot.className =
      "status-dot";

    const isOnline =
      isMemberOnline(
        member.id
      );

    if (isOnline) {
      dot.classList.add("online");
    }

    status.appendChild(dot);

    const statusText =
      document.createElement("span");

    statusText.textContent =
      isOnline
        ? "Online"
        : formatLastSeen(
            member.last_seen_at
          );

    status.appendChild(
      statusText
    );

    info.appendChild(name);
    info.appendChild(status);

    wrapper.appendChild(avatar);
    wrapper.appendChild(info);

    membersList.appendChild(
      wrapper
    );

  });

}


/* =========================================================
   RENDER MESSAGE
   ========================================================= */

function renderMessage(
  data,
  shouldScroll = true
) {

  if (!messages || !data) {
    return;
  }

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "message";

  wrapper.dataset.messageId =
    data.id;

  if (
    currentUser &&
    data.sender_id === currentUser.id
  ) {
    wrapper.classList.add("mine");
  }

  const bubble =
    document.createElement("div");

  bubble.className =
    "bubble";

  /* ---------- SENDER ---------- */

  const sender =
    document.createElement("div");

  sender.className =
    "sender sender-name";

  sender.textContent =
    data.username ||
    data.sender_name ||
    "Unknown user";

  bubble.appendChild(sender);


  /* ---------- REPLY ---------- */

  if (data.reply_to_id) {

    const replyMessage =
      messageCache.get(
        String(data.reply_to_id)
      );

    const replyBox =
      document.createElement("div");

    replyBox.className =
      "message-reply";

    if (replyMessage) {

      const replyUser =
        document.createElement("div");

      replyUser.className =
        "reply-user";

      replyUser.textContent =
        replyMessage.username ||
        replyMessage.sender_name ||
        "Unknown user";

      const replyText =
        document.createElement("div");

      replyText.className =
        "reply-text";

      replyText.textContent =
        replyMessage.message ||
        replyMessage.content ||
        "Media message";

      replyBox.appendChild(
        replyUser
      );

      replyBox.appendChild(
        replyText
      );

    } else {

      replyBox.textContent =
        "Reply to a previous message";
    }

    bubble.appendChild(
      replyBox
    );
  }


  /* ---------- CONTENT ---------- */

  const content =
    document.createElement("div");

  content.className =
    "text message-text";

  const messageText =
    data.message || "";

  const messageType =
    data.message_type ||
    "text";

  if (
    messageType === "image" &&
    data.file_url
  ) {

    content.appendChild(
      createImageContent(
        data.file_url,
        data.message
      )
    );

  } else if (
    messageType === "video" &&
    data.file_url
  ) {

    content.appendChild(
      createVideoContent(
        data.file_url
      )
    );

  } else if (
    messageType === "audio" ||
    messageType === "voice"
  ) {

    if (data.file_url) {

      content.appendChild(
        createAudioContent(
          data.file_url
        )
      );

    } else {

      appendSafeTextWithLinks(
        content,
        messageText
      );
    }

  } else if (
    messageType === "code" ||
    looksLikeCode(messageText)
  ) {

    content.appendChild(
      createCodeContent(
        messageText
      )
    );

  } else {

    appendSafeTextWithLinks(
      content,
      messageText
    );
  }

  bubble.appendChild(content);


  /* ---------- TIME ---------- */

  const footer =
    document.createElement("div");

  footer.className =
    "message-footer";

  const time =
    document.createElement("span");

  time.className =
    "time message-time";

  time.textContent =
    formatMessageTime(
      data.created_at
    );

  footer.appendChild(time);

  bubble.appendChild(
    footer
  );


  /* ---------- ACTIONS ---------- */

  const actions =
    document.createElement("div");

  actions.className =
    "message-actions";


  /* Reply button */

  const replyButton =
    document.createElement("button");

  replyButton.className =
    "message-action";

  replyButton.type =
    "button";

  replyButton.textContent =
    "↩";

  replyButton.title =
    "Reply";

  replyButton.addEventListener(
    "click",
    function () {
      startReply(data);
    }
  );

  actions.appendChild(
    replyButton
  );


  /* Reaction button */

  const reactionButton =
    document.createElement("button");

  reactionButton.className =
    "message-action";

  reactionButton.type =
    "button";

  reactionButton.textContent =
    "😊";

  reactionButton.title =
    "React";

  reactionButton.addEventListener(
    "click",
    function (event) {

      event.stopPropagation();

      toggleReactionPicker(
        wrapper,
        data.id
      );
    }
  );

  actions.appendChild(
    reactionButton
  );


  /* Delete own message */

  if (
    currentUser &&
    data.sender_id === currentUser.id
  ) {

    const deleteButton =
      document.createElement("button");

    deleteButton.className =
      "message-action delete-message";

    deleteButton.type =
      "button";

    deleteButton.textContent =
      "🗑 Delete";

    deleteButton.title =
      "Delete";

    deleteButton.addEventListener(
      "click",
      function () {
        deleteMessage(data);
      }
    );

    actions.appendChild(
      deleteButton
    );
  }

  bubble.appendChild(
    actions
  );

  wrapper.appendChild(
    bubble
  );

  messages.appendChild(
    wrapper
  );

  renderMessageReactions(
    wrapper,
    data.id
  );

  if (shouldScroll) {
    scrollMessagesToBottom();
  }

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

  if (!currentUser) {
    return;
  }

  const content =
    messageInput?.value.trim();

  if (!content) {
    return;
  }

  const replyTo =
    replyingToMessage
      ? Number(replyingToMessage.id)
      : null;

  if (sendBtn) {
    sendBtn.disabled = true;
  }

  try {

    /*
      IMPORTANT:
      Database column is `message`,
      NOT `content`.

      Database column is `reply_to_id`,
      NOT `reply_to`.
    */

    const payload = {
      sender_id:
        currentUser.id,

      sender_name:
        currentProfile?.username ||
        currentUser.user_metadata?.username ||
        usernameInput?.value.trim() ||
        "Unknown user",

      message:
        content,

      message_type:
        looksLikeCode(content)
          ? "code"
          : "text",

      reply_to_id:
        replyTo
    };

    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .insert(payload)
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    if (messageInput) {
      messageInput.value = "";
    }

    cancelReply();

    stopTyping();

    /*
      Realtime normally renders the message.
      If realtime is slow/not enabled, render it locally.
    */

    if (
      data &&
      !messageCache.has(
        String(data.id)
      )
    ) {

      const enriched = {
        ...data,
        username:
          currentProfile?.username ||
          data.sender_name ||
          "Unknown user"
      };

      messageCache.set(
        String(data.id),
        enriched
      );

      renderMessage(
        enriched
      );
    }

  } catch (error) {

    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    alert(
      "Message send failed: " +
      (
        error.message ||
        "Unknown error"
      )
    );

  } finally {

    if (sendBtn) {
      sendBtn.disabled = false;
    }

  }

}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

async function handleFileUpload(event) {

  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  if (!currentUser) {
    return;
  }

  const maxSize =
    50 * 1024 * 1024;

  if (file.size > maxSize) {

    alert(
      "File is too large. Maximum size is 50 MB."
    );

    fileInput.value = "";
    return;
  }

  let messageType = null;

  if (file.type.startsWith("image/")) {
    messageType = "image";
  } else if (
    file.type.startsWith("video/")
  ) {
    messageType = "video";
  } else if (
    file.type.startsWith("audio/")
  ) {
    messageType = "audio";
  } else {

    alert(
      "Only images, videos and audio files are supported."
    );

    fileInput.value = "";
    return;
  }

  try {

    if (mediaBtn) {
      mediaBtn.disabled = true;
    }

    const extension =
      getFileExtension(file.name);

    const randomPart =
      Math.random()
        .toString(36)
        .slice(2, 10);

    const filePath =
      `${currentUser.id}/${Date.now()}-${randomPart}${extension}`;

    const {
      error: uploadError
    } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false
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
          filePath,
          60 * 60 * 24 * 30
        );

    if (signedError) {
      throw signedError;
    }

    const fileUrl =
      signedData?.signedUrl;

    if (!fileUrl) {
      throw new Error(
        "Could not create file URL."
      );
    }

    const replyTo =
      replyingToMessage
        ? Number(replyingToMessage.id)
        : null;

    const payload = {
      sender_id:
        currentUser.id,

      sender_name:
        currentProfile?.username ||
        currentUser.user_metadata?.username ||
        "Unknown user",

      message:
        file.name,

      message_type:
        messageType,

      file_url:
        fileUrl,

      reply_to_id:
        replyTo
    };

    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .insert(payload)
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    cancelReply();

    if (
      data &&
      !messageCache.has(
        String(data.id)
      )
    ) {

      const enriched = {
        ...data,
        username:
          currentProfile?.username ||
          data.sender_name ||
          "Unknown user"
      };

      messageCache.set(
        String(data.id),
        enriched
      );

      renderMessage(
        enriched
      );
    }

  } catch (error) {

    console.error(
      "FILE UPLOAD ERROR:",
      error
    );

    alert(
      "File upload failed: " +
      (
        error.message ||
        "Unknown error"
      )
    );

  } finally {

    if (fileInput) {
      fileInput.value = "";
    }

    if (mediaBtn) {
      mediaBtn.disabled = false;
    }

  }

}


/* =========================================================
   VOICE RECORDING
   ========================================================= */

async function startVoiceRecording() {

  if (isRecordingVoice) {
    return;
  }

  try {

    recordingStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    recordedChunks = [];

    mediaRecorder =
      new MediaRecorder(
        recordingStream
      );

    mediaRecorder.ondataavailable =
      function (event) {

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
      async function () {

        const blob =
          new Blob(
            recordedChunks,
            {
              type:
                mediaRecorder.mimeType ||
                "audio/webm"
            }
          );

        await uploadVoiceBlob(
          blob
        );

        recordingStream
          ?.getTracks()
          .forEach(
            track => track.stop()
          );

        recordingStream = null;
        mediaRecorder = null;
      };

    mediaRecorder.start();

    isRecordingVoice = true;

    if (onlineStatus) {
      onlineStatus.textContent =
        "● Recording...";
    }

  } catch (error) {

    console.error(
      "VOICE RECORD ERROR:",
      error
    );

    alert(
      "Microphone permission is required."
    );

  }

}


function stopVoiceRecording() {

  if (
    !isRecordingVoice ||
    !mediaRecorder
  ) {
    return;
  }

  isRecordingVoice = false;

  mediaRecorder.stop();

}


/* =========================================================
   UPLOAD VOICE
   ========================================================= */

async function uploadVoiceBlob(blob) {

  if (!currentUser) {
    return;
  }

  try {

    const filePath =
      `${currentUser.id}/voice-${Date.now()}.webm`;

    const {
      error: uploadError
    } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .upload(
          filePath,
          blob,
          {
            contentType:
              "audio/webm",
            upsert: false
          }
        );

    if (uploadError) {
      throw uploadError;
    }

    const {
      data,
      error
    } =
      await supabaseClient.storage
        .from("neural-ninjas-media")
        .createSignedUrl(
          filePath,
          60 * 60 * 24 * 30
        );

    if (error) {
      throw error;
    }

    const fileUrl =
      data?.signedUrl;

    if (!fileUrl) {
      throw new Error(
        "Voice URL could not be created."
      );
    }

    const {
      data: messageData,
      error: messageError
    } =
      await supabaseClient
        .from("messages")
        .insert({
          sender_id:
            currentUser.id,

          sender_name:
            currentProfile?.username ||
            "Unknown user",

          message:
            "Voice message",

          message_type:
            "voice",

          file_url:
            fileUrl
        })
        .select("*")
        .single();

    if (messageError) {
      throw messageError;
    }

    if (
      messageData &&
      !messageCache.has(
        String(messageData.id)
      )
    ) {

      const enriched = {
        ...messageData,
        username:
          currentProfile?.username ||
          messageData.sender_name ||
          "Unknown user"
      };

      messageCache.set(
        String(messageData.id),
        enriched
      );

      renderMessage(
        enriched
      );
    }

  } catch (error) {

    console.error(
      "VOICE UPLOAD ERROR:",
      error
    );

    alert(
      "Voice upload failed: " +
      (
        error.message ||
        "Unknown error"
      )
    );

  } finally {

    updateOnlineStatus();

  }

}


/* =========================================================
   MEDIA ELEMENTS
   ========================================================= */

function createImageContent(
  url,
  filename
) {

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "media-wrapper";

  const img =
    document.createElement("img");

  img.className =
    "chat-image";

  img.src = url;
  img.alt =
    filename ||
    "Image";

  img.loading = "lazy";

  img.addEventListener(
    "click",
    function () {
      window.open(
        url,
        "_blank"
      );
    }
  );

  wrapper.appendChild(img);

  return wrapper;
}


function createVideoContent(
  url
) {

  const video =
    document.createElement("video");

  video.className =
    "chat-video";

  video.src = url;

  video.controls = true;

  video.preload = "metadata";

  return video;
}


function createAudioContent(
  url
) {

  const audio =
    document.createElement("audio");

  audio.className =
    "chat-audio";

  audio.src = url;

  audio.controls = true;

  preloadAudio(audio);

  return audio;
}


function preloadAudio(audio) {

  try {
    audio.preload = "metadata";
  } catch (_) {}

}


/* =========================================================
   CODE RENDERING
   ========================================================= */

function looksLikeCode(text) {

  if (!text) {
    return false;
  }

  return (
    text.includes("```") ||
    text.includes("<html") ||
    text.includes("</html>") ||
    text.includes("function ") ||
    text.includes("const ") ||
    text.includes("let ") ||
    text.includes("=>") ||
    text.includes("SELECT ") ||
    text.includes("console.log")
  );

}


function createCodeContent(
  text
) {

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "code-wrapper";

  let codeText =
    text || "";

  let language = "";

  const match =
    codeText.match(
      /^```(\w+)?\s*([\s\S]*?)```$/
    );

  if (match) {

    language =
      match[1] || "";

    codeText =
      match[2];

  }

  const pre =
    document.createElement("pre");

  const code =
    document.createElement("code");

  if (language) {
    code.className =
      `language-${language}`;
  }

  code.textContent =
    codeText;

  pre.appendChild(code);

  const copyButton =
    document.createElement("button");

  copyButton.type =
    "button";

  copyButton.className =
    "copy-code-btn";

  copyButton.textContent =
    "Copy";

  copyButton.addEventListener(
    "click",
    async function () {

      try {

        await navigator.clipboard.writeText(
          codeText
        );

        copyButton.textContent =
          "Copied!";

        setTimeout(
          function () {
            copyButton.textContent =
              "Copy";
          },
          1500
        );

      } catch (error) {

        console.error(
          "COPY ERROR:",
          error
        );

      }

    }
  );

  wrapper.appendChild(
    copyButton
  );

  wrapper.appendChild(
    pre
  );

  if (
    window.hljs &&
    typeof window.hljs.highlightElement ===
      "function"
  ) {

    try {
      window.hljs.highlightElement(
        code
      );
    } catch (error) {
      console.error(
        "HIGHLIGHT ERROR:",
        error
      );
    }

  }

  return wrapper;
}


/* =========================================================
   SAFE TEXT + LINKS
   ========================================================= */

function appendSafeTextWithLinks(
  element,
  text
) {

  if (!text) {
    return;
  }

  const parts =
    text.split(
      /(https?:\/\/[^\s]+)/g
    );

  parts.forEach(part => {

    if (
      /^https?:\/\//i.test(part)
    ) {

      const link =
        document.createElement("a");

      link.href = part;

      link.textContent =
        part;

      link.target =
        "_blank";

      link.rel =
        "noopener noreferrer";

      element.appendChild(
        link
      );

    } else {

      element.appendChild(
        document.createTextNode(
          part
        )
      );
    }

  });

}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(
  message
) {

  if (!currentUser) {
    return;
  }

  if (
    message.sender_id !==
    currentUser.id
  ) {
    return;
  }

  const confirmed =
    confirm(
      "Delete this message?"
    );

  if (!confirmed) {
    return;
  }

  try {

    const {
      error
    } =
      await supabaseClient
        .from("messages")
        .delete()
        .eq(
          "id",
          message.id
        )
        .eq(
          "sender_id",
          currentUser.id
        );

    if (error) {
      throw error;
    }

    const element =
      document.querySelector(
        `[data-message-id="${message.id}"]`
      );

    element?.remove();

    messageCache.delete(
      String(message.id)
    );

  } catch (error) {

    console.error(
      "DELETE MESSAGE ERROR:",
      error
    );

    alert(
      "Failed to delete message: " +
      error.message
    );

  }

}


/* =========================================================
   REPLY
   ========================================================= */

function startReply(
  message
) {

  replyingToMessage =
    message;

  if (replyBar) {
    replyBar.classList.remove(
      "hidden"
    );
  }

  if (replySender) {
    replySender.textContent =
      message.username ||
      message.sender_name ||
      "Unknown user";
  }

  if (replyPreview) {

    const preview =
      message.message ||
      "Media message";

    replyPreview.textContent =
      preview.length > 100
        ? preview.slice(0, 100) + "..."
        : preview;
  }

  messageInput?.focus();

}


function cancelReply() {

  replyingToMessage =
    null;

  replyBar?.classList.add(
    "hidden"
  );

  if (replySender) {
    replySender.textContent =
      "";
  }

  if (replyPreview) {
    replyPreview.textContent =
      "";
  }

}


/* =========================================================
   REACTIONS
   ========================================================= */

async function loadReactions() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("message_reactions")
      .select(
        "id, message_id, user_id, reaction, profiles(username)"
      );

  if (error) {

    console.error(
      "LOAD REACTIONS ERROR:",
      error
    );

    return;
  }

  reactionCache.clear();

  (data || []).forEach(
    reaction => {

      const key =
        String(
          reaction.message_id
        );

      if (
        !reactionCache.has(key)
      ) {
        reactionCache.set(
          key,
          []
        );
      }

      reactionCache
        .get(key)
        .push(reaction);

    }
  );

  document
    .querySelectorAll(
      ".message"
    )
    .forEach(
      element => {

        const id =
          element.dataset.messageId;

        renderMessageReactions(
          element,
          id
        );

      }
    );

}


function setupReactionPicker(
  wrapper,
  messageId
) {

  /*
    Kept as a separate function so
    existing CSS can style reaction UI.
  */

}


function toggleReactionPicker(
  wrapper,
  messageId
) {

  closeAllReactionPickers();

  const picker =
    document.createElement("div");

  picker.className =
    "reaction-picker";

  const reactions = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "🔥",
    "👏"
  ];

  reactions.forEach(
    emoji => {

      const button =
        document.createElement("button");

      button.type =
        "button";

      button.textContent =
        emoji;

      button.addEventListener(
        "click",
        async function () {

          await toggleReaction(
            messageId,
            emoji
          );

          picker.remove();

        }
      );

      picker.appendChild(
        button
      );

    }
  );

  wrapper.appendChild(
    picker
  );

}


function closeAllReactionPickers() {

  document
    .querySelectorAll(
      ".reaction-picker"
    )
    .forEach(
      picker => picker.remove()
    );

}


async function toggleReaction(
  messageId,
  reaction
) {

  if (!currentUser) {
    return;
  }

  try {

    const {
      data: existing,
      error: findError
    } =
      await supabaseClient
        .from("message_reactions")
        .select(
          "id"
        )
        .eq(
          "message_id",
          messageId
        )
        .eq(
          "user_id",
          currentUser.id
        )
        .eq(
          "reaction",
          reaction
        )
        .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existing) {

      const {
        error
      } =
        await supabaseClient
          .from("message_reactions")
          .delete()
          .eq(
            "id",
            existing.id
          );

      if (error) {
        throw error;
      }

    } else {

      const {
        error
      } =
        await supabaseClient
          .from("message_reactions")
          .insert({
            message_id:
              messageId,

            user_id:
              currentUser.id,

            reaction:
              reaction
          });

      if (error) {
        throw error;
      }
    }

    await loadReactions();

  } catch (error) {

    console.error(
      "REACTION ERROR:",
      error
    );

  }

}


function renderMessageReactions(
  wrapper,
  messageId
) {

  if (!wrapper) {
    return;
  }

  const old =
    wrapper.querySelector(
      ".reactions"
    );

  old?.remove();

  const list =
    reactionCache.get(
      String(messageId)
    ) || [];

  if (!list.length) {
    return;
  }

  const container =
    document.createElement("div");

  container.className =
    "reactions";

  const counts =
    {};

  list.forEach(
    item => {

      counts[item.reaction] =
        (counts[item.reaction] || 0) + 1;

    }
  );

  Object.entries(counts)
    .forEach(
      ([emoji, count]) => {

        const button =
          document.createElement("button");

        button.type =
          "button";

        button.className =
          "reaction";

        button.textContent =
          `${emoji} ${count}`;

        button.title =
          list
            .filter(
              r =>
                r.reaction === emoji
            )
            .map(
              r =>
                r.profiles?.username ||
                "Unknown user"
            )
            .join(", ");

        button.addEventListener(
          "click",
          function () {

            toggleReaction(
              messageId,
              emoji
            );

          }
        );

        container.appendChild(
          button
        );

      }
    );

  wrapper.appendChild(
    container
  );

}


/* =========================================================
   REALTIME
   ========================================================= */

function setupRealtime() {

  if (!currentUser) {
    return;
  }

  if (messageChannel) {
    supabaseClient
      .removeChannel(
        messageChannel
      );
  }

  if (reactionChannel) {
    supabaseClient
      .removeChannel(
        reactionChannel
      );
  }


  /* ---------- MESSAGES ---------- */

  messageChannel =
    supabaseClient
      .channel(
        "neural-ninjas-messages"
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        async payload => {

          await handleRealtimeMessage(
            payload.new
          );

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

          const id =
            String(
              payload.old?.id
            );

          messageCache.delete(id);

          const element =
            document.querySelector(
              `[data-message-id="${id}"]`
            );

          element?.remove();

        }
      )
      .subscribe(
        status => {

          if (
            status === "SUBSCRIBED"
          ) {

            if (onlineStatus) {
              onlineStatus.textContent =
                "● Online";
            }

          }

        }
      );


  /* ---------- REACTIONS ---------- */

  reactionChannel =
    supabaseClient
      .channel(
        "neural-ninjas-reactions"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions"
        },
        async () => {

          await loadReactions();

        }
      )
      .subscribe();

}


async function handleRealtimeMessage(
  row
) {

  if (!row) {
    return;
  }

  const id =
    String(row.id);

  if (
    messageCache.has(id)
  ) {
    return;
  }

  let username =
    row.sender_name ||
    "Unknown user";

  if (row.sender_id) {

    const {
      data
    } =
      await supabaseClient
        .from("profiles")
        .select(
          "id, username, last_seen_at"
        )
        .eq(
          "id",
          row.sender_id
        )
        .maybeSingle();

    if (data?.username) {
      username =
        data.username;
    }
  }

  const enriched = {
    ...row,
    username
  };

  messageCache.set(
    id,
    enriched
  );

  renderMessage(
    enriched
  );

}


/* =========================================================
   TYPING INDICATOR
   ========================================================= */

function setupTyping() {

  if (typingChannel) {

    supabaseClient
      .removeChannel(
        typingChannel
      );
  }

  typingChannel =
    supabaseClient
      .channel(
        "neural-ninjas-typing"
      )
      .on(
        "broadcast",
        {
          event: "typing"
        },
        payload => {

          if (
            payload.payload?.userId ===
            currentUser?.id
          ) {
            return;
          }

          showTypingUser(
            payload.payload?.username
          );

        }
      )
      .subscribe();

}


function handleTyping() {

  if (!typingChannel) {
    return;
  }

  if (!isCurrentlyTyping) {
    isCurrentlyTyping = true;
  }

  typingChannel.send({
    type: "broadcast",
    event: "typing",
    payload: {
      userId:
        currentUser?.id,

      username:
        currentProfile?.username ||
        "Someone"
    }
  });

  clearTimeout(
    typingTimeout
  );

  typingTimeout =
    setTimeout(
      stopTyping,
      1500
    );

}


function stopTyping() {

  isCurrentlyTyping =
    false;

  clearTimeout(
    typingTimeout
  );

  typingTimeout = null;

  if (typingIndicator) {
    typingIndicator.textContent =
      "";
    typingIndicator.classList.add(
      "hidden"
    );
  }

}


function showTypingUser(
  username
) {

  if (!typingIndicator) {
    return;
  }

  typingIndicator.textContent =
    `${username || "Someone"} is typing...`;

  typingIndicator.classList.remove(
    "hidden"
  );

  clearTimeout(
    typingIndicator._hideTimer
  );

  typingIndicator._hideTimer =
    setTimeout(
      function () {

        typingIndicator.classList.add(
          "hidden"
        );

      },
      1800
    );

}


/* =========================================================
   PRESENCE
   ========================================================= */

function setupPresence() {

  if (!currentUser) {
    return;
  }

  if (presenceChannel) {

    supabaseClient
      .removeChannel(
        presenceChannel
      );
  }

  presenceChannel =
    supabaseClient
      .channel(
        "neural-ninjas-presence",
        {
          config: {
            presence: {
              key:
                currentUser.id
            }
          }
        }
      )
      .on(
        "presence",
        {
          event: "sync"
        },
        () => {

          const state =
            presenceChannel.presenceState();

          presenceUsers = {};

          Object.keys(state)
            .forEach(
              key => {

                const entries =
                  state[key];

                if (
                  entries &&
                  entries.length
                ) {

                  presenceUsers[key] =
                    entries[0];
                }

              }
            );

          updateOnlineStatus();
          refreshMembersPresence();

        }
      )
      .on(
        "presence",
        {
          event: "join"
        },
        () => {

          updateOnlineStatus();
          refreshMembersPresence();

        }
      )
      .on(
        "presence",
        {
          event: "leave"
        },
        () => {

          updateOnlineStatus();
          refreshMembersPresence();

        }
      )
      .subscribe(
        async status => {

          if (
            status === "SUBSCRIBED"
          ) {

            await presenceChannel.track({
              userId:
                currentUser.id,

              username:
                currentProfile?.username ||
                "Unknown user",

              online:
                true,

              joinedAt:
                Date.now()
            });

            updateOnlineStatus();
          }

        }
      );

}


function isMemberOnline(
  userId
) {

  return Boolean(
    presenceUsers[userId]
  );

}


function refreshMembersPresence() {

  loadMembers();

}


function updateOnlineStatus() {

  if (!onlineStatus) {
    return;
  }

  const count =
    Object.keys(
      presenceUsers
    ).length;

  onlineStatus.textContent =
  `${count} Member${count === 1 ? "" : "s"} Online`;
}


/* =========================================================
   LAST SEEN
   ========================================================= */

async function updateLastSeen() {

  if (!currentUser) {
    return;
  }

  try {

    await supabaseClient
      .from("profiles")
      .update({
        last_seen_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        currentUser.id
      );

  } catch (error) {

    console.error(
      "LAST SEEN ERROR:",
      error
    );

  }

}


function startLastSeenTimer() {

  clearInterval(
    lastSeenInterval
  );

  lastSeenInterval =
    setInterval(
      updateLastSeen,
      30000
    );

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {

  membersSidebar?.classList.add(
    "open"
  );

  sidebarOverlay?.classList.add(
    "open"
  );

}


function closeSidebar() {

  membersSidebar?.classList.remove(
    "open"
  );

  sidebarOverlay?.classList.remove(
    "open"
  );

}


/* =========================================================
   THEMES
   ========================================================= */

function openThemePanel() {

  themePanel?.classList.remove(
    "hidden"
  );

}


function closeThemePanel() {

  themePanel?.classList.add(
    "hidden"
  );

}


function setupThemeButtons() {

  const buttons =
    document.querySelectorAll(
      "[data-theme]"
    );

  buttons.forEach(
    button => {

      button.addEventListener(
        "click",
        function () {

          const theme =
            button.dataset.theme;

          if (!theme) {
            return;
          }

          applyTheme(
            theme
          );

        }
      );

    }
  );

}


function applyTheme(
  theme
) {

  document.body.dataset.theme =
    theme;

  localStorage.setItem(
    "neural-ninjas-theme",
    theme
  );

}


function restoreTheme() {

  const theme =
    localStorage.getItem(
      "neural-ninjas-theme"
    );

  if (theme) {
    applyTheme(theme);
  }

}


/* =========================================================
   MESSAGE SEARCH
   ========================================================= */

function performMessageSearch() {

  const query =
    messageSearchInput?.value
      .trim()
      .toLowerCase();

  const messageElements =
    document.querySelectorAll(
      ".message"
    );

  messageElements.forEach(
    element => {

      if (!query) {

        element.style.display =
          "";

        return;
      }

      const id =
        element.dataset.messageId;

      const message =
        messageCache.get(
          String(id)
        );

      const text =
        [
          message?.message,
          message?.sender_name,
          message?.username
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      element.style.display =
        text.includes(query)
          ? ""
          : "none";

    }
  );

}


function clearMessageSearch() {

  if (messageSearchInput) {
    messageSearchInput.value =
      "";
  }

  performMessageSearch();

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function exitChat() {

  try {

    if (presenceChannel) {

      try {
        await presenceChannel.untrack();
      } catch (_) {}

    }

    if (messageChannel) {
      await supabaseClient
        .removeChannel(
          messageChannel
        );
    }

    if (reactionChannel) {
      await supabaseClient
        .removeChannel(
          reactionChannel
        );
    }

    if (typingChannel) {
      await supabaseClient
        .removeChannel(
          typingChannel
        );
    }

    if (presenceChannel) {
      await supabaseClient
        .removeChannel(
          presenceChannel
        );
    }

    await supabaseClient.auth.signOut();

  } catch (error) {

    console.error(
      "LOGOUT ERROR:",
      error
    );

  }

  clearInterval(
    lastSeenInterval
  );

  currentUser = null;
  currentProfile = null;

  messageCache.clear();
  reactionCache.clear();

  presenceUsers = {};

  chatScreen?.classList.add(
    "hidden"
  );

  loginScreen?.classList.remove(
    "hidden"
  );

  if (usernameInput) {
    usernameInput.value =
      "";
  }

  if (pinInput) {
    pinInput.value =
      "";
  }

  if (messages) {
    messages.innerHTML =
      "";
  }

  closeSidebar();
  closeThemePanel();

}


/* =========================================================
   DELETE ACCOUNT
   ========================================================= */

async function deleteAccount() {

  if (!currentUser) {
    return;
  }

  const confirmed =
    confirm(
      "Are you sure you want to permanently delete your account?"
    );

  if (!confirmed) {
    return;
  }

  const secondConfirm =
    confirm(
      "This action cannot be easily undone. Continue?"
    );

  if (!secondConfirm) {
    return;
  }

  try {

    const sessionResult =
      await supabaseClient.auth.getSession();

    const accessToken =
      sessionResult.data.session?.access_token;

    if (!accessToken) {
      throw new Error(
        "No active session."
      );
    }

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/super-responder`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${accessToken}`,

            "apikey":
              SUPABASE_PUBLISHABLE_KEY
          },

          body: JSON.stringify({
            action:
              "delete_account"
          })
        }
      );

    const result =
      await response.json()
        .catch(
          () => ({})
        );

    if (!response.ok) {

      throw new Error(
        result.error ||
        result.message ||
        "Account deletion failed."
      );

    }

    alert(
      "Account deleted successfully."
    );

    await exitChat();

  } catch (error) {

    console.error(
      "DELETE ACCOUNT ERROR:",
      error
    );

    alert(
      "Account deletion failed: " +
      error.message
    );

  }

}


/* =========================================================
   HELPERS
   ========================================================= */

function getInitials(
  username
) {

  if (!username) {
    return "?";
  }

  const words =
    username
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (words.length === 1) {

    return words[0]
      .slice(0, 2)
      .toUpperCase();

  }

  return (
    words[0][0] +
    words[1][0]
  ).toUpperCase();

}


function formatMessageTime(
  timestamp
) {

  if (!timestamp) {
    return "";
  }

  const date =
    new Date(timestamp);

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


function formatLastSeen(
  timestamp
) {

  if (!timestamp) {
    return "Offline";
  }

  const date =
    new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Offline";
  }

  const diff =
    Date.now() -
    date.getTime();

  const seconds =
    Math.floor(
      diff / 1000
    );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  return `${days}d ago`;

}


function getFileExtension(
  filename
) {

  const index =
    filename.lastIndexOf(".");

  if (index === -1) {
    return "";
  }

  return filename
    .slice(index)
    .toLowerCase();

}


function scrollMessagesToBottom() {

  if (!messages) {
    return;
  }

  requestAnimationFrame(
    function () {

      messages.scrollTop =
        messages.scrollHeight;

    }
  );

}


function showLoginStatus(
  text,
  isError = false
) {

  if (!loginStatus) {
    return;
  }

  loginStatus.textContent =
    text;

  loginStatus.classList.toggle(
    "error",
    isError
  );

}


function showChatError(
  text
) {

  if (!messages) {
    return;
  }

  const error =
    document.createElement("div");

  error.className =
    "chat-error";

  error.textContent =
    text;

  messages.appendChild(
    error
  );

}


/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  function (event) {

    console.error(
      "UNHANDLED PROMISE:",
      event.reason
    );

  }
);

window.addEventListener(
  "error",
  function (event) {

    console.error(
      "GLOBAL ERROR:",
      event.error ||
      event.message
    );

  }
);


/* =========================================================
   PHONE ERROR PANEL - TEMPORARY DEBUGGER
   ========================================================= */

(function () {

  const panel = document.createElement("div");

  panel.id = "phoneErrorPanel";

  panel.style.cssText = `
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: 10px;
    max-height: 45vh;
    overflow-y: auto;
    background: #111;
    color: #ff4444;
    border: 2px solid #ff3333;
    border-radius: 12px;
    padding: 12px;
    z-index: 999999;
    font-family: monospace;
    font-size: 12px;
    display: none;
    white-space: pre-wrap;
    word-break: break-word;
  `;

  panel.innerHTML =
    "<b>🔴 NEURAL NINJAS ERROR LOG</b><br><br>";

  document.body.appendChild(panel);


  function showError(title, error) {

    panel.style.display = "block";

    const box =
      document.createElement("div");

    box.style.cssText = `
      margin-top: 10px;
      padding: 8px;
      border-top: 1px solid #555;
    `;

    box.textContent =
      title +
      "\n" +
      (
        error?.message ||
        error?.details ||
        error?.hint ||
        String(error)
      );

    panel.appendChild(box);
  }


  window.addEventListener(
    "error",
    function (event) {

      showError(
        "JAVASCRIPT ERROR:",
        event.error ||
        event.message
      );

    }
  );


  window.addEventListener(
    "unhandledrejection",
    function (event) {

      showError(
        "PROMISE ERROR:",
        event.reason
      );

    }
  );


  const originalAlert =
    window.alert;

  window.alert =
    function (message) {

      showError(
        "APP ALERT:",
        message
      );

      originalAlert(message);
    };


  console.log =
    function (...args) {

      const text =
        args
          .map(
            item => {

              if (
                typeof item === "object"
              ) {

                try {
                  return JSON.stringify(
                    item,
                    null,
                    2
                  );
                } catch (_) {
                  return String(item);
                }

              }

              return String(item);

            }
          )
          .join(" ");

      showError(
        "LOG:",
        text
      );

    };


  console.error =
    function (...args) {

      const text =
        args
          .map(
            item => {

              if (
                typeof item === "object"
              ) {

                try {
                  return JSON.stringify(
                    item,
                    null,
                    2
                  );
                } catch (_) {
                  return String(item);
                }

              }

              return String(item);

            }
          )
          .join(" ");

      showError(
        "❌ CONSOLE ERROR:",
        text
      );

    };


})();

/* =========================================================
   END OF APP.JS
   ========================================================= */
