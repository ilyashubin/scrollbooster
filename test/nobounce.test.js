(function() {
  var scrollEl = document.querySelector("#nobounce .inner");
  var scr = new ScrollBooster({
    viewport: document.querySelector("#nobounce .wrapper"),
    emulateScroll: true,
    bounce: false,
    onUpdate: function(data) {
      scrollEl.style.transform =
        "translate(" + -data.position.x + "px, " + -data.position.y + "px)";
    }
  });
})();
