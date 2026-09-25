/* =========================================================
   NEURAL NINJAS - APP.JS
   =========================================================
   Features:
   • Username + 6-digit PIN authentication
   • Private team chat
   • Realtime messages
   • Image / Video / Audio upload
   • Voice-note recording support
   • Typing indicator
   • Online presence
   • Last seen
   • Reply to messages
   • Message reactions
   • Reaction users
   • Message search + safe highlighting
   • Code-message detection
   • Code copy button
   • Delete own messages
   • Chat themes
   • Account deletion
   • Realtime cleanup
   ========================================================= */


/* =========================================================
   SUPABASE CONFIG
   ========================================================= */

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl"; // <-- keep your existing publishable key here


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
   DOM REFERENCES
   ========================================================= */

let loginScreen;
let chatScreen;

let usernameInput;
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
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* -------------------------
     Get DOM elements
     ------------------------- */

  loginScreen =
    document.getElementById("loginScreen");

  chatScreen =
    document.getElementById("chatScreen");

  usernameInput =
    document.getElementById("usernameInput");

  joinBtn =
    document.getElementById("joinBtn");

  loginStatus =
    document.getElementById("loginStatus");

  onlineStatus =
    document.getElementById("onlineStatus");

  menuBtn =
    document.getElementById("menuBtn");

  logoutBtn =
    document.getElementById("logoutBtn");

  membersSidebar =
    document.getElementById("membersSidebar");

  closeSidebarBtn =
    document.getElementById("closeSidebarBtn");

  sidebarOverlay =
    document.getElementById("sidebarOverlay");

  membersList =
    document.getElementById("membersList");

  memberCount =
    document.getElementById("memberCount");

  deleteAccountBtn =
    document.getElementById("deleteAccountBtn");

  themeBtn =
    document.getElementById("themeBtn");

  themePanel =
    document.getElementById("themePanel");

  closeThemeBtn =
    document.getElementById("closeThemeBtn");

  searchBar =
    document.getElementById("searchBar");

  messageSearchInput =
    document.getElementById("messageSearchInput");

  clearSearchBtn =
    document.getElementById("clearSearchBtn");

  messages =
    document.getElementById("messages");

  typingIndicator =
    document.getElementById("typingIndicator");

  replyBar =
    document.getElementById("replyBar");

  replySender =
    document.getElementById("replySender");

  replyPreview =
    document.getElementById("replyPreview");

  cancelReplyBtn =
    document.getElementById("cancelReplyBtn");

  mediaBtn =
    document.getElementById("mediaBtn");

  fileInput =
    document.getElementById("fileInput");

  messageInput =
    document.getElementById("messageInput");

  sendBtn =
    document.getElementById("sendBtn");


  /* -------------------------
     Login
     ------------------------- */

  if (joinBtn) {
    joinBtn.addEventListener(
      "click",
      handleLogin
    );
  }

  if (usernameInput) {
    usernameInput.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {
          handleLogin();
        }

      }
    );
  }


  /* -------------------------
     Logout
     ------------------------- */

  if (logoutBtn) {
    logoutBtn.addEventListener(
      "click",
      exitChat
    );
  }


  /* -------------------------
     Members sidebar
     ------------------------- */

  if (menuBtn) {
    menuBtn.addEventListener(
      "click",
      openSidebar
    );
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener(
      "click",
      closeSidebar
    );
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener(
      "click",
      closeSidebar
    );
  }


  /* -------------------------
     Delete account
     ------------------------- */

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener(
      "click",
      deleteAccount
    );
  }


  /* -------------------------
     Themes
     ------------------------- */

  if (themeBtn) {
    themeBtn.addEventListener(
      "click",
      openThemePanel
    );
  }

  if (closeThemeBtn) {
    closeThemeBtn.addEventListener(
      "click",
      closeThemePanel
    );
  }

  document
    .querySelectorAll(".theme-option")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const theme =
            button.dataset.theme;

          applyTheme(theme);

        }
      );

    });


  /* -------------------------
     Search
     ------------------------- */

  if (messageSearchInput) {
    messageSearchInput.addEventListener(
      "input",
      searchMessages
    );
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener(
      "click",
      clearSearch
    );
  }


  /* -------------------------
     Composer
     ------------------------- */

  if (sendBtn) {
    sendBtn.addEventListener(
      "click",
      sendMessage
    );
  }

  if (messageInput) {

    messageInput.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {

          if (!event.shiftKey) {

            event.preventDefault();

            sendMessage();

          }

        }

      }
    );

    messageInput.addEventListener(
      "input",
      handleTyping
    );

  }


  /* -------------------------
     Reply
     ------------------------- */

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener(
      "click",
      cancelReply
    );
  }


  /* -------------------------
     MEDIA
     IMPORTANT:
     Only ONE change listener.
     ------------------------- */

  if (mediaBtn && fileInput) {

    mediaBtn.addEventListener(
      "click",
      () => {

        fileInput.value = "";

        fileInput.click();

      }
    );

    fileInput.addEventListener(
      "change",
      async event => {

        const file =
          event.target.files &&
          event.target.files[0];

        if (!file) return;

        await handleFileUpload(file);

      }
    );

  }


  /* -------------------------
     Theme from localStorage
     ------------------------- */

  const savedTheme =
    localStorage.getItem(
      "neuralNinjasTheme"
    );

  if (savedTheme) {
    applyTheme(savedTheme);
  }


  /* -------------------------
     Auth session
     ------------------------- */

  restoreSession();


  /* -------------------------
     Global keyboard shortcuts
     ------------------------- */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeSidebar();
        closeThemePanel();

      }

    }
  );


  /* -------------------------
     Visibility / last seen
     ------------------------- */

  document.addEventListener(
    "visibilitychange",
    async () => {

      if (
        document.visibilityState ===
        "hidden"
      ) {

        await updateLastSeen();

      }

    }
  );

});


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
    usernameInput?.value
      ?.trim();

  if (!username) {

    setLoginStatus(
      "Enter your username."
    );

    return;

  }


  if (username.length < 2) {

    setLoginStatus(
      "Username must be at least 2 characters."
    );

    return;

  }


  /*
     The original interface only has
     username input. PIN is requested
     using a prompt so HTML structure
     remains unchanged.
  */

  const pin =
    window.prompt(
      "Enter your 6-digit PIN:"
    );


  if (pin === null) return;


  if (!/^\d{6}$/.test(pin)) {

    setLoginStatus(
      "PIN must be exactly 6 digits."
    );

    return;

  }


  setLoginStatus(
    "Connecting..."
  );

  joinBtn.disabled = true;


  try {

    const email =
      makeAuthEmail(username);


    /* -------------------------
       Try login first
       ------------------------- */

    let { data, error } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password: pin
        });


    /* -------------------------
       If login fails,
       try creating account
       ------------------------- */

    if (error) {

      const signUpResult =
        await supabaseClient.auth
          .signUp({
            email,
            password: pin,
            options: {
              data: {
                username
              }
            }
          });


      if (
        signUpResult.error
      ) {

        throw new Error(
          "Username or PIN is incorrect, or account already exists."
        );

      }


      data =
        signUpResult.data;


      /*
         If email confirmation is enabled,
         Supabase may not return a session.
      */

      if (!data.session) {

        throw new Error(
          "Account created, but email confirmation is enabled in Supabase. Disable email confirmation for this username/PIN login system."
        );

      }

    }


    currentUser =
      data.user;


    if (!currentUser) {

      throw new Error(
        "Login succeeded but user session was not returned."
      );

    }


    await loadCurrentProfile(
      username
    );


    await startChat();


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    setLoginStatus(
      error.message ||
      "Login failed."
    );

  } finally {

    joinBtn.disabled = false;

  }

}


/* =========================================================
   LOAD CURRENT PROFILE
   ========================================================= */

async function loadCurrentProfile(
  fallbackUsername = ""
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq(
        "id",
        currentUser.id
      )
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

  } else {

    /*
       Creates profile if auth user
       exists but profile doesn't.
    */

    const username =
      fallbackUsername
        .trim()
        .toLowerCase();


    const {
      data: newProfile,
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .insert({
          id: currentUser.id,
          username,
          last_seen_at:
            new Date().toISOString()
        })
        .select()
        .single();


    if (profileError) {

      throw profileError;

    }


    currentProfile =
      newProfile;

  }

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
      await supabaseClient.auth
        .getSession();


    if (error) {

      console.error(
        error
      );

      return;

    }


    if (data.session?.user) {

      currentUser =
        data.session.user;


      const {
        data: profile
      } =
        await supabaseClient
          .from("profiles")
          .select("*")
          .eq(
            "id",
            currentUser.id
          )
          .maybeSingle();


      currentProfile =
        profile;


      if (
        currentProfile
      ) {

        await startChat();

      }

    }

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

  if (!currentUser) return;


  clearOldState();


  loginScreen?.classList.add(
    "hidden"
  );

  chatScreen?.classList.remove(
    "hidden"
  );


  if (onlineStatus) {

    onlineStatus.textContent =
      "● Connecting...";

  }


  /*
     Subscribe BEFORE loading messages
     to reduce chance of missing a
     realtime message during startup.
  */

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


  if (onlineStatus) {

    onlineStatus.textContent =
      "● Online";

  }


  messageInput?.focus();

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

  cancelReply();

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


  /*
     Cache everything FIRST.
     This makes reply rendering
     more reliable.
  */

  data.forEach(
    message => {

      messageCache.set(
        String(message.id),
        message
      );

    }
  );


  messages.innerHTML = "";


  data.forEach(
    message => {

      renderMessage(
        message,
        false
      );

    }
  );


  scrollToBottom();

}


/* =========================================================
   REALTIME
   ========================================================= */

function setupRealtime() {

  /*
     Clean previous channels first.
  */

  cleanupRealtimeChannels();


  /* -------------------------
     Messages
     ------------------------- */

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
        payload => {

          const message =
            payload.new;

          messageCache.set(
            String(message.id),
            message
          );


          if (
            String(
              message.sender_id
            ) !==
            String(
              currentUser?.id
            )
          ) {

            renderMessage(
              message,
              true
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

          const id =
            String(
              payload.old.id
            );

          messageCache.delete(id);

          removeMessageFromDOM(id);

        }
      )
      .subscribe(
        status => {

          console.log(
            "MESSAGE CHANNEL:",
            status
          );

        }
      );


  /* -------------------------
     Reactions
     ------------------------- */

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
        async payload => {

          const messageId =
            String(
              payload.new?.message_id ??
              payload.old?.message_id ??
              ""
            );


          if (!messageId) return;


          await loadReactionsForMessage(
            messageId
          );


          rerenderReactions(
            messageId
          );

        }
      )
      .subscribe(
        status => {

          console.log(
            "REACTION CHANNEL:",
            status
          );

        }
      );

}


/* =========================================================
   REALTIME CLEANUP
   ========================================================= */

function cleanupRealtimeChannels() {

  if (messageChannel) {

    supabaseClient
      .removeChannel(
        messageChannel
      );

    messageChannel = null;

  }


  if (reactionChannel) {

    supabaseClient
      .removeChannel(
        reactionChannel
      );

    reactionChannel = null;

  }


  if (typingChannel) {

    supabaseClient
      .removeChannel(
        typingChannel
      );

    typingChannel = null;

  }


  if (presenceChannel) {

    supabaseClient
      .removeChannel(
        presenceChannel
      );

    presenceChannel = null;

  }


  if (typingTimeout) {

    clearTimeout(
      typingTimeout
    );

    typingTimeout = null;

  }


  isCurrentlyTyping = false;

}


/* =========================================================
   RENDER MESSAGE
   ========================================================= */

function renderMessage(
  data,
  shouldScroll = true
) {

  if (!data || !messages) {
    return;
  }


  const messageId =
    String(data.id);


  /*
     Prevent duplicate DOM messages.
  */

  const existing =
    Array.from(
      messages.querySelectorAll(
        ".message"
      )
    ).find(
      el =>
        String(
          el.dataset.messageId
        ) === messageId
    );


  if (existing) {

    return;

  }


  const isMine =
    String(
      data.sender_id
    ) ===
    String(
      currentUser?.id
    );


  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    `message ${
      isMine
        ? "mine"
        : "other"
    }`;


  wrapper.dataset.messageId =
    messageId;


  /* -------------------------
     Sender
     ------------------------- */

  const sender =
    document.createElement(
      "div"
    );


  sender.className =
    "message-sender";


  sender.textContent =
    isMine
      ? "You"
      : (
          data.username ||
          data.profiles?.username ||
          "User"
        );


  /* -------------------------
     Bubble
     ------------------------- */

  const bubble =
    document.createElement(
      "div"
    );


  bubble.className =
    "message-bubble";


  /* -------------------------
     Reply preview
     ------------------------- */

  if (data.reply_to) {

    const reply =
      createReplyPreview(
        data.reply_to
      );

    bubble.appendChild(
      reply
    );

  }


  /* -------------------------
     Message content
     ------------------------- */

  const content =
    document.createElement(
      "div"
    );


  content.className =
    "message-content";


  const messageType =
    data.message_type ||
    "text";


  if (
    messageType ===
    "image"
  ) {

    createImageContent(
      content,
      data
    );

  } else if (
    messageType ===
    "video"
  ) {

    createVideoContent(
      content,
      data
    );

  } else if (
    messageType ===
    "audio" ||
    messageType ===
    "voice"
  ) {

    createAudioContent(
      content,
      data
    );

  } else if (
    messageType ===
    "code" ||
    looksLikeCode(
      data.content
    )
  ) {

    createCodeContent(
      content,
      data.content || ""
    );

  } else {

    content.textContent =
      data.content || "";

  }


  bubble.appendChild(
    content
  );


  /* -------------------------
     Message time
     ------------------------- */

  const meta =
    document.createElement(
      "div"
    );


  meta.className =
    "message-meta";


  const time =
    document.createElement(
      "span"
    );


  time.textContent =
    formatMessageTime(
      data.created_at
    );


  meta.appendChild(
    time
  );


  /* -------------------------
     Actions
     ------------------------- */

  const actions =
    document.createElement(
      "div"
    );


  actions.className =
    "message-actions";


  const replyButton =
    document.createElement(
      "button"
    );


  replyButton.type =
    "button";

  replyButton.className =
    "message-action-btn";

  replyButton.textContent =
    "↩";

  replyButton.title =
    "Reply";


  replyButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      startReply(data);

    }
  );


  actions.appendChild(
    replyButton
  );


  if (isMine) {

    const deleteButton =
      document.createElement(
        "button"
      );


    deleteButton.type =
      "button";

    deleteButton.className =
      "message-action-btn delete";

    deleteButton.textContent =
      "🗑";

    deleteButton.title =
      "Delete message";


    deleteButton.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        deleteMessage(
          data.id
        );

      }
    );


    actions.appendChild(
      deleteButton
    );

  }


  meta.appendChild(
    actions
  );


  bubble.appendChild(
    meta
  );


  /* -------------------------
     Reactions
     ------------------------- */

  const reactionContainer =
    document.createElement(
      "div"
    );


  reactionContainer.className =
    "reaction-area";


  reactionContainer.dataset.reactionMessageId =
    messageId;


  renderReactionArea(
    reactionContainer,
    messageId
  );


  wrapper.appendChild(
    sender
  );

  wrapper.appendChild(
    bubble
  );

  wrapper.appendChild(
    reactionContainer
  );


  /*
     Long press / right click
     reaction picker.
  */

  setupReactionPicker(
    wrapper,
    messageId
  );


  messages.appendChild(
    wrapper
  );


  if (shouldScroll) {

    scrollToBottom();

  }

}


/* =========================================================
   REPLY PREVIEW INSIDE MESSAGE
   ========================================================= */

function createReplyPreview(
  replyTo
) {

  const box =
    document.createElement(
      "div"
    );


  box.className =
    "message-reply-preview";


  const original =
    messageCache.get(
      String(replyTo)
    );


  if (original) {

    const name =
      original.sender_id ===
      currentUser?.id
        ? "You"
        : (
            original.username ||
            original.profiles?.username ||
            "User"
          );


    box.textContent =
      `${name}: ${
        getPreviewText(original)
      }`;

  } else {

    box.textContent =
      "Original message unavailable.";

  }


  return box;

}


/* =========================================================
   MEDIA RENDERERS
   ========================================================= */

function createImageContent(
  container,
  data
) {

  if (!data.file_url) {

    container.textContent =
      data.content ||
      "Image unavailable.";

    return;

  }


  const img =
    document.createElement(
      "img"
    );


  img.src =
    data.file_url;

  img.alt =
    data.content ||
    "Image";

  img.loading =
    "lazy";


  img.className =
    "chat-image";


  img.addEventListener(
    "click",
    () => {

      window.open(
        data.file_url,
        "_blank",
        "noopener,noreferrer"
      );

    }
  );


  container.appendChild(
    img
  );

}


function createVideoContent(
  container,
  data
) {

  if (!data.file_url) {

    container.textContent =
      "Video unavailable.";

    return;

  }


  const video =
    document.createElement(
      "video"
    );


  video.src =
    data.file_url;

  video.controls =
    true;

  video.playsInline =
    true;

  video.className =
    "chat-video";


  container.appendChild(
    video
  );

}


function createAudioContent(
  container,
  data
) {

  if (!data.file_url) {

    container.textContent =
      "Audio unavailable.";

    return;

  }


  const audio =
    document.createElement(
      "audio"
    );


  audio.src =
    data.file_url;

  audio.controls =
    true;


  audio.className =
    "chat-audio";


  container.appendChild(
    audio
  );

}


/* =========================================================
   CODE MESSAGE
   ========================================================= */

function looksLikeCode(
  text
) {

  if (!text) return false;


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


function cleanCode(
  text
) {

  return text
    .replace(/^```[\w-]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

}


function createCodeContent(
  container,
  text
) {

  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "code-message";


  const pre =
    document.createElement(
      "pre"
    );


  const code =
    document.createElement(
      "code"
    );


  const cleaned =
    cleanCode(text);


  code.textContent =
    cleaned;


  pre.appendChild(
    code
  );


  const copyButton =
    document.createElement(
      "button"
    );


  copyButton.type =
    "button";

  copyButton.className =
    "copy-code-btn";

  copyButton.textContent =
    "Copy";


  copyButton.addEventListener(
    "click",
    async event => {

      event.stopPropagation();

      try {

        await navigator.clipboard.writeText(
          cleaned
        );

        copyButton.textContent =
          "Copied!";


        setTimeout(
          () => {

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


  container.appendChild(
    wrapper
  );


  /*
     Highlight.js if available.
  */

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

      console.warn(
        "Highlight error:",
        error
      );

    }

  }

}


/* =========================================================
   SEND TEXT MESSAGE
   ========================================================= */

async function sendMessage() {

  if (!currentUser) return;


  const content =
    messageInput?.value
      ?.trim();


  if (!content) return;


  sendBtn.disabled = true;


  try {

    const replyTo =
      replyingToMessage
        ? replyingToMessage.id
        : null;


    const payload = {

      sender_id:
        currentUser.id,

      content,

      message_type:
        looksLikeCode(content)
          ? "code"
          : "text",

      reply_to:
        replyTo

    };


    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .insert(payload)
        .select()
        .single();


    /*
       CHECK ERROR BEFORE
       touching UI state.
    */

    if (error) {

      throw error;

    }


    if (data) {

      messageCache.set(
        String(data.id),
        data
      );


      renderMessage(
        data,
        true
      );

    }


    messageInput.value = "";

    cancelReply();


    stopTypingBroadcast();


  } catch (error) {

    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    showChatError(
      "Failed to send message."
    );

  } finally {

    sendBtn.disabled = false;

    messageInput?.focus();

  }

}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

async function handleFileUpload(
  file
) {

  if (!currentUser) return;


  if (!file) return;


  /*
     50 MB maximum.
  */

  const MAX_SIZE =
    50 * 1024 * 1024;


  if (file.size > MAX_SIZE) {

    showChatError(
      "File is too large. Maximum size is 50 MB."
    );

    return;

  }


  const type =
    file.type || "";


  let messageType =
    null;


  if (
    type.startsWith(
      "image/"
    )
  ) {

    messageType =
      "image";

  } else if (
    type.startsWith(
      "video/"
    )
  ) {

    messageType =
      "video";

  } else if (
    type.startsWith(
      "audio/"
    )
  ) {

    messageType =
      "audio";

  }


  if (!messageType) {

    showChatError(
      "Only image, video and audio files are supported."
    );

    return;

  }


  mediaBtn.disabled = true;


  const originalText =
    mediaBtn.textContent;


  mediaBtn.textContent =
    "…";


  try {

    const extension =
      getFileExtension(
        file.name
      );


    const randomPart =
      Math.random()
        .toString(36)
        .slice(2, 10);


    const filePath =
      `${currentUser.id}/${Date.now()}-${randomPart}${extension}`;


    /*
       IMPORTANT:
       Bucket name from your existing app.
    */

    const {
      error:
        uploadError
    } =
      await supabaseClient
        .storage
        .from(
          "neural-ninjas-media"
        )
        .upload(
          filePath,
          file,
          {
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              file.type || undefined

          }
        );


    if (uploadError) {

      throw uploadError;

    }


    /*
       Current system uses signed URLs.
       30 days.
    */

    const {
      data: signedData,
      error:
        signedError
    } =
      await supabaseClient
        .storage
        .from(
          "neural-ninjas-media"
        )
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
        ? replyingToMessage.id
        : null;


    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .insert({
          sender_id:
            currentUser.id,

          content:
            file.name,

          message_type:
            messageType,

          file_url:
            fileUrl,

          reply_to:
            replyTo
        })
        .select()
        .single();


    if (error) {

      throw error;

    }


    if (data) {

      messageCache.set(
        String(data.id),
        data
      );


      renderMessage(
        data,
        true
      );

    }


    cancelReply();


  } catch (error) {

    console.error(
      "FILE UPLOAD ERROR:",
      error
    );

    showChatError(
      "File upload failed."
    );

  } finally {

    mediaBtn.disabled =
      false;

    mediaBtn.textContent =
      originalText || "＋";

    fileInput.value = "";

  }

}


/* =========================================================
   VOICE NOTE SUPPORT
   =========================================================
   Existing HTML has no dedicated microphone button,
   so this is kept as a reusable function.
   It can be connected to a button later without
   changing the database/message architecture.
   ========================================================= */

async function startVoiceRecording() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    showChatError(
      "Voice recording is not supported on this device/browser."
    );

    return;

  }


  if (isRecordingVoice) return;


  try {

    recordingStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true
        });


    recordedChunks = [];


    let mimeType =
      "audio/webm";


    if (
      MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
    ) {

      mimeType =
        "audio/webm;codecs=opus";

    } else if (
      MediaRecorder.isTypeSupported(
        "audio/mp4"
      )
    ) {

      mimeType =
        "audio/mp4";

    }


    mediaRecorder =
      new MediaRecorder(
        recordingStream,
        {
          mimeType
        }
      );


    mediaRecorder.addEventListener(
      "dataavailable",
      event => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          recordedChunks.push(
            event.data
          );

        }

      }
    );


    mediaRecorder.addEventListener(
      "stop",
      async () => {

        const blob =
          new Blob(
            recordedChunks,
            {
              type:
                mimeType
            }
          );


        cleanupRecordingStream();


        if (
          blob.size > 0
        ) {

          await uploadVoiceBlob(
            blob
          );

        }

      }
    );


    mediaRecorder.start();

    isRecordingVoice = true;


  } catch (error) {

    console.error(
      "VOICE RECORDING ERROR:",
      error
    );

    cleanupRecordingStream();

    showChatError(
      "Microphone permission or recording failed."
    );

  }

}


function stopVoiceRecording() {

  if (
    mediaRecorder &&
    isRecordingVoice
  ) {

    mediaRecorder.stop();

    isRecordingVoice = false;

  }

}


function cleanupRecordingStream() {

  if (recordingStream) {

    recordingStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    recordingStream = null;

  }

  mediaRecorder = null;

}


async function uploadVoiceBlob(
  blob
) {

  if (!currentUser) return;


  try {

    const path =
      `${currentUser.id}/voice-${Date.now()}.webm`;


    const {
      error:
        uploadError
    } =
      await supabaseClient
        .storage
        .from(
          "neural-ninjas-media"
        )
        .upload(
          path,
          blob,
          {
            contentType:
              "audio/webm",

            cacheControl:
              "3600",

            upsert:
              false

          }
        );


    if (uploadError) {

      throw uploadError;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from(
          "neural-ninjas-media"
        )
        .createSignedUrl(
          path,
          60 * 60 * 24 * 30
        );


    if (error) {

      throw error;

    }


    const {
      data: message,
      error:
        messageError
    } =
      await supabaseClient
        .from("messages")
        .insert({
          sender_id:
            currentUser.id,

          content:
            "Voice note",

          message_type:
            "voice",

          file_url:
            data.signedUrl,

          reply_to:
            replyingToMessage
              ? replyingToMessage.id
              : null

        })
        .select()
        .single();


    if (messageError) {

      throw messageError;

    }


    if (message) {

      messageCache.set(
        String(message.id),
        message
      );

      renderMessage(
        message,
        true
      );

    }


    cancelReply();


  } catch (error) {

    console.error(
      "VOICE UPLOAD ERROR:",
      error
    );

    showChatError(
      "Voice note upload failed."
    );

  }

}


/* =========================================================
   REPLY SYSTEM
   ========================================================= */

function startReply(
  message
) {

  if (!message) return;


  replyingToMessage =
    message;


  const sender =
    String(
      message.sender_id
    ) ===
    String(
      currentUser?.id
    )
      ? "You"
      : (
          message.username ||
          message.profiles?.username ||
          "User"
        );


  if (replySender) {

    replySender.textContent =
      sender;

  }


  if (replyPreview) {

    replyPreview.textContent =
      getPreviewText(
        message
      );

  }


  replyBar?.classList.remove(
    "hidden"
  );


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
      "User";

  }


  if (replyPreview) {

    replyPreview.textContent =
      "";

  }

}


function getPreviewText(
  message
) {

  if (!message) {
    return "";
  }


  if (
    message.message_type ===
    "image"
  ) {

    return "📷 Image";

  }


  if (
    message.message_type ===
    "video"
  ) {

    return "🎥 Video";

  }


  if (
    message.message_type ===
    "audio" ||
    message.message_type ===
    "voice"
  ) {

    return "🎵 Audio";

  }


  return (
    message.content ||
    "Message"
  )
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      100
    );

}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(
  messageId
) {

  if (!currentUser) return;


  const message =
    messageCache.get(
      String(messageId)
    );


  if (!message) {

    showChatError(
      "Message not found."
    );

    return;

  }


  if (
    String(
      message.sender_id
    ) !==
    String(
      currentUser.id
    )
  ) {

    showChatError(
      "You can only delete your own messages."
    );

    return;

  }


  const confirmed =
    window.confirm(
      "Delete this message?"
    );


  if (!confirmed) return;


  try {

    const {
      error
    } =
      await supabaseClient
        .from("messages")
        .delete()
        .eq(
          "id",
          messageId
        )
        .eq(
          "sender_id",
          currentUser.id
        );


    if (error) {

      throw error;

    }


    messageCache.delete(
      String(messageId)
    );


    removeMessageFromDOM(
      String(messageId)
    );


  } catch (error) {

    console.error(
      "DELETE MESSAGE ERROR:",
      error
    );

    showChatError(
      "Failed to delete message."
    );

  }

}


function removeMessageFromDOM(
  messageId
) {

  const all =
    messages?.querySelectorAll(
      ".message"
    ) || [];


  all.forEach(
    element => {

      if (
        String(
          element.dataset.messageId
        ) ===
        String(messageId)
      ) {

        element.remove();

      }

    }
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

  const {
    data,
    error
  } =
    await supabaseClient
      .from("message_reactions")
      .select(
        "user_id, message_id, reaction, profiles(username)"
      );


  if (error) {

    console.warn(
      "REACTIONS LOAD ERROR:",
      error
    );

    return;

  }


  reactionCache.clear();


  data.forEach(
    row => {

      const key =
        String(
          row.message_id
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
        .push(row);

    }
  );


  rerenderAllReactions();

}


async function loadReactionsForMessage(
  messageId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("message_reactions")
      .select(
        "user_id, message_id, reaction, profiles(username)"
      )
      .eq(
        "message_id",
        messageId
      );


  if (error) {

    console.warn(
      "REACTION LOAD ERROR:",
      error
    );

    return;

  }


  reactionCache.set(
    String(messageId),
    data || []
  );

}


function renderReactionArea(
  container,
  messageId
) {

  container.innerHTML = "";


  const rows =
    reactionCache.get(
      String(messageId)
    ) || [];


  const grouped =
    new Map();


  rows.forEach(
    row => {

      const reaction =
        row.reaction;


      if (
        !grouped.has(
          reaction
        )
      ) {

        grouped.set(
          reaction,
          []
        );

      }


      grouped
        .get(reaction)
        .push(row);

    }
  );


  grouped.forEach(
    (users, reaction) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";

      button.className =
        "reaction-count";

      button.textContent =
        `${reaction} ${users.length}`;


      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          showReactionUsers(
            reaction,
            users
          );

        }
      );


      container.appendChild(
        button
      );

    }
  );

}


function rerenderReactions(
  messageId
) {

  const areas =
    messages?.querySelectorAll(
      ".reaction-area"
    ) || [];


  areas.forEach(
    area => {

      if (
        String(
          area.dataset
            .reactionMessageId
        ) ===
        String(messageId)
      ) {

        renderReactionArea(
          area,
          messageId
        );

      }

    }
  );

}


function rerenderAllReactions() {

  const areas =
    messages?.querySelectorAll(
      ".reaction-area"
    ) || [];


  areas.forEach(
    area => {

      renderReactionArea(
        area,
        area.dataset
          .reactionMessageId
      );

    }
  );

}


function setupReactionPicker(
  messageElement,
  messageId
) {

  let pressTimer = null;


  const show =
    () => {

      removeReactionPicker();


      const picker =
        document.createElement(
          "div"
        );


      picker.className =
        "reaction-picker";


      REACTIONS.forEach(
        reaction => {

          const button =
            document.createElement(
              "button"
            );


          button.type =
            "button";

          button.textContent =
            reaction;


          button.addEventListener(
            "click",
            event => {

              event.stopPropagation();

              toggleReaction(
                messageId,
                reaction
              );

              removeReactionPicker();

            }
          );


          picker.appendChild(
            button
          );

        }
      );


      messageElement.appendChild(
        picker
      );

    };


  messageElement.addEventListener(
    "contextmenu",
    event => {

      event.preventDefault();

      show();

    }
  );


  messageElement.addEventListener(
    "touchstart",
    () => {

      pressTimer =
        setTimeout(
          show,
          600
        );

    },
    {
      passive: true
    }
  );


  [
    "touchend",
    "touchmove",
    "touchcancel"
  ].forEach(
    eventName => {

      messageElement.addEventListener(
        eventName,
        () => {

          if (pressTimer) {

            clearTimeout(
              pressTimer
            );

            pressTimer = null;

          }

        },
        {
          passive: true
        }
      );

    }
  );

}


async function toggleReaction(
  messageId,
  reaction
) {

  if (!currentUser) return;


  try {

    const {
      data: existing,
      error:
        selectError
    } =
      await supabaseClient
        .from(
          "message_reactions"
        )
        .select(
          "user_id, message_id, reaction"
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


    if (selectError) {

      throw selectError;

    }


    if (existing) {

      const {
        error
      } =
        await supabaseClient
          .from(
            "message_reactions"
          )
          .delete()
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
          );


      if (error) {

        throw error;

      }

    } else {

      const {
        error
      } =
        await supabaseClient
          .from(
            "message_reactions"
          )
          .insert({
            message_id:
              messageId,

            user_id:
              currentUser.id,

            reaction

          });


      if (error) {

        throw error;

      }

    }


    await loadReactionsForMessage(
      messageId
    );


    rerenderReactions(
      messageId
    );


  } catch (error) {

    console.error(
      "REACTION ERROR:",
      error
    );

  }

}


function showReactionUsers(
  reaction,
  users
) {

  const names =
    users.map(
      user => {

        return (
          user.profiles?.username ||
          user.username ||
          "User"
        );

      }
    );


  window.alert(
    `${reaction}\n\n${names.join("\n")}`
  );

}


function removeReactionPicker() {

  document
    .querySelectorAll(
      ".reaction-picker"
    )
    .forEach(
      picker =>
        picker.remove()
    );

}


document.addEventListener(
  "click",
  event => {

    if (
      !event.target.closest(
        ".reaction-picker"
      )
    ) {

      removeReactionPicker();

    }

  }
);


/* =========================================================
   TYPING INDICATOR
   ========================================================= */

function setupTyping() {

  if (!currentUser) return;


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

          const username =
            payload.payload?.username;


          const userId =
            payload.payload?.userId;


          if (
            !username ||
            String(userId) ===
            String(currentUser.id)
          ) {

            return;

          }


          showTyping(
            username
          );

        }
      )
      .subscribe();


}


function handleTyping() {

  if (!typingChannel) return;


  if (!messageInput?.value.trim()) {

    stopTypingBroadcast();

    return;

  }


  if (!isCurrentlyTyping) {

    isCurrentlyTyping =
      true;

    typingChannel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        username:
          currentProfile?.username ||
          "Someone",

        userId:
          currentUser.id
      }
    });

  }


  if (typingTimeout) {

    clearTimeout(
      typingTimeout
    );

  }


  typingTimeout =
    setTimeout(
      stopTypingBroadcast,
      1500
    );

}


function stopTypingBroadcast() {

  isCurrentlyTyping =
    false;


  if (typingTimeout) {

    clearTimeout(
      typingTimeout
    );

    typingTimeout = null;

  }

}


function showTyping(
  username
) {

  if (!typingIndicator) return;


  typingIndicator.textContent =
    `${username} is typing...`;


  typingIndicator.classList.add(
    "show"
  );


  clearTimeout(
    typingIndicator._timer
  );


  typingIndicator._timer =
    setTimeout(
      () => {

        typingIndicator.classList.remove(
          "show"
        );

        typingIndicator.textContent =
          "";

      },
      1800
    );

}


/* =========================================================
   PRESENCE
   ========================================================= */

function setupPresence() {

  if (!currentUser) return;


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
                String(
                  currentUser.id
                )
            }
          }
        }
      );


  presenceChannel.on(
    "presence",
    {
      event: "sync"
    },
    () => {

      const state =
        presenceChannel.presenceState();


      presenceUsers =
        state || {};


      renderMembers();

    }
  );


  presenceChannel.on(
    "presence",
    {
      event: "join"
    },
    () => {

      renderMembers();

    }
  );


  presenceChannel.on(
    "presence",
    {
      event: "leave"
    },
    () => {

      renderMembers();

    }
  );


  presenceChannel
    .subscribe(
      async status => {

        if (
          status ===
          "SUBSCRIBED"
        ) {

          await presenceChannel.track({
            userId:
              currentUser.id,

            username:
              currentProfile?.username ||
              "User",

            online:
              true,

            joinedAt:
              Date.now()
          });

        }

      }
    );

}


/* =========================================================
   MEMBERS
   ========================================================= */

async function loadMembers() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, username, bio, last_seen_at"
      )
      .order(
        "username",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      "MEMBERS LOAD ERROR:",
      error
    );

    return;

  }


  window.neuralNinjasMembers =
    data || [];


  renderMembers();

}


function isUserOnline(
  userId
) {

  return Object.values(
    presenceUsers || {}
  ).some(
    entries =>
      entries.some(
        entry =>
          String(
            entry.userId
          ) ===
          String(userId)
      )
  );

}


function renderMembers() {

  if (!membersList) return;


  const members =
    window.neuralNinjasMembers ||
    [];


  memberCount.textContent =
    `${members.length} ${
      members.length === 1
        ? "member"
        : "members"
    }`;


  membersList.innerHTML = "";


  members.forEach(
    member => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "member-item";


      const avatar =
        document.createElement(
          "div"
        );


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
        document.createElement(
          "div"
        );


      info.className =
        "member-info";


      const name =
        document.createElement(
          "strong"
        );


      name.textContent =
        member.username ||
        "User";


      const status =
        document.createElement(
          "span"
        );


      const online =
        isUserOnline(
          member.id
        );


      if (online) {

        status.textContent =
          "● Online";

        status.className =
          "member-online";

      } else {

        status.textContent =
          formatLastSeen(
            member.last_seen_at
          );

        status.className =
          "member-last-seen";

      }


      info.appendChild(
        name
      );

      info.appendChild(
        status
      );


      item.appendChild(
        avatar
      );

      item.appendChild(
        info
      );


      membersList.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   LAST SEEN
   ========================================================= */

async function updateLastSeen() {

  if (!currentUser) return;


  try {

    const {
      error
    } =
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


    if (error) {

      console.warn(
        "LAST SEEN ERROR:",
        error
      );

      return;

    }


    if (
      currentProfile
    ) {

      currentProfile.last_seen_at =
        new Date().toISOString();

    }

  } catch (error) {

    console.warn(
      error
    );

  }

}


function startLastSeenTimer() {

  if (lastSeenInterval) {

    clearInterval(
      lastSeenInterval
    );

  }


  lastSeenInterval =
    setInterval(
      async () => {

        if (
          document.visibilityState ===
          "visible"
        ) {

          await updateLastSeen();

          renderMembers();

        }

      },
      30000
    );

}


function formatLastSeen(
  timestamp
) {

  if (!timestamp) {

    return "Last seen unknown";

  }


  const date =
    new Date(timestamp);


  const diff =
    Date.now() -
    date.getTime();


  if (diff < 60000) {

    return "Last seen just now";

  }


  const minutes =
    Math.floor(
      diff / 60000
    );


  if (minutes < 60) {

    return `Last seen ${minutes}m ago`;

  }


  const hours =
    Math.floor(
      minutes / 60
    );


  if (hours < 24) {

    return `Last seen ${hours}h ago`;

  }


  const days =
    Math.floor(
      hours / 24
    );


  return `Last seen ${days}d ago`;

}


/* =========================================================
   SEARCH
   =========================================================
   IMPORTANT FIX:
   Never replace message.innerHTML during search.
   That used to destroy reply/delete/reaction
   event listeners.
   ========================================================= */

function searchMessages() {

  const query =
    messageSearchInput?.value
      ?.trim()
      .toLowerCase() ||
    "";


  const messageElements =
    messages?.querySelectorAll(
      ".message"
    ) || [];


  messageElements.forEach(
    element => {

      /*
         Read text safely without
         modifying the message DOM.
      */

      const text =
        element.textContent
          .toLowerCase();


      if (!query) {

        element.style.display =
          "";

        element.classList.remove(
          "search-match"
        );

        return;

      }


      const match =
        text.includes(
          query
        );


      element.style.display =
        match
          ? ""
          : "none";


      element.classList.toggle(
        "search-match",
        match
      );

    }
  );

}


function clearSearch() {

  if (
    messageSearchInput
  ) {

    messageSearchInput.value =
      "";

  }


  searchMessages();

}


/* =========================================================
   THEME SYSTEM
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


function applyTheme(
  theme
) {

  const validThemes = [
    "default",
    "cyber",
    "space",
    "amber"
  ];


  if (
    !validThemes.includes(
      theme
    )
  ) {

    theme =
      "default";

  }


  document.body.dataset.theme =
    theme;


  localStorage.setItem(
    "neuralNinjasTheme",
    theme
  );


  document
    .querySelectorAll(
      ".theme-option"
    )
    .forEach(
      option => {

        option.classList.toggle(
          "active",
          option.dataset.theme ===
            theme
        );

      }
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
   ACCOUNT DELETION
   ========================================================= */

async function deleteAccount() {

  if (!currentUser) return;


  const firstConfirm =
    window.confirm(
      "Delete your Neural Ninjas account?"
    );


  if (!firstConfirm) return;


  const secondConfirm =
    window.confirm(
      "This action cannot be easily undone. Delete account permanently?"
    );


  if (!secondConfirm) return;


  deleteAccountBtn.disabled =
    true;


  deleteAccountBtn.textContent =
    "Deleting...";


  try {

    const {
      data: sessionData,
      error:
        sessionError
    } =
      await supabaseClient.auth
        .getSession();


    if (sessionError) {

      throw sessionError;

    }


    const accessToken =
      sessionData.session
        ?.access_token;


    if (!accessToken) {

      throw new Error(
        "Your session has expired. Please login again."
      );

    }


    /*
       Account deletion MUST happen
       through the Edge Function because
       auth.users cannot safely be deleted
       from the browser with normal RLS.
    */

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/super-responder`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${accessToken}`,

            apikey:
              SUPABASE_PUBLISHABLE_KEY
          },

          body: JSON.stringify({
            action:
              "delete_account"
          })

        }
      );


    let result = null;


    try {

      result =
        await response.json();

    } catch {

      result = null;

    }


    if (
      !response.ok ||
      result?.success === false
    ) {

      throw new Error(
        result?.error ||
        result?.message ||
        `Account deletion failed (${response.status}).`
      );

    }


    /*
       Server already deleted account.
       Signout is best-effort.
    */

    try {

      await supabaseClient.auth
        .signOut();

    } catch (signOutError) {

      console.warn(
        "SIGNOUT AFTER DELETE:",
        signOutError
      );

    }


    cleanupApplication();


    alert(
      "Your account has been deleted."
    );


  } catch (error) {

    console.error(
      "ACCOUNT DELETE ERROR:",
      error
    );

    alert(
      error.message ||
      "Failed to delete account."
    );

  } finally {

    if (
      deleteAccountBtn
    ) {

      deleteAccountBtn.disabled =
        false;

      deleteAccountBtn.textContent =
        "Delete Account";

    }

  }

}


/* =========================================================
   EXIT / LOGOUT
   ========================================================= */

async function exitChat() {

  const confirmed =
    window.confirm(
      "Exit Neural Ninjas?"
    );


  if (!confirmed) return;


  try {

    await updateLastSeen();

  } catch {

    /* Ignore last-seen failure
       while logging out. */

  }


  try {

    await supabaseClient.auth
      .signOut();

  } catch (error) {

    console.warn(
      "SIGNOUT ERROR:",
      error
    );

  }


  cleanupApplication();

}


/* =========================================================
   APPLICATION CLEANUP
   ========================================================= */

function cleanupApplication() {

  cleanupRealtimeChannels();


  if (lastSeenInterval) {

    clearInterval(
      lastSeenInterval
    );

    lastSeenInterval = null;

  }


  cleanupRecordingStream();


  currentUser = null;

  currentProfile = null;

  messageCache.clear();

  reactionCache.clear();

  presenceUsers = {};

  replyingToMessage = null;

  isCurrentlyTyping = false;


  if (messages) {

    messages.innerHTML =
      "";

  }


  if (messageInput) {

    messageInput.value =
      "";

  }


  clearSearch();

  cancelReply();

  closeSidebar();

  closeThemePanel();


  chatScreen?.classList.add(
    "hidden"
  );

  loginScreen?.classList.remove(
    "hidden"
  );


  if (onlineStatus) {

    onlineStatus.textContent =
      "Connecting...";

  }


  setLoginStatus("");

}


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    /*
       Do not await here.
       Browser may terminate async
       operations immediately.
    */

    if (currentUser) {

      updateLastSeen();

    }

  }
);


/* =========================================================
   UI HELPERS
   ========================================================= */

function setLoginStatus(
  message
) {

  if (!loginStatus) return;

  loginStatus.textContent =
    message;

}


function showChatError(
  message
) {

  console.error(
    message
  );


  /*
     Use login status if available,
     otherwise temporary typing area
     so no extra HTML is required.
  */

  if (
    chatScreen?.classList.contains(
      "hidden"
    )
  ) {

    setLoginStatus(
      message
    );

    return;

  }


  if (typingIndicator) {

    typingIndicator.textContent =
      message;

    typingIndicator.classList.add(
      "show"
    );


    clearTimeout(
      typingIndicator._errorTimer
    );


    typingIndicator._errorTimer =
      setTimeout(
        () => {

          typingIndicator.classList.remove(
            "show"
          );

          typingIndicator.textContent =
            "";

        },
        2500
      );

  }

}


function scrollToBottom() {

  if (!messages) return;


  requestAnimationFrame(
    () => {

      messages.scrollTop =
        messages.scrollHeight;

    }
  );

}


function formatMessageTime(
  timestamp
) {

  if (!timestamp) {
    return "";
  }


  const date =
    new Date(timestamp);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  return date.toLocaleTimeString(
    [],
    {
      hour:
        "2-digit",

      minute:
        "2-digit"
    }
  );

}


function getFileExtension(
  filename
) {

  const index =
    filename.lastIndexOf(
      "."
    );


  if (
    index === -1
  ) {

    return "";

  }


  return filename
    .slice(index)
    .toLowerCase()
    .replace(
      /[^a-z0-9.]/g,
      ""
    );

}


/* =========================================================
   GLOBAL ERROR HANDLERS
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "UNHANDLED PROMISE:",
      event.reason
    );

  }
);


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


/* =========================================================
   DEBUG HELPERS
   ========================================================= */

window.NeuralNinjas = {

  getCurrentUser() {
    return currentUser;
  },

  getCurrentProfile() {
    return currentProfile;
  },

  startVoiceRecording,

  stopVoiceRecording,

  sendMessage,

  clearSearch,

  applyTheme,

  logout: exitChat

};


console.log(
  "🥷 Neural Ninjas loaded successfully."
);
