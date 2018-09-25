import * as assert from "assert";
import * as Jakets from "jakets/lib/Jakets";
import * as Tsc from "jakets/lib/TscTask";

import { ClosureTask as ClosureTaskJava } from "../lib/Closure";
import { ClosureTask, Exec } from "../lib/ClosureTask";

let MakeRelative = Jakets.CreateMakeRelative(__dirname);
let CompileDir = Jakets.BuildDir + "/compile";

let CompileTask = Tsc.TscTask(
  "tsc"
  , [MakeRelative("./Main.ts")]
  , []
  , {
    outDir: CompileDir,
    module: Tsc.ModuleKind.CommonJS,
    target: Tsc.ScriptTarget.ES5
  }
).GetName();

let JavaClosureTask = Jakets.Task(
  "java_closure"
  , [
    ClosureTaskJava(
      "closure_java"
      , [CompileTask]
      , CompileDir + "/all_java.js"
      , [CompileDir + "/Main.js"]
      , {
        define: ["Message='Hello'"]
      }
    )
  ]
  , async () => {
    require(`../build/compile/all_java`);
  }
);

let JsClosureTask = Jakets.Task(
  "js_closure"
  , [
    ClosureTask(
      "closure"
      , [CompileTask]
      , CompileDir + "/all.js"
      , [CompileDir + "/Main.js"]
      , {
        assumeFunctionWrapper: true,
        applyInputSourceMaps: true,
        outputWrapper: '(function(){\n%output%\n})()',
        createSourceMap: true,
        defines: {
          "Message": "Hello"
        },
        externs: [
          { src: "var exports;" },
          MakeRelative("./externs.js"),
        ]
      }
    )
  ]
  , async () => {
    let result = require(`../build/compile/all`);
    console.log(result);
    assert.equal(result.default, 'Hello  world! and Hi  universe!');
  }
);

Jakets.GlobalTask(
  "jtsc_test"
  , [
    JsClosureTask,
    // JavaClosureTask,
  ]
);
