import * as Path from "path";
import * as Fs from "fs";
import * as Util from "util";
import * as Zlib from "zlib";
import * as ChildProcess from "child_process";
// import * as ClosureCompiler from "google-closure-compiler-js";
// const ClosureCompiler = require("google-closure-compiler-js");
const ClosureJsCompiler = require("google-closure-compiler").jsCompiler;

import * as Jakets from "jakets/lib/Jakets";
import { CommandInfo } from "jakets/lib/Command";

type Languages = "ES3" | "ES5" | "ES6" | "ECMASCRIPT3" | "ECMASCRIPT5" | "ECMASCRIPT5_STRICT" | "ECMASCRIPT6" | "ECMASCRIPT6_STRICT" | "ECMASCRIPT6_TYPED";
export interface ClosureOptions {
  //https://github.com/google/closure-compiler/wiki/Flags-and-Options
  //https://github.com/google/closure-compiler-js

  /** Generate $inject properties for AngularJS for functions annotated with @ngInject */
  angularPass?: boolean; //=false

  /**  Compose input source maps into output source map */
  applyInputSourceMaps?: boolean; //=true

  /** Enable additional optimizations based on the assumption that the output will be wrapped with a function wrapper. This flag is used to indicate that "global" declarations will not actually be global but instead isolated to the compilation unit. This enables additional optimizations. */
  assumeFunctionWrapper?: boolean; //=false

  /** Don't generate output. Run checks, but no optimization passes. */
  checksOnly?: boolean; //=false

  /**  Specifies the compilation level to use. */
  compilationLevel?: "WHITESPACE_ONLY" | "SIMPLE" | "ADVANCED"; //=SIMPLE;

  /**  */
  dartPass?: boolean; //=false

  /**  Overrides the value of variables annotated with @define, an object mapping names to primitive types */
  defines?: { [defineName: string]: string | number | boolean }; //=null
  define?: string[]; //old style for backward compatibility ["k=v", "x=y"]

  /** Determines the set of builtin externs to load. Options: BROWSER, CUSTOM */
  env?: "BROWSER" | "CUSTOM"; //=BROWSER

  /**  */
  exportLocalPropertyDefinitions?: boolean; //=false

  /** Generates export code for those marked with @export. */
  generateExports?: boolean; //=false

  /** Primary output filename. If not specified, output is written to stdout */
  jsOutputFile?: string;

  /** Sets what language spec that input sources conform to. */
  languageIn?: Languages; //=ES6;

  /** Sets what language spec the output should conform to. */
  languageOut?: Languages; //=ES5;

  /** Checks for type errors using the new type inference algorithm. */
  newTypeInf?: boolean; //=false

  /** Interpolate output into this string, replacing the token %output% */
  outputWrapper?: string; //=null;

  /** Loads the specified file and passes the file contents to the --output_wrapper flag, replacing the value if it exists. 
   * This is useful if you want special characters like newline in the wrapper 
   */
  outputWrapperFile?: string; //=null;

  /**  Specify the Polymer version pass to use. */
  polymerVersion?: string; //=null;

  /**  */
  preserveTypeAnnotations?: boolean; //=false

  /** Process CommonJS modules to a concatenable form, i.e., support require statements. */
  processCommonJsModules?: boolean; //=false

  /** Specifies the name of an object that will be used to store all non-extern globals. */
  renamePrefixNamespace?: string;

  /** Rewrite ES6 library calls to use polyfills provided by the compiler's runtime. */
  rewritePolyfills?: boolean; //=false

  /** Enable or disable the optimizations based on available type information. Inaccurate type annotations may result in incorrect results. */
  useTypesForOptimization?: boolean; //=false

  /** Specifies the warning level to use. Options: QUIET, DEFAULT, VERBOSE */
  warningLevel?: "QUIET" | "DEFAULT" | "VERBOSE"; //=DEFAULT;

  /**  Specifies the source code to compile. */
  jsCode?: { src?: string; path?: string; sourceMap?: string; }[];

  /**  Additional externs to use for this compile. */
  // externs?: ClosureOptions["jsCode"];
  // externs?: (Exclude<ClosureOptions["jsCode"], undefined>[0] | string)[]; //Changed for backward compatibility
  externs?: ({ src: string } | string)[]; //Changed for backward compatibility

  /** Generates a source map mapping the generated source file back to its original sources. */
  createSourceMap?: boolean; //=false

  /** for future expansions */
  // [option: string]: any;
}

/** Default arguments that can be overwritten via options */
export const DefaultClosureOptions: ClosureOptions = {
  compilationLevel: "ADVANCED",
  // language: "ECMASCRIPT5",
  languageIn: "ES5",
  //" --new_type_inf"; //Looks like crashes the compier sometimes
  // summary_detail_level: 3,
  warningLevel: "QUIET",
};

export function GetOptions(closureOptions?: ClosureOptions): ClosureOptions {
  let allOptions = Object.assign({}, DefaultClosureOptions, closureOptions || {});

  // if (allOptions.define) {
  //   //Convert array style to object style
  //   let defines = allOptions.defines || {};
  //   allOptions.define.forEach(d => {
  //     let [key, value] = d.split("=");
  //     defines[key] = value;
  //   });
  //   allOptions.defines = defines;
  //   // delete allOptions.define;
  // }

  if (allOptions.defines) {
    //Convert object style to array style
    let defines = allOptions.defines;
    allOptions.define =
      Object.keys(allOptions.defines)
        .map(key => {
          let value = defines[key];
          return (typeof value === "string" && !/^'[^']*'$/.test(value)) ? `${key}='${value}'` : `${key}=${value}`;
        })
        .concat(allOptions.define || []) //Already mixed define and defines
      ;
    delete allOptions.defines;
  }

  return allOptions;
}

async function ReadTextFile(path: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    Fs.readFile(path, { encoding: "utf8" }, (err, data) => {
      if (err) {
        const msg = `Cannot read file ${path} ${err}`;
        Jakets.Log(msg, 0);
        reject(msg);
      } else {
        resolve(data);
      }
    });
  });
}

const ExecAsync = Util.promisify(ChildProcess.exec);

export async function Exec<CommandInfoType extends CommandInfo = CommandInfo>(inputs: string[], output: string, closureOptions?: ClosureOptions, enableGzip?: boolean, depInfo?: CommandInfoType) {
  let sectionName = depInfo
    ? `closure compile ${depInfo.Data.Name} with ${depInfo.DependencyFile}`
    : `closure compile ${output}`
    ;
  console.time(sectionName);

  let allOptions = GetOptions(closureOptions);

  Jakets.Log(`options for ${sectionName}`, 0);
  Jakets.Log(Util.inspect(allOptions, { depth: null }), 0);
  // allOptions.jsOutputFile = output;
  jake.mkdirP(Path.dirname(output));

  if (allOptions.externs) {
    allOptions.externs = allOptions.externs.map((e, index) => {
      if (typeof e === "string") {
        return e;
      } else {
        let extrenFile = output + `.${index}.extern.js`;
        Fs.writeFileSync(extrenFile, e.src, { encoding: "utf8" });
        return extrenFile;
      }
    });
  }
  if (false && allOptions.outputWrapper) {
    let outputWrapperFile = output + `.outputWrapper.js`;
    Fs.writeFileSync(outputWrapperFile, allOptions.outputWrapper, { encoding: "utf8" });
    allOptions.outputWrapperFile = outputWrapperFile;
    delete allOptions.outputWrapper;
  }

  let command =
    // `node ./node_modules/bin/google-closure-compiler  --platform=javascript`
    `npx google-closure-compiler --platform=javascript`
    + inputs.map(input => " --js=" + input).join("")
    + " --js_output_file=" + output
    + Object.keys(allOptions).map(key => {
      let value = (<any>allOptions)[key];
      switch (key) {
        case "define":
      }
      if (Array.isArray(value)) {
        switch (key) {
          case "define": return value.map(v => ` --${key}="${v}"`).join("");
          default: return value.map(v => ` --${key}=${v}`).join("");
        }
      } else {
        switch (key) {
          case "outputWrapper": value = `"${value.replace(/\n/g, " ")}"`;
        }
        return ` --${key}=${value}`;
      }
    }).join(" ");

  // await Jakets.ExecAsync(command);
  Jakets.Log(command, 0);
  await ExecAsync(command, { env: process.env });

  console.timeEnd(sectionName);

  if (enableGzip) {
    await Jakets.ExecAsync(`gzip --best < ${output} > ${output}.gz`);
  }

  return;
  /**
   * The following would have worked, except
   * - The code is serial and wont run multiple tasks in parallel
   * - If java is available, will not use that
   * - Has problem with --define
   */
  return new Promise((resolve, reject) => {
    // type Compiler = import("google-closure-compiler").Compiler;
    // type Run = (filelist: ClosureOptions['jsCode'], callback?: Parameters<Compiler['run']>[0]) => ReturnType<Compiler['run']>;

    const compiler/* : Compiler & { run: Run } */ = new ClosureJsCompiler(allOptions);
    const compilerProcess = compiler.run(
      inputs.map(input => ({ path: input }))/* allOptions.jsCode */,
      (exitCode: number, results: { path: string; sourceMape: string; src: string }[], stdErr: string) => {
        if (exitCode > 0) {
          console.error(stdErr);
          reject();
          process.exit(1);
        }

        console.warn(stdErr);
        console.log(results);

        for (let result of results) {
          jake.mkdirP(Path.dirname(result.path));
          Fs.writeFileSync(result.path, result.src, { encoding: "utf8" });
          if (result.sourceMape) {
            Fs.writeFileSync(result.path + ".map", result.sourceMape, { encoding: "utf8" });
          }
        }

        console.timeEnd(sectionName);

        if (enableGzip) {
          Jakets.ExecAsync(`gzip --best < ${output} > ${output}.gz`).then(resolve, reject);
        } else {
          resolve();
        }
      }
    );
  });
}

export function ClosureTask(
  name: string
  , dependencies: string[]
  , output: string
  , inputs: string[]
  , closureOptions?: ClosureOptions
  , enableGzip?: boolean
): Jakets.FileTaskType {

  let allDeps = Array.from(dependencies);

  let allOptions = GetOptions(closureOptions);

  if (allOptions.externs) {
    allOptions.externs.forEach(e => {
      if (typeof e === 'string') {
        allDeps.push(e);
        // } else if (e.path) {
        //   allDeps.push(e.path);
      }
    });
  }

  let depInfo = new CommandInfo({
    Name: name,
    Dir: Path.resolve(Jakets.LocalDir),
    Command: "closure-js",
    Inputs: inputs,
    Outputs: [output],
    Options: allOptions,
    Dependencies: allDeps
  });

  if (!Fs.existsSync(output) && Fs.existsSync(depInfo.DependencyFile)) {
    //Output might have been deleted but dep is still there
    Fs.unlinkSync(depInfo.DependencyFile);
  }

  let commandTask = Jakets.FileTask(depInfo.DependencyFile, depInfo.AllDependencies, async function () {
    depInfo.Write();
    await Exec(inputs, output, allOptions, enableGzip);
  });

  return Jakets.FileTask(output, [commandTask], async function () {
    if (!Fs.existsSync(output)) {
      throw `Cannot find file ${output}`;
    }
  });
}

/*
  .\node_modules\.bin\google-closure-compiler-js.cmd  --applyInputSourceMaps true --assumeFunctionWrapper true --compilationLevel 'ADVANCED' --createSourceMap true --languageIn 'ES5' --outputWrapper '(function(){\n%output%\n})()' --warningLevel 'QUIET' --jsCode build/compile/Main.js
*/
