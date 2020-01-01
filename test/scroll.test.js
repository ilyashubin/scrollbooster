(function() {
  var viewportEl = document.querySelector("#scroll .wrapper");
  var scr;

  beforeEach(function(done) {
    scr = new ScrollBooster({
      viewport: viewportEl,
      emulateScroll: true,
      onUpdate: function(data) {
        viewportEl.scrollTop = data.position.y;
        viewportEl.scrollLeft = data.position.x;
      }
    });
    scr.setPosition({ x: 100, y: 100 });
    setTimeout(done, 300);
  });

  describe("Scroll", function() {
    it("Scroll test", function() {
      chai.expect(scr.position.x).to.equal(-100);
      chai.expect(scr.position.y).to.equal(-100);

      let st = viewportEl.scrollTop;
      chai.expect(st).to.equal(100);
    });
  });
})();
