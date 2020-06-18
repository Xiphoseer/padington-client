const LOCAL_STORAGE_KEY_CLIENT_NAME = "padington-client-name";

export default function setupChat() {
  let url = new URL(window.location);
  let pad_param = url.searchParams.get('pad');
  const padname = pad_param ? pad_param : "";
  const is_secure = url.protocol == "https:";
  const hostname = url.hostname;

  var localStorage = window.localStorage;

  var chatAside = document.getElementById("chat");
  var editor = document.getElementById("editor");
  var chatClose = document.getElementById("chat-close-button");
  var chatOpen = document.getElementById("chat-open-button");
  var chatMessagesDiv = document.getElementById("chat-messages");
  var messageInput = document.getElementById("new-message");
  var messageForm = document.getElementById("message-form");
  var peerList = document.getElementById("peers");
  var peerListToggle = document.getElementById("peer-list-toggle");
  var clientNameInput = document.getElementById("client-name");
  var clientID = -1;
  var clientName = null;

  var peers = new Map();

  peerListToggle.onclick = function(event) {
    peerList.classList.toggle('closed');
  }

  chatClose.onclick = function(event) {
    chatAside.classList.add('closed');
    chatOpen.classList.remove('hidden');
    editor.classList.remove('chat-open');
  }

  chatOpen.onclick = function(event) {
    chatAside.classList.remove('closed');
    chatOpen.classList.add('hidden');
    editor.classList.add('chat-open');
  }

  function splitArg (text) {
    var cmd_len = text.indexOf('|');
    var cmd, arg;
    if (cmd_len < 0) {
      cmd = text;
    } else {
      cmd = text.slice(0, cmd_len);
      arg = text.slice(cmd_len + 1);
    }
    return [cmd, arg];
  }

  function addMessage(par) {
    chatMessagesDiv.appendChild(par)
    chatMessagesDiv.scrollBy(0, 500);
  }

  function addPeerListEntry(id, data) {
    var newName = document.createElement("strong");
    var newNameContent = document.createTextNode(data.name);
    newName.appendChild(newNameContent);

    var newListItem = document.createElement("li");
    newListItem.id = `peer-${id}`;
    newListItem.appendChild(newName);

    peerList.appendChild(newListItem);
  }

  function addChatMessage (text) {
    const [remoteClientIDString, message] = splitArg(text);
    let remoteClientID = Number(remoteClientIDString);

    let entry = peers.get(remoteClientID);
    let name = entry.name;

    var newName = document.createElement("strong");
    newName.dataset.src = remoteClientID;
    var newNameContent = document.createTextNode(name);
    newName.appendChild(newNameContent);

    var newPar = document.createElement("p");
    newPar.appendChild(newName);
    var newContent = document.createTextNode(" " + message);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  function addControlMessage(remoteClientID, text) {
    let entry = peers.get(remoteClientID);
    let name = entry.name;

    var newName = document.createElement("strong");
    newName.dataset.src = remoteClientID;
    var newNameContent = document.createTextNode(name);
    newName.appendChild(newNameContent);

    var newPar = document.createElement("p");
    newPar.classList.add("msg-control");
    newPar.appendChild(newName);
    var newContent = document.createTextNode(text);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  function renameUser(arg) {
    let [id, newName] = splitArg(arg);
    let remoteID = Number(id);

    peers.get(remoteID).name = newName;

    if (remoteID != clientID) {
      console.log("Rename", remoteID, "->", newName);
      let peerEntry = peerList.querySelector(`#peer-${remoteID} > strong`);
      if (peerEntry) {
        peerEntry.textContent = newName;
      }
    } else {
      if (clientNameInput.value != newName) {
        console.warn("Received remote name change to", newName, "!");
        clientNameInput.value = newName;
      }
    }

    let nameElements = chatMessagesDiv.querySelectorAll(`[data-src='${remoteID}']`);
    nameElements.forEach(function(nameElement) {
      nameElement.textContent = newName;
    });
  }

  function addNewUser(arg) {
    let [id, data] = splitArg(arg);
    let remoteID = Number(id);

    let peerData = JSON.parse(data);

    peers.set(remoteID, peerData);

    addControlMessage(remoteID, " joined the channel!");
    if (remoteID != clientID) {
      addPeerListEntry(remoteID, peerData);
    }
  }

  function userLeft(id) {
    let remoteID = Number(id);
    addControlMessage(remoteID, " left the channel!");
    peers.delete(remoteID);
    if (remoteID != clientID) {
      let peerEntry = peerList.querySelector(`#peer-${remoteID}`);
      if (peerEntry) {
        peerEntry.remove();
      }
    }
  }

  function addSystemMessage(text) {
    var newPar = document.createElement("p");
    newPar.classList.add("msg-system");
    var newContent = document.createTextNode(text);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  const protocol = is_secure ? 'wss:' : 'ws:';
  const apiLocation = `${protocol}//${hostname}:9002/${padname}`;
  console.debug("Connection to pad server at", apiLocation);
  var exampleSocket = new WebSocket(apiLocation, "padington");

  exampleSocket.onopen = function (event) {
    exampleSocket.onerror = function(event) {
      console.error("WebSocket error observed:", event);
      addSystemMessage("WebSocket error observed");
    }
    let intendedName = localStorage.getItem(LOCAL_STORAGE_KEY_CLIENT_NAME);
    if (intendedName) {
      console.info(`Using name from local storage: %c${intendedName}`, "font-weight: bold");
      exampleSocket.send(`init|${intendedName}`);
    } else {
      exampleSocket.send("init");
    }
  };

  exampleSocket.onerror = function(event) {
    const msg = `Could not connect to server at ${apiLocation}`;
    console.error("WebSocket failed before connection was established:", event);
    addSystemMessage(msg);
  };

  exampleSocket.onclose = function(event) {
    console.error("WebSocket was closed:", event);
    if (event.wasClean) {
      addSystemMessage(`Connection closed with code ${event.code} and reason '${event.reason}'`);
    } else {
      addSystemMessage(`Connection broke with code ${event.code}`);
    }
  };

  function showPadChooser() {
    exampleSocket.onclose = function(event) {
      console.log("Connection closed as expected!");
    };

    editor.textContent = "";
    chatOpen.classList.add('hidden');

    var padChooserTitle = document.createTextNode("Choose a Pad!");
    var padChooserHeading = document.createElement("h2");
    padChooserHeading.appendChild(padChooserTitle);

    var padNameField = document.createElement("input");
    padNameField.type = "text";
    padNameField.name = "pad";
    padNameField.pattern = "[^/]+"

    var padOpenButtonText = document.createTextNode("Open")
    var padOpenButton = document.createElement("button");
    padOpenButton.type = "submit";
    padOpenButton.appendChild(padOpenButtonText);

    var padChooser = document.createElement("form");
    padChooser.id = "pad-chooser";

    padChooser.onsubmit = function(event) {
      // prepend the current padname
      padNameField.value = `${padname}${padNameField.value}`;
    }

    padChooser.appendChild(padChooserHeading);
    //padChooser.appendChild(padPatternInfo);
    padChooser.appendChild(padNameField);
    padChooser.appendChild(padOpenButton);

    editor.appendChild(padChooser);
  }

  var eventBus = {
    sendSteps: function(version, steps, clientID) {
      const stepJSON = steps.map(x => x.toJSON());
      console.log("Sending steps", {
        version: version,
        steps: stepJSON,
        clientID: clientID,
      });
      exampleSocket.send(`steps|${version}|${JSON.stringify(stepJSON)}`);
    }
  };

  exampleSocket.onmessage = function (event) {
    const [cmd, arg] = splitArg(event.data);
    switch (cmd) {
      case 'chat':
        addChatMessage(arg);
        break;
      case 'error':
        console.error(arg);
        break;
      case 'folder':
        showPadChooser();
        break;
      case 'new-user':
        addNewUser(arg);
        break;
      case 'rename':
        renameUser(arg);
        break;
      case 'user-left':
        userLeft(arg);
        break;
      case 'init':
        const [setClientID, msg] = splitArg(arg);
        let data = JSON.parse(msg);
        clientID = Number(setClientID);
        data.clientID = clientID;
        eventBus.oninit(data);
        break;
      case 'peers':
        const initialPeers = JSON.parse(arg);
        for (let [id, data] of Object.entries(initialPeers)) {
          let remoteID = Number(id);
          peers.set(remoteID, data);
          if (remoteID != clientID) {
            addPeerListEntry(remoteID, data);
          } else {
            clientNameInput.value = data.name;
            clientName = data.name;
          }
        }
        break;
      case 'steps':
        const batches = JSON.parse(arg);
        let event = {
          steps: batches.flatMap(x => x.steps),
          clientIDs: batches.flatMap(x => x.steps.map(y => x.src)),
        };
        eventBus.onnewsteps(event);
        break;
      default:
        console.warn(`Unknown command %c${cmd}`, "font-weight: bold", "with argument(s):", arg);
    }
  }

  messageForm.onsubmit = function(event) {
    exampleSocket.send(`chat|${messageInput.value}`);
    messageInput.value = "";
    event.preventDefault();
  }

  clientNameInput.onkeydown = function(e) {
    if (e.code == 'Enter') {
      event.target.blur();
    }
  }
  clientNameInput.onblur = function (event) {
    let name = clientNameInput.value;
    if (name != clientName) {
      clientName = name;
      localStorage.setItem(LOCAL_STORAGE_KEY_CLIENT_NAME, name);
      exampleSocket.send(`rename|${name}`);
    }
  };

  return eventBus;
}
