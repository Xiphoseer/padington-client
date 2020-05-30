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
import {Step} from "prosemirror-transform"
import {schema} from "prosemirror-markdown"
import {exampleSetup} from "prosemirror-example-setup"
import {collab, sendableSteps, receiveTransaction, getVersion} from "prosemirror-collab"

const editorNode = document.querySelector("#editor");

var eventBus = setupChat();
eventBus.oninit = function(event) {
  editorNode.innerHTML = "";
  console.log("Initializing editor", event.doc);

  let plugins = exampleSetup({schema: schema});
  // TODO: event.version ???
  plugins.push(collab({version: 0, clientID: event.clientID}));

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
        eventBus.sendSteps(sendable.version, sendable.steps, sendable.clientID)
      }
    }
  })

  eventBus.onnewsteps = function(newData) {
    let currentVersion = getVersion(view.state);
    //let newData = authority.stepsSince()
    let steps = newData.steps.map(step => Step.fromJSON(schema, step));

    view.dispatch(receiveTransaction(view.state, steps, newData.clientIDs));
  }
}
