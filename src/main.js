import setupChat from './chat.js';
import setupEditor from './editor.js';
import setupAudio from './audio.js';
import {PadingtonClient} from './protocol.js';

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "prosemirror-example-setup/style/style.css";
import "@fortawesome/fontawesome-free/scss/solid.scss";
import "@fortawesome/fontawesome-free/scss/fontawesome.scss";
import "../style/layout.css";
import "../style/chat.scss";
import "../style/editor.scss";

let url = new URL(window.location);
let pad_param = url.searchParams.get('pad');
const padname = pad_param ? pad_param : "";
const is_secure = url.protocol == "https:";
const hostname = url.hostname;

var padington = new PadingtonClient(is_secure, hostname, padname);

setupChat(padington, padname);
setupEditor(padington);
window.audioState = setupAudio(padington);
