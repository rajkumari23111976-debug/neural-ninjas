const SUPABASE_URL = "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_KEY = "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";

const supabaseClient = supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

/* =========================
GLOBAL STATE
========================= */

let currentUser = null;
let currentProfile = null;

let realtimeChannel = null;
let presenceChannel = null;

let presenceUsers = {};

let sending = false;
let uploading = false;

/* =========================
DOM
========================= */

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");

const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const loginStatus = document.getElementById("loginStatus");

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");

const sendBtn = document.getElementById("sendBtn");
const mediaBtn = document.getElementById("mediaBtn");
const fileInput = document.getElementById("fileInput");

const logoutBtn = document.getElementById("logoutBtn");

const menuBtn = document.getElementById("menuBtn");
const membersSidebar = document.getElementById("membersSidebar");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const membersList = document.getElementById("membersList");
const memberCount = document.getElementById("memberCount");
const onlineStatus = document.getElementById("onlineStatus");

/* =========================
INITIAL START
========================= */

document.addEventListener("DOMContentLoaded", () => {

joinBtn.addEventListener("click", joinTeam);

sendBtn.addEventListener("click", sendMessage);

mediaBtn.addEventListener("click", () => {
fileInput.click();
});

fileInput.addEventListener("change", handleFileUpload);

messageInput.addEventListener("keydown", event => {

if (event.key === "Enter") {
  event.preventDefault();
  sendMessage();
}

});

usernameInput.addEventListener("keydown", event => {

if (event.key === "Enter") {
  event.preventDefault();
  joinTeam();
}

});

logoutBtn.addEventListener("click", exitChat);

menuBtn.addEventListener("click", openSidebar);

closeSidebarBtn.addEventListener("click", closeSidebar);

sidebarOverlay.addEventListener("click", closeSidebar);

checkSession();

});

/* =========================
SESSION
========================= */

async function checkSession() {

try {

const {
  data: { session }
} = await supabaseClient.auth.getSession();

if (!session) {
  showLogin();
  return;
}

currentUser = session.user;

const profile = await getProfile(currentUser.id);

if (!profile) {

  /*
   The anonymous session exists but its profile
   does not exist anymore.
  */

  await supabaseClient.auth.signOut();

  currentUser = null;

  showLogin();

  return;
}

currentProfile = profile;

showChat();

await startChat();

} catch (error) {

console.error(error);

showLogin();

}

}

/* =========================
JOIN TEAM
========================= */

async function joinTeam() {

if (joinBtn.disabled) {
return;
}

const username = usernameInput.value.trim();

if (!username) {

loginStatus.textContent = "Please enter a username.";

return;

}

if (username.length < 2) {

loginStatus.textContent =
  "Username must be at least 2 characters.";

return;

}

joinBtn.disabled = true;

loginStatus.textContent = "Connecting...";

try {

/*
 First check whether a valid current session already exists.
 This prevents creating a new anonymous identity every time
 the page is opened.
*/

let {
  data: { session }
} = await supabaseClient.auth.getSession();


/*
 If there is no session, create ONE anonymous identity.
*/

if (!session) {

  const {
    data,
    error
  } = await supabaseClient.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  session = data.session;
}


currentUser = session.user;


/*
 Check if this anonymous identity already has a profile.
*/

const existingProfile =
  await getProfile(currentUser.id);


if (existingProfile) {

  /*
   Same browser/session returning.
   We use the existing identity.

   If the entered username is different,
   don't change the existing identity automatically.
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

  currentProfile = existingProfile;

} else {

  /*
   Before creating a new profile, check whether
   the username is already owned by another identity.
  */

  const {
    data: existingUsername,
    error: usernameError
  } = await supabaseClient
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .maybeSingle();


  /*
   If maybeSingle finds multiple rows, the database will
   complain. This should no longer happen because we cleaned
   the duplicates and created the unique lower-case index.
  */

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
   Create profile for this anonymous identity.
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

    /*
     Unique-index race condition protection.
    */

    if (profileError.code === "23505") {

      loginStatus.textContent =
        "That username is already in use.";

      joinBtn.disabled = false;

      return;
    }

    throw profileError;
  }

  currentProfile = newProfile;

}


showChat();

await startChat();

} catch (error) {

console.error(error);

loginStatus.textContent =
  error.message || "Could not join the team.";

}

joinBtn.disabled = false;

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

console.error("Profile error:", error);

return null;

}

return data;
}

/* =========================
SHOW LOGIN
========================= */

function showLogin() {

loginScreen.classList.remove("hidden");

chatScreen.classList.add("hidden");

usernameInput.focus();

}

/* =========================
SHOW CHAT
========================= */

function showChat() {

loginScreen.classList.add("hidden");

chatScreen.classList.remove("hidden");

}

/* =========================
START CHAT
========================= */

async function startChat() {

await loadMessages();

setupRealtime();

await setupPresence();

await loadMembers();

messageInput.focus();

}

/* =========================
LOAD MESSAGES
========================= */

async function loadMessages() {

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

console.error(error);

return;

}

for (const message of data) {

await renderMessage(message, false);

}

scrollToBottom();

}

/* =========================
REALTIME
========================= */

function setupRealtime() {

if (realtimeChannel) {

supabaseClient.removeChannel(
  realtimeChannel
);

}

realtimeChannel =
supabaseClient
.channel("neural-ninjas-messages")

  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages"
    },
    async payload => {

      /*
       Avoid duplicate rendering because the sender
       already renders their own newly inserted message.
      */

      if (
        payload.new.sender_id === currentUser?.id
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

if (presenceChannel) {

await supabaseClient.removeChannel(
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
PRESENCE STATE
========================= */

function rebuildPresence() {

if (!presenceChannel) {
return;
}

const state =
presenceChannel.presenceState();

const online = {};

Object.keys(state).forEach(key => {

const entries = state[key];

if (!entries || !entries.length) {
  return;
}

const user = entries[0];

if (user.user_id) {

  online[user.user_id] = {
    username: user.username || "Unknown"
  };

}

});

presenceUsers = online;

updateOnlineStatus();

renderMembers();

}

/* =========================
LOAD ALL MEMBERS
========================= */

async function loadMembers() {

const {
data,
error
} = await supabaseClient
.from("profiles")
.select("id, username, created_at")
.order("created_at", {
ascending: true
});

if (error) {

console.error("Members error:", error);

return;

}

window.allMembers = data || [];

renderMembers();

}

/* =========================
RENDER MEMBERS
========================= */

function renderMembers() {

const allMembers =
window.allMembers || [];

memberCount.textContent =
"${allMembers.length} ${ allMembers.length === 1 ? "member" : "members" }";

membersList.innerHTML = "";

for (const member of allMembers) {

const isOnline =
  Boolean(
    presenceUsers[member.id]
  );


const item =
  document.createElement("div");

item.className = "member";


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
status.appendChild(statusText);

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

onlineStatus.textContent =
"${count} ${ count === 1 ? "member" : "members" } online";

}

/* =========================
SIDEBAR
========================= */

function openSidebar() {

membersSidebar.classList.add("open");

sidebarOverlay.classList.add("show");

renderMembers();

}

function closeSidebar() {

membersSidebar.classList.remove("open");

sidebarOverlay.classList.remove("show");

}

/* =========================
SEND MESSAGE
========================= */

async function sendMessage() {

if (sending) {
return;
}

const text =
messageInput.value.trim();

if (!text) {
return;
}

sending = true;

sendBtn.disabled = true;

try {

const {
  data,
  error
} = await supabaseClient
  .from("messages")
  .insert({
    sender_id: currentUser.id,
    sender_name: currentProfile.username,
    message_type: detectCode(text)
      ? "code"
      : "text",
    message: text
  })
  .select()
  .single();


if (error) {
  throw error;
}


/*
 Render immediately for sender.
*/

await renderMessage(data, true);

messageInput.value = "";

playSendSound();

scrollToBottom();

} catch (error) {

console.error(error);

alert(
  error.message ||
  "Message could not be sent."
);

}

sending = false;

sendBtn.disabled = false;

messageInput.focus();

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


oscillator.type = "sine";

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
fileInput.files[0];

if (!file) {
return;
}

if (uploading) {
return;
}

if (file.size > 50 * 1024 * 1024) {

alert(
  "File is larger than 50 MB."
);

fileInput.value = "";

return;

}

uploading = true;

mediaBtn.disabled = true;

try {

const extension =
  file.name.includes(".")
    ? "." +
      file.name
        .split(".")
        .pop()
    : "";


const safeName =
  `${Date.now()}-${crypto.randomUUID()}${extension}`;


const path =
  `${currentUser.id}/${safeName}`;


const {
  error: uploadError
} = await supabaseClient.storage
  .from("neural-ninjas-media")
  .upload(
    path,
    file,
    {
      contentType: file.type,
      upsert: false
    }
  );


if (uploadError) {
  throw uploadError;
}


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


const {
  data: message,
  error: messageError
} = await supabaseClient
  .from("messages")
  .insert({
    sender_id: currentUser.id,
    sender_name: currentProfile.username,
    message_type: getMediaType(file.type),
    message: file.name,
    file_url: signedData.signedUrl
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

console.error(error);

alert(
  error.message ||
  "File upload failed."
);

}

uploading = false;

mediaBtn.disabled = false;

fileInput.value = "";

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

if (
document.querySelector(
"[data-message-id="${data.id}"]"
)
) {
return;
}

const wrapper =
document.createElement("div");

wrapper.className = "message";

if (
data.sender_id === currentUser.id
) {

wrapper.classList.add("mine");

}

wrapper.dataset.messageId =
data.id;

const bubble =
document.createElement("div");

bubble.className =
"bubble";

const sender =
document.createElement("div");

sender.className =
"sender";

sender.textContent =
data.sender_name;

bubble.appendChild(sender);

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

const time =
document.createElement("div");

time.className =
"time";

time.textContent =
formatTime(data.created_at);

bubble.appendChild(time);

const deleteButton =
document.createElement("button");

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

bubble.appendChild(deleteButton);

wrapper.appendChild(bubble);

messages.appendChild(wrapper);

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

const urlRegex =
/(https?://[^\s]+|www.[^\s]+)/gi;

let lastIndex = 0;

let match;

while (
(match = urlRegex.exec(text)) !== null
) {

const before =
  text.slice(
    lastIndex,
    match.index
  );


if (before) {

  container.appendChild(
    document.createTextNode(before)
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

link.target = "_blank";

link.rel =
  "noopener noreferrer";

link.textContent =
  url;


container.appendChild(link);


if (trailing) {

  container.appendChild(
    document.createTextNode(trailing)
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
  document.createTextNode(remaining)
);

}

}

/* =========================
CODE
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
"SELECT ",
"INSERT ",
"CREATE TABLE",
"def ",
"import ",
"public class ",
"console.log"
];

return indicators.some(
indicator =>
text.includes(indicator)
);

}

function cleanCode(text) {

return text
.replace(/^"[a-zA-Z0-9_-]*\n?/, "") .replace(/"$/, "")
.trim();

}

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

pre.appendChild(codeElement);

box.appendChild(pre);

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

    await navigator.clipboard.writeText(
      code
    );

    copyButton.textContent =
      "Copied!";

    setTimeout(() => {

      copyButton.textContent =
        "Copy Code";

    }, 1200);

  } catch (error) {

    alert(
      "Copy failed."
    );

  }

}

);

box.appendChild(copyButton);

container.appendChild(box);

if (
window.hljs &&
typeof hljs.highlightElement ===
"function"
) {

hljs.highlightElement(
  codeElement
);

}

}

/* =========================
MEDIA RENDER
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
Existing signed URLs may expire.
Try to extract storage path and create
a fresh signed URL when possible.
*/

const freshUrl =
await refreshSignedUrl(url);

if (freshUrl) {
url = freshUrl;
}

if (
data.message_type === "image"
) {

const image =
  document.createElement("img");

image.className =
  "chat-media";

image.src = url;

image.alt =
  data.message || "Image";

container.appendChild(image);

}

if (
data.message_type === "video"
) {

const video =
  document.createElement("video");

video.className =
  "chat-media";

video.controls = true;

video.playsInline = true;

video.src = url;

container.appendChild(video);

}

if (
data.message_type === "audio"
) {

const audio =
  document.createElement("audio");

audio.controls = true;

audio.src = url;

container.appendChild(audio);

}

const saveLink =
document.createElement("a");

saveLink.className =
"save-media";

saveLink.href =
url;

saveLink.target =
"_blank";

saveLink.rel =
"noopener noreferrer";

saveLink.download =
data.message || "media";

saveLink.textContent =
"Save Media";

container.appendChild(
saveLink
);

}

/* =========================
SIGNED URL REFRESH
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
    index + marker.length
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


if (error) {
  return url;
}


return data.signedUrl;

} catch (error) {

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

if (button.disabled) {
return;
}

button.disabled = true;

button.textContent =
"Deleting...";

try {

const {
  data,
  error
} = await supabaseClient
  .from("messages")
  .delete()
  .eq("id", messageId)
  .select();


if (error) {
  throw error;
}


/*
 Remove immediately.
Realtime DELETE will also arrive,
 but the DOM check prevents problems.
*/

wrapper.remove();

} catch (error) {

console.error(error);

button.disabled = false;

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

This keeps the anonymous identity/session
so the same device can return to the same
Neural Ninjas identity.
*/

closeSidebar();

chatScreen.classList.add("hidden");

loginScreen.classList.remove("hidden");

usernameInput.value =
currentProfile?.username || "";

loginStatus.textContent =
"Your Neural Ninjas session is saved on this device.";

usernameInput.focus();

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

requestAnimationFrame(() => {

messages.scrollTop =
  messages.scrollHeight;

});

}
