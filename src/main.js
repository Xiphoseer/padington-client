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

const docJSON = {
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level":1 },
      "content": [
        {"type":"text","text":"Padington"}
      ]
    },
    {
      "type": "code_block",
      "attrs": { "params": "" },
      "content": [
        {
          "type": "text",
          "text": "fn foo(a: u32) -> u32 {\n  2 * a\n}"
        }
      ]
    },
    {
      "type": "blockquote",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet."
            }
          ]
        }
      ]
    }
  ]
};

const editorNode = document.querySelector("#editor");
editorNode.innerHTML = "";

window.view = new EditorView(editorNode, {
  state: EditorState.create({
    doc: schema.nodeFromJSON(docJSON),
    plugins: exampleSetup({schema: schema})
  })
})

setupChat();
