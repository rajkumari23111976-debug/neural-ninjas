/* =========================================================
   NEURAL NINJAS - APP.JS
   =========================================================
   CSS-COMPATIBLE VERSION
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
   • Message search
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
   DOM REFERENCES
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
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

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


  /* =======================================================
     LOGIN
     ======================================================= */

  if (joinBtn) {
    joinBtn.addEventListener("click", handleLogin);
  }

  if (usernameInput) {
    usernameInput.addEventListener("keydown", event => {

      if (event.key === "Enter") {
        handleLogin();
      }

    });
  }

if (pinInput) {

  pinInput.addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {
        handleLogin();
      }

    }
  );

}


  /* =======================================================
     LOGOUT
     ======================================================= */

  if (logoutBtn) {
    logoutBtn.addEventListener("click", exitChat);
  }


  /* =======================================================
     SIDEBAR
     ======================================================= */

  if (menuBtn) {
    menuBtn.addEventListener("click", openSidebar);
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
  }


  /* =======================================================
     DELETE ACCOUNT
     ======================================================= */

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", deleteAccount);
  }


  /* =======================================================
     THEMES
     ======================================================= */

  if (themeBtn) {
    themeBtn.addEventListener("click", openThemePanel);
  }

  if (closeThemeBtn) {
    closeThemeBtn.addEventListener("click", closeThemePanel);
  }

  document.querySelectorAll(".theme-option").forEach(button => {

    button.addEventListener("click", () => {

      applyTheme(button.dataset.theme);

    });

  });


  /* =======================================================
     SEARCH
     ======================================================= */

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


  /* =======================================================
     COMPOSER
     ======================================================= */

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (messageInput) {

    messageInput.addEventListener("keydown", event => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();
        sendMessage();

      }

    });

    messageInput.addEventListener(
      "input",
      handleTyping
    );

  }


  /* =======================================================
     REPLY
     ======================================================= */

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener(
      "click",
      cancelReply
    );
  }


  /* =======================================================
     MEDIA
     ONLY ONE FILE LISTENER
     ======================================================= */

  if (mediaBtn && fileInput) {

    mediaBtn.addEventListener("click", () => {

      fileInput.value = "";
      fileInput.click();

    });

    fileInput.addEventListener(
      "change",
      async event => {

        const file =
          event.target.files?.[0];

        if (!file) return;

        await handleFileUpload(file);

      }
    );

  }


  /* =======================================================
     SAVED THEME
     ======================================================= */

  const savedTheme =
    localStorage.getItem(
      "neuralNinjasTheme"
    );

  if (savedTheme) {
    applyTheme(savedTheme);
  }


  /* =======================================================
     RESTORE SESSION
     ======================================================= */

  restoreSession();


  /* =======================================================
     ESCAPE
     ======================================================= */

  document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

      closeSidebar();
      closeThemePanel();
      removeReactionPicker();

    }

  });


  /* =======================================================
     VISIBILITY
     ======================================================= */

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
    usernameInput?.value?.trim();

  const pin =
    pinInput?.value?.trim();

  if (!username) {
    setLoginStatus("Enter your username.");
    usernameInput?.focus();
    return;
  }

  if (username.length < 2) {
    setLoginStatus(
      "Username must be at least 2 characters."
    );
    return;
  }

  if (!/^\d{6}$/.test(pin)) {
    setLoginStatus(
      "PIN must be exactly 6 digits."
    );
    pinInput?.focus();
    return;
  }

  setLoginStatus("Connecting...");

  if (joinBtn) {
    joinBtn.disabled = true;
  }

  try {

    const email =
      makeAuthEmail(username);

    let { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password: pin
      });

    /*
      Existing account login failed.
      Try creating account.
    */

    if (error) {

      const signUpResult =
        await supabaseClient.auth.signUp({
          email,
          password: pin,
          options: {
            data: {
              username
            }
          }
        });

      if (signUpResult.error) {

        throw new Error(
          "Username or PIN is incorrect, or account already exists."
        );

      }

      data =
        signUpResult.data;

      if (!data.session) {

        throw new Error(
          "Account created but Supabase email confirmation is enabled. Disable email confirmation in Supabase."
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

    await loadCurrentProfile(username);

    await startChat();

    /*
      Clear PIN after successful login.
    */

    if (pinInput) {
      pinInput.value = "";
    }

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

    if (joinBtn) {
      joinBtn.disabled = false;
    }

  }
}


    


/* =========================================================
   LOAD PROFILE
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
      .eq("id", currentUser.id)
      .maybeSingle();


  if (error) {
    throw error;
  }


  if (data) {

    currentProfile = data;
    return;

  }


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

      console.error(
        "SESSION ERROR:",
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
          .eq("id", currentUser.id)
          .maybeSingle();


      currentProfile =
        profile;


      if (currentProfile) {

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

  messageInput?.focus();


  messageInput?.focus();

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

  const rawMessages =
    data || [];

  /*
    Get all sender IDs.
  */

  const senderIds =
    [
      ...new Set(
        rawMessages
          .map(message =>
            message.sender_id
          )
          .filter(Boolean)
          .map(String)
      )
    ];

  let profilesMap =
    new Map();

  if (senderIds.length > 0) {

    const {
      data: profiles,
      error: profilesError
    } =
      await supabaseClient
        .from("profiles")
        .select(
          "id, username, bio, last_seen_at"
        )
        .in(
          "id",
          senderIds
        );

    if (profilesError) {

      console.warn(
        "MESSAGE PROFILE LOAD ERROR:",
        profilesError
      );

    } else {

      (profiles || []).forEach(profile => {

        profilesMap.set(
          String(profile.id),
          profile
        );

      });

    }

  }

  /*
    Attach username to every message.
  */

  const enrichedMessages =
    rawMessages.map(message => {

      const profile =
        profilesMap.get(
          String(message.sender_id)
        );

      return {
        ...message,

        username:
          message.username ||
          profile?.username ||
          (
            String(message.sender_id) ===
            String(currentUser?.id)
              ? currentProfile?.username
              : "User"
          ),

        profiles:
          profile || null

      };

    });

  messageCache.clear();

  if (messages) {
    messages.innerHTML = "";
  }

  enrichedMessages.forEach(message => {

    messageCache.set(
      String(message.id),
      message
    );

    renderMessage(
      message,
      false
    );

  });

  scrollToBottom();
}



/* =========================================================
   REALTIME
   ========================================================= */

function setupRealtime() {

  cleanupRealtimeChannels();


  /* =======================================================
     MESSAGE CHANNEL
     ======================================================= */

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

          if (!message?.id) return;

           let profile = null;

if (message.sender_id) {

  const {
    data: senderProfile
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, username, bio, last_seen_at"
      )
      .eq(
        "id",
        message.sender_id
      )
      .maybeSingle();

  profile =
    senderProfile || null;
}

const enrichedMessage = {

  ...message,

  username:
    profile?.username ||
    (
      String(message.sender_id) ===
      String(currentUser?.id)
        ? currentProfile?.username
        : "User"
    ),

  profiles:
    profile

};


          const id =
            String(message.id);


          messageCache.set(
            id,
            enrichedmessage
          );


          /*
             Do NOT render here if this
             is our own message.

             sendMessage() already renders
             the returned inserted row.
          */

          if (
            String(message.sender_id) !==
            String(currentUser?.id)
          ) {

            renderMessage(
              enrichedmessage,
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
              payload.old?.id
            );

          if (!id) return;


          messageCache.delete(id);

          removeMessageFromDOM(id);

        }
      )
      .subscribe(status => {

        console.log(
          "MESSAGE CHANNEL:",
          status
        );

      });


  /* =======================================================
     REACTION CHANNEL
     ======================================================= */

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

    supabaseClient.removeChannel(
      messageChannel
    );

    messageChannel = null;

  }


  if (reactionChannel) {

    supabaseClient.removeChannel(
      reactionChannel
    );

    reactionChannel = null;

  }


  if (typingChannel) {

    supabaseClient.removeChannel(
      typingChannel
    );

    typingChannel = null;

  }


  if (presenceChannel) {

    supabaseClient.removeChannel(
      presenceChannel
    );

    presenceChannel = null;

  }


  if (typingTimeout) {

    clearTimeout(typingTimeout);
    typingTimeout = null;

  }


  isCurrentlyTyping = false;

}


/* =========================================================
   RENDER MESSAGE
   =========================================================
   IMPORTANT:
   THESE CLASS NAMES MATCH YOUR CSS.
   ========================================================= */

function renderMessage(
  data,
  shouldScroll = true
) {

  if (!data || !messages) return;


  const messageId =
    String(data.id);


  /* =======================================================
     DUPLICATE CHECK
     ======================================================= */

  const existing =
    messages.querySelector(
      `.message[data-message-id="${CSS.escape(messageId)}"]`
    );


  if (existing) return;


  const isMine =
    String(data.sender_id) ===
    String(currentUser?.id);


  /* =======================================================
     MESSAGE WRAPPER
     ======================================================= */

  const wrapper =
    document.createElement("div");


  wrapper.className =
    `message ${isMine ? "mine" : ""}`;


  wrapper.dataset.messageId =
    messageId;


  /* =======================================================
     BUBBLE
     ======================================================= */

  const bubble =
    document.createElement("div");


  bubble.className =
    "bubble";


  /* =======================================================
     SENDER
     ======================================================= */

  /*
     Your latest CSS has .sender-name
     while your original CSS has .sender.

     We use BOTH classes so both sections
     of your CSS remain compatible.
  */

  const sender =
    document.createElement("div");


  sender.className =
    "sender sender-name";


  sender.textContent =
    isMine
      ? "You"
      : (
          data.username ||
          data.profiles?.username ||
          "User"
        );


  if (!isMine) {

    bubble.appendChild(sender);

  } else {

    /*
       Keep sender on own messages too.
       This preserves the existing layout.
    */

    bubble.appendChild(sender);

  }


  /* =======================================================
     REPLY PREVIEW
     ======================================================= */

  if (data.reply_to) {

    bubble.appendChild(
      createReplyPreview(
        data.reply_to
      )
    );

  }


  /* =======================================================
     MESSAGE TEXT / MEDIA / CODE
     ======================================================= */

  const content =
    document.createElement("div");


  /*
     Use both .text and .message-text.
     This makes the renderer compatible
     with both your older and newer CSS.
  */

  content.className =
    "text message-text";


  const messageType =
    data.message_type ||
    "text";


  if (messageType === "image") {

    createImageContent(
      content,
      data
    );

  } else if (messageType === "video") {

    createVideoContent(
      content,
      data
    );

  } else if (
    messageType === "audio" ||
    messageType === "voice"
  ) {

    createAudioContent(
      content,
      data
    );

  } else if (
    messageType === "code" ||
    looksLikeCode(data.content)
  ) {

    createCodeContent(
      content,
      data.content || ""
    );

  } else {

    appendSafeTextWithLinks(
      content,
      data.content || ""
    );

  }


  bubble.appendChild(content);


  /* =======================================================
     TIME
     ======================================================= */

  const time =
    document.createElement("span");


  /*
     Use both .time and .message-time.
  */

  time.className =
    "time message-time";


  time.textContent =
    formatMessageTime(
      data.created_at
    );


  bubble.appendChild(time);


  /* =======================================================
     REPLY BUTTON
     ======================================================= */

  const replyButton =
    document.createElement("button");


  replyButton.type =
    "button";


  replyButton.className =
    "reply-message";


  replyButton.textContent =
    "↩ Reply";


  replyButton.title =
    "Reply to this message";


  replyButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      startReply(data);

    }
  );


  bubble.appendChild(
    replyButton
  );


  /* =======================================================
     DELETE BUTTON
     ======================================================= */

  if (isMine) {

    const deleteButton =
      document.createElement("button");


    deleteButton.type =
      "button";


    /*
       EXACT CSS CLASS
       FROM YOUR CSS
    */

    deleteButton.className =
      "delete-message";


    deleteButton.textContent =
      "Delete";


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


    bubble.appendChild(
      deleteButton
    );

  }


  /* =======================================================
     REACTIONS
     ======================================================= */

  const reactionContainer =
    document.createElement("div");


  reactionContainer.className =
    "reaction-area";


  reactionContainer.dataset.reactionMessageId =
    messageId;


  renderReactionArea(
    reactionContainer,
    messageId
  );


  bubble.appendChild(
    reactionContainer
  );


  /* =======================================================
     FINAL DOM
     ======================================================= */

  wrapper.appendChild(
    bubble
  );


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
   SAFE TEXT + LINKS
   ========================================================= */

function appendSafeTextWithLinks(
  container,
  text
) {

  if (!text) return;


  const urlRegex =
    /(https?:\/\/[^\s]+)/g;


  const parts =
    text.split(urlRegex);


  parts.forEach(part => {

    if (/^https?:\/\/[^\s]+$/i.test(part)) {

      const link =
        document.createElement("a");


      link.href =
        part;

      link.target =
        "_blank";

      link.rel =
        "noopener noreferrer";


      link.className =
        "message-link";


      link.textContent =
        part;


      container.appendChild(
        link
      );

    } else {

      container.appendChild(
        document.createTextNode(
          part
        )
      );

    }

  });

}


/* =========================================================
   REPLY PREVIEW
   ========================================================= */

function createReplyPreview(
  replyTo
) {

  const box =
    document.createElement("div");


  box.className =
    "message-reply-preview";


  const original =
    messageCache.get(
      String(replyTo)
    );


  const sender =
    document.createElement("div");


  sender.className =
    "message-reply-sender";


  const content =
    document.createElement("div");


  content.className =
    "message-reply-content";


  if (original) {

    sender.textContent =
      String(original.sender_id) ===
      String(currentUser?.id)
        ? "You"
        : (
            original.username ||
            original.profiles?.username ||
            "User"
          );


    content.textContent =
      getPreviewText(original);

  } else {

    sender.textContent =
      "Reply";

    content.textContent =
      "Original message unavailable.";

  }


  box.appendChild(sender);
  box.appendChild(content);


  /*
     Clicking the reply preview
     jumps to original message.
  */

  if (original) {

    box.style.cursor =
      "pointer";


    box.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        jumpToMessage(
          original.id
        );

      }
    );

  }


  return box;

}


/* =========================================================
   JUMP TO MESSAGE
   ========================================================= */

function jumpToMessage(
  messageId
) {

  const target =
    messages?.querySelector(
      `.message[data-message-id="${CSS.escape(String(messageId))}"]`
    );


  if (!target) return;


  target.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });


  target.classList.remove(
    "reply-target-highlight"
  );


  void target.offsetWidth;


  target.classList.add(
    "reply-target-highlight"
  );


  setTimeout(() => {

    target.classList.remove(
      "reply-target-highlight"
    );

  }, 2000);

}


/* =========================================================
   MEDIA
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
    document.createElement("img");


  img.src =
    data.file_url;

  img.alt =
    data.content ||
    "Image";

  img.loading =
    "lazy";


  /*
     EXACT CSS CLASS
  */

  img.className =
    "chat-media";


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


  container.appendChild(img);

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
    document.createElement("video");


  video.src =
    data.file_url;

  video.controls =
    true;

  video.playsInline =
    true;


  /*
     EXACT CSS CLASS
  */

  video.className =
    "chat-media";


  container.appendChild(video);

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
    document.createElement("audio");


  audio.src =
    data.file_url;

  audio.controls =
    true;


  /*
     EXACT CSS CLASS
  */

  audio.className =
    "chat-media";


  container.appendChild(audio);

}


/* =========================================================
   CODE DETECTION
   ========================================================= */

function looksLikeCode(text) {

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


/* =========================================================
   CLEAN CODE
   ========================================================= */

function cleanCode(text) {

  return text
    .replace(
      /^```[\w-]*\n?/i,
      ""
    )
    .replace(
      /\n?```$/i,
      ""
    )
    .trim();

}


/* =========================================================
   CODE CONTENT
   ========================================================= */

function createCodeContent(
  container,
  text
) {

  const wrapper =
    document.createElement("div");


  /*
     EXACT CSS CLASS
  */

  wrapper.className =
    "code-box";


  const pre =
    document.createElement("pre");


  const code =
    document.createElement("code");


  const cleaned =
    cleanCode(text);


  code.textContent =
    cleaned;


  pre.appendChild(code);


  const copyButton =
    document.createElement("button");


  copyButton.type =
    "button";


  /*
     EXACT CSS CLASS
  */

  copyButton.className =
    "copy-code";


  copyButton.textContent =
    "Copy";


  copyButton.addEventListener(
    "click",
    async event => {

      event.stopPropagation();


      try {

        if (
          navigator.clipboard &&
          navigator.clipboard.writeText
        ) {

          await navigator.clipboard.writeText(
            cleaned
          );

        } else {

          const textarea =
            document.createElement("textarea");

          textarea.value =
            cleaned;

          document.body.appendChild(
            textarea
          );

          textarea.select();

          document.execCommand(
            "copy"
          );

          textarea.remove();

        }


        copyButton.textContent =
          "Copied!";


        setTimeout(() => {

          copyButton.textContent =
            "Copy";

        }, 1500);


      } catch (error) {

        console.error(
          "COPY ERROR:",
          error
        );

        copyButton.textContent =
          "Copy failed";


        setTimeout(() => {

          copyButton.textContent =
            "Copy";

        }, 1500);

      }

    }
  );


  /*
     CSS expects button first
     and code area after it.
  */

  wrapper.appendChild(
    copyButton
  );

  wrapper.appendChild(
    pre
  );


  container.appendChild(
    wrapper
  );


  /* =======================================================
     HIGHLIGHT.JS
     ======================================================= */

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
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

  if (!currentUser) return;


  const content =
    messageInput?.value?.trim();


  if (!content) return;


  if (sendBtn) {
    sendBtn.disabled = true;
  }


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

    if (sendBtn) {
      sendBtn.disabled = false;
    }

    messageInput?.focus();

  }

}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

async function handleFileUpload(
  file
) {

  if (!currentUser || !file) return;


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


  let messageType = null;


  if (type.startsWith("image/")) {

    messageType =
      "image";

  } else if (type.startsWith("video/")) {

    messageType =
      "video";

  } else if (type.startsWith("audio/")) {

    messageType =
      "audio";

  }


  if (!messageType) {

    showChatError(
      "Only image, video and audio files are supported."
    );

    return;

  }


  if (mediaBtn) {
    mediaBtn.disabled = true;
  }


  const originalText =
    mediaBtn?.textContent;


  if (mediaBtn) {
    mediaBtn.textContent =
      "…";
  }


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


    const {
      error: uploadError
    } =
      await supabaseClient
        .storage
        .from("neural-ninjas-media")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              file.type || undefined
          }
        );


    if (uploadError) {
      throw uploadError;
    }


    const {
      data: signedData,
      error: signedError
    } =
      await supabaseClient
        .storage
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

    if (mediaBtn) {

      mediaBtn.disabled =
        false;

      mediaBtn.textContent =
        originalText || "＋";

    }


    if (fileInput) {
      fileInput.value = "";
    }

  }

}


/* =========================================================
   VOICE RECORDING
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
      await navigator.mediaDevices.getUserMedia({
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
        { mimeType }
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
              type: mimeType
            }
          );


        cleanupRecordingStream();


        if (blob.size > 0) {

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
      .forEach(track => {
        track.stop();
      });

    recordingStream = null;

  }


  mediaRecorder = null;

}


/* =========================================================
   VOICE UPLOAD
   ========================================================= */

async function uploadVoiceBlob(
  blob
) {

  if (!currentUser) return;


  try {

    const path =
      `${currentUser.id}/voice-${Date.now()}.webm`;


    const {
      error: uploadError
    } =
      await supabaseClient
        .storage
        .from("neural-ninjas-media")
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
        .from("neural-ninjas-media")
        .createSignedUrl(
          path,
          60 * 60 * 24 * 30
        );


    if (error) {
      throw error;
    }


    const {
      data: message,
      error: messageError
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
    String(message.sender_id) ===
    String(currentUser?.id)
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
      getPreviewText(message);
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

  if (!message) return "";


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
    String(message.sender_id) !==
    String(currentUser.id)
  ) {

    showChatError(
      "You can only delete your own messages."
    );

    return;

  }


  if (
    !window.confirm(
      "Delete this message?"
    )
  ) {
    return;
  }


  try {

    const {
      error
    } =
      await supabaseClient
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", currentUser.id);


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


  all.forEach(element => {

    if (
      String(
        element.dataset.messageId
      ) ===
      String(messageId)
    ) {

      element.remove();

    }

  });

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


  (data || []).forEach(row => {

    const key =
      String(row.message_id);


    if (!reactionCache.has(key)) {

      reactionCache.set(
        key,
        []
      );

    }


    reactionCache
      .get(key)
      .push(row);

  });


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


  rows.forEach(row => {

    const reaction =
      row.reaction;


    if (!grouped.has(reaction)) {

      grouped.set(
        reaction,
        []
      );

    }


    grouped
      .get(reaction)
      .push(row);

  });


  grouped.forEach(
    (users, reaction) => {

      const button =
        document.createElement("button");


      button.type =
        "button";


      /*
         .reaction-count is styled
         by your CSS.
      */

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


  areas.forEach(area => {

    if (
      String(
        area.dataset.reactionMessageId
      ) ===
      String(messageId)
    ) {

      renderReactionArea(
        area,
        messageId
      );

    }

  });

}


function rerenderAllReactions() {

  const areas =
    messages?.querySelectorAll(
      ".reaction-area"
    ) || [];


  areas.forEach(area => {

    renderReactionArea(
      area,
      area.dataset.reactionMessageId
    );

  });

}


/* =========================================================
   REACTION PICKER
   ========================================================= */

function setupReactionPicker(
  messageElement,
  messageId
) {

  let pressTimer = null;


  const show = () => {

    removeReactionPicker();


    const picker =
      document.createElement("div");


    /*
       No CSS was supplied for this class,
       so it remains isolated and won't
       affect the normal bubble.
    */

    picker.className =
      "reaction-picker";


    REACTIONS.forEach(reaction => {

      const button =
        document.createElement("button");


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

    });


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
  ].forEach(eventName => {

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

  });

}


async function toggleReaction(
  messageId,
  reaction
) {

  if (!currentUser) return;


  try {

    const {
      data: existing,
      error: selectError
    } =
      await supabaseClient
        .from("message_reactions")
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
          .from("message_reactions")
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
          .from("message_reactions")
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
    users.map(user => {

      return (
        user.profiles?.username ||
        user.username ||
        "User"
      );

    });


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
      picker => picker.remove()
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
   TYPING
   ========================================================= */

function setupTyping() {

  if (!currentUser) return;


  if (typingChannel) {

    supabaseClient.removeChannel(
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


          showTyping(username);

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
    setTimeout(() => {

      typingIndicator.classList.remove(
        "show"
      );

      typingIndicator.textContent =
        "";

    }, 1800);

}


function refreshPresenceState() {

  if (!presenceChannel) return;

  presenceUsers =
    presenceChannel.presenceState() || {};

  renderMembers();

  updateOnlineStatus();

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

      presenceUsers =
        presenceChannel.presenceState() ||
        {};

      renderMembers();

    }
  );


  presenceChannel.on(
  "presence",
  {
    event: "sync"
  },
  () => {
    refreshPresenceState();
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


  presenceChannel.subscribe(
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
  ).some(entries =>
    entries.some(entry =>
      String(entry.userId) ===
      String(userId)
    )
  );

}


   function updateOnlineStatus() {

  const members =
    window.neuralNinjasMembers || [];

  const onlineMembers =
    members.filter(member =>
      isUserOnline(member.id)
    );

  const count =
    onlineMembers.length;

  if (onlineStatus) {

    onlineStatus.textContent =
      `● ${count} member${count === 1 ? "" : "s"} online`;

  }

}

/* =========================================================
   RENDER MEMBERS
   IMPORTANT:
   MATCHES YOUR CSS EXACTLY
   ========================================================= */

function renderMembers() {

  if (!membersList) return;


  const members =
    window.neuralNinjasMembers ||
    [];


  if (memberCount) {

    memberCount.textContent =
      `${members.length} ${
        members.length === 1
          ? "member"
          : "members"
      }`;

  }


  membersList.innerHTML = "";


  members.forEach(member => {

    const item =
      document.createElement("div");


    /*
       EXACT CSS CLASS
    */

    item.className =
      "member";


    /* =====================================================
       AVATAR
       ===================================================== */

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


    /* =====================================================
       INFO
       ===================================================== */

    const info =
      document.createElement("div");


    info.className =
      "member-info";


    /* =====================================================
       NAME
       ===================================================== */

    const name =
      document.createElement("div");


    name.className =
      "member-name";


    name.textContent =
      member.username ||
      "User";


    /* =====================================================
       STATUS
       ===================================================== */

    const status =
      document.createElement("div");


    status.className =
      "member-status";


    const dot =
      document.createElement("span");


    dot.className =
      "status-dot";


    const statusText =
      document.createElement("span");


    const online =
      isUserOnline(
        member.id
      );


    if (online) {

      dot.classList.add(
        "online"
      );


      statusText.textContent =
        "Online";

    } else {

      statusText.textContent =
        formatLastSeen(
          member.last_seen_at
        );

    }


    status.appendChild(dot);

    status.appendChild(
      statusText
    );


    info.appendChild(name);

    info.appendChild(status);


    item.appendChild(avatar);

    item.appendChild(info);


    membersList.appendChild(item);

  });

}


/* =========================================================
   LAST SEEN
   ========================================================= */

async function updateLastSeen() {

  if (!currentUser) return;


  try {

    const now =
      new Date().toISOString();


    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update({
          last_seen_at: now
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


    if (currentProfile) {

      currentProfile.last_seen_at =
        now;

    }

  } catch (error) {

    console.warn(
      "LAST SEEN ERROR:",
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


  messageElements.forEach(element => {

    if (!query) {

      element.style.display =
        "";

      element.classList.remove(
        "search-match"
      );

      return;

    }


    const text =
      element.textContent
        .toLowerCase();


    const match =
      text.includes(query);


    element.style.display =
      match
        ? ""
        : "none";


    element.classList.toggle(
      "search-match",
      match
    );

  });

}


function clearSearch() {

  if (messageSearchInput) {

    messageSearchInput.value =
      "";

  }


  searchMessages();

}


/* =========================================================
   THEME
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
    !validThemes.includes(theme)
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
    .forEach(option => {

      option.classList.toggle(
        "active",
        option.dataset.theme ===
          theme
      );

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


  if (deleteAccountBtn) {

    deleteAccountBtn.disabled =
      true;

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


    const accessToken =
      sessionData.session?.access_token;


    if (!accessToken) {

      throw new Error(
        "Your session has expired. Please login again."
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


    try {

      await supabaseClient.auth.signOut();

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

    if (deleteAccountBtn) {

      deleteAccountBtn.disabled =
        false;

      deleteAccountBtn.textContent =
        "Delete Account";

    }

  }

}


/* =========================================================
   LOGOUT
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
    /* Ignore */
  }


  try {

    await supabaseClient.auth.signOut();

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
    messages.innerHTML = "";
  }


  if (messageInput) {
    messageInput.value = "";
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
      setTimeout(() => {

        typingIndicator.classList.remove(
          "show"
        );

        typingIndicator.textContent =
          "";

      }, 2500);

  }

}


function scrollToBottom() {

  if (!messages) return;


  requestAnimationFrame(() => {

    messages.scrollTop =
      messages.scrollHeight;

  });

}


function formatMessageTime(
  timestamp
) {

  if (!timestamp) return "";


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
      hour: "2-digit",
      minute: "2-digit"
    }
  );

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
    .toLowerCase()
    .replace(
      /[^a-z0-9.]/g,
      ""
    );

}


/* =========================================================
   GLOBAL ERRORS
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
   DEBUG / PUBLIC API
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

  logout:
    exitChat

};


console.log(
  "🥷 Neural Ninjas loaded successfully."
);
