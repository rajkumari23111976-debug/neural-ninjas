/* =========================================================
   NEURAL NINJAS - APP.JS
   ========================================================= */

/* =========================
   SUPABASE
   ========================= */

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

/*
  IMPORTANT:
  Keep your existing Supabase publishable key here.
  Do NOT use a service_role/secret key.
*/
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


/* =========================
   GLOBAL STATE
   ========================= */

let currentUser = null;
let currentProfile = null;

let realtimeChannel = null;
let presenceChannel = null;

let presenceUsers = {};
let allMembers = [];

let sending = false;
let uploading = false;


/* =========================
   DOM ELEMENTS
   ========================= */

const loginScreen =
  document.getElementById("loginScreen");

const chatScreen =
  document.getElementById("chatScreen");

const usernameInput =
  document.getElementById("usernameInput");

const joinBtn =
  document.getElementById("joinBtn");

const loginStatus =
  document.getElementById("loginStatus");

const messages =
  document.getElementById("messages");

const messageInput =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");

const mediaBtn =
  document.getElementById("mediaBtn");

const fileInput =
  document.getElementById("fileInput");

const logoutBtn =
  document.getElementById("logoutBtn");

const menuBtn =
  document.getElementById("menuBtn");

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

const onlineStatus =
  document.getElementById("onlineStatus");


/* =========================
   START
   ========================= */

document.addEventListener("DOMContentLoaded", () => {

  if (joinBtn) {
    joinBtn.addEventListener("click", joinTeam);
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (mediaBtn && fileInput) {
    mediaBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      handleFileUpload
    );
  }

  if (messageInput) {
    messageInput.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {
          event.preventDefault();
          sendMessage();
        }

      }
    );
  }

  if (usernameInput) {
    usernameInput.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {
          event.preventDefault();
          joinTeam();
        }

      }
    );
  }

  if (logoutBtn) {
    logoutBtn.addEventListener(
      "click",
      exitChat
    );
  }

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

  checkSession();

});


/* =========================
   SESSION CHECK
   ========================= */

async function checkSession() {

  try {

    const {
      data,
      error
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    const session = data.session;

    if (!session) {
      showLogin();
      return;
    }

    currentUser = session.user;

    const profile =
      await getProfile(currentUser.id);

    /*
      If an old anonymous session exists
      but its profile was deleted, remove
      that broken session.
    */

    if (!profile) {

      await supabaseClient.auth.signOut();

      currentUser = null;
      currentProfile = null;

      showLogin();

      return;
    }

    currentProfile = profile;

    showChat();

    await startChat();

  } catch (error) {

    console.error(
      "Session error:",
      error
    );

    currentUser = null;
    currentProfile = null;

    showLogin();
  }
}


/* =========================
   JOIN TEAM
   ========================= */

async function joinTeam() {

  if (sending || uploading) {
    return;
  }

  const username =
    usernameInput
      ? usernameInput.value.trim()
      : "";

  if (!username) {

    loginStatus.textContent =
      "Please enter a username.";

    return;
  }

  if (username.length < 2) {

    loginStatus.textContent =
      "Username must be at least 2 characters.";

    return;
  }

  if (username.length > 30) {

    loginStatus.textContent =
      "Username must be 30 characters or less.";

    return;
  }

  joinBtn.disabled = true;

  loginStatus.textContent =
    "Connecting...";

  try {

    /*
      Get current session.
    */

    let {
      data,
      error
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    let session = data.session;


    /*
      If there is no session,
      create anonymous session.
    */

    if (!session) {

      const result =
        await supabaseClient.auth.signInAnonymously();

      if (result.error) {
        throw result.error;
      }

      session =
        result.data.session;
    }

    if (!session || !session.user) {
      throw new Error(
        "Could not create a Neural Ninjas session."
      );
    }

    currentUser =
      session.user;


    /*
      Check whether this session already
      has a profile.
    */

    const existingProfile =
      await getProfile(currentUser.id);


    if (existingProfile) {

      /*
        Same device/session returning.
      */

      if (
        existingProfile.username.toLowerCase() !==
        username.toLowerCase()
      ) {

        loginStatus.textContent =
          `This device is already logged in as "${existingProfile.username}".`;

        joinBtn.disabled = false;

        return;
      }

      currentProfile =
        existingProfile;

    } else {

      /*
        Check username availability.
      */

      const {
        data: existingUsername,
        error: usernameError
      } = await supabaseClient
        .from("profiles")
        .select("id, username")
        .ilike("username", username)
        .maybeSingle();

      if (usernameError) {
        throw usernameError;
      }

      if (existingUsername) {

        loginStatus.textContent =
          `Username "${existingUsername.username}" is already in use.`;

        joinBtn.disabled = false;

        return;
      }


      /*
        Create profile.
      */

      const {
        data: newProfile,
        error: profileError
      } = await supabaseClient
        .from("profiles")
        .insert({
          id: currentUser.id,
          username: username
        })
        .select()
        .single();

      if (profileError) {

        if (profileError.code === "23505") {

          loginStatus.textContent =
            "That username is already in use.";

          joinBtn.disabled = false;

          return;
        }

        throw profileError;
      }

      currentProfile =
        newProfile;
    }


    /*
      Open chat.
    */

    showChat();

    loginStatus.textContent = "";

    await startChat();

  } catch (error) {

    console.error(
      "Join error:",
      error
    );

    loginStatus.textContent =
      error.message ||
      "Could not join Neural Ninjas.";

  } finally {

    joinBtn.disabled = false;
  }
}


/* =========================
   GET PROFILE
   ========================= */

async function getProfile(userId) {

  const {
    data,
    error
  } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {

    console.error(
      "Profile error:",
      error
    );

    return null;
  }

  return data;
}


/* =========================
   SHOW LOGIN
   ========================= */

function showLogin() {

  if (loginScreen) {
    loginScreen.classList.remove("hidden");
  }

  if (chatScreen) {
    chatScreen.classList.add("hidden");
  }

  if (usernameInput) {
    setTimeout(() => {
      usernameInput.focus();
    }, 100);
  }
}


/* =========================
   SHOW CHAT
   ========================= */

function showChat() {

  if (loginScreen) {
    loginScreen.classList.add("hidden");
  }

  if (chatScreen) {
    chatScreen.classList.remove("hidden");
  }
}


/* =========================
   START CHAT
   ========================= */

async function startChat() {

  if (!currentUser || !currentProfile) {
    return;
  }

  await loadMessages();

  setupRealtime();

  await setupPresence();

  await loadMembers();

  if (messageInput) {
    messageInput.focus();
  }
}


/* =========================
   LOAD MESSAGES
   ========================= */

async function loadMessages() {

  if (!messages) {
    return;
  }

  messages.innerHTML = "";

  const {
    data,
    error
  } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at", {
      ascending: true
    });

  if (error) {

    console.error(
      "Messages error:",
      error
    );

    return;
  }

  for (const message of data || []) {

    await renderMessage(
      message,
      false
    );
  }

  scrollToBottom();
}


/* =========================
   REALTIME MESSAGES
   ========================= */

function setupRealtime() {

  if (realtimeChannel) {

    supabaseClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }


  realtimeChannel =
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

          /*
            Sender already renders their own
            message immediately.
          */

          if (
            payload.new.sender_id ===
            currentUser?.id
          ) {
            return;
          }

          await renderMessage(
            payload.new,
            true
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

          const element =
            document.querySelector(
              `[data-message-id="${payload.old.id}"]`
            );

          if (element) {
            element.remove();
          }
        }
      )

      .subscribe();
}


/* =========================
   PRESENCE
   ========================= */

async function setupPresence() {

  if (!currentUser || !currentProfile) {
    return;
  }

  if (presenceChannel) {

    await supabaseClient.removeChannel(
      presenceChannel
    );

    presenceChannel = null;
  }

  presenceUsers = {};


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


  presenceChannel.on(
    "presence",
    {
      event: "sync"
    },
    () => {
      rebuildPresence();
    }
  );


  presenceChannel.on(
    "presence",
    {
      event: "join"
    },
    () => {
      rebuildPresence();
    }
  );


  presenceChannel.on(
    "presence",
    {
      event: "leave"
    },
    () => {
      rebuildPresence();
    }
  );


  presenceChannel.subscribe(
    async status => {

      if (status === "SUBSCRIBED") {

        await presenceChannel.track({
          user_id: currentUser.id,
          username: currentProfile.username
        });

        rebuildPresence();
      }
    }
  );
}


/* =========================
   REBUILD PRESENCE
   ========================= */

function rebuildPresence() {

  if (!presenceChannel) {
    return;
  }

  const state =
    presenceChannel.presenceState();

  const online = {};


  Object.keys(state).forEach(key => {

    const entries =
      state[key];

    if (
      !entries ||
      entries.length === 0
    ) {
      return;
    }

    const user =
      entries[0];

    if (user.user_id) {

      online[user.user_id] = {
        username:
          user.username ||
          "Unknown"
      };
    }
  });


  presenceUsers =
    online;

  updateOnlineStatus();

  renderMembers();
}


/* =========================
   LOAD MEMBERS
   ========================= */

async function loadMembers() {

  const {
    data,
    error
  } = await supabaseClient
    .from("profiles")
    .select(
      "id, username, created_at"
    )
    .order("created_at", {
      ascending: true
    });

  if (error) {

    console.error(
      "Members error:",
      error
    );

    return;
  }

  allMembers =
    data || [];

  renderMembers();
}


/* =========================
   RENDER MEMBERS
   ========================= */

function renderMembers() {

  if (!membersList) {
    return;
  }

  const count =
    allMembers.length;


  if (memberCount) {

    memberCount.textContent =
      `${count} ${
        count === 1
          ? "member"
          : "members"
      }`;
  }


  membersList.innerHTML = "";


  for (const member of allMembers) {

    const isOnline =
      Boolean(
        presenceUsers[member.id]
      );


    const item =
      document.createElement("div");

    item.className =
      "member";


    const avatar =
      document.createElement("div");

    avatar.className =
      "member-avatar";

    avatar.textContent =
      member.username
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
      member.username;


    const status =
      document.createElement("div");

    status.className =
      "member-status";


    const dot =
      document.createElement("span");

    dot.className =
      "status-dot" +
      (isOnline ? " online" : "");


    const statusText =
      document.createElement("span");

    statusText.textContent =
      isOnline
        ? "Online"
        : "Offline";


    status.appendChild(dot);

    status.appendChild(
      statusText
    );

    info.appendChild(name);

    info.appendChild(status);

    item.appendChild(avatar);

    item.appendChild(info);

    membersList.appendChild(item);
  }


  updateOnlineStatus();
}


/* =========================
   ONLINE STATUS
   ========================= */

function updateOnlineStatus() {

  const count =
    Object.keys(
      presenceUsers
    ).length;


  if (onlineStatus) {

    onlineStatus.textContent =
      `${count} ${
        count === 1
          ? "member"
          : "members"
      } online`;
  }
}


/* =========================
   SIDEBAR
   ========================= */

function openSidebar() {

  if (membersSidebar) {
    membersSidebar.classList.add("open");
  }

  if (sidebarOverlay) {
    sidebarOverlay.classList.add("show");
  }

  renderMembers();
}


function closeSidebar() {

  if (membersSidebar) {
    membersSidebar.classList.remove("open");
  }

  if (sidebarOverlay) {
    sidebarOverlay.classList.remove("show");
  }
}


/* =========================
   SEND MESSAGE
   ========================= */

async function sendMessage() {

  if (sending) {
    return;
  }

  if (!currentUser || !currentProfile) {
    return;
  }

  const text =
    messageInput
      ? messageInput.value.trim()
      : "";

  if (!text) {
    return;
  }

  sending = true;

  if (sendBtn) {
    sendBtn.disabled = true;
  }


  try {

    const {
      data,
      error
    } = await supabaseClient
      .from("messages")
      .insert({
        sender_id:
          currentUser.id,

        sender_name:
          currentProfile.username,

        message_type:
          detectCode(text)
            ? "code"
            : "text",

        message:
          text
      })
      .select()
      .single();


    if (error) {
      throw error;
    }


    /*
      Render immediately.
    */

    await renderMessage(
      data,
      true
    );


    messageInput.value = "";

    playSendSound();

    scrollToBottom();

  } catch (error) {

    console.error(
      "Send message error:",
      error
    );

    alert(
      error.message ||
      "Message could not be sent."
    );

  } finally {

    sending = false;

    if (sendBtn) {
      sendBtn.disabled = false;
    }

    if (messageInput) {
      messageInput.focus();
    }
  }
}


/* =========================
   SEND SOUND
   ========================= */

function playSendSound() {

  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const ctx =
      new AudioContext();

    const oscillator =
      ctx.createOscillator();

    const gain =
      ctx.createGain();


    oscillator.type =
      "sine";


    oscillator.frequency.setValueAtTime(
      850,
      ctx.currentTime
    );


    oscillator.frequency.exponentialRampToValueAtTime(
      1200,
      ctx.currentTime + 0.06
    );


    gain.gain.setValueAtTime(
      0.0001,
      ctx.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
      0.08,
      ctx.currentTime + 0.01
    );


    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + 0.09
    );


    oscillator.connect(gain);

    gain.connect(
      ctx.destination
    );


    oscillator.start();

    oscillator.stop(
      ctx.currentTime + 0.1
    );

  } catch (error) {

    console.log(
      "Sound unavailable."
    );
  }
}


/* =========================
   FILE UPLOAD
   ========================= */

async function handleFileUpload() {

  const file =
    fileInput?.files?.[0];

  if (!file) {
    return;
  }

  if (uploading) {
    return;
  }

  if (!currentUser || !currentProfile) {

    alert(
      "Please join Neural Ninjas first."
    );

    return;
  }


  if (
    file.size >
    50 * 1024 * 1024
  ) {

    alert(
      "File is larger than 50 MB."
    );

    fileInput.value = "";

    return;
  }


  /*
    Only image, video and audio.
  */

  const isAllowed =
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/");


  if (!isAllowed) {

    alert(
      "Only images, videos and audio files are allowed."
    );

    fileInput.value = "";

    return;
  }


  uploading = true;

  if (mediaBtn) {
    mediaBtn.disabled = true;
  }


  try {

    const extension =
      file.name.includes(".")
        ? "." +
          file.name
            .split(".")
            .pop()
            .replace(/[^a-zA-Z0-9]/g, "")
        : "";


    /*
      crypto.randomUUID may not exist
      on some older browsers.
    */

    const randomPart =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random()
            .toString(36)
            .substring(2);


    const safeName =
      `${Date.now()}-${randomPart}${extension}`;


    const path =
      `${currentUser.id}/${safeName}`;


    /*
      Upload file.
    */

    const {
      error: uploadError
    } = await supabaseClient.storage
      .from("neural-ninjas-media")
      .upload(
        path,
        file,
        {
          contentType:
            file.type,

          upsert:
            false
        }
      );


    if (uploadError) {
      throw uploadError;
    }


    /*
      Create signed URL.
    */

    const {
      data: signedData,
      error: signedError
    } = await supabaseClient.storage
      .from("neural-ninjas-media")
      .createSignedUrl(
        path,
        60 * 60 * 24 * 30
      );


    if (signedError) {
      throw signedError;
    }


    /*
      Insert message.
    */

    const {
      data: message,
      error: messageError
    } = await supabaseClient
      .from("messages")
      .insert({
        sender_id:
          currentUser.id,

        sender_name:
          currentProfile.username,

        message_type:
          getMediaType(file.type),

        message:
          file.name,

        file_url:
          signedData.signedUrl
      })
      .select()
      .single();


    if (messageError) {
      throw messageError;
    }


    await renderMessage(
      message,
      true
    );


    playSendSound();

    scrollToBottom();

  } catch (error) {

    console.error(
      "Upload error:",
      error
    );

    alert(
      error.message ||
      "File upload failed."
    );

  } finally {

    uploading = false;

    if (mediaBtn) {
      mediaBtn.disabled = false;
    }

    if (fileInput) {
      fileInput.value = "";
    }
  }
}


/* =========================
   MEDIA TYPE
   ========================= */

function getMediaType(type) {

  if (type.startsWith("image/")) {
    return "image";
  }

  if (type.startsWith("video/")) {
    return "video";
  }

  if (type.startsWith("audio/")) {
    return "audio";
  }

  return "file";
}


/* =========================
   RENDER MESSAGE
   ========================= */

async function renderMessage(
  data,
  shouldScroll = true
) {

  if (!messages || !data) {
    return;
  }


  /*
    Prevent duplicate message.
  */

  const existing =
    document.querySelector(
      `[data-message-id="${data.id}"]`
    );


  if (existing) {
    return;
  }


  const wrapper =
    document.createElement("div");

  wrapper.className =
    "message";


  if (
    data.sender_id ===
    currentUser?.id
  ) {

    wrapper.classList.add(
      "mine"
    );
  }


  wrapper.dataset.messageId =
    data.id;


  const bubble =
    document.createElement("div");

  bubble.className =
    "bubble";


  /*
    Sender.
  */

  const sender =
    document.createElement("div");

  sender.className =
    "sender";

  sender.textContent =
    data.sender_name ||
    "Unknown";


  bubble.appendChild(
    sender
  );


  /*
    Message content.
  */

  if (
    data.message_type === "image" ||
    data.message_type === "video" ||
    data.message_type === "audio"
  ) {

    await renderMedia(
      bubble,
      data
    );

  } else if (
    data.message_type === "code"
  ) {

    renderCode(
      bubble,
      data.message || ""
    );

  } else {

    renderText(
      bubble,
      data.message || ""
    );
  }


  /*
    Time.
  */

  const time =
    document.createElement("div");

  time.className =
    "time";

  time.textContent =
    formatTime(
      data.created_at
    );


  bubble.appendChild(
    time
  );


  /*
    Delete button.
  */

  const deleteButton =
    document.createElement("button");

  deleteButton.className =
    "delete-message";

  deleteButton.textContent =
    "Delete";


  deleteButton.addEventListener(
    "click",
    () => {

      deleteMessage(
        data.id,
        deleteButton,
        wrapper
      );

    }
  );


  bubble.appendChild(
    deleteButton
  );


  wrapper.appendChild(
    bubble
  );

  messages.appendChild(
    wrapper
  );


  if (shouldScroll) {
    scrollToBottom();
  }
}


/* =========================
   TEXT + LINKS
   ========================= */

function renderText(
  container,
  text
) {

  /*
    Detect normal http/https URLs
    and www URLs.
  */

  const urlRegex =
    /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

  let lastIndex = 0;

  let match;


  while (
    (match =
      urlRegex.exec(text)) !== null
  ) {

    const before =
      text.slice(
        lastIndex,
        match.index
      );


    if (before) {

      container.appendChild(
        document.createTextNode(
          before
        )
      );
    }


    let url =
      match[0];

    let trailing = "";


    /*
      Remove punctuation from URL end.
    */

    while (
      /[.,!?;:]$/.test(url)
    ) {

      trailing =
        url.slice(-1) +
        trailing;

      url =
        url.slice(0, -1);
    }


    const link =
      document.createElement("a");

    link.className =
      "message-link";


    link.href =
      url.startsWith("www.")
        ? "https://" + url
        : url;


    link.target =
      "_blank";


    link.rel =
      "noopener noreferrer";


    link.textContent =
      url;


    container.appendChild(
      link
    );


    if (trailing) {

      container.appendChild(
        document.createTextNode(
          trailing
        )
      );
    }


    lastIndex =
      match.index +
      match[0].length;
  }


  const remaining =
    text.slice(lastIndex);


  if (remaining) {

    container.appendChild(
      document.createTextNode(
        remaining
      )
    );
  }
}


/* =========================
   CODE DETECTION
   ========================= */

function detectCode(text) {

  const indicators = [

    "```",

    "function ",

    "const ",

    "let ",

    "var ",

    "=>",

    "<html",

    "<div",

    "<script",

    "SELECT ",

    "INSERT ",

    "UPDATE ",

    "CREATE TABLE",

    "CREATE DATABASE",

    "def ",

    "import ",

    "from ",

    "public class ",

    "console.log",

    "#include",

    "System.out",

    "print("

  ];


  return indicators.some(
    indicator =>
      text.includes(indicator)
  );
}


/* =========================
   CLEAN CODE
   ========================= */

function cleanCode(text) {

  let code =
    String(text || "").trim();


  /*
    Remove opening and closing
    markdown code fences.
  */

  code =
    code.replace(
      /^```[a-zA-Z0-9_-]*\s*/,
      ""
    );


  code =
    code.replace(
      /\s*```$/,
      ""
    );


  return code.trim();
}


/* =========================
   RENDER CODE
   ========================= */

function renderCode(
  container,
  text
) {

  const code =
    cleanCode(text);


  const box =
    document.createElement("div");

  box.className =
    "code-box";


  const pre =
    document.createElement("pre");


  const codeElement =
    document.createElement("code");


  codeElement.textContent =
    code;


  pre.appendChild(
    codeElement
  );


  box.appendChild(
    pre
  );


  /*
    Copy Code button.
  */

  const copyButton =
    document.createElement("button");

  copyButton.className =
    "copy-code";

  copyButton.textContent =
    "Copy Code";


  copyButton.addEventListener(
    "click",
    async () => {

      try {

        if (
          navigator.clipboard &&
          navigator.clipboard.writeText
        ) {

          await navigator.clipboard.writeText(
            code
          );

        } else {

          /*
            Fallback for older browsers.
          */

          const textarea =
            document.createElement(
              "textarea"
            );

          textarea.value =
            code;

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
            "Copy Code";

        }, 1200);

      } catch (error) {

        console.error(
          "Copy error:",
          error
        );

        alert(
          "Copy failed."
        );
      }
    }
  );


  box.appendChild(
    copyButton
  );


  container.appendChild(
    box
  );


  /*
    Highlight.js if available.
  */

  if (
    window.hljs &&
    typeof hljs.highlightElement ===
      "function"
  ) {

    try {

      hljs.highlightElement(
        codeElement
      );

    } catch (error) {

      console.log(
        "Syntax highlighting unavailable."
      );
    }
  }
}


/* =========================
   RENDER MEDIA
   ========================= */

async function renderMedia(
  container,
  data
) {

  if (!data.file_url) {
    return;
  }


  let url =
    data.file_url;


  /*
    Try refreshing expired signed URL.
  */

  const freshUrl =
    await refreshSignedUrl(
      url
    );


  if (freshUrl) {
    url = freshUrl;
  }


  /*
    IMAGE
  */

  if (
    data.message_type ===
    "image"
  ) {

    const image =
      document.createElement(
        "img"
      );

    image.className =
      "chat-media";

    image.src =
      url;

    image.alt =
      data.message ||
      "Image";

    image.loading =
      "lazy";

    container.appendChild(
      image
    );
  }


  /*
    VIDEO
  */

  if (
    data.message_type ===
    "video"
  ) {

    const video =
      document.createElement(
        "video"
      );

    video.className =
      "chat-media";

    video.controls =
      true;

    video.playsInline =
      true;

    video.preload =
      "metadata";

    video.src =
      url;

    container.appendChild(
      video
    );
  }


  /*
    AUDIO
  */

  if (
    data.message_type ===
    "audio"
  ) {

    const audio =
      document.createElement(
        "audio"
      );

    audio.controls =
      true;

    audio.preload =
      "metadata";

    audio.src =
      url;

    container.appendChild(
      audio
    );
  }


  /*
    SAVE MEDIA
  */

  const saveLink =
    document.createElement(
      "a"
    );

  saveLink.className =
    "save-media";

  saveLink.href =
    url;

  saveLink.target =
    "_blank";

  saveLink.rel =
    "noopener noreferrer";

  saveLink.download =
    data.message ||
    "media";

  saveLink.textContent =
    "Save Media";


  container.appendChild(
    saveLink
  );
}


/* =========================
   REFRESH SIGNED URL
   ========================= */

async function refreshSignedUrl(
  url
) {

  try {

    const marker =
      "/storage/v1/object/sign/neural-ninjas-media/";


    const index =
      url.indexOf(marker);


    if (index === -1) {
      return url;
    }


    const rest =
      url.slice(
        index +
        marker.length
      );


    const path =
      rest.split("?")[0];


    const {
      data,
      error
    } = await supabaseClient.storage
      .from("neural-ninjas-media")
      .createSignedUrl(
        decodeURIComponent(path),
        60 * 60 * 24 * 30
      );


    if (
      error ||
      !data ||
      !data.signedUrl
    ) {

      return url;
    }


    return data.signedUrl;

  } catch (error) {

    console.error(
      "Signed URL refresh error:",
      error
    );

    return url;
  }
}


/* =========================
   DELETE MESSAGE
   ========================= */

async function deleteMessage(
  messageId,
  button,
  wrapper
) {

  if (
    !button ||
    button.disabled
  ) {
    return;
  }


  button.disabled =
    true;

  button.textContent =
    "Deleting...";


  try {

    const {
      error
    } = await supabaseClient
      .from("messages")
      .delete()
      .eq(
        "id",
        messageId
      );


    if (error) {
      throw error;
    }


    /*
      Remove immediately.
    */

    if (wrapper) {
      wrapper.remove();
    }

  } catch (error) {

    console.error(
      "Delete error:",
      error
    );

    button.disabled =
      false;

    button.textContent =
      "Delete";


    alert(
      error.message ||
      "Delete failed."
    );
  }
}


/* =========================
   EXIT CHAT
   ========================= */

async function exitChat() {

  /*
    IMPORTANT:
    Do NOT sign out.

    This keeps the anonymous session
    on the device so the same identity
    can return later.
  */

  closeSidebar();


  if (chatScreen) {
    chatScreen.classList.add(
      "hidden"
    );
  }


  if (loginScreen) {
    loginScreen.classList.remove(
      "hidden"
    );
  }


  if (usernameInput) {

    usernameInput.value =
      currentProfile?.username ||
      "";

    usernameInput.focus();
  }


  if (loginStatus) {

    loginStatus.textContent =
      "Your Neural Ninjas session is saved on this device.";
  }
}


/* =========================
   TIME
   ========================= */

function formatTime(
  timestamp
) {

  if (!timestamp) {
    return "";
  }


  const date =
    new Date(timestamp);


  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


/* =========================
   SCROLL
   ========================= */

function scrollToBottom() {

  if (!messages) {
    return;
  }


  requestAnimationFrame(() => {

    messages.scrollTop =
      messages.scrollHeight;

  });
}
