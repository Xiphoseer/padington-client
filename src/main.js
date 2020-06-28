import setupChat from './chat.js';

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "prosemirror-example-setup/style/style.css";
import "@fortawesome/fontawesome-free/scss/solid.scss";
import "@fortawesome/fontawesome-free/scss/fontawesome.scss";
import "../style/layout.css";
import "../style/chat.scss";
import "../style/editor.scss";

import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {Schema, DOMParser} from "prosemirror-model"
import {Step} from "prosemirror-transform"
import {schema} from "prosemirror-markdown"
import {exampleSetup} from "prosemirror-example-setup"
import {collab, sendableSteps, receiveTransaction, getVersion} from "prosemirror-collab"

const editorNode = document.querySelector("#editor");

var padington = setupChat();

padington.oninit = function(event) {
  editorNode.innerHTML = "";
  console.log("Initializing editor", event.doc);

  let plugins = exampleSetup({schema: schema, floatingMenu: true});
  let version = event.version;
  plugins.push(collab({version: version, clientID: padington.id}));

  window.view = new EditorView(editorNode, {
    state: EditorState.create({
      doc: schema.nodeFromJSON(event.doc),
      plugins: plugins,
    }),
    dispatchTransaction(transaction) {
      let newState = view.state.apply(transaction)
      view.updateState(newState)
      let sendable = sendableSteps(newState)
      if (sendable) {
        padington.sendSteps(sendable.version, sendable.steps)
      }
    }
  })

  padington.onsteps = function(event) {
    let currentVersion = getVersion(view.state);
    let steps = event.steps.map(step => Step.fromJSON(schema, step));

    view.dispatch(receiveTransaction(view.state, steps, event.clientIDs));
  }
}
