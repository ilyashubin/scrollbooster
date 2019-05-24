!function (t, i) {
    "object" == typeof exports && "object" == typeof module ? module.exports = i() : "function" == typeof define && define.amd ? define("ScrollBooster", [], i) : "object" == typeof exports ? exports.ScrollBooster = i() : t.ScrollBooster = i()
}("undefined" != typeof self ? self : this, function () {
    return function (t) {
        function i(o) {
            if (e[o]) return e[o].exports;
            var n = e[o] = {i: o, l: !1, exports: {}};
            return t[o].call(n.exports, n, n.exports, i), n.l = !0, n.exports
        }

        var e = {};
        return i.m = t, i.c = e, i.d = function (t, e, o) {
            i.o(t, e) || Object.defineProperty(t, e, {configurable: !1, enumerable: !0, get: o})
        }, i.n = function (t) {
            var e = t && t.__esModule ? function () {
                return t.default
            } : function () {
                return t
            };
            return i.d(e, "a", e), e
        }, i.o = function (t, i) {
            return Object.prototype.hasOwnProperty.call(t, i)
        }, i.p = "/dist/", i(i.s = 0)
    }([function (t, i, e) {
        "use strict";

        function o(t, i) {
            if (!(t instanceof i)) throw new TypeError("Cannot call a class as a function")
        }

        function n(t) {
            return Math.max(t.offsetWidth, t.scrollWidth)
        }

        function s(t) {
            return Math.max(t.offsetHeight, t.scrollHeight)
        }

        function r(t, i, e) {
            for (var o = void 0, n = t.childNodes, s = document.createRange(), r = 0; o = n[r], r < n.length; r++) if (3 === o.nodeType) {
                s.selectNodeContents(o);
                var h = s.getBoundingClientRect();
                if (i >= h.left && e >= h.top && i <= h.right && e <= h.bottom) return o
            }
            return !1
        }

        function h() {
            var t = window.getSelection ? window.getSelection() : document.selection;
            t && (t.removeAllRanges ? t.removeAllRanges() : t.empty && t.empty())
        }

        Object.defineProperty(i, "__esModule", {value: !0});
        var c = Object.assign || function (t) {
            for (var i = 1; i < arguments.length; i++) {
                var e = arguments[i];
                for (var o in e) Object.prototype.hasOwnProperty.call(e, o) && (t[o] = e[o])
            }
            return t
        }, l = function () {
            function t(t, i) {
                for (var e = 0; e < i.length; e++) {
                    var o = i[e];
                    o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(t, o.key, o)
                }
            }

            return function (i, e, o) {
                return e && t(i.prototype, e), o && t(i, o), i
            }
        }(), p = function () {
            function t() {
                var i = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                if (o(this, t), !(i.viewport && i.viewport instanceof Element)) return void console.error('"viewport" config property must be present and must be Element');
                var e = {
                    handle: i.viewport,
                    content: i.viewport.children[0],
                    bounce: !0,
                    friction: .05,
                    bounceForce: .1,
                    textSelection: !1,
                    onClick: function () {
                    },
                    shouldScroll: function () {
                        return !0
                    },
                    onUpdate: function () {
                    }
                };
                if (this.props = c({}, e, i), !this.props.content) return void console.error("Viewport does not have any content");
                this.viewport = {
                    width: this.props.viewport.clientWidth,
                    height: this.props.viewport.clientHeight
                }, this.content = {width: n(this.props.content), height: s(this.props.content)}, this.position = {
                    x: 0,
                    y: 0
                }, this.velocity = {
                    x: 0,
                    y: 0
                }, this.friction = 1 - this.props.friction, this.bounceForce = this.props.bounceForce, this.isDragging = !1, this.dragStartPosition = {
                    x: 0,
                    y: 0
                }, this.dragOffsetPosition = c({}, this.dragStartPosition), this.dragPosition = c({}, this.position), this.isScrollEnabled = !!this.props.emulateScroll, this.isScrolling = !1, this.scrollOffset = {
                    x: 0,
                    y: 0
                }, this.bounce = this.props.bounce, this.textSelection = this.props.textSelection, this.boundX = {
                    from: Math.min(-this.content.width + this.viewport.width, 0),
                    to: 0
                }, this.boundY = {
                    from: Math.min(-this.content.height + this.viewport.height, 0),
                    to: 0
                }, this.mode = {
                    x: "x" == this.props.mode,
                    y: "y" == this.props.mode,
                    xy: "x" !== this.props.mode && "y" !== this.props.mode
                }, this.isRunning = !1, this.rafID = null, this.events = {}, this.animate(), this.handleEvents()
            }

            return l(t, [{
                key: "run", value: function () {
                    var t = this;
                    this.isRunning = !0, cancelAnimationFrame(this.rafID), this.rafID = requestAnimationFrame(function () {
                        return t.animate()
                    })
                }
            }, {
                key: "animate", value: function () {
                    var t = this;
                    this.isRunning && (this.update(), this.notify(), this.rafID = requestAnimationFrame(function () {
                        return t.animate()
                    }))
                }
            }, {
                key: "update", value: function () {
                    this.applyBoundForce(), this.applyDragForce(), this.applyScrollForce(), this.velocity.x *= this.friction, this.velocity.y *= this.friction, this.mode.y || (this.position.x += this.velocity.x), this.mode.x || (this.position.y += this.velocity.y), this.bounce && !this.isScrolling || (this.position.x = Math.max(Math.min(this.position.x, this.boundX.to), this.boundX.from), this.position.y = Math.max(Math.min(this.position.y, this.boundY.to), this.boundY.from)), !this.isDragging && !this.isScrolling && Math.abs(this.velocity.x) < .1 && Math.abs(this.velocity.y) < .1 && (this.isRunning = !1)
                }
            }, {
                key: "applyForce", value: function (t) {
                    this.velocity.x += t.x, this.velocity.y += t.y
                }
            }, {
                key: "applyBoundForce", value: function () {
                    if (this.bounce && !this.isDragging) {
                        var t = this.position.x < this.boundX.from, i = this.position.x > this.boundX.to,
                            e = this.position.y < this.boundY.from, o = this.position.y > this.boundY.to,
                            n = {x: 0, y: 0};
                        if (t || i) {
                            var s = t ? this.boundX.from : this.boundX.to, r = s - this.position.x,
                                h = r * this.bounceForce,
                                c = this.position.x + (this.velocity.x + h) / (1 - this.friction);
                            t && c < this.boundX.from || i && c > this.boundX.to || (h = r * this.bounceForce - this.velocity.x), n.x = h
                        }
                        if (e || o) {
                            var l = e ? this.boundY.from : this.boundY.to, p = l - this.position.y,
                                a = p * this.bounceForce,
                                u = this.position.y + (this.velocity.y + a) / (1 - this.friction);
                            e && u < this.boundY.from || o && u > this.boundY.to || (a = p * this.bounceForce - this.velocity.y), n.y = a
                        }
                        this.applyForce(n)
                    }
                }
            }, {
                key: "applyDragForce", value: function () {
                    if (this.isDragging) {
                        var t = {x: this.dragPosition.x - this.position.x, y: this.dragPosition.y - this.position.y},
                            i = {x: t.x - this.velocity.x, y: t.y - this.velocity.y};
                        this.applyForce(i)
                    }
                }
            }, {
                key: "applyScrollForce", value: function () {
                    if (this.isScrolling) {
                        var t = {x: this.scrollOffset.x - this.velocity.x, y: this.scrollOffset.y - this.velocity.y};
                        this.scrollOffset.x = 0, this.scrollOffset.y = 0, this.applyForce(t)
                    }
                }
            }, {
                key: "setPosition", value: function () {
                    var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                    this.velocity.x = 0, this.velocity.y = 0, this.position.x = -t.x || 0, this.position.y = -t.y || 0, this.run()
                }
            }, {
                key: "getUpdate", value: function () {
                    return {
                        isRunning: this.isRunning,
                        isDragging: this.isDragging,
                        isScrolling: this.isScrolling,
                        position: {x: -this.position.x, y: -this.position.y},
                        dragOffsetPosition: this.dragOffsetPosition,
                        viewport: c({}, this.viewport),
                        content: c({}, this.content)
                    }
                }
            }, {
                key: "notify", value: function () {
                    this.props.onUpdate(this.getUpdate())
                }
            }, {
                key: "updateMetrics", value: function () {
                    this.viewport.width = this.props.viewport.clientWidth, this.viewport.height = this.props.viewport.clientHeight, this.content.width = n(this.props.content), this.content.height = s(this.props.content), this.boundX.from = Math.min(-this.content.width + this.viewport.width, 0), this.boundY.from = Math.min(-this.content.height + this.viewport.height, 0), this.run()
                }
            }, {
                key: "handleEvents", value: function () {
                    var t = this, i = this.props.viewport, e = {x: 0, y: 0}, o = {x: 0, y: 0}, n = !1,
                        s = function (i) {
                            var e = void 0, s = void 0;
                            n ? (e = i.touches[0].pageX, s = i.touches[0].pageY) : (e = i.pageX, s = i.pageY), t.dragOffsetPosition.x = e - o.x, t.dragOffsetPosition.y = s - o.y, t.dragPosition.x = t.dragStartPosition.x + t.dragOffsetPosition.x, t.dragPosition.y = t.dragStartPosition.y + t.dragOffsetPosition.y, n || i.preventDefault()
                        };
                    this.events.pointerdown = function (c) {
                        var l = void 0, p = void 0, a = void 0, u = void 0;
                        n = !(!c.touches || !c.touches[0]), n ? (l = c.touches[0].pageX, p = c.touches[0].pageY, a = c.touches[0].clientX, u = c.touches[0].clientY) : (l = c.pageX, p = c.pageY, a = c.clientX, u = c.clientY);
                        var d = i.getBoundingClientRect();
                        if (!(a - d.left >= i.clientLeft + i.clientWidth) && !(u - d.top >= i.clientTop + i.clientHeight) && t.props.shouldScroll(t.getUpdate(), c)) {
                            if (t.textSelection) {
                                if (r(c.target, a, u)) return;
                                h()
                            }
                            t.isDragging = !0, (e.x || e.y) && (t.position.x = e.x, t.position.y = e.y, e.x = 0, e.y = 0), o.x = l, o.y = p, t.dragStartPosition.x = t.position.x, t.dragStartPosition.y = t.position.y, s(c), t.run();
                            var v = void 0, f = void 0;
                            f = function (i) {
                                t.isDragging = !1, n ? (window.removeEventListener("touchmove", s), window.removeEventListener("touchend", v)) : (window.removeEventListener("mousemove", s), window.removeEventListener("mouseup", v))
                            }, n ? (v = window.addEventListener("touchend", f), window.addEventListener("touchmove", s)) : (v = window.addEventListener("mouseup", f), window.addEventListener("mousemove", s))
                        }
                    };
                    var c = null;
                    this.events.wheel = function (i) {
                        t.velocity.x = 0, t.isScrollEnabled && (t.isScrolling = !0, t.scrollOffset.x = -i.deltaX, t.scrollOffset.y = -i.deltaY, t.run(), clearTimeout(c), c = setTimeout(function () {
                            return t.isScrolling = !1
                        }, 80), i.preventDefault())
                    }, this.events.scroll = function (i) {
                        var o = t.props.viewport.scrollLeft, n = t.props.viewport.scrollTop;
                        Math.abs(t.position.x + o) > 3 && (t.position.x = -o, t.velocity.x = 0), Math.abs(t.position.y + n) > 3 && (t.position.y = -n, t.velocity.y = 0), e.x = -t.props.viewport.scrollLeft, e.y = -t.props.viewport.scrollTop
                    }, this.events.click = function (i) {
                        t.props.onClick(t.getUpdate(), i)
                    }, this.events.resize = this.updateMetrics.bind(this), this.props.handle.addEventListener("mousedown", this.events.pointerdown), this.props.handle.addEventListener("touchstart", this.events.pointerdown), this.props.handle.addEventListener("click", this.events.click), this.props.viewport.addEventListener("wheel", this.events.wheel), this.props.viewport.addEventListener("scroll", this.events.scroll), window.addEventListener("resize", this.events.resize)
                }
            }, {
                key: "destroy", value: function () {
                    this.props.handle.removeEventListener("mousedown", this.events.pointerdown), this.props.handle.removeEventListener("touchstart", this.events.pointerdown), this.props.handle.removeEventListener("click", this.events.click), this.props.viewport.removeEventListener("wheel", this.events.wheel), this.props.viewport.removeEventListener("scroll", this.events.scroll), window.removeEventListener("resize", this.events.resize)
                }
            }, {
                key: "enable", value: function () {
                    this.props.handle.addEventListener("mousedown", this.events.pointerdown), this.props.handle.addEventListener("touchstart", this.events.pointerdown), this.props.handle.addEventListener("click", this.events.click), this.props.viewport.addEventListener("wheel", this.events.wheel), this.props.viewport.addEventListener("scroll", this.events.scroll), window.addEventListener("resize", this.events.resize)
                }
            }
            ]), t
        }();
        i.default = p, t.exports = i.default
    }])
});
