(function() {
  var scrollEl = document.querySelector("#init .inner");
  var scr;

  beforeEach(function(done) {
    scr = new ScrollBooster({
      viewport: document.querySelector("#init .wrapper"),
      content: scrollEl,
      onUpdate: function(data) {
        scrollEl.style.transform =
          "translate(" + -data.position.x + "px, " + -data.position.y + "px)";
      }
    });
    setTimeout(done, 300);
  });

  describe("Init", function() {
    it("Init properties", function() {
      chai.expect(scr.position.x).to.equal(0);
      chai.expect(scr.position.y).to.equal(0);

      chai.expect(scr.props.viewport).to.be.an.instanceof(Element);
      chai.expect(scr.props.content).to.be.an.instanceof(Element);

      chai.expect(scr.viewport.width).to.equal(300);
      chai.expect(scr.viewport.height).to.equal(300);

      chai.expect(scr.content.width).to.gt(300);
      chai.expect(scr.content.height).to.gt(300);
    });
  });
})();
