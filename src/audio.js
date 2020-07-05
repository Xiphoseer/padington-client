const configuration = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'}
  ]
}

/*async function getUser() {
    try {
        const constraints = {'audio': true};
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        //audioElement.srcObject = stream;
        return stream;
    } catch(error) {
        console.error('Error opening microphone.', error);
    }
}*/

async function initConnection(state, remoteID) {
  // The user with the larger ID initializes the connection
  console.log("Send init message to client", remoteID);
  const peerConnection = new RTCPeerConnection(configuration);

  let localStream = await state.localStream;
  localStream.getTracks().forEach(track => {
    console.log("Adding track", track);
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  state.client.sendWebRTC(remoteID, offer);

  state.connections.set(remoteID, peerConnection);
}

async function handleEnabled(state, remoteID) {
  console.info("Client", remoteID, "enabled their audio");
  if (state.isEnabled) {
    if (remoteID < state.client.id) {
      initConnection(state, remoteID);
    } else {
      // Ignore if it's ourselves
      if (remoteID == state.client.id) {
        console.log("Server confirmed that we enabled our audio");
      } else {
        console.log("Expecting init message from client", remoteID);
      }
    }
  } else {
    console.info("Audio is disabled, ignoring!");
  }
}

function handleAudio(event) {
  if (event.isEnabled) {
    handleEnabled(this, event.id);
  } else {
    console.log("Client", event.id, "disabled their audio");
  }
}

function handleEnter(event) {
  if (event.data.audio) {
    handleEnabled(this, event.id);
  }
}

function logSDP(text) {
  let lines = text.split("\r\n");
  lines = lines.filter(line => !!line);
  let obj = lines.map(line => {
    const [key, val] = line.split("=");
    let l = new Object();
    l[key] = val;
    return l;
  });
  /*for (const line of lines) {
    const [key, val] = line.split("=");
    console.log(key, "=", val.split(" "));
  }*/
  console.dir(obj);
}

function finishSetup(state, remoteID, peerConnection) {
  peerConnection.addEventListener('icecandidate', event => {
    console.log("ICE Candidate Event", event);
    if (event.candidate) {
      state.client.sendWebRTC(remoteID, {
        iceCandidate: event.candidate,
        'type': 'iceCandidate',
      });
    }
  });

  peerConnection.addEventListener('track', async (event) => {
    console.log("Recieved Track", event.track, state.remoteStream);
    state.remoteStream.addTrack(event.track, state.remoteStream);
  });

  // INFO: This event just doesn't exist in firefox :(
  peerConnection.onconnectionstatechange = function(event) {
    switch(peerConnection.connectionState) {
      case "connected":
        console.info("The connection has become fully connected");
        break;
      case "disconnected":
      case "failed":
        console.info("One or more transports has terminated unexpectedly or in an error");
        break;
      case "closed":
        console.info("The connection has been closed");
        break;
    }
  }

  peerConnection.addEventListener("icegatheringstatechange", ev => {
    switch(peerConnection.iceGatheringState) {
      case "new":
        console.log("gathering is either just starting or has been reset");
        break;
      case "gathering":
        console.log("gathering has begun or is ongoing")
        break;
      case "complete":
        console.log("gathering has ended");
        break;
    }
  });

  console.log("Finished setup for connection", peerConnection);
}

async function handleAnswer(state, remoteID, answer) {
  console.groupCollapsed("Got WebRTC answer");
  logSDP(answer.sdp);
  console.groupEnd();

  const remoteDesc = new RTCSessionDescription(answer);

  let peerConnection = state.connections.get(remoteID);
  if (peerConnection) {
    finishSetup(state, remoteID, peerConnection);
    await peerConnection.setRemoteDescription(remoteDesc);
    console.log("Finished setting remote description", peerConnection);
  } else {
    console.error("Recieved WebRTC answer for client", remoteID, "but there is no connection pending");
  }
}

async function handleOffer(state, remoteID, offer) {
  console.groupCollapsed("Got WebRTC offer");
  logSDP(offer.sdp);
  console.groupEnd();

  const peerConnection = new RTCPeerConnection(configuration);

  let localStream = await state.localStream;
  localStream.getTracks().forEach(track => {
    console.log("Adding track", track);
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  state.client.sendWebRTC(remoteID, answer);
  state.connections.set(remoteID, peerConnection);

  finishSetup(state, remoteID, peerConnection);
}

async function handleICECandidate(state, remoteID, message) {
  let peerConnection = state.connections.get(remoteID);
  if (peerConnection) {
    try {
      console.log("ICE Candidate Message", message.iceCandidate);
      await peerConnection.addIceCandidate(message.iceCandidate);
    } catch (e) {
      console.error('Error adding received ice candidate', e);
    }
  } else {
    console.error("Recieved WebRTC answer for client", remoteID, "but there is no connection pending");
  }
}

function handleSignal(event) {
  switch (event.message.type) {
    case 'offer':
      handleOffer(this, event.id, event.message);
      break;
    case 'answer':
      handleAnswer(this, event.id, event.message);
      break;
    case 'iceCandidate':
      handleICECandidate(this, event.id, event.message);
      break;
    default:
      console.info("Got message", event.message, "from remote peer", event.id);
      break;
  }
}

async function onEnable(state) {
  if (!state.localStream) {
    state.localStream = navigator.mediaDevices.getUserMedia({audio: true});
  }

  console.log("Checking for needed audio connections");
  for (const [remoteID, data] of state.client.peers) {
    console.log(remoteID, data)
    if (remoteID < state.client.id && data.audio) {
      initConnection(state, remoteID)
    }
  }

  state.output.play().then(x => console.log(x)).catch(e => console.error(e));
}

async function onDisable(state) {

}

class AudioState {
  constructor(client, audioElement) {
    this.isEnabled = false;
    this.client = client;
    this.connections = new Map();

    this.localStream = null;
    this.remoteStream = new MediaStream();
    audioElement.srcObject = this.remoteStream;
    this.output = audioElement;

    client.addEventListener('audio', handleAudio.bind(this));
    client.addEventListener('enter', handleEnter.bind(this));
    client.addEventListener('webrtc', handleSignal.bind(this));
  }

  setEnabled(flag) {
    let v = !!flag;
    this.isEnabled = v;
    this.client.setAudio(v);

    if (v) {
      return onEnable(this);
    } else {
      return onDisable(this);
    }
  }
}

export default function setupAudio(client) {
  let audioConnectButton = document.getElementById("audio-connect-button");
  let audioDisconnectButton = document.getElementById("audio-disconnect-button");
  let audioMuteToggle = document.getElementById("audio-mute-toggle");
  let audioElement = document.getElementById("audio-output");

  var audioState = new AudioState(client, audioElement);

  audioConnectButton.onclick = function(event) {
    audioState.setEnabled(true);

    audioDisconnectButton.classList.remove('hidden');
    audioMuteToggle.classList.remove('hidden');
    audioMuteToggle.title = "Mute Audio";
    audioMuteToggle.textContent = "Mute Audio";
    audioConnectButton.classList.add('hidden');
  }

  audioMuteToggle.onclick = function(event) {
    if (audioElement.paused) {
      audioElement.play().then(x => console.log(x)).catch(e => console.error(e));
      audioMuteToggle.title = "Mute Audio";
      audioMuteToggle.textContent = "Mute Audio";
    } else {
      audioElement.pause();
      audioMuteToggle.title = "Unmute Audio";
      audioMuteToggle.textContent = "Unmute Audio";
    }
  }

  audioDisconnectButton.onclick = function(event) {
    audioElement.srcObject = null;
    audioState.setEnabled(false);

    audioDisconnectButton.classList.add('hidden');
    audioMuteToggle.classList.add('hidden');
    audioConnectButton.classList.remove('hidden');
  }

  return audioState;
}
