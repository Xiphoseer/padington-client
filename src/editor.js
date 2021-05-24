import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
//import {Schema, DOMParser} from "prosemirror-model"
import {Step} from "prosemirror-transform"
import {schema} from "prosemirror-markdown"
import {exampleSetup} from "prosemirror-example-setup"
import {collab, sendableSteps, receiveTransaction, getVersion} from "prosemirror-collab"



export default function setupEditor(client) {
  const editorNode = document.querySelector("#editor");

  client.addEventListener('init', function(event) {
    editorNode.innerHTML = "";
    console.log("Initializing editor", event.doc);

    let plugins = exampleSetup({schema: schema, floatingMenu: true});
    let version = event.version;
    plugins.push(collab({version: version, clientID: client.id}));

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
          client.sendSteps(sendable.version, sendable.steps)
        }
      }
    });

    client.addEventListener('steps', function(event) {
      let currentVersion = getVersion(view.state);
      let steps = event.steps.map(step => Step.fromJSON(schema, step));

      view.dispatch(receiveTransaction(view.state, steps, event.clientIDs));
    });
  });
}
