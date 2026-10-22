export type GoogleTag = (...args: unknown[]) => void;

export function createGoogleTagQueue(push: (entry: IArguments) => void): GoogleTag {
  return function () {
    // gtag.js processes Arguments objects for commands; plain arrays are ignored.
    // https://developers.google.com/tag-platform/gtagjs
    // eslint-disable-next-line prefer-rest-params
    push(arguments);
  };
}
