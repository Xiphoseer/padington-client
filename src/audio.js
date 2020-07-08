const configuration = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'}
  ]
}

async function initConnection(state, remoteID) {
  // The user with the larger ID initializes the connection
  console.log("Send init message to client", remoteID);
  const peerConnection = new RTCPeerConnection(configuration);

  state.localStream.getTracks().forEach(track => {
    console.log("Adding track", track);
    peerConnection.addTrack(track, state.localStream);
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
    console.log("ICE Candidate Event"/*, event*/);
    if (event.candidate) {
      state.client.sendWebRTC(remoteID, {
        iceCandidate: event.candidate,
        'type': 'iceCandidate',
      });
    }
  });

  peerConnection.addEventListener('track', async (event) => {
    console.log("Recieved Track", event.track);

    var remoteStream = new MediaStream();
    remoteStream.addTrack(event.track);

    var audioNode = state.audioCtx.createMediaStreamSource(remoteStream);
    audioNode.connect(state.audioCtx.destination);
    state.remoteStreamAudioNodes.set(remoteID, audioNode);
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
  peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  state.localStream.getTracks().forEach(track => {
    console.log("Adding track", track);
    peerConnection.addTrack(track, state.localStream);
  });

  // Finish the setup before awaiting?
  finishSetup(state, remoteID, peerConnection);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  state.client.sendWebRTC(remoteID, answer);
  state.connections.set(remoteID, peerConnection);
}

async function handleICECandidate(state, remoteID, message) {
  let peerConnection = state.connections.get(remoteID);
  if (peerConnection) {
    try {
      console.log("ICE Candidate Message"/*, message.iceCandidate*/);
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
  console.log("Creating audio context");
  const audioContext = new AudioContext();
  state.audioCtx = audioContext;

  console.log("Loading user media");
  return navigator.mediaDevices.getUserMedia ({audio: true})
    .then(micStream => {
      state.micStream = micStream;
      state.sendNode = state.audioCtx.createMediaStreamDestination();
      state.micNode = state.audioCtx.createMediaStreamSource(state.micStream);
      state.micGainNode = state.audioCtx.createGain();
      state.micGainNode.gain.setValueAtTime(1, state.audioCtx.currentTime);

      state.micNode.connect(state.micGainNode);
      state.micGainNode.connect(state.sendNode);
      state.localStream = state.sendNode.stream;

      //var oscillator = state.audioCtx.createOscillator();
      //oscillator.type = 'sine';
      //oscillator.frequency.setValueAtTime(220, state.audioCtx.currentTime); // value in hertz
      //oscillator.connect(state.audioCtx.destination);
      //oscillator.start();
      //state.oscillator = oscillator;

      console.log("Checking for needed audio connections");
      for (const [remoteID, data] of state.client.peers) {
        console.log("Found Peer", remoteID, data)
        if (remoteID < state.client.id && data.audio) {
          initConnection(state, remoteID)
        }
      }
    })
    .catch(e => {
      console.dir(e);
      console.error(e);
    });
}

async function onDisable(state) {
  console.log("Unsetting local stream");
  state.micNode.disconnect();
  state.micGainNode.disconnect();
  let audioTracks = state.micStream.getAudioTracks();
  console.log("Audio Tracks", audioTracks);
  audioTracks.forEach(track => {
    console.log("Disabling track", track);
    track.enabled = false;
  });
  state.micStream = null;
  state.localStream = null;

  console.log("Stopping all remote tracks");
  for (const [key, value] of state.remoteStreamAudioNodes) {
    console.log("Disconnected audio node for client", key);
    value.disconnect();
  }
  console.log("Closing all connections");
  for (let [id, connection] of state.connections) {
    connection.close();
  }
  console.log("Closed all connections");
  state.connections = new Map();
}

// for legacy browsers
const AudioContext = window.AudioContext || window.webkitAudioContext;

class AudioState {
  constructor(client) {
    this.isEnabled = false;
    this.client = client;
    this.connections = new Map();
    this.localStream = null;

    this.remoteStreamAudioNodes = new Map();

    client.addEventListener('audio', handleAudio.bind(this));
    client.addEventListener('enter', handleEnter.bind(this));
    client.addEventListener('webrtc', handleSignal.bind(this));
  }

  setMicGain(value) {
    if (this.micGainNode) {
      this.micGainNode.gain.setValueAtTime(value, this.audioCtx.currentTime);
    } else {
      console.warn("Cannot set mic gain when audio isn't enabled!");
    }
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
  //let audioMuteToggle = document.getElementById("audio-mute-toggle");

  let micVolume = document.getElementById("mic-volume");
  let micVolumeSlider = document.getElementById("mic-volume-slider");
  let micVolumeValue = document.getElementById("mic-volume-value");

  micVolumeSlider.value = 1;

  var audioState = new AudioState(client);

  audioConnectButton.onclick = function(event) {
    audioState.setEnabled(true)
      .then(_ => {
        audioDisconnectButton.classList.remove('hidden');
        micVolume.classList.remove('hidden');
        audioState.setMicGain(micVolumeSlider.value);

        audioConnectButton.classList.add('hidden');
      })
      .catch(e => console.trace(e));
  }

  micVolumeSlider.addEventListener('input', function(event) {
    let value = micVolumeSlider.value;
    micVolumeValue.textContent = value;
    audioState.setMicGain(value);
  });

  /*audioMuteToggle.onclick = function(event) {
    if (audioState.localStream) {
      let audioTrack = audioState.localStream.getAudioTracks()[0];
      if (audioTrack) {
        if (audioTrack.enabled) {
          audioTrack.enabled = false;
          audioMuteToggle.title = "Unmute Audio";
          audioMuteToggle.textContent = "Unmute Audio";
        } else {
          audioTrack.enabled = true;
          audioMuteToggle.title = "Mute Audio";
          audioMuteToggle.textContent = "Mute Audio";
        }
      } else {
        console.warn("Pressed mute toggle without an audio track");
      }
    } else {
      console.warn("Pressed mute toggle without a local stream");
    }
  }*/

  audioDisconnectButton.onclick = function(event) {
    audioState.setEnabled(false)
      .catch(e => console.trace(e));

    audioDisconnectButton.classList.add('hidden');
    micVolume.classList.add('hidden');
    audioConnectButton.classList.remove('hidden');
  }

  return audioState;
}
