// The shared package compiles without Node or DOM types so it stays usable from Expo.
// Declare only the cross-runtime web APIs we rely on (available in Node, browsers, and Expo).
declare class URL {
  constructor(url: string, base?: string);
  readonly origin: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}
