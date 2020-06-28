import { PadingtonClient } from './protocol.js';

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

  function addSystemMessage(text) {
    var newPar = document.createElement("p");
    newPar.classList.add("msg-system");
    var newContent = document.createTextNode(text);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  var client = new PadingtonClient(is_secure, hostname, padname);

  /// Display a control message for a given ID
  function addControlMessage(remoteID, text) {
    let entry = client.peers.get(remoteID);
    let name = entry.name;

    var newName = document.createElement("strong");
    newName.dataset.src = remoteID;
    var newNameContent = document.createTextNode(name);
    newName.appendChild(newNameContent);

    var newPar = document.createElement("p");
    newPar.classList.add("msg-control");
    newPar.appendChild(newName);
    var newContent = document.createTextNode(text);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  /// Display a chat message for the given id
  function addChatMessage (event) {
    let entry = peers.get(event.id);
    let name = entry.name;

    var newName = document.createElement("strong");
    newName.dataset.src = event.id;
    var newNameContent = document.createTextNode(name);
    newName.appendChild(newNameContent);

    var newPar = document.createElement("p");
    newPar.appendChild(newName);
    var newContent = document.createTextNode(" " + event.message);
    newPar.appendChild(newContent);

    addMessage(newPar)
  }

  /// When a new user appears in the channel, send a chat control message
  /// and add them to the peer list
  function addNewUser(event) {
    addControlMessage(event.id, " joined the channel!");
    if (event.id != client.id) {
      addPeerListEntry(event.id, event.data);
    }
  }

  /// When a user leaves, print a message
  function userLeft(event) {
    addControlMessage(event.id, " left the channel!");
    if (event.id != client.id) {
      let peerEntry = peerList.querySelector(`#peer-${event.id}`);
      if (peerEntry) {
        peerEntry.remove();
      }
    }
  }

  /// When a user is renamed, update all names in the UI
  function renameUser(event) {
    let remoteID = event.id;
    let newName = event.newName;
    if (remoteID != client.id) {
      console.log("Rename", event.id, "->", newName);
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

  /// When the client data is updated by the server, reset the name box
  function updateClient(event) {
    clientNameInput.value = event.name;
  }

  /// When the current path is not a pad but a folder, display a box
  function showPadChooser() {
    client.expectClose();

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

  client.onsysmessage = addSystemMessage;
  client.onchat = addChatMessage;
  client.onfolder = showPadChooser;
  client.onenter = addNewUser;
  client.onrename = renameUser;
  client.onleave = userLeft;
  client.onupdate = updateClient;

  messageForm.onsubmit = function(event) {
    client.sendChatMessage(messageInput.value);
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
    if (name != client.name) {
      client.rename(name);
    }
  };

  return client;
}
