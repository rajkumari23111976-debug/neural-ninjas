/* =========================================================
   NEURAL NINJAS - APP.JS
   Username + 6-Digit PIN Authentication
   Realtime Chat + Online Presence + Last Seen
   ========================================================= */

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";

let supabaseClient = null;

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

let lastSeenTimer = null;

/* =========================================================
   DOM
   ========================================================= */

let loginScreen;
let chatScreen;

let usernameInput;
let pinInput;
let joinBtn;
let loginStatus;

let membersList;
let memberCount;
let onlineStatus;
let deleteAccountBtn;

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

  deleteAccountBtn =
    document.getElementById("deleteAccountBtn");

  if (!supabaseClient) {
    showFatalError(
      "Supabase failed to initialize."
    );
    return;
  }

  if (!usernameInput || !joinBtn) {
    showFatalError(
      "Login elements not found."
    );
    return;
  }

  createPinInput();

  /* -------------------------------------------------------
     EVENTS
     ------------------------------------------------------- */

  joinBtn.addEventListener(
    "click",
    joinTeam
  );

  usernameInput.addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        event.preventDefault();

        pinInput?.focus();
      }

    }
  );

  pinInput.addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        event.preventDefault();

        joinTeam();
      }

    }
  );

  sendBtn?.addEventListener(
    "click",
    sendMessage
  );

  messageInput?.addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        event.preventDefault();

        sendMessage();
      }

    }
  );

  mediaBtn?.addEventListener(
    "click",
    () => fileInput?.click()
  );

  fileInput?.addEventListener(
    "change",
    handleFileUpload
  );

  logoutBtn?.addEventListener(
    "click",
    exitChat
  );

  menuBtn?.addEventListener(
    "click",
    openSidebar
  );

  deleteAccountBtn?.addEventListener(
    "click",
    deleteAccount
  );

  closeSidebarBtn?.addEventListener(
    "click",
    closeSidebar
  );

  sidebarOverlay?.addEventListener(
    "click",
    closeSidebar
  );

  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.visibilityState ===
        "hidden"
      ) {

        updateLastSeen();

      }

    }
  );

  window.addEventListener(
    "beforeunload",
    () => {

      updateLastSeen();

    }
  );

  checkSession();

});

/* =========================================================
   PIN INPUT
   ========================================================= */

function createPinInput() {

  if (
    document.getElementById("pinInput")
  ) {

    pinInput =
      document.getElementById(
        "pinInput"
      );

    return;
  }

  pinInput =
    document.createElement("input");

  pinInput.id =
    "pinInput";

  pinInput.type =
    "password";

  pinInput.inputMode =
    "numeric";

  pinInput.maxLength =
    6;

  pinInput.placeholder =
    "Enter 6-digit PIN";

  pinInput.autocomplete =
    "current-password";

  pinInput.style.marginTop =
    "10px";

  pinInput.style.width =
    "100%";

  pinInput.style.boxSizing =
    "border-box";

  usernameInput.insertAdjacentElement(
    "afterend",
    pinInput
  );

}

/* =========================================================
   HIDDEN AUTH IDENTIFIER
   ========================================================= */

function makeAuthEmail(username) {

  const clean =
    username
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9._-]/g,
        "_"
      );

  return (
    clean +
    "@neuralninjas.local"
  );
}

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
   JOIN / LOGIN
   ========================================================= */

async function joinTeam() {

  if (
    sending ||
    uploading
  ) {
    return;
  }

  const username =
    usernameInput.value.trim();

  const pin =
    pinInput.value.trim();

  if (!username) {

    loginStatus.textContent =
      "Please enter your username.";

    usernameInput.focus();

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

  if (!/^\d{6}$/.test(pin)) {

    loginStatus.textContent =
      "PIN must contain exactly 6 digits.";

    pinInput.focus();

    return;
  }

  joinBtn.disabled =
    true;

  loginStatus.textContent =
    "Checking account...";

  try {

    const authEmail =
      makeAuthEmail(username);

    const loginResult =
      await supabaseClient.auth
        .signInWithPassword({

          email:
            authEmail,

          password:
            pin

        });

    if (
      !loginResult.error &&
      loginResult.data?.user
    ) {

      currentUser =
        loginResult.data.user;

      const profile =
        await getProfile(
          currentUser.id
        );

      if (!profile) {

        await supabaseClient.auth.signOut();

        throw new Error(
          "Account profile is missing."
        );

      }

      currentProfile =
        profile;

      loginStatus.textContent =
        "Login successful. Opening Neural Ninjas...";

      showChat();

      await startChat();

      return;
    }

    loginStatus.textContent =
      "Creating account...";

    const signupResult =
      await supabaseClient.auth
        .signUp({

          email:
            authEmail,

          password:
            pin,

          options: {

            data: {
              neural_ninjas_username:
                username
            }

          }

        });

    if (signupResult.error) {

      const errorMessage =
        signupResult.error.message ||
        "";

      if (
        errorMessage
          .toLowerCase()
          .includes("already")
      ) {

        throw new Error(
          "Incorrect PIN for this username."
        );

      }

      throw signupResult.error;
    }

    if (!signupResult.data?.user) {

      throw new Error(
        "Could not create account."
      );

    }

    if (!signupResult.data?.session) {

      throw new Error(
        "Account created, but login session was not created. Check that email confirmation is disabled in Supabase."
      );

    }

    currentUser =
      signupResult.data.user;

    const {
      data: newProfile,
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .insert({

          id:
            currentUser.id,

          username:
            username,

          last_seen_at:
            new Date().toISOString()

        })
        .select()
        .single();

    if (profileError) {

      await supabaseClient.auth.signOut();

      if (
        profileError.code ===
        "23505"
      ) {

        throw new Error(
          "That username is already in use."
        );

      }

      throw profileError;
    }

    currentProfile =
      newProfile;

    loginStatus.textContent =
      "Account created. Opening Neural Ninjas...";

    showChat();

    await startChat();

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    loginStatus.textContent =
      error?.message ||
      "Could not login.";

  } finally {

    joinBtn.disabled =
      false;

  }

}

/* =========================================================
   DELETE ACCOUNT
   ========================================================= */

async function deleteAccount() {
  const confirmed = confirm(
    "Are you sure you want to permanently delete your Neural Ninjas account?\n\nThis cannot be undone."
  );

  if (!confirmed) {
    return;
  }

  try {
    deleteAccountBtn.disabled = true;
    deleteAccountBtn.textContent = "Deleting...";

    // Get current session
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session || !session.access_token) {
      throw new Error("Your login session has expired. Please login again.");
    }

    console.log("Delete account: session found");

    const functionUrl =
      `${SUPABASE_URL}/functions/v1/super-responder`;

    console.log("Delete account URL:", functionUrl);

    const response = await fetch(functionUrl, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({})
    });

    console.log(
      "Delete account response status:",
      response.status
    );

    const responseText = await response.text();

    console.log(
      "Delete account response:",
      responseText
    );

    let result = {};

    try {
      result = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      result = {
        error: responseText || "Invalid server response"
      };
    }

    if (!response.ok) {
      throw new Error(
        result.error ||
        `Delete failed (${response.status})`
      );
    }

    if (result.success !== true) {
      throw new Error(
        result.error ||
        "Account deletion failed."
      );
    }

    // Remove realtime/presence
    try {
      if (presenceChannel) {
        await supabase.removeChannel(presenceChannel);
        presenceChannel = null;
      }
    } catch (e) {
      console.warn("Presence cleanup:", e);
    }

    try {
      if (realtimeChannel) {
        await supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    } catch (e) {
      console.warn("Realtime cleanup:", e);
    }

    // Stop last-seen timer
    if (lastSeenTimer) {
      clearInterval(lastSeenTimer);
      lastSeenTimer = null;
    }

    // Sign out locally
    await supabase.auth.signOut();

    // Reset app state
    currentUser = null;
    currentProfile = null;
    presenceUsers = {};
    allMembers = [];

    // Clear UI
    messagesEl.innerHTML = "";

    if (usernameInput) {
      usernameInput.value = "";
    }

    if (pinInput) {
      pinInput.value = "";
    }

    loginStatus.textContent = "";

    membersSidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");

    showLogin();

    alert("Your Neural Ninjas account has been deleted successfully.");

  } catch (error) {
    console.error("DELETE ACCOUNT ERROR:", error);

    alert(
      "Failed to delete account.\n\n" +
      (error.message || "Network error. Please try again.")
    );

  } finally {
    deleteAccountBtn.disabled = false;
    deleteAccountBtn.textContent = "Delete Account";
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
      .eq(
        "id",
        userId
      )
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

  startLastSeenTimer();

  await updateLastSeen();

  messageInput?.focus();

}

/* =========================================================
   LOAD MESSAGES
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
   REALTIME MESSAGES
   ========================================================= */

function setupRealtime() {

  if (realtimeChannel) {

    supabaseClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;

  }

  const channelName =
    "neural-ninjas-messages-" +
    currentUser.id +
    "-" +
    Date.now();

  console.log(
    "🔌 Creating realtime channel:",
    channelName
  );

  realtimeChannel =
    supabaseClient
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event:
            "INSERT",

          schema:
            "public",

          table:
            "messages"
        },
        payload => {

          console.log(
            "📨 REALTIME MESSAGE RECEIVED:",
            payload.new
          );

          renderMessage(
            payload.new,
            true
          );

        }
      )
      .on(
        "postgres_changes",
        {
          event:
            "DELETE",

          schema:
            "public",

          table:
            "messages"
        },
        payload => {

          console.log(
            "🗑️ REALTIME DELETE:",
            payload.old
          );

          const element =
            document.querySelector(
              `[data-message-id="${payload.old.id}"]`
            );

          if (element) {
            element.remove();
          }

        }
      )
      .subscribe(
        status => {

          console.log(
            "📡 REALTIME STATUS:",
            status
          );

          if (
            status ===
            "SUBSCRIBED"
          ) {

            console.log(
              "✅ NEURAL NINJAS REALTIME CONNECTED"
            );

          }

          if (
            status ===
            "CHANNEL_ERROR"
          ) {

            console.error(
              "❌ REALTIME CHANNEL ERROR"
            );

          }

          if (
            status ===
            "TIMED_OUT"
          ) {

            console.error(
              "⏱️ REALTIME CONNECTION TIMED OUT"
            );

          }

        }
      );

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

    try {

      await supabaseClient
        .removeChannel(
          presenceChannel
        );

    } catch {}

  }

  presenceUsers = {};

  presenceChannel =
    supabaseClient.channel(
      "neural-ninjas-presence",
      {

        config: {

          presence: {

            key:
              currentUser.id

          }

        }

      }
    );

  presenceChannel.on(
    "presence",
    {
      event:
        "sync"
    },
    rebuildPresence
  );

  presenceChannel.on(
    "presence",
    {
      event:
        "join"
    },
    rebuildPresence
  );

  presenceChannel.on(
    "presence",
    {
      event:
        "leave"
    },
    rebuildPresence
  );

  presenceChannel.subscribe(
    async status => {

      console.log(
        "PRESENCE STATUS:",
        status
      );

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
        "id, username, created_at, last_seen_at"
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

/* =========================================================
   RENDER MEMBERS
   ========================================================= */

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

    if (online) {

      statusText.textContent =
        "Online";

    } else {

      statusText.textContent =
        formatLastSeen(
          member.last_seen_at
        );

    }

    status.appendChild(dot);
    status.appendChild(statusText);

    info.appendChild(name);
    info.appendChild(status);

    item.appendChild(avatar);
    item.appendChild(info);

    membersList.appendChild(item);

  }

  updateOnlineStatus();

}

/* =========================================================
   LAST SEEN FORMAT
   ========================================================= */

function formatLastSeen(timestamp) {

  if (!timestamp) {

    return "Last seen unknown";

  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "Last seen unknown";

  }

  const now =
    new Date();

  const diff =
    now.getTime() -
    date.getTime();

  const minute =
    60 * 1000;

  const hour =
    60 * minute;

  if (diff < minute) {

    return "Last seen just now";

  }

  if (diff < hour) {

    const minutes =
      Math.floor(
        diff / minute
      );

    return `Last seen ${minutes} ${
      minutes === 1
        ? "minute"
        : "minutes"
    } ago`;

  }

  if (
    date.toDateString() ===
    now.toDateString()
  ) {

    return (
      "Last seen today at " +
      date.toLocaleTimeString(
        [],
        {
          hour:
            "2-digit",

          minute:
            "2-digit"
        }
      )
    );

  }

  const yesterday =
    new Date(now);

  yesterday.setDate(
    now.getDate() - 1
  );

  if (
    date.toDateString() ===
    yesterday.toDateString()
  ) {

    return (
      "Last seen yesterday at " +
      date.toLocaleTimeString(
        [],
        {
          hour:
            "2-digit",

          minute:
            "2-digit"
        }
      )
    );

  }

  return (
    "Last seen " +
    date.toLocaleDateString(
      [],
      {
        day:
          "2-digit",

        month:
          "short"
      }
    ) +
    " at " +
    date.toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    )
  );

}

/* =========================================================
   UPDATE LAST SEEN
   ========================================================= */

async function updateLastSeen() {

  if (
    !currentUser
  ) {
    return;
  }

  const now =
    new Date().toISOString();

  try {

    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update({

          last_seen_at:
            now

        })
        .eq(
          "id",
          currentUser.id
        );

    if (error) {

      console.error(
        "Last seen update error:",
        error
      );

      return;
    }

    if (currentProfile) {

      currentProfile.last_seen_at =
        now;

    }

    const member =
      allMembers.find(
        item =>
          item.id ===
          currentUser.id
      );

    if (member) {

      member.last_seen_at =
        now;

    }

    renderMembers();

  } catch (error) {

    console.error(
      "LAST SEEN ERROR:",
      error
    );

  }

}

/* =========================================================
   LAST SEEN TIMER
   ========================================================= */

function startLastSeenTimer() {

  stopLastSeenTimer();

  lastSeenTimer =
    setInterval(
      () => {

        updateLastSeen();

      },
      30000
    );

}

function stopLastSeenTimer() {

  if (lastSeenTimer) {

    clearInterval(
      lastSeenTimer
    );

    lastSeenTimer =
      null;

  }

}

/* =========================================================
   ONLINE COUNT
   ========================================================= */

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
    sendBtn.disabled =
      true;
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

    messageInput.value =
      "";

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

      sendBtn.disabled =
        false;

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
    gain.connect(ctx.destination);

    oscillator.start();

    oscillator.stop(
      ctx.currentTime + 0.1
    );

  } catch {

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

    fileInput.value =
      "";

    return;
  }

  const allowed =
    file.type.startsWith(
      "image/"
    ) ||
    file.type.startsWith(
      "video/"
    ) ||
    file.type.startsWith(
      "audio/"
    );

  if (!allowed) {

    alert(
      "Only images, videos and audio files are allowed."
    );

    fileInput.value =
      "";

    return;
  }

  uploading = true;

  if (mediaBtn) {

    mediaBtn.disabled =
      true;

  }

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
      error: uploadError
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
      data: signedData,
      error: signedError
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
      data: message,
      error: messageError
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

    if (mediaBtn) {

      mediaBtn.disabled =
        false;

    }

    fileInput.value =
      "";

  }

}

function getMediaType(type) {

  if (
    type.startsWith(
      "image/"
    )
  ) {
    return "image";
  }

  if (
    type.startsWith(
      "video/"
    )
  ) {
    return "video";
  }

  if (
    type.startsWith(
      "audio/"
    )
  ) {
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

  bubble.appendChild(
    sender
  );

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

  } else if (
    data.message_type ===
    "code"
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

  bubble.appendChild(
    time
  );

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
    () =>
      deleteMessage(
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
      text.includes(
        indicator
      )
  );

}

function cleanCode(text) {

  let code =
    String(
      text || ""
    ).trim();

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
   DELETE MESSAGE
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
   EXIT / LOGOUT
   ========================================================= */

async function exitChat() {

  closeSidebar();

  stopLastSeenTimer();

  await updateLastSeen();

  if (presenceChannel) {

    try {

      await supabaseClient
        .removeChannel(
          presenceChannel
        );

    } catch {}

    presenceChannel =
      null;

  }

  if (realtimeChannel) {

    try {

      await supabaseClient
        .removeChannel(
          realtimeChannel
        );

    } catch {}

    realtimeChannel =
      null;

  }

  await supabaseClient.auth.signOut();

  currentUser = null;
  currentProfile = null;

  presenceUsers = {};

  showLogin();

  if (usernameInput) {
    usernameInput.value = "";
  }

  if (pinInput) {
    pinInput.value = "";
  }

  if (loginStatus) {

    loginStatus.textContent =
      "Enter your username and PIN to login.";

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
      hour:
        "2-digit",

      minute:
        "2-digit"
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
      event.error ||
      event.message
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
