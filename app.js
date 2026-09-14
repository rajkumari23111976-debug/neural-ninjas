// ======================================================
// NEURAL NINJAS
// Text + Images + Videos + Audio + Code
// No Voice Recording
// ======================================================


// ======================================================
// SUPABASE CONFIG
// ======================================================

const SUPABASE_URL =
  "https://uzletbnjofnxwmlgvnxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZevxyTcnHnMhI6QlgWRk9w_K3Ve3syl";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


// ======================================================
// DOM
// ======================================================

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

const logoutBtn =
  document.getElementById("logoutBtn");

const messagesBox =
  document.getElementById("messages");

const onlineStatus =
  document.getElementById("onlineStatus");

const messageInput =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");

const mediaBtn =
  document.getElementById("mediaBtn");

const fileInput =
  document.getElementById("fileInput");


// ======================================================
// GLOBAL
// ======================================================

let currentUser = null;

let currentUsername = null;

let realtimeChannel = null;


// ======================================================
// START
// ======================================================

window.addEventListener(
  "load",
  async function () {

    console.log(
      "🥷 Neural Ninjas loaded"
    );

    await checkSession();

  }
);


// ======================================================
// SESSION
// ======================================================

async function checkSession() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();


    if (error) {

      console.error(error);

      showLogin();

      return;

    }


    if (!data.session) {

      showLogin();

      return;

    }


    currentUser =
      data.session.user;


    const profile =
      await getProfile();


    if (!profile) {

      showLogin();

      return;

    }


    currentUsername =
      profile.username;


    showChat();

    await loadMessages();

    subscribeRealtime();


  } catch (error) {

    console.error(
      "Session error:",
      error
    );

    showLogin();

  }

}


// ======================================================
// JOIN TEAM
// ======================================================

joinBtn.addEventListener(
  "click",
  joinTeam
);


usernameInput.addEventListener(
  "keydown",
  function (event) {

    if (event.key === "Enter") {

      event.preventDefault();

      joinTeam();

    }

  }
);


async function joinTeam() {

  const username =
    usernameInput.value.trim();


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


  joinBtn.disabled = true;

  loginStatus.textContent =
    "Joining Neural Ninjas...";


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInAnonymously();


    if (error) {

      throw error;

    }


    currentUser =
      data.user;


    const {
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .insert({

          id:
            currentUser.id,

          username:
            username

        });


    if (profileError) {

      const existingProfile =
        await getProfile();


      if (!existingProfile) {

        throw profileError;

      }


      currentUsername =
        existingProfile.username;

    } else {

      currentUsername =
        username;

    }


    showChat();

    await loadMessages();

    subscribeRealtime();


  } catch (error) {

    console.error(error);

    loginStatus.textContent =
      "Error: " + error.message;


  } finally {

    joinBtn.disabled = false;

  }

}


// ======================================================
// PROFILE
// ======================================================

async function getProfile() {

  if (!currentUser) {

    return null;

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("username")
      .eq(
        "id",
        currentUser.id
      )
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


// ======================================================
// SHOW LOGIN
// ======================================================

function showLogin() {

  loginScreen.classList.remove(
    "hidden"
  );

  chatScreen.classList.add(
    "hidden"
  );

}


// ======================================================
// SHOW CHAT
// ======================================================

function showChat() {

  loginScreen.classList.add(
    "hidden"
  );

  chatScreen.classList.remove(
    "hidden"
  );

  onlineStatus.textContent =
    "● Connected";

}


// ======================================================
// LOGOUT
// ======================================================

logoutBtn.addEventListener(
  "click",
  async function () {

    try {

      if (realtimeChannel) {

        await supabaseClient
          .removeChannel(
            realtimeChannel
          );

        realtimeChannel =
          null;

      }


      await supabaseClient.auth
        .signOut();


      currentUser = null;

      currentUsername = null;


      messagesBox.innerHTML = "";

      usernameInput.value = "";


      showLogin();


    } catch (error) {

      console.error(error);

    }

  }
);


// ======================================================
// LOAD MESSAGES
// ======================================================

async function loadMessages() {

  messagesBox.innerHTML = "";


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
      "Load messages error:",
      error
    );

    return;

  }


  for (
    const message of data
  ) {

    renderMessage(message);

  }


  scrollToBottom();

}


// ======================================================
// REALTIME
// ======================================================

function subscribeRealtime() {

  if (realtimeChannel) {

    supabaseClient
      .removeChannel(
        realtimeChannel
      );

  }


  realtimeChannel =
    supabaseClient
      .channel(
        "neural-ninjas-chat"
      )


      // INSERT
      .on(

        "postgres_changes",

        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },

        function (payload) {

          renderMessage(
            payload.new
          );

          scrollToBottom();

        }

      )


      // DELETE
      .on(

        "postgres_changes",

        {
          event: "DELETE",
          schema: "public",
          table: "messages"
        },

        function (payload) {

          removeMessageFromScreen(
            payload.old.id
          );

        }

      )


      .subscribe(
        function (status) {

          console.log(
            "Realtime:",
            status
          );


          if (
            status ===
            "SUBSCRIBED"
          ) {

            onlineStatus.textContent =
              "● Connected";

          }

        }
      );

}


// ======================================================
// SEND TEXT
// ======================================================

sendBtn.addEventListener(
  "click",
  sendTextMessage
);


messageInput.addEventListener(
  "keydown",
  function (event) {

    if (
      event.key === "Enter"
    ) {

      event.preventDefault();

      sendTextMessage();

    }

  }
);


async function sendTextMessage() {

  const text =
    messageInput.value.trim();


  if (!text) {

    return;

  }


  if (!currentUser) {

    alert(
      "Please join the team first."
    );

    return;

  }


  sendBtn.disabled = true;


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
            currentUsername,

          message_type:
            detectMessageType(text),

          message:
            cleanCodeMessage(text)

        })
        .select()
        .single();


    if (error) {

      throw error;

    }


    // Sender ko immediately message dikhao
    if (data) {

      renderMessage(data);

      scrollToBottom();

    }


    messageInput.value = "";


  } catch (error) {

    console.error(
      "Message error:",
      error
    );


    alert(
      "Message send failed:\n" +
      error.message
    );


  } finally {

    sendBtn.disabled = false;

    messageInput.focus();

  }

}


// ======================================================
// DETECT CODE
// ======================================================

function detectMessageType(text) {

  if (
    text.startsWith("```") &&
    text.endsWith("```")
  ) {

    return "code";

  }


  return "text";

}


// ======================================================
// CLEAN CODE
// ======================================================

function cleanCodeMessage(text) {

  if (
    text.startsWith("```") &&
    text.endsWith("```")
  ) {

    return text
      .replace(
        /^```[a-zA-Z0-9_-]*\n?/,
        ""
      )
      .replace(
        /```$/,
        ""
      )
      .trim();

  }


  return text;

}


// ======================================================
// MEDIA BUTTON
// ======================================================

mediaBtn.addEventListener(
  "click",
  function () {

    fileInput.click();

  }
);


fileInput.addEventListener(
  "change",
  async function () {

    const file =
      fileInput.files[0];


    if (!file) {

      return;

    }


    await uploadMedia(file);


    fileInput.value = "";

  }
);


// ======================================================
// UPLOAD MEDIA
// ======================================================

async function uploadMedia(file) {

  if (!currentUser) {

    return;

  }


  try {

    mediaBtn.disabled = true;

    mediaBtn.textContent =
      "⏳";


    const extension =
      getFileExtension(
        file.name
      );


    const filePath =
      currentUser.id +
      "/" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2) +
      extension;


    const {
      error: uploadError
    } =
      await supabaseClient
        .storage
        .from(
          "neural-ninjas-media"
        )
        .upload(
          filePath,
          file
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


    let messageType =
      "file";


    if (
      file.type.startsWith(
        "image/"
      )
    ) {

      messageType =
        "image";

    }

    else if (
      file.type.startsWith(
        "video/"
      )
    ) {

      messageType =
        "video";

    }

    else if (
      file.type.startsWith(
        "audio/"
      )
    ) {

      messageType =
        "audio";

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
            currentUsername,

          message_type:
            messageType,

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


    // Sender ko media bhi immediately dikhao
    if (messageData) {

      renderMessage(messageData);

      scrollToBottom();

    }


  } catch (error) {

    console.error(
      "Upload error:",
      error
    );


    alert(
      "Upload failed:\n" +
      error.message
    );


  } finally {

    mediaBtn.disabled = false;

    mediaBtn.textContent =
      "＋";

  }

}


// ======================================================
// FILE EXTENSION
// ======================================================

function getFileExtension(
  filename
) {

  const index =
    filename.lastIndexOf(".");


  if (index === -1) {

    return "";

  }


  return filename.substring(
    index
  );

}


// ======================================================
// RENDER MESSAGE
// ======================================================

function renderMessage(message) {

  if (
    document.querySelector(
      `[data-message-id="${message.id}"]`
    )
  ) {

    return;

  }


  const wrapper =
    document.createElement("div");


  wrapper.className =
    "message";


  wrapper.dataset.messageId =
    message.id;


  if (
    message.sender_id ===
    currentUser?.id
  ) {

    wrapper.classList.add(
      "mine"
    );

  }


  const bubble =
    document.createElement("div");


  bubble.className =
    "bubble";


  const sender =
    document.createElement("div");


  sender.className =
    "sender";


  sender.textContent =
    message.sender_name ||
    "Unknown";


  bubble.appendChild(
    sender
  );


  switch (
    message.message_type
  ) {

    case "image":

      renderImage(
        bubble,
        message
      );

      break;


    case "video":

      renderVideo(
        bubble,
        message
      );

      break;


    case "audio":

      renderAudio(
        bubble,
        message
      );

      break;


    case "code":

      renderCode(
        bubble,
        message.message || ""
      );

      break;


    default:

      renderText(
        bubble,
        message.message || ""
      );
      break;

  }


  const time =
    document.createElement("div");


  time.className =
    "time";


  time.textContent =
    formatTime(
      message.created_at
    );


  bubble.appendChild(
    time
  );


  // ====================================================
  // DELETE BUTTON
  // ====================================================

  const deleteButton =
    document.createElement("button");


  deleteButton.className =
    "delete-message";


  deleteButton.textContent =
    "Delete";


  deleteButton.addEventListener(
    "click",
    async function () {

      await deleteMessage(
        message.id,
        deleteButton
      );

    }
  );


  bubble.appendChild(
    deleteButton
  );


  wrapper.appendChild(
    bubble
  );


  messagesBox.appendChild(
    wrapper
  );


  if (
    typeof hljs !==
    "undefined"
  ) {

    wrapper
      .querySelectorAll(
        "pre code"
      )
      .forEach(
        function (block) {

          hljs.highlightElement(
            block
          );

        }
      );

  }

}


// ======================================================
// TEXT
// ======================================================

function renderText(
  container,
  text
) {
  
  const element =
    document.createElement("div");
  
  element.className =
    "text";
  
  
  const urlRegex =
    /(https?:\/\/[^\s]+)/g;
  
  
  let lastIndex = 0;
  
  let match;
  
  
  while (
    (match =
      urlRegex.exec(text)) !== null
  ) {
    
    // Normal text before URL
    if (
      match.index >
      lastIndex
    ) {
      
      element.appendChild(
        document.createTextNode(
          text.substring(
            lastIndex,
            match.index
          )
        )
      );
      
    }
    
    
    // Clickable URL
    const link =
      document.createElement("a");
    
    
    link.href =
      match[0];
    
    link.textContent =
      match[0];
    
    link.target =
      "_blank";
    
    link.rel =
      "noopener noreferrer";
    
    
    // High-contrast link style
    link.style.color =
      "#00e5ff";
    
    link.style.fontWeight =
      "600";
    
    link.style.textDecoration =
      "underline";
    
    link.style.textDecorationThickness =
      "2px";
    
    link.style.textUnderlineOffset =
      "3px";
    
    
    // Touch/click feedback
    link.addEventListener(
      "touchstart",
      function() {
        
        link.style.color =
          "#ffffff";
        
      }
    );
    
    
    link.addEventListener(
      "touchend",
      function() {
        
        link.style.color =
          "#00e5ff";
        
      }
    );
    
    
    element.appendChild(
      link
    );
    
    
    lastIndex =
      urlRegex.lastIndex;
    
  }
  
  
  // Remaining text
  if (
    lastIndex <
    text.length
  ) {
    
    element.appendChild(
      document.createTextNode(
        text.substring(
          lastIndex
        )
      )
    );
    
  }
  
  
  // Message without URL
  if (
    lastIndex === 0
  ) {
    
    element.textContent =
      text;
    
  }
  
  
  container.appendChild(
    element
  );
  
}


// ======================================================
// CODE
// ======================================================

function renderCode(
  container,
  code
) {

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


  const copyButton =
    document.createElement("button");


  copyButton.className =
    "copy-code";


  copyButton.textContent =
    "Copy Code";


  copyButton.addEventListener(
    "click",
    async function () {

      try {

        await navigator.clipboard
          .writeText(code);


        copyButton.textContent =
          "Copied!";


        setTimeout(
          function () {

            copyButton.textContent =
              "Copy Code";

          },
          1500
        );


      } catch (error) {

        alert(
          "Copy failed."
        );

      }

    }
  );


  box.appendChild(
    pre
  );


  box.appendChild(
    copyButton
  );


  container.appendChild(
    box
  );

}


// ======================================================
// IMAGE
// ======================================================

function renderImage(
  container,
  message
) {

  const image =
    document.createElement("img");


  image.className =
    "chat-media";


  image.src =
    message.file_url;


  image.alt =
    message.message ||
    "Image";


  image.loading =
    "lazy";


  image.addEventListener(
    "click",
    function () {

      window.open(
        message.file_url,
        "_blank"
      );

    }
  );


  container.appendChild(
    image
  );


  addSaveButton(
    container,
    message.file_url,
    message.message ||
      "image"
  );

}


// ======================================================
// VIDEO
// ======================================================

function renderVideo(
  container,
  message
) {

  const video =
    document.createElement("video");


  video.className =
    "chat-media";


  video.src =
    message.file_url;


  video.controls = true;

  video.playsInline = true;


  container.appendChild(
    video
  );


  addSaveButton(
    container,
    message.file_url,
    message.message ||
      "video"
  );

}


// ======================================================
// AUDIO FILE
// ======================================================

function renderAudio(
  container,
  message
) {

  const audio =
    document.createElement("audio");


  audio.src =
    message.file_url;


  audio.controls = true;


  container.appendChild(
    audio
  );


  addSaveButton(
    container,
    message.file_url,
    message.message ||
      "audio"
  );

}


// ======================================================
// SAVE MEDIA
// ======================================================

function addSaveButton(
  container,
  url,
  filename
) {

  const button =
    document.createElement("a");


  button.className =
    "copy-code";


  button.textContent =
    "Save Media";


  button.href =
    url;


  button.target =
    "_blank";


  button.rel =
    "noopener";


  button.download =
    filename;


  container.appendChild(
    button
  );

}


// ======================================================
// DELETE MESSAGE
// ======================================================

async function deleteMessage(
  messageId,
  button
) {

  if (
    !confirm(
      "Delete this message?"
    )
  ) {

    return;

  }


  if (!currentUser) {

    alert(
      "Please join the team first."
    );

    return;

  }


  button.disabled = true;


  try {

    console.log(
      "Deleting message:",
      messageId
    );


    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .delete()
        .eq(
          "id",
          messageId
        )
        .select();


    if (error) {

      throw error;

    }


    console.log(
      "Delete response:",
      data
    );


    // Agar row delete hui hai
    if (
      data &&
      data.length > 0
    ) {

      removeMessageFromScreen(
        messageId
      );

    } else {

      // Realtime available ho to bhi
      // UI ko immediately remove kar do
      removeMessageFromScreen(
        messageId
      );

    }


  } catch (error) {

    console.error(
      "Delete error:",
      error
    );


    alert(
      "Delete failed:\n" +
      error.message
    );


    button.disabled = false;

  }

}


// ======================================================
// REMOVE MESSAGE FROM SCREEN
// ======================================================

function removeMessageFromScreen(
  messageId
) {

  const element =
    document.querySelector(
      `[data-message-id="${messageId}"]`
    );


  if (element) {

    element.remove();

  }

}


// ======================================================
// TIME
// ======================================================

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


// ======================================================
// SCROLL
// ======================================================

function scrollToBottom() {

  messagesBox.scrollTop =
    messagesBox.scrollHeight;

}


// ======================================================
// FINAL
// ======================================================

console.log(
  "🥷 NEURAL NINJAS READY — NO VOICE SYSTEM"
);
