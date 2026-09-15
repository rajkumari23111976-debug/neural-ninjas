/* =========================================================
   NEURAL NINJAS - APP.JS
   ========================================================= */

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";


/* =========================================================
   STARTUP CHECK
   ========================================================= */

let supabaseClient;

try {
  if (typeof supabase === "undefined") {
    throw new Error("Supabase library did not load.");
  }

  supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

} catch (error) {
  console.error("STARTUP ERROR:", error);

  window.addEventListener("DOMContentLoaded", () => {
    const status = document.getElementById("loginStatus");

    if (status) {
      status.textContent =
        "App error: " + error.message;
    }
  });
}


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentProfile = null;

let realtimeChannel = null;
let presenceChannel = null;

let presenceUsers = {};
let allMembers = [];

let sending = false;
let uploading = false;


/* =========================================================
   DOM
   ========================================================= */

let loginScreen;
let chatScreen;
let usernameInput;
let joinBtn;
let loginStatus;

let messages;
let messageInput;
let sendBtn;

let mediaBtn;
let fileInput;

let logoutBtn;
let menuBtn;

let membersSidebar;
let closeSidebarBtn;
let sidebarOverlay;

let membersList;
let memberCount;
let onlineStatus;


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

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

  messages =
    document.getElementById("messages");

  messageInput =
    document.getElementById("messageInput");

  sendBtn =
    document.getElementById("sendBtn");

  mediaBtn =
    document.getElementById("mediaBtn");

  fileInput =
    document.getElementById("fileInput");

  logoutBtn =
    document.getElementById("logoutBtn");

  menuBtn =
    document.getElementById("menuBtn");

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

  onlineStatus =
    document.getElementById("onlineStatus");


  /* ---------------------------------
     Check HTML
     --------------------------------- */

  if (!joinBtn) {
    showFatalError("JOIN button not found.");
    return;
  }

  if (!usernameInput) {
    showFatalError("Username input not found.");
    return;
  }

  if (!supabaseClient) {
    showFatalError("Supabase failed to initialize.");
    return;
  }


  /* ---------------------------------
     Events
     --------------------------------- */

  joinBtn.addEventListener(
    "click",
    joinTeam
  );


  usernameInput.addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {
        event.preventDefault();
        joinTeam();
      }

    }
  );


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
          event.preventDefault();
          sendMessage();
        }

      }
    );
  }


  if (mediaBtn && fileInput) {

    mediaBtn.addEventListener(
      "click",
      () => fileInput.click()
    );

  }


  if (fileInput) {

    fileInput.addEventListener(
      "change",
      handleFileUpload
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


  /* ---------------------------------
     Start
     --------------------------------- */

  checkSession();

});


/* =========================================================
   FATAL ERROR
   ========================================================= */

function showFatalError(message) {

  console.error(message);

  if (loginStatus) {
    loginStatus.textContent =
      "⚠️ " + message;
  }

}


/* =========================================================
   SESSION
   ========================================================= */

async function checkSession() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();


    if (error) {
      throw error;
    }


    const session =
      data?.session;


    if (!session) {
      showLogin();
      return;
    }


    currentUser =
      session.user;


    const profile =
      await getProfile(
        currentUser.id
      );


    if (!profile) {

      await supabaseClient.auth.signOut();

      currentUser = null;
      currentProfile = null;

      showLogin();

      return;
    }


    currentProfile =
      profile;


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


/* =========================================================
   JOIN
   ========================================================= */

async function joinTeam() {

  console.log("JOIN TEAM CLICKED");


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

    /* ---------------------------------
       Get session
       --------------------------------- */

    let {
      data,
      error
    } =
      await supabaseClient.auth.getSession();


    if (error) {
      throw error;
    }


    let session =
      data?.session;


    /* ---------------------------------
       Anonymous login
       --------------------------------- */

    if (!session) {

      loginStatus.textContent =
        "Creating secure session...";


      const result =
        await supabaseClient.auth
          .signInAnonymously();


      if (result.error) {
        throw result.error;
      }


      session =
        result.data?.session;

    }


    if (!session?.user) {

      throw new Error(
        "Could not create session."
      );

    }


    currentUser =
      session.user;


    /* ---------------------------------
       Existing profile
       --------------------------------- */

    const existingProfile =
      await getProfile(
        currentUser.id
      );


    if (existingProfile) {

      if (
        existingProfile.username
          .toLowerCase() !==
        username.toLowerCase()
      ) {

        loginStatus.textContent =
          `This device is already logged in as "${existingProfile.username}".`;

        joinBtn.disabled = false;

        return;
      }


      currentProfile =
        existingProfile;

    }


    /* ---------------------------------
       New profile
       --------------------------------- */

    else {

      loginStatus.textContent =
        "Creating your Neural Ninjas profile...";


      const {
        data: existingUsername,
        error: usernameError
      } =
        await supabaseClient
          .from("profiles")
          .select("id, username")
          .ilike(
            "username",
            username
          )
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


      const {
        data: newProfile,
        error: profileError
      } =
        await supabaseClient
          .from("profiles")
          .insert({
            id: currentUser.id,
            username: username
          })
          .select()
          .single();


      if (profileError) {

        if (
          profileError.code ===
          "23505"
        ) {

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


    /* ---------------------------------
       Open chat
       --------------------------------- */

    loginStatus.textContent =
      "Opening Neural Ninjas...";


    showChat();

    await startChat();


  } catch (error) {

    console.error(
      "JOIN ERROR:",
      error
    );


    loginStatus.textContent =
      error?.message ||
      "Could not join Neural Ninjas.";


  } finally {

    joinBtn.disabled =
      false;

  }

}


/* =========================================================
   PROFILE
   ========================================================= */

async function getProfile(userId) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();


  if (error) {

    console.error(
      "Profile error:",
      error
    );

    throw error;

  }


  return data;

}


/* =========================================================
   LOGIN / CHAT
   ========================================================= */

function showLogin() {

  loginScreen?.classList.remove(
    "hidden"
  );

  chatScreen?.classList.add(
    "hidden"
  );

}


function showChat() {

  loginScreen?.classList.add(
    "hidden"
  );

  chatScreen?.classList.remove(
    "hidden"
  );

}


/* =========================================================
   CHAT START
   ========================================================= */

async function startChat() {

  if (
    !currentUser ||
    !currentProfile
  ) {
    return;
  }


  await loadMessages();

  setupRealtime();

  await setupPresence();

  await loadMembers();


  messageInput?.focus();

}


/* =========================================================
   MESSAGES
   ========================================================= */

async function loadMessages() {

  if (!messages) {
    return;
  }


  messages.innerHTML = "";


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
      "Messages error:",
      error
    );

    return;
  }


  for (
    const message
    of data || []
  ) {

    renderMessage(
      message,
      false
    );

  }


  scrollToBottom();

}


/* =========================================================
   REALTIME
   ========================================================= */

function setupRealtime() {

  if (realtimeChannel) {

    supabaseClient.removeChannel(
      realtimeChannel
    );

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
        payload => {

          if (
            payload.new.sender_id ===
            currentUser?.id
          ) {
            return;
          }


          renderMessage(
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


          element?.remove();

        }
      )


      .subscribe();

}


/* =========================================================
   PRESENCE
   ========================================================= */

async function setupPresence() {

  if (
    !currentUser ||
    !currentProfile
  ) {
    return;
  }


  if (presenceChannel) {

    await supabaseClient
      .removeChannel(
        presenceChannel
      );

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
    rebuildPresence
  );


  presenceChannel.on(
    "presence",
    {
      event: "join"
    },
    rebuildPresence
  );


  presenceChannel.on(
    "presence",
    {
      event: "leave"
    },
    rebuildPresence
  );


  presenceChannel.subscribe(
    async status => {

      if (
        status ===
        "SUBSCRIBED"
      ) {

        await presenceChannel.track({
          user_id:
            currentUser.id,

          username:
            currentProfile.username
        });


        rebuildPresence();

      }

    }
  );

}


/* =========================================================
   PRESENCE REBUILD
   ========================================================= */

function rebuildPresence() {

  if (!presenceChannel) {
    return;
  }


  const state =
    presenceChannel.presenceState();


  const online = {};


  Object.keys(state)
    .forEach(key => {

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
        "id, username, created_at"
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


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


  for (
    const member
    of allMembers
  ) {

    const online =
      Boolean(
        presenceUsers[
          member.id
        ]
      );


    const item =
      document.createElement(
        "div"
      );

    item.className =
      "member";


    const avatar =
      document.createElement(
        "div"
      );

    avatar.className =
      "member-avatar";


    avatar.textContent =
      member.username
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
        "div"
      );

    name.className =
      "member-name";


    name.textContent =
      member.username;


    const status =
      document.createElement(
        "div"
      );

    status.className =
      "member-status";


    const dot =
      document.createElement(
        "span"
      );

    dot.className =
      "status-dot" +
      (
        online
          ? " online"
          : ""
      );


    const statusText =
      document.createElement(
        "span"
      );


    statusText.textContent =
      online
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

  renderMembers();

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
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

  if (
    sending ||
    !currentUser ||
    !currentProfile
  ) {
    return;
  }


  const text =
    messageInput?.value.trim();


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
    } =
      await supabaseClient
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


    renderMessage(
      data,
      true
    );


    messageInput.value = "";

    playSendSound();


  } catch (error) {

    console.error(
      "Send error:",
      error
    );


    alert(
      error?.message ||
      "Message could not be sent."
    );


  } finally {

    sending = false;

    if (sendBtn) {
      sendBtn.disabled = false;
    }

    messageInput?.focus();

  }

}


/* =========================================================
   SOUND
   ========================================================= */

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
      "Sound unavailable"
    );

  }

}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

async function handleFileUpload() {

  const file =
    fileInput?.files?.[0];


  if (!file) {
    return;
  }


  if (
    uploading ||
    !currentUser ||
    !currentProfile
  ) {
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


  const allowed =
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/");


  if (!allowed) {

    alert(
      "Only images, videos and audio files are allowed."
    );

    fileInput.value = "";

    return;
  }


  uploading = true;

  mediaBtn &&
    (mediaBtn.disabled = true);


  try {

    const extension =
      file.name.includes(".")
        ? "." +
          file.name
            .split(".")
            .pop()
            .replace(
              /[^a-zA-Z0-9]/g,
              ""
            )
        : "";


    const random =
      Math.random()
        .toString(36)
        .substring(2);


    const path =
      `${currentUser.id}/${Date.now()}-${random}${extension}`;


    const {
      error:
        uploadError
    } =
      await supabaseClient.storage
        .from(
          "neural-ninjas-media"
        )
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


    const {
      data:
        signedData,
      error:
        signedError
    } =
      await supabaseClient.storage
        .from(
          "neural-ninjas-media"
        )
        .createSignedUrl(
          path,
          60 * 60 * 24 * 30
        );


    if (signedError) {
      throw signedError;
    }


    const {
      data:
        message,
      error:
        messageError
    } =
      await supabaseClient
        .from("messages")
        .insert({
          sender_id:
            currentUser.id,

          sender_name:
            currentProfile.username,

          message_type:
            getMediaType(
              file.type
            ),

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


    renderMessage(
      message,
      true
    );


    playSendSound();


  } catch (error) {

    console.error(
      "Upload error:",
      error
    );


    alert(
      error?.message ||
      "File upload failed."
    );


  } finally {

    uploading = false;

    mediaBtn &&
      (mediaBtn.disabled = false);

    fileInput.value = "";

  }

}


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


/* =========================================================
   RENDER MESSAGE
   ========================================================= */

function renderMessage(
  data,
  shouldScroll = true
) {

  if (
    !messages ||
    !data
  ) {
    return;
  }


  const existing =
    document.querySelector(
      `[data-message-id="${data.id}"]`
    );


  if (existing) {
    return;
  }


  const wrapper =
    document.createElement(
      "div"
    );


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
    document.createElement(
      "div"
    );


  bubble.className =
    "bubble";


  const sender =
    document.createElement(
      "div"
    );


  sender.className =
    "sender";


  sender.textContent =
    data.sender_name ||
    "Unknown";


  bubble.appendChild(sender);


  if (
    data.message_type ===
      "image" ||
    data.message_type ===
      "video" ||
    data.message_type ===
      "audio"
  ) {

    renderMedia(
      bubble,
      data
    );

  }

  else if (
    data.message_type ===
    "code"
  ) {

    renderCode(
      bubble,
      data.message || ""
    );

  }

  else {

    renderText(
      bubble,
      data.message || ""
    );

  }


  const time =
    document.createElement(
      "div"
    );


  time.className =
    "time";


  time.textContent =
    formatTime(
      data.created_at
    );


  bubble.appendChild(time);


  const deleteButton =
    document.createElement(
      "button"
    );


  deleteButton.className =
    "delete-message";


  deleteButton.textContent =
    "Delete";


  deleteButton.addEventListener(
    "click",
    () => deleteMessage(
      data.id,
      deleteButton,
      wrapper
    )
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


/* =========================================================
   TEXT
   ========================================================= */

function renderText(
  container,
  text
) {

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


    while (
      /[.,!?;:]$/.test(url)
    ) {

      trailing =
        url.slice(-1) +
        trailing;

      url =
        url.slice(
          0,
          -1
        );

    }


    const link =
      document.createElement(
        "a"
      );


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
    text.slice(
      lastIndex
    );


  if (remaining) {

    container.appendChild(
      document.createTextNode(
        remaining
      )
    );

  }

}


/* =========================================================
   CODE
   ========================================================= */

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


function cleanCode(text) {

  let code =
    String(text || "").trim();


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


function renderCode(
  container,
  text
) {

  const box =
    document.createElement(
      "div"
    );


  box.className =
    "code-box";


  const pre =
    document.createElement(
      "pre"
    );


  const codeElement =
    document.createElement(
      "code"
    );


  codeElement.textContent =
    cleanCode(text);


  pre.appendChild(
    codeElement
  );


  box.appendChild(
    pre
  );


  const copyButton =
    document.createElement(
      "button"
    );


  copyButton.className =
    "copy-code";


  copyButton.textContent =
    "Copy Code";


  copyButton.addEventListener(
    "click",
    async () => {

      try {

        await navigator.clipboard.writeText(
          codeElement.textContent
        );


        copyButton.textContent =
          "Copied!";


        setTimeout(
          () => {
            copyButton.textContent =
              "Copy Code";
          },
          1200
        );


      } catch {

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


  if (
    window.hljs &&
    typeof hljs.highlightElement ===
      "function"
  ) {

    try {

      hljs.highlightElement(
        codeElement
      );

    } catch {}

  }

}


/* =========================================================
   MEDIA
   ========================================================= */

function renderMedia(
  container,
  data
) {

  if (!data.file_url) {
    return;
  }


  const url =
    data.file_url;


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


  const save =
    document.createElement(
      "a"
    );


  save.className =
    "save-media";


  save.href =
    url;


  save.target =
    "_blank";


  save.rel =
    "noopener noreferrer";


  save.download =
    data.message ||
    "media";


  save.textContent =
    "Save Media";


  container.appendChild(
    save
  );

}


/* =========================================================
   DELETE
   ========================================================= */

async function deleteMessage(
  id,
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
    } =
      await supabaseClient
        .from("messages")
        .delete()
        .eq(
          "id",
          id
        );


    if (error) {
      throw error;
    }


    wrapper?.remove();


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
      error?.message ||
      "Delete failed."
    );

  }

}


/* =========================================================
   EXIT
   ========================================================= */

function exitChat() {

  closeSidebar();

  chatScreen?.classList.add(
    "hidden"
  );

  loginScreen?.classList.remove(
    "hidden"
  );


  if (usernameInput) {

    usernameInput.value =
      currentProfile?.username ||
      "";

  }


  if (loginStatus) {

    loginStatus.textContent =
      "Your session is saved on this device.";

  }

}


/* =========================================================
   TIME
   ========================================================= */

function formatTime(timestamp) {

  if (!timestamp) {
    return "";
  }


  return new Date(
    timestamp
  ).toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

  if (!messages) {
    return;
  }


  requestAnimationFrame(
    () => {
      messages.scrollTop =
        messages.scrollHeight;
    }
  );

}


/* =========================================================
   GLOBAL ERROR DISPLAY
   ========================================================= */

window.addEventListener(
  "error",
  event => {

    console.error(
      "GLOBAL ERROR:",
      event.error || event.message
    );


    if (
      loginStatus &&
      !currentProfile
    ) {

      loginStatus.textContent =
        "⚠️ JavaScript error: " +
        event.message;

    }

  }
);


window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "PROMISE ERROR:",
      event.reason
    );


    if (
      loginStatus &&
      !currentProfile
    ) {

      loginStatus.textContent =
        "⚠️ " +
        (
          event.reason?.message ||
          "Something went wrong."
        );

    }

  }
);
