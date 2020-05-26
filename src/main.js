import setupChat from './chat.js';

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "prosemirror-example-setup/style/style.css";
import "../style/layout.css";
import "../style/chat.scss";
import "../style/editor.scss";

import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {Schema, DOMParser} from "prosemirror-model"
import {schema} from "prosemirror-markdown";
import {exampleSetup} from "prosemirror-example-setup"

const editorNode = document.querySelector("#editor");

var eventBus = setupChat();
eventBus.oninit = function(event) {
  editorNode.innerHTML = "";
  console.log("Initializing editor", event.doc);
  window.view = new EditorView(editorNode, {
    state: EditorState.create({
      doc: schema.nodeFromJSON(event.doc),
      plugins: exampleSetup({schema: schema})
    })
  })
}
