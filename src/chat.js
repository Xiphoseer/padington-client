export default function setup() {
  let url = new URL(window.location);
  let pad_param = url.searchParams.get('pad');
  const padname = pad_param ? pad_param : "";
  const is_secure = url.protocol == "https:";
  const hostname = url.hostname;

  var chatMessagesDiv = document.getElementById("chat-messages");
  var messageInput = document.getElementById("new-message");
  var messageForm = document.getElementById("message-form");

  function splitArg (text) {
    var cmd_len = text.indexOf('|');
    var cmd, arg;
    if (cmd_len < 0) {
      cmd = text;
    } else {
      cmd = text.slice(0, cmd_len);
      arg = text.slice(cmd_len + 1);
    }
    return {cmd, arg};
  }

  function addMessage(par) {
    chatMessagesDiv.appendChild(par)
    chatMessagesDiv.scrollBy(0, 500);
  }

  function addChatMessage (text) {
    const {cmd, arg} = splitArg(text);

    var newName = document.createElement("strong");
    var newNameContent = document.createTextNode(`Bear ${cmd}: `);
    newName.appendChild(newNameContent);

    var newPar = document.createElement("p");
    newPar.appendChild(newName);
    var newContent = document.createTextNode(arg);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  function addControlMessage(id, text) {
    var newName = document.createElement("strong");
    var newNameContent = document.createTextNode(`Bear ${id}`);
    newName.appendChild(newNameContent);

    var newPar = document.createElement("p");
    newPar.classList.add("msg-control");
    newPar.appendChild(newName);
    var newContent = document.createTextNode(text);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  function addNewUser(id) {
    addControlMessage(id, " joined the channel!");
  }

  function addUserLeft(id) {
    addControlMessage(id, " left the channel!");
  }

  const protocol = is_secure ? 'wss:' : 'ws:';
  const apiLocation = `${protocol}//${hostname}:9002/${padname}`;
  console.log("Connection to pad server at", apiLocation);
  var exampleSocket = new WebSocket(apiLocation, "paddington");

  exampleSocket.onopen = function (event) {
    exampleSocket.send("init");
  };

  exampleSocket.onmessage = function (event) {
    const {cmd, arg} = splitArg(event.data);
    switch (cmd) {
      case 'chat':
        addChatMessage(arg);
        break;
      case 'error':
        console.error(arg);
        break;
      case 'new-user':
        addNewUser(arg);
        break;
      case 'user-left':
        addUserLeft(arg);
        break;
      default:
        console.warn(`Unknown command ${cmd}`);
    }
  }

  messageForm.onsubmit = function(event) {
    exampleSocket.send(`chat|${messageInput.value}`);
    messageInput.value = "";
    event.preventDefault();
  }
}
