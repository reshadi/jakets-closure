import * as Path from "path";
import * as Fs from "fs";
import * as Zlib from "zlib";

import * as Jakets from "jakets/lib/Jakets";
import * as Util from "jakets/lib/Util";
import { CommandInfo, ExtractFilesAndUpdateDependencyInfo } from "jakets/lib/Command";

let ClosureJar = Util.FindModulePath("google-closure-compiler/compiler.jar", [".."]);

let RawExec = Util.CreateExec("java -jar " + ClosureJar);

export interface ClosureOptions {
  //https://developers.google.com/closure/compiler/docs/api-ref
  define?: string[];
  summary_detail_level?: number;
  // language?: "ECMASCRIPT3" | "ECMASCRIPT5" | "ECMASCRIPT5_STRICT" | "ECMASCRIPT6" | "ECMASCRIPT6_STRICT";
  language?: "ES3" | "ES5" | "ECMASCRIPT5_STRICT" | "ECMASCRIPT6" | "ECMASCRIPT6_STRICT";
  language_in?: ClosureOptions["language"],
  language_out?: ClosureOptions["language"],
  compilation_level?: "WHITESPACE_ONLY" | "SIMPLE_OPTIMIZATIONS" | "ADVANCED_OPTIMIZATIONS";
  externs?: string[];
  warning_level?: "QUIET" | "DEFAULT" | "VERBOSE";
  output_wrapper?: string;
  js_output_file?: string;
  js?: string[];
  [option: string]: string | string[] | number;
}

/** Default arguments that can be overwritten via options */
export const DefaultClosureOptions: ClosureOptions = {
  compilation_level: "ADVANCED_OPTIMIZATIONS",
  // language: "ECMASCRIPT5",
  language_in: "ES5",
  //" --new_type_inf"; //Looks like crashes the compier sometimes
  summary_detail_level: 3,
  warning_level: "QUIET",
};

export function GetOptions(inputs: string[], output: string, closureOptions?: ClosureOptions): ClosureOptions {
  let allOptions = Object.assign(
    {}
    , DefaultClosureOptions
    , {
      js_output_file: output,
      js: inputs
    }
    , closureOptions || {}
  );
  return allOptions;
}

export async function Exec(options: ClosureOptions, enableGzip?: boolean) {
  let args =
    Object.keys(options)
      .map(option => {
        let optionValue = options[option];
        let arg: string;

        if (typeof optionValue === "string" || typeof optionValue === "number") {
          arg = ` --${option} ${optionValue}`;
        } else if (Array.isArray(optionValue)) {
          arg = optionValue.map(v => ` --${option} ${v}`).join(" ");
        } else {
          throw `Does not know what to do with closure option ${option}:${optionValue}`;
        }
        return arg;
      })
      .join(" ");

  let output = options.js_output_file;
  jake.mkdirP(Path.dirname(output));

  return new Promise((resolve, reject) => {
    RawExec(
      args,
      enableGzip
        ? () => Jakets.Exec("gzip --best < " + output + " > " + output + ".gz", resolve)
        : resolve
    );
  });
}

export function ClosureTask(
  name: string
  , dependencies: string[]
  , output: string
  , inputs: string[]
  , options?: ClosureOptions
  , enableGzip?: boolean
): Jakets.FileTaskType {
  options = GetOptions(inputs, output, options);
  let depInfo = new CommandInfo({
    Name: name,
    Dir: Path.resolve(Util.LocalDir),
    Command: "closure-java",
    Inputs: inputs,
    Outputs: [output],
    Options: options,
    Dependencies: dependencies
  });

  if (!Fs.existsSync(output) && Fs.existsSync(depInfo.DependencyFile)) {
    //Output might have been deleted but dep is still there
    Fs.unlinkSync(depInfo.DependencyFile);
  }

  let commandTask = Jakets.FileTask(depInfo.DependencyFile, depInfo.AllDependencies, async function () {
    let sectionName = `java closure compile ${depInfo.Data.Name} with ${depInfo.DependencyFile}`;
    console.time(sectionName);

    depInfo.Write();
    await Exec(options, enableGzip);

    console.timeEnd(sectionName);
  });

  return Jakets.FileTask(output, [commandTask], async function () {
    if (!Fs.existsSync(output)) {
      throw `Cannot find file ${output}`;
    }
  });
}