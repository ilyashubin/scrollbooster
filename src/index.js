const getFullWidth = (elem) => Math.max(elem.offsetWidth, elem.scrollWidth);
const getFullHeight = (elem) => Math.max(elem.offsetHeight, elem.scrollHeight);

const textNodeFromPoint = (element, x, y) => {
  const nodes = element.childNodes;
  const range = document.createRange();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType !== 3) { continue; }
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom) {
      return node;
    }
  }
  return false;
};

const clearTextSelection = () => {
  const selection = window.getSelection ? window.getSelection() : document.selection;
  if (!selection) { return; }
  if (selection.removeAllRanges) {
    selection.removeAllRanges();
  } else if (selection.empty) {
    selection.empty();
  }
};

export default class ScrollBooster {
  constructor(options = {}) {
    const defaults = {
      content: options.viewport.children[0],
      direction: 'all', // 'vertical', 'horizontal'
      pointerMode: 'all', // 'touch', 'mouse'
      bounce: true,
      friction: 0.05,
      bounceForce: 0.1,
      textSelection: false,
      inputsFocus: true,
      emulateScroll: false,
      onClick() {},
      onUpdate() {},
      shouldScroll() { return true }
    };

    this.props = { ...defaults, ...options };

    if (!this.props.viewport || !(this.props.viewport instanceof Element)) {
      console.error(`ScrollBooster init error: "viewport" config property must be present and must be Element`);
      return;
    }

    if (!this.props.content) {
      console.error(`ScrollBooster init error: Viewport does not have any content`);
      return;
    }

    this.viewport = {
      width: this.props.viewport.clientWidth,
      height: this.props.viewport.clientHeight
    };
    this.content = {
      width: getFullWidth(this.props.content),
      height: getFullHeight(this.props.content)
    };

    this.position = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.friction = 1 - this.props.friction;
    this.bounceForce = this.props.bounceForce;

    this.isDragging = false;
    this.dragStartPosition = { x: 0, y: 0 };
    this.dragOffset = { ...this.dragStartPosition };
    this.dragPosition = { ...this.position };

    this.isTargetScroll = false;
    this.targetPosition = { x: 0, y: 0 };

    this.isScrolling = false;
    this.scrollOffset = { x: 0, y: 0 };

    this.bounce = this.props.bounce;
    this.textSelection = this.props.textSelection;

    this.boundX = {
      from: Math.min(-this.content.width + this.viewport.width, 0),
      to: 0
    };
    this.boundY = {
      from: Math.min(-this.content.height + this.viewport.height, 0),
      to: 0
    };

    this.isRunning = false;
    this.rafID = null;

    this.events = {};

    this.animate();
    this.handleEvents();
  }

  /**
   * Run update loop
   */
  run() {
    this.isRunning = true;
    cancelAnimationFrame(this.rafID);
    this.rafID = requestAnimationFrame(() => this.animate());
  }

  animate() {
    if (!this.isRunning) {
      return;
    }
    this.update();
    this.props.onUpdate(this.getState());
    this.rafID = requestAnimationFrame(() => this.animate());
  }

  isMoving() {
    return this.isDragging || this.isScrolling || Math.abs(this.velocity.x) >= 0.1 || Math.abs(this.velocity.y) >= 0.1;
  }

  update() {
    this.applyBoundForce();
    this.applyDragForce();
    this.applyScrollForce();
    this.applyTargetForce();

    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;

    if (this.props.direction !== 'vertical') {
      this.position.x += this.velocity.x;
    }
    if (this.props.direction !== 'horizontal') {
      this.position.y += this.velocity.y;
    }

    // disable bounce effect
    if ((!this.bounce || this.isScrolling) && !this.isTargetScroll) {
      this.position.x = Math.max(Math.min(this.position.x, this.boundX.to), this.boundX.from);
      this.position.y = Math.max(Math.min(this.position.y, this.boundY.to), this.boundY.from);
    }

    // stop update loop if nothing moves
    if (!this.isMoving()) {
      this.isRunning = false;
      this.isTargetScroll = false;
    }
  }

  applyForce(force) {
    this.velocity.x += force.x;
    this.velocity.y += force.y;
  }

  /**
   * Apply force for bounce effect
   */
  applyBoundForce() {
    if (!this.bounce || this.isDragging) {
      return;
    }

    // scrolled past viewport boundaries
    const pastLeft = this.position.x < this.boundX.from;
    const pastRight = this.position.x > this.boundX.to;
    const pastTop = this.position.y < this.boundY.from;
    const pastBottom = this.position.y > this.boundY.to;
    const pastX = pastLeft || pastRight;
    const pastY = pastTop || pastBottom;

    if (!pastX && !pastY) {
      return;
    }

    const bound = {
      x: pastLeft ? this.boundX.from : this.boundX.to,
      y: pastTop ? this.boundY.from : this.boundY.to,
    };

    const distanceToBound = {
      x: bound.x - this.position.x,
      y: bound.y - this.position.y,
    };

    const force = {
      x: distanceToBound.x * this.bounceForce,
      y: distanceToBound.y * this.bounceForce,
    };

    const restPosition = {
      x: this.position.x + (this.velocity.x + force.x) / (1 - this.friction),
      y: this.position.y + (this.velocity.y + force.y) / (1 - this.friction),
    };

    if ((pastLeft && restPosition.x >= this.boundX.from) || (pastRight && restPosition.x <= this.boundX.to)) {
      force.x = distanceToBound.x * this.bounceForce - this.velocity.x;
    }

    if ((pastTop && restPosition.y >= this.boundY.from) || (pastBottom && restPosition.y <= this.boundY.to)) {
      force.y = distanceToBound.y * this.bounceForce - this.velocity.y;
    }

    this.applyForce({
      x: pastX ? force.x : 0,
      y: pastY ? force.y : 0,
    });
  }

  /**
   * Apply force to move content while dragging with mouse/touch
   */
  applyDragForce() {
    if (!this.isDragging) {
      return;
    }

    const dragVelocity = {
      x: this.dragPosition.x - this.position.x,
      y: this.dragPosition.y - this.position.y
    };

    const force = {
      x: dragVelocity.x - this.velocity.x,
      y: dragVelocity.y - this.velocity.y
    };

    this.applyForce(force);
  }

  /**
   * Apply force to emulate mouse wheel or trackpad
   */
  applyScrollForce() {
    if (!this.isScrolling) {
      return;
    }

    const force = {
      x: this.scrollOffset.x - this.velocity.x,
      y: this.scrollOffset.y - this.velocity.y
    };

    this.scrollOffset.x = 0;
    this.scrollOffset.y = 0;

    this.applyForce(force);
  }

  applyTargetForce() {
    if (!this.isTargetScroll) {
      return
    }

    const force = {
      x: (this.targetPosition.x - this.position.x) * 0.08 - this.velocity.x,
      y: (this.targetPosition.y - this.position.y) * 0.08 - this.velocity.y,
    };

    this.applyForce(force);
  }

  /**
   * Smooth scroll to target position
   */
  scrollTo(position = {}) {
    this.isTargetScroll = true;
    this.targetPosition.x = -position.x || 0;
    this.targetPosition.y = -position.y || 0;
    this.run();
  }

  /**
   * Manual position setting
   */
  setPosition(position = {}) {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.position.x = -position.x || 0;
    this.position.y = -position.y || 0;
    this.run();
  }

  /**
   * Get latest metrics and coordinates
   */
  getState() {
    return {
      isMoving: this.isMoving(),
      isDragging: !!(this.dragOffset.x || this.dragOffset.y),
      position: { x: -this.position.x, y: -this.position.y },
      dragOffset: this.dragOffset,
    };
  }

  updateMetrics() {
    this.viewport.width = this.props.viewport.clientWidth;
    this.viewport.height = this.props.viewport.clientHeight;

    this.content.width = getFullWidth(this.props.content);
    this.content.height = getFullHeight(this.props.content);

    this.boundX.from = Math.min(-this.content.width + this.viewport.width, 0);
    this.boundY.from = Math.min(-this.content.height + this.viewport.height, 0);

    this.run();
  }

  handleEvents() {
    const dragOrigin = { x: 0, y: 0 };
    let wheelTimer = null;
    let isTouch = false;

    const setDragPosition = (event) => {
      if (!this.isDragging) {
        return
      }

      const pageX = isTouch ? event.touches[0].pageX : event.pageX;
      const pageY = isTouch ? event.touches[0].pageY: event.pageY;

      this.dragOffset.x = pageX - dragOrigin.x;
      this.dragOffset.y = pageY - dragOrigin.y;

      this.dragPosition.x = this.dragStartPosition.x + this.dragOffset.x;
      this.dragPosition.y = this.dragStartPosition.y + this.dragOffset.y;
    };

    this.events.pointerdown = (event) => {
      isTouch = !!(event.touches && event.touches[0]);

      const eventData = isTouch ? event.touches[0] : event;
      const { pageX, pageY, clientX, clientY } = eventData

      const { viewport } = this.props;
      const rect = viewport.getBoundingClientRect();

      // click on vertical scrollbar
      if (clientX - rect.left >= viewport.clientLeft + viewport.clientWidth) {
        return;
      }

      // click on horizontal scrollbar
      if (clientY - rect.top >= viewport.clientTop + viewport.clientHeight) {
        return;
      }

      // interaction disabled by user
      if (!this.props.shouldScroll(this.getState(), event)) {
        return;
      }

      // disable on mobile
      if (this.props.pointerMode === 'mouse' && isTouch) {
        return;
      }

      // disable on desktop
      if (this.props.pointerMode === 'touch' && !isTouch) {
        return;
      }

      // focus on form input elements
      const formNodes = ['input', 'textarea', 'button', 'select', 'label'];
      if (this.props.inputsFocus && formNodes.indexOf(event.target.nodeName.toLowerCase()) > -1) {
        return;
      }

      // handle text selection
      if (this.textSelection) {
        const textNode = textNodeFromPoint(event.target, clientX, clientY);
        if (textNode) {
          return;
        }
        clearTextSelection();
      }

      this.isDragging = true;

      dragOrigin.x = pageX;
      dragOrigin.y = pageY;
      this.dragStartPosition.x = this.position.x;
      this.dragStartPosition.y = this.position.y;

      setDragPosition(event);
      this.run();
      event.preventDefault()
    };

    this.events.pointermove = (event) => {
      setDragPosition(event);
    };

    this.events.pointerup = () => {
      this.isDragging = false;
    };

    this.events.wheel = (event) => {
      if (!this.props.emulateScroll) {
        return;
      }
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.isScrolling = true;

      this.scrollOffset.x = -event.deltaX;
      this.scrollOffset.y = -event.deltaY;

      this.run();

      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => (this.isScrolling = false), 80);
      event.preventDefault();
    };

    this.events.scroll = () => {
      const { scrollLeft, scrollTop } = this.props.viewport;
      if (Math.abs(this.position.x + scrollLeft) > 3) {
        this.position.x = -scrollLeft;
        this.velocity.x = 0;
      }
      if (Math.abs(this.position.y + scrollTop) > 3) {
        this.position.y = -scrollTop;
        this.velocity.y = 0;
      }
    };

    this.events.click = (event) => this.props.onClick(this.getState(), event);
    this.events.contentLoad = () => this.updateMetrics();
    this.events.resize = () => this.updateMetrics();

    this.props.viewport.addEventListener('mousedown', this.events.pointerdown);
    this.props.viewport.addEventListener('touchstart', this.events.pointerdown);
    this.props.viewport.addEventListener('click', this.events.click);
    this.props.viewport.addEventListener('wheel', this.events.wheel);
    this.props.viewport.addEventListener('scroll', this.events.scroll);
    this.props.content.addEventListener('load', this.events.contentLoad, true);
    window.addEventListener('mousemove', this.events.pointermove);
    window.addEventListener('touchmove', this.events.pointermove);
    window.addEventListener('mouseup', this.events.pointerup);
    window.addEventListener('touchend', this.events.pointerup);
    window.addEventListener('resize', this.events.resize);
  }

  updateOptions(options = {}) {
    this.props = { ...this.props, ...options };
    this.props.onUpdate(this.getState());
    this.run();
  }

  destroy() {
    this.props.viewport.removeEventListener('mousedown', this.events.pointerdown);
    this.props.viewport.removeEventListener('touchstart', this.events.pointerdown);
    this.props.viewport.removeEventListener('click', this.events.click);
    this.props.viewport.removeEventListener('wheel', this.events.wheel);
    this.props.viewport.removeEventListener('scroll', this.events.scroll);
    this.props.content.removeEventListener('load', this.events.contentLoad);
    window.removeEventListener('mousemove', this.events.pointermove);
    window.removeEventListener('touchmove', this.events.pointermove);
    window.removeEventListener('mouseup', this.events.pointerup);
    window.removeEventListener('touchend', this.events.pointerup);
    window.removeEventListener('resize', this.events.resize);
  }
}
