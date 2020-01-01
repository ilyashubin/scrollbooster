(function() {
  var scrollEl = document.querySelector("#yonly .inner");
  var scr = new ScrollBooster({
    viewport: document.querySelector("#yonly .wrapper"),
    direction: "vertical",
    emulateScroll: true,
    onUpdate: function(data) {
      scrollEl.style.transform =
        "translate(" + -data.position.x + "px, " + -data.position.y + "px)";
    }
  });
  scr.setPosition({
    y: 100
  });
})();
