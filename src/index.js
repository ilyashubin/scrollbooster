export default class ScrollBooster {
  constructor(props = {}) {

    if (!props.viewport || !(props.viewport instanceof Element)) {
      console.error('"viewport" config property must be present and must be Element')
      return
    }

    let defaults = {
      handle: props.viewport,
      content: props.viewport.children[0],
      bounce: true,
      friction: 0.05,
      bounceForce: 0.1,
      textSelection: false,
      onClick: function () {},
      shouldScroll: function () { return true },
      onUpdate: function () {}
    }

    this.props = { ...defaults, ...props }

    if (!this.props.content) {
      console.error('Viewport does not have any content')
      return
    }

    this.viewport = {
      width: this.props.viewport.clientWidth,
      height: this.props.viewport.clientHeight
    }
    this.content = {
      width: getFullWidth(this.props.content),
      height: getFullHeight(this.props.content)
    }

    this.position = { x: 0, y: 0 }
    this.velocity = { x: 0, y: 0 }
    this.friction = 1 - this.props.friction
    this.bounceForce = this.props.bounceForce

    this.isDragging = false
    this.dragStartPosition = { x: 0, y: 0 }
    this.dragOffsetPosition = { ...this.dragStartPosition }
    this.dragPosition = { ...this.position }

    this.isScrollEnabled = !!this.props.emulateScroll
    this.isScrolling = false
    this.scrollOffset = { x: 0, y: 0 }

    this.bounce = this.props.bounce
    this.textSelection = this.props.textSelection

    this.boundX = {
      from: Math.min(-this.content.width + this.viewport.width, 0),
      to: 0
    }
    this.boundY = {
      from: Math.min(-this.content.height + this.viewport.height, 0),
      to: 0
    }

    this.mode = {
      x: this.props.mode == 'x',
      y: this.props.mode == 'y',
      xy: this.props.mode !== 'x' && this.props.mode !== 'y'
    }

    this.isRunning = false
    this.rafID = null

    this.events = {}

    this.animate()
    this.handleEvents()
  }

  /**
   * Run update loop
   */
  run() {
    this.isRunning = true
    cancelAnimationFrame(this.rafID)
    this.rafID = requestAnimationFrame(() => this.animate())
  }

  animate() {
    if (!this.isRunning) { return }
    this.update()
    this.notify()
    this.rafID = requestAnimationFrame(() => this.animate())
  }

  update() {
    this.applyBoundForce()
    this.applyDragForce()
    this.applyScrollForce()

    this.velocity.x *= this.friction
    this.velocity.y *= this.friction

    if (!this.mode.y) {
      this.position.x += this.velocity.x
    }
    if (!this.mode.x) {
      this.position.y += this.velocity.y
    }

    // if bounce effect is disabled
    if (!this.bounce || this.isScrolling) {
      this.position.x = Math.max(Math.min(this.position.x, this.boundX.to), this.boundX.from)
      this.position.y = Math.max(Math.min(this.position.y, this.boundY.to), this.boundY.from)
    }

    // stop update loop if nothing moves
    if (
      !this.isDragging &&
      !this.isScrolling &&
      Math.abs(this.velocity.x) < 0.1 &&
      Math.abs(this.velocity.y) < 0.1
    ) {
      this.isRunning = false
    }
  }

  applyForce(force) {
    this.velocity.x += force.x
    this.velocity.y += force.y
  }

  /**
   * Apply force for bounce effect
   */
  applyBoundForce() {
    if (!this.bounce) { return }
    if (this.isDragging) { return }

    let pastLeft = this.position.x < this.boundX.from
    let pastRight = this.position.x > this.boundX.to
    let pastTop = this.position.y < this.boundY.from
    let pastBottom = this.position.y > this.boundY.to

    let resultForce = { x: 0, y: 0 }

    // scrolled past left of right viewport boundaries
    if (pastLeft || pastRight) {
      let bound = pastLeft ? this.boundX.from : this.boundX.to
      let distance = bound - this.position.x

      let force = distance * this.bounceForce
      var restX = this.position.x + (this.velocity.x + force) / (1 - this.friction)

      if (
        !((pastLeft && restX < this.boundX.from) || (pastRight && restX > this.boundX.to))
      ) {
        force = distance * this.bounceForce - this.velocity.x
      }

      resultForce.x = force
    }

    // scrolled past top of bottom viewport boundaries
    if (pastTop || pastBottom) {
      let bound = pastTop ? this.boundY.from : this.boundY.to
      let distance = bound - this.position.y

      let force = distance * this.bounceForce
      var restY = this.position.y + (this.velocity.y + force) / (1 - this.friction)

      if (
        !((pastTop && restY < this.boundY.from) || (pastBottom && restY > this.boundY.to))
      ) {
        force = distance * this.bounceForce - this.velocity.y
      }

      resultForce.y = force
    }

    this.applyForce(resultForce)
  }

  /**
   * Apply force to move content while dragging with mouse/touch
   */
  applyDragForce() {
    if (!this.isDragging) { return }
    let dragVelocity = {
      x: this.dragPosition.x - this.position.x,
      y: this.dragPosition.y - this.position.y
    }
    let dragForce = {
      x: dragVelocity.x - this.velocity.x,
      y: dragVelocity.y - this.velocity.y
    }

    this.applyForce(dragForce)
  }

  /**
   * Apply force to emulate mouse wheel
   */
  applyScrollForce() {
    if (!this.isScrolling) { return }

    let scrollForce = {
      x: this.scrollOffset.x - this.velocity.x,
      y: this.scrollOffset.y - this.velocity.y
    }

    this.scrollOffset.x = 0
    this.scrollOffset.y = 0

    this.applyForce(scrollForce)
  }

  /**
   * Manual position setting
   */
  setPosition(newPosition = {}) {
    this.velocity.x = 0
    this.velocity.y = 0

    this.position.x = -newPosition.x || 0
    this.position.y = -newPosition.y || 0

    this.run()
  }

  /**
   * Get latest metrics and coordinates
   */
  getUpdate() {
    return {
      isRunning: this.isRunning,
      isDragging: this.isDragging,
      isScrolling: this.isScrolling,
      position: {
        x: -this.position.x,
        y: -this.position.y
      },
      dragOffsetPosition: this.dragOffsetPosition,
      viewport: { ...this.viewport },
      content: { ...this.content }
    }
  }

  notify() {
    this.props.onUpdate(this.getUpdate())
  }

  updateMetrics() {
    this.viewport.width = this.props.viewport.clientWidth
    this.viewport.height = this.props.viewport.clientHeight

    this.content.width = getFullWidth(this.props.content)
    this.content.height = getFullHeight(this.props.content)

    this.boundX.from = Math.min(-this.content.width + this.viewport.width, 0)
    this.boundY.from = Math.min(-this.content.height + this.viewport.height, 0)

    this.run()
  }

  handleEvents() {
    let vp = this.props.viewport
    let scroll = { x: 0, y: 0 }
    let mousedown = { x: 0, y: 0 }

    let isTouch = false

    let setDragPosition = (event) => {
      let pageX, pageY

      if (isTouch) {
        pageX = event.touches[0].pageX
        pageY = event.touches[0].pageY
      } else {
        pageX = event.pageX
        pageY = event.pageY
      }

      this.dragOffsetPosition.x = pageX - mousedown.x
      this.dragOffsetPosition.y = pageY - mousedown.y

      this.dragPosition.x = this.dragStartPosition.x + this.dragOffsetPosition.x
      this.dragPosition.y = this.dragStartPosition.y + this.dragOffsetPosition.y

      if (!isTouch) {
        event.preventDefault()
      }
    }

    this.events.pointerdown = (event) => {
      let pageX, pageY, clientX, clientY

      isTouch =  !!(event.touches && event.touches[0])

      if (isTouch) {
        pageX = event.touches[0].pageX
        pageY = event.touches[0].pageY
        clientX = event.touches[0].clientX
        clientY = event.touches[0].clientY
      } else {
        pageX = event.pageX
        pageY = event.pageY
        clientX = event.clientX
        clientY = event.clientY
      }

      let rect = vp.getBoundingClientRect()

      // click on vertical scrollbar
      if (clientX - rect.left >= vp.clientLeft + vp.clientWidth) {
        return
      }

      // click on horizontal scrollbar
      if (clientY - rect.top >= vp.clientTop + vp.clientHeight) {
        return
      }

      if (!this.props.shouldScroll(this.getUpdate(), event)) {
        return
      }

      // text selection enabled
      if (this.textSelection) {
        let clickedNode = textNodeFromPoint(event.target, clientX, clientY)
        if (clickedNode) {
          return
        } else {
          clearTextSelection()
        }
      }

      this.isDragging = true

      if (scroll.x || scroll.y) {
        this.position.x = scroll.x
        this.position.y = scroll.y
        scroll.x = 0
        scroll.y = 0
      }
      mousedown.x = pageX
      mousedown.y = pageY
      this.dragStartPosition.x = this.position.x
      this.dragStartPosition.y = this.position.y

      setDragPosition(event)

      this.run()

      let pointerUp, removeEvents

      removeEvents = (event) => {
        this.isDragging = false

        if (isTouch) {
          window.removeEventListener('touchmove', setDragPosition)
          window.removeEventListener('touchend', pointerUp)
        } else {
          window.removeEventListener('mousemove', setDragPosition)
          window.removeEventListener('mouseup', pointerUp)
        }
      }

      if (isTouch) {
        pointerUp = window.addEventListener('touchend', removeEvents)
        window.addEventListener('touchmove', setDragPosition)
      } else {
        pointerUp = window.addEventListener('mouseup', removeEvents)
        window.addEventListener('mousemove', setDragPosition)
      }
    }

    let scrollTimer = null
    this.events.wheel = (event) => {
      this.velocity.x = 0

      if (!this.isScrollEnabled) { return }
      this.isScrolling = true

      this.scrollOffset.x = -event.deltaX
      this.scrollOffset.y = -event.deltaY

      this.run()

      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => this.isScrolling = false, 80)

      event.preventDefault()
    }

    this.events.scroll = (event) => {
      let sl = this.props.viewport.scrollLeft
      let st = this.props.viewport.scrollTop
      if (Math.abs(this.position.x + sl) > 3) {
        this.position.x = -sl
        this.velocity.x = 0
      }
      if (Math.abs(this.position.y + st) > 3) {
        this.position.y = -st
        this.velocity.y = 0
      }
      scroll.x = -this.props.viewport.scrollLeft
      scroll.y = -this.props.viewport.scrollTop
    }

    this.events.click = (event) => {
      this.props.onClick(this.getUpdate(), event)
    }

    this.events.resize = this.updateMetrics.bind(this)

    this.props.handle.addEventListener('mousedown', this.events.pointerdown)
    this.props.handle.addEventListener('touchstart', this.events.pointerdown)
    this.props.handle.addEventListener('click', this.events.click)
    this.props.viewport.addEventListener('wheel', this.events.wheel)
    this.props.viewport.addEventListener('scroll', this.events.scroll)
    window.addEventListener('resize', this.events.resize)
  }

  destroy() {
    this.props.handle.removeEventListener('mousedown', this.events.pointerdown)
    this.props.handle.removeEventListener('touchstart', this.events.pointerdown)
    this.props.handle.removeEventListener('click', this.events.click)
    this.props.viewport.removeEventListener('wheel', this.events.wheel)
    this.props.viewport.removeEventListener('scroll', this.events.scroll)
    window.removeEventListener('resize', this.events.resize)
  }
}

function getFullWidth (elem) {
  return Math.max(elem.offsetWidth, elem.scrollWidth)
}

function getFullHeight (elem) {
  return Math.max(elem.offsetHeight, elem.scrollHeight)
}

function textNodeFromPoint (element, x, y) {
  let node
  let nodes = element.childNodes
  let range = document.createRange()
  for (let i = 0; node = nodes[i], i < nodes.length; i++) {
    if (node.nodeType !== 3) continue
    range.selectNodeContents(node)
    let rect = range.getBoundingClientRect()
    if (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom) {
      return node
    }
  }
  return false
}

function clearTextSelection () {
  let sel = window.getSelection ? window.getSelection() : document.selection
  if (sel) {
    if (sel.removeAllRanges) {
      sel.removeAllRanges()
    } else if (sel.empty) {
      sel.empty()
    }
  }
}
