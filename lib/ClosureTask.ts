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
  defines?: { [defineName: string]: string | number | boolean }; //=null
  define?: string[]; //old style for backward compatibility ["k=v", "x=y"]

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
  // externs?: ClosureOptions["jsCode"];
  externs?: (ClosureOptions["jsCode"][0] | string)[]; //Changed for backward compatibility

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

  if (allOptions.define) {
    //Conver old style to new
    allOptions.defines = allOptions.defines || {};
    allOptions.define.forEach(d => {
      let [key, value] = d.split("=");
      allOptions.defines[key] = value;
    });
    delete allOptions.define;
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

export async function Exec<CommandInfoType extends CommandInfo = CommandInfo>(inputs: string[], output: string, closureOptions?: ClosureOptions, enableGzip?: boolean, depInfo?: CommandInfoType) {
  let sectionName = depInfo
    ? `closure compile ${depInfo.Data.Name} with ${depInfo.DependencyFile}`
    : `closure compile ${output}`
    ;
  console.time(sectionName);

  let allOptions = GetOptions(closureOptions);


  if (allOptions.externs) {
    allOptions.externs = allOptions.externs.map(e => {
      if (typeof e === "string") {
        return { src: Fs.readFileSync(e, { encoding: "utf8" }) }
      } else {
        return e;
      }
    })
  }

  //In case we wanted to ready all files async
  let jsCode =
    (await Promise.all(inputs.map(f => ReadTextFile(f))))
      .map(text => { return { src: text }; });
  // let jsCode = inputs.map(f => { return { path: f } });

  allOptions.jsCode = (allOptions.jsCode && Array.isArray(allOptions.jsCode))
    ? allOptions.jsCode.concat(jsCode)
    : jsCode
    ;

  let results = <{ compiledCode: string; errors: any[]; warnings: any[] }>ClosureCompiler.compile(allOptions);
  if (results.errors && results.errors.length > 1) {
    Jakets.Log(results.errors, 0);
    process.exit(1);
  }

  if (results.warnings && results.warnings.length > 1) {
    console.warn(results.warnings);
  }


  jake.mkdirP(Path.dirname(output));
  Fs.writeFileSync(output, results.compiledCode, { encoding: "utf8" });

  if (enableGzip) {
    return Jakets.ExecAsync(`gzip --best < ${output} > ${output}.gz`);
  }

  console.timeEnd(sectionName);
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

  if (!Fs.existsSync(output) && Fs.existsSync(depInfo.DependencyFile)) {
    //Output might have been deleted but dep is still there
    Fs.unlinkSync(depInfo.DependencyFile);
  }

  let commandTask = Jakets.FileTask(depInfo.DependencyFile, depInfo.AllDependencies, async function () {
    depInfo.Write();
    await Exec(inputs, output, options, enableGzip);
  });

  return Jakets.FileTask(output, [commandTask], async function () {
    if (!Fs.existsSync(output)) {
      throw `Cannot find file ${output}`;
    }
  });
}