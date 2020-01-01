(function() {
  var scrollEl = document.querySelector("#scrollto .inner");
  var scr = new ScrollBooster({
    viewport: document.querySelector("#scrollto .wrapper"),
    emulateScroll: true,
    onUpdate: function(data) {
      scrollEl.style.transform =
        "translate(" + -data.position.x + "px, " + -data.position.y + "px)";
    }
  });

  document.querySelector('#scrollto-button').addEventListener('click', function () {
    scr.scrollTo({
      x: Math.random() * 150,
      y: Math.random() * 150
    })
  })
})();
