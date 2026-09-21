import assert from "node:assert/strict";
import { registerGptworkerControlTool } from "../dist/tools/control.js";
import {
  GPTWORKER_HELP,
  GPTWORKER_ROOT_MENU,
} from "../dist/lib/quickstart.js";

const registered = new Map();
const fakeServer = {
  registerTool(name, config, callback) {
    registered.set(name, { config, callback });
    return {
      remove() {},
      update() {},
      enable() {},
      disable() {},
      enabled: true,
    };
  },
};

registerGptworkerControlTool(fakeServer);
const control = registered.get("gptworker_control");
assert.ok(control, "gptworker_control was not registered");

const commands = await control.callback({ surface: "commands" });
assert.equal(commands.content.length, 1);
assert.equal(commands.content[0].type, "text");
assert.equal(commands.content[0].text, GPTWORKER_ROOT_MENU);
assert.equal(commands.structuredContent.text, GPTWORKER_ROOT_MENU);

const help = await control.callback({ surface: "help" });
assert.equal(help.content.length, 1);
assert.equal(help.content[0].type, "text");
assert.equal(help.content[0].text, GPTWORKER_HELP);
assert.equal(help.structuredContent.text, GPTWORKER_HELP);

console.log("test-control-surface: ok");
