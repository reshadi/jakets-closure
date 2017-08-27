// import * as M1 from "./Module1";
// import * as M2 from "./Module2";

namespace M1 {
  export function F1() {
    return "Hello";
  }

  export function F2() {
    return " world!";
  }
}
namespace M2 {
  export function F1() {
    return "Hi";
  }

  export function F2() {
    return " universe!";
  }
}
console.log(`${M1.F1()} ${M1.F2()} and ${M2.F1()} ${M2.F2()}`);