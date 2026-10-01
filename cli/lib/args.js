"use strict";

// Reads the value that follows a flag in argv. A flag only counts as having
// a value when the following token exists AND does not itself look like
// another flag (start with "--") — otherwise "--waive --expires 2026-12-31"
// would read "--expires" as the waiver's reason, or an omitted "--lane"
// value would silently swallow whatever flag happened to come next. Both
// omission and this kind of collision are reported the same way: present
// with no usable value, distinct from the flag never being given at all.
//
// Returns { present, value }:
//   { present: false, value: null }  — the flag was not given at all
//   { present: true,  value: null }  — given, but with no usable value
//   { present: true,  value: str  }  — given, with this value
function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return { present: false, value: null };
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) return { present: true, value: null };
  return { present: true, value: next };
}

module.exports = { flagValue };
