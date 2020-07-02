async function playAudio(audioElement) {
    try {
        const constraints = {'audio': true};
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        audioElement.srcObject = stream;
    } catch(error) {
        console.error('Error opening microphone.', error);
    }
}

export default function setupAudio(client) {
  let audioConnectButton = document.getElementById("audio-connect-button");
  let audioDisconnectButton = document.getElementById("audio-disconnect-button");
  let audioMuteToggle = document.getElementById("audio-mute-toggle");
  let audioElement = document.getElementById("audio-output");

  audioConnectButton.onclick = function(event) {
    playAudio(audioElement).then(() => {
      audioElement.play();
      audioMuteToggle.title = "Mute Audio";
      audioMuteToggle.textContent = "Mute Audio";
    });

    client.setAudio(true);

    audioDisconnectButton.classList.remove('hidden');
    audioMuteToggle.classList.remove('hidden');
    audioConnectButton.classList.add('hidden');
  }

  audioMuteToggle.onclick = function(event) {
    if (audioElement.paused) {
      audioElement.play();
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
    client.setAudio(false);

    audioDisconnectButton.classList.add('hidden');
    audioMuteToggle.classList.add('hidden');
    audioConnectButton.classList.remove('hidden');
  }

  client.addEventListener('audio', function(event) {
    if (event.isEnabled) {
      console.log(`Client ${event.id} enabled their audio`);
      if (event.id < client.id) {
        // The user with the larger ID initializes the connection
        console.log("Send init message to client", event.id);
        client.sendWebRTC(event.id, {init: true});
      }
    } else {
      console.log(`Client ${event.id} disabled their audio`);
    }
  });

  client.addEventListener('webrtc', function(event) {
    console.info("Got message", event.message, "from remote peer", event.id);
  });
}
