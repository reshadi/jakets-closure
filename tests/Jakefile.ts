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

Jakets.GlobalTask(
  "jtsc_test"
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
      }
    ),
    ClosureTaskJava(
      "closure_java"
      , [CompileTask]
      , CompileDir + "/all_java.js"
      , [CompileDir + "/Main.js"]
    ),
  ]
  , async () => {
    let resultDir = '../build/compile'; //MakeRelative(CompileDir);
    require(`${resultDir}/all`);
    require(`${resultDir}/all_java`);
  }
);
