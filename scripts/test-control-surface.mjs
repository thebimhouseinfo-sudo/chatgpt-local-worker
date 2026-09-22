import assert from "node:assert/strict";
import { registerGptworkerControlTool } from "../dist/tools/control.js";
import {
  GPTWORKER_HELP,
  GPTWORKER_ROOT_MENU,
} from "../dist/lib/quickstart.js";
import { requiresWorkHandle } from "../dist/lib/tool-work-policy.js";

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
assert.ok(
  control.config.description.includes("Use ONLY when the entire trimmed user command is exactly"),
  "gptworker_control must be restricted to exact root/help commands"
);
assert.ok(
  control.config.description.includes("NEVER use this tool for gr/job"),
  "gptworker_control must explicitly reject gr/job routing"
);

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

assert.equal(
  requiresWorkHandle("gptworker_control"),
  false,
  "gptworker_control must be a control tool and not require a work handle"
);
assert.equal(
  requiresWorkHandle("gptworker_admission"),
  false,
  "gptworker_admission must be a control tool and not require a work handle"
);

console.log("test-control-surface: ok");
