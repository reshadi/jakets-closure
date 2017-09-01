import * as Path from "path";
import * as Fs from "fs";
import * as Zlib from "zlib";
import * as ClosureCompiler from "google-closure-compiler-js";
import * as Jakets from "jakets/lib/Jakets";
import * as Util from "jakets/lib/Util";
import { CommandInfo } from "jakets/lib/Command";

type Languages = "ES3" | "ES5" | "ES6" | "ECMASCRIPT3" | "ECMASCRIPT5" | "ECMASCRIPT5_STRICT" | "ECMASCRIPT6" | "ECMASCRIPT6_STRICT" | "ECMASCRIPT6_TYPED";
export interface ClosureOptions {
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
  defines?: { [defineName: string]: string }; //=null

  /** Determines the set of builtin externs to load. Options: BROWSER, CUSTOM */
  env?: "BROWSER" | "CUSTOM"; //=BROWSER

  /**  */
  exportLocalPropertyDefinitions?: boolean; //=false

  /** Generates export code for those marked with @export. */
  generateExports?: boolean; //=false

  /** Sets what language spec that input sources conform to. */
  languageIn?: Languages; //=ES6;

  /** Sets what language spec the output should conform to. */
  languageOut?: Languages; //=ES5;

  /** Checks for type errors using the new type inference algorithm. */
  newTypeInf?: boolean; //=false

  /**  Interpolate output into this string, replacing the token %output% */
  outputWrapper?: string; //=null;

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
  externs?: ClosureOptions["jsCode"];

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
  return allOptions;
}

export async function Exec(inputs: string[], output: string, closureOptions?: ClosureOptions, enableGzip?: boolean) {
  let allOptions = GetOptions(closureOptions);

  //In case we wanted to ready all files async
  let jsCode = await Promise.all(
    inputs.map(f => new Promise((resolve, reject) => {
      Fs.readFile(f, { encoding: "utf8" }, (err, data) => {
        if (err) {
          const msg = `Cannot read file ${f} ${err}`;
          Jakets.Log(msg, 0);
          reject(msg);
        } else {
          resolve({ src: data });
        }
      })
    }))
  );
  // let jsCode = inputs.map(f => { return { path: f } });

  allOptions.jsCode = (allOptions.jsCode && Array.isArray(allOptions.jsCode))
    ? allOptions.jsCode.concat(jsCode)
    : jsCode
    ;

  let results = <{ compiledCode: string; errors: string[]; }>ClosureCompiler.compile(allOptions);
  if (results.errors && results.errors.length > 1) {
    console.error(results);
    throw "Closure error";
  }

  jake.mkdirP(Path.dirname(output));
  Fs.writeFileSync(output, results.compiledCode, { encoding: "utf8" });

  if (enableGzip) {
    return Jakets.ExecAsync(`gzip --best < ${output} > ${output}.gz`);
  }
}

export function ClosureTask(
  name: string
  , dependencies: string[]
  , output: string
  , inputs: string[]
  , options?: ClosureOptions
  , enableGzip?: boolean
): Jakets.FileTaskType {
  options = GetOptions(options);

  let depInfo = new CommandInfo({
    Name: name,
    Dir: Path.resolve(Util.LocalDir),
    Command: "closure-js",
    Inputs: inputs,
    Outputs: [output],
    Options: options,
    Dependencies: dependencies
  });

  return Jakets.FileTask(depInfo.DependencyFile, depInfo.AllDependencies, async function () {
    let sectionName = `closure compile ${depInfo.Data.Name} with ${depInfo.DependencyFile}`;
    console.time(sectionName);

    await Exec(inputs, output, options, enableGzip);
    depInfo.Write();

    console.timeEnd(sectionName);
  });
}