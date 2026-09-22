/* Rewrite local /cards-fr/ paths (and GitHub blob pages) to raw GitHub images. */
(function () {
  var TO =
    "https://raw.githubusercontent.com/xwjtd6mtg7-sketch/grand-line-tcg/main/site/cards-fr/";
  var BLOB =
    "https://github.com/xwjtd6mtg7-sketch/grand-line-tcg/blob/main/site/cards-fr/";
  function fix(u) {
    if (typeof u !== "string" || !u) return u;
    if (u.indexOf("/cards-fr/") === 0) return TO + u.slice("/cards-fr/".length);
    if (u.indexOf(BLOB) === 0) return TO + u.slice(BLOB.length);
    return u;
  }
  window.GL_CARD_CDN = TO;
  window.GL_cardSrc = fix;

  var desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (desc && desc.set) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (v) {
        desc.set.call(this, fix(v));
      },
    });
  }
  var sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (n === "src" || n === "href") v = fix(String(v));
    return sa.call(this, n, v);
  };
  if (window.fetch) {
    var ofetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      if (typeof input === "string") input = fix(input);
      return ofetch(input, init);
    };
  }
})();
