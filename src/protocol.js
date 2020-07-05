const LOCAL_STORAGE_KEY_CLIENT_NAME = "padington-client-name";

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

/// Dispatches an event to the appropriate listener
function dispatchEvent(client, type, event) {
  let handlers = client.eventHandlers[type];
  if (handlers) {
    handlers.forEach((handler, i) => {
      handler(event);
    });
  } else {
    console.error("[padington]", "Could not find event handlers for type", type);
  }
}

export class PeerEnterEvent {
  constructor(id, data) {
    this.id = id;
    this.data = data;
  }
}

export class PeerLeaveEvent {
  constructor(id) {
    this.id = id;
  }
}

export class PeerRenameEvent {
  constructor(id, newName) {
    this.id = id;
    this.newName = newName;
  }
}

export class PeerAudioEvent {
  constructor(id, isEnabled) {
    this.id = id;
    this.isEnabled = isEnabled;
  }
}

export class PeerWebRTCEvent {
  constructor(id, message) {
    this.id = id;
    this.message = message;
  }
}

export class ChatMessageEvent {
  constructor(id, message) {
    this.id = id;
    this.message = message;
  }
}

/// Adds a new user to the client
function addNewUser(client, arg) {
  let [id, data] = splitArg(arg);
  let remoteID = Number(id);
  let peerData = JSON.parse(data);

  client.peers.set(remoteID, peerData);
  dispatchEvent(client, 'enter', new PeerEnterEvent(remoteID, peerData));
}

/// Handles a user leaving
function handleLeave(client, arg) {
  let remoteID = Number(arg);
  dispatchEvent(client, 'leave', new PeerLeaveEvent(remoteID));
  client.peers.delete(remoteID);
}

/// Rename a remote peer
function updatePeer(client, arg) {
  let [id, payload] = splitArg(arg);
  let remoteID = Number(id);
  let peerEntry = client.peers.get(remoteID);

  let data = JSON.parse(payload);

  if (data.name) {
    let newName = data.name;
    peerEntry.name = newName;
    dispatchEvent(client, 'rename', new PeerRenameEvent(remoteID, newName));
  }

  if (data.audio != null) {
    peerEntry.audio = data.audio;
    dispatchEvent(client, 'audio', new PeerAudioEvent(remoteID, data.audio));
  }
}

/// Handle the init message
function handleInit(client, arg) {
  const [clientID, msg] = splitArg(arg);
  let data = JSON.parse(msg);
  client.id = Number(clientID);
  console.info("This is client", client.id);
  dispatchEvent(client, 'init', data);
}

function handleWebRTC(client, arg) {
  const [remoteIDString, msg] = splitArg(arg);
  let data = JSON.parse(msg);
  let remoteID = Number(remoteIDString);

  dispatchEvent(client, 'webrtc', new PeerWebRTCEvent(remoteID, data));
}

function handlePeers(client, arg) {
  const initialPeers = JSON.parse(arg);
  for (let [id, data] of Object.entries(initialPeers)) {
    let remoteID = Number(id);
    client.peers.set(remoteID, data);
    if (remoteID != client.id) {
      dispatchEvent(client, 'enter', new PeerEnterEvent(remoteID, data));
    } else {
      client.name = data.name;
      dispatchEvent(client, 'update', data);
    }
  }
}

/// Handle a chat message
function handleChat(client, arg) {
  const [remoteIDString, message] = splitArg(arg);
  let remoteID = Number(remoteIDString);
  dispatchEvent(client, 'chat', new ChatMessageEvent(remoteID, message))
}

/// Send a system message
function systemMessage(client, msg) {
  dispatchEvent(client, 'system', msg);
}

/// Handle an error after the connection has been opened
function handleError(event) {
  console.error("WebSocket error observed:", event);
  systemMessage(this, "WebSocket error observed");
}

/// Handle an opened connection
function handleOpen(event) {
  this.socket.onerror = this._handleError;

  if (this.name) {
    console.info(`Using name from local storage: %c${this.name}`, "font-weight: bold");
    this.socket.send(`init|${this.name}`);
  } else {
    this.socket.send("init");
  }
}

/// Handle a connection closing
function handleClose(event) {
  console.error("WebSocket was closed:", event);
  if (event.wasClean) {
    systemMessage(this, `Connection closed with code ${event.code} and reason '${event.reason}'`);
  } else {
    systemMessage(this, `Connection broke with code ${event.code}`);
  }
}

/// Handle an error before the connection was established
function handleInitialError(event) {
  const msg = `Could not connect to server at ${event.target.url}`;
  console.error("WebSocket failed before connection was established:", event);
  systemMessage(this, msg);
  this.expectClose();
}

/// Handle a message
function handleMessage(event) {
  const [cmd, arg] = splitArg(event.data);
  switch (cmd) {
    case 'chat':
      handleChat(this, arg);
      break;
    case 'error':
      console.error(arg);
      break;
    case 'folder':
      dispatchEvent(this, 'folder');
      break;
    case 'new-user':
      addNewUser(this, arg);
      break;
    case 'update':
      updatePeer(this, arg);
      break;
    case 'user-left':
      handleLeave(this, arg);
      break;
    case 'init':
      handleInit(this, arg);
      break;
    case 'peers':
      handlePeers(this, arg);
      break;
    case 'webrtc':
      handleWebRTC(this, arg);
      break;
    case 'steps':
      const batches = JSON.parse(arg);
      let event = {
        steps: batches.flatMap(x => x.steps),
        clientIDs: batches.flatMap(x => x.steps.map(y => x.src)),
      };
      dispatchEvent(this, 'steps', event);
      break;
    default:
      console.warn(`Unknown command %c${cmd}`, "font-weight: bold", "with argument(s):", arg);
  }
}

export class PadingtonClient {
  constructor(is_secure, hostname, padname) {
    const protocol = is_secure ? 'wss:' : 'ws:';
    const apiLocation = `${protocol}//${hostname}:9002/${padname}`;

    console.debug("Connection to pad server at", apiLocation);
    this.socket = new WebSocket(apiLocation, "padington");

    this.id = -1;
    this.name = localStorage.getItem(LOCAL_STORAGE_KEY_CLIENT_NAME);
    this.peers = new Map();

    this.eventHandlers = {
      system: [],
      chat: [],
      error: [],
      folder: [],
      enter: [],
      rename: [],
      audio: [],
      leave: [],
      init: [],
      peers: [],
      steps: [],
      webrtc: [],
    };

    this.socket.onopen = handleOpen.bind(this);
    this.socket.onerror = handleInitialError.bind(this);
    this.socket.onclose = handleClose.bind(this);
    this.socket.onmessage = handleMessage.bind(this);
  }

  /// Update the client to not treat a connection closed event as an error
  expectClose() {
    this.socket.onclose = function(event) {
      console.log("Connection closed as expected!");
    }
  }

  /// Tell the server that you are currently at version X an would like to
  /// apply the given steps
  sendSteps(version, steps) {
    const stepJSON = steps.map(x => x.toJSON());
    console.log("Sending steps", { version: version, steps: stepJSON });
    this.socket.send(`steps|${version}|${JSON.stringify(stepJSON)}`);
  }

  /// Send some WebRTC signal to a specific other client
  sendWebRTC(to, data) {
    if (to == null || data == null) {
      throw new RangeError("padington::sendWebRTC called with", to, data);
    }
    let msg = `webrtc|${to}|${JSON.stringify(data)}`;
    // console.log(msg);
    this.socket.send(msg);
  }

  /// Sets a new name for this client
  rename(newName) {
    this.name = newName;
    localStorage.setItem(LOCAL_STORAGE_KEY_CLIENT_NAME, newName);
    const msg = {name: newName};
    this.socket.send(`update|${JSON.stringify(msg)}`);
  }

  /// Send a chat message
  sendChatMessage(msg) {
    this.socket.send(`chat|${msg}`);
  }

  /// Set whether the audio connection is active
  setAudio(on) {
    const msg = {audio: !!on};
    this.socket.send(`update|${JSON.stringify(msg)}`);
  }

  /// Update any of the event listeners
  addEventListener(type, listener) {
    this.eventHandlers[type].push(listener);
  }

  set onsystem(handler) { this.eventHandlers.system = [handler]; }
  set onchat(handler) { this.eventHandlers.chat = [handler]; }
  set onerror(handler) { this.eventHandlers.error = [handler]; }
  set onfolder(handler) { this.eventHandlers.folder = [handler]; }
  set onenter(handler) { this.eventHandlers.enter = [handler]; }
  set onrename(handler) { this.eventHandlers.rename = [handler]; }
  set onaudio(handler) { this.eventHandlers.audio = [handler]; }
  set onleave(handler) { this.eventHandlers.leave = [handler]; }
  set oninit(handler) { this.eventHandlers.init = [handler]; }
  set onupdate(handler) { this.eventHandlers.update = [handler]; }
  set onsteps(handler) { this.eventHandlers.steps = [handler]; }
  set onwebrtc(handler) { this.eventHandlers.webrtc = [handler]; }
}
