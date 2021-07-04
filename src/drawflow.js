export default class Drawflow {
  constructor(container, render = null) {
    this.events = {};
    this.container = container;
    this.precanvas = null;
    this.nodeId = 1;
    this.ele_selected = null;
    this.node_selected = null;
    this.drag = false;
    this.reroute = false;
    this.reroute_fix_curvature = false;
    this.curvature = 0.5;
    this.reroute_curvature_start_end = 0.5;
    this.reroute_curvature = 0.5;
    this.reroute_width = 6;
    this.drag_point = false;
    this.editor_selected = false;
    this.connection = false;
    this.connection_ele = null;
    this.connection_selected = null;
    this.canvas_x = 0;
    this.canvas_y = 0;
    this.pos_x = 0;
    this.pos_x_start = 0;
    this.pos_y = 0;
    this.pos_y_start = 0;
    this.mouse_x = 0;
    this.mouse_y = 0;
    this.line_path = 5;
    this.first_click = null;
    this.force_first_input = false;
    this.draggable_inputs = true;
    this.useuuid = false;
    this.checkInOutType = false;
    this.singleConnectionForTypedInput = false;

    this.select_elements = null;
    this.noderegister = {};
    this.render = render;
    this.drawflow = { "drawflow": { "Home": { "data": {} } } };
    // Configurable options
    this.module = 'Home';
    this.editor_mode = 'edit';
    this.zoom = 1;
    this.zoom_max = 1.6;
    this.zoom_min = 0.5;
    this.zoom_value = 0.1;
    this.zoom_last_value = 1;

    // Mobile
    this.evCache = [];
    this.prevDiff = -1;
  }

  start() {
    // console.info("Start Drawflow!!");
    this.container.classList.add("parent-drawflow");
    this.container.tabIndex = 0;
    this.precanvas = document.createElement('div');
    this.precanvas.classList.add("drawflow");
    this.container.appendChild(this.precanvas);

    /* Mouse and Touch Actions */
    this.container.addEventListener('mouseup', this.dragEnd.bind(this));
    this.container.addEventListener('mousemove', this.position.bind(this));
    this.container.addEventListener('mousedown', this.click.bind(this));

    this.container.addEventListener('touchend', this.dragEnd.bind(this));
    this.container.addEventListener('touchmove', this.position.bind(this));
    this.container.addEventListener('touchstart', this.click.bind(this));

    /* Context Menu */
    this.container.addEventListener('contextmenu', this.contextmenu.bind(this));
    /* Delete */
    this.container.addEventListener('keydown', this.key.bind(this));

    /* Zoom Mouse */
    this.container.addEventListener('wheel', this.zoom_enter.bind(this));
    /* Update data Nodes */
    this.container.addEventListener('input', this.updateNodeValue.bind(this));

    this.container.addEventListener('dblclick', this.dblclick.bind(this));
    /* Mobile zoom */
    this.container.onpointerdown = this.pointerdown_handler.bind(this);
    this.container.onpointermove = this.pointermove_handler.bind(this);
    this.container.onpointerup = this.pointerup_handler.bind(this);
    this.container.onpointercancel = this.pointerup_handler.bind(this);
    this.container.onpointerout = this.pointerup_handler.bind(this);
    this.container.onpointerleave = this.pointerup_handler.bind(this);

    this.load();
  }

  /* Mobile zoom */
  pointerdown_handler(ev) {
    this.evCache.push(ev);
  }

  pointermove_handler(ev) {
    for(var i = 0; i < this.evCache.length; i++) {
      if(ev.pointerId == this.evCache[i].pointerId) {
        this.evCache[i] = ev;
        break;
      }
    }

    if(this.evCache.length == 2) {
      // Calculate the distance between the two pointers
      var curDiff = Math.abs(this.evCache[0].clientX - this.evCache[1].clientX);

      if(this.prevDiff > 100) {
        if(curDiff > this.prevDiff) {
          // The distance between the two pointers has increased

          this.zoom_in();
        }
        if(curDiff < this.prevDiff) {
          // The distance between the two pointers has decreased
          this.zoom_out();
        }
      }
      this.prevDiff = curDiff;
    }
  }

  pointerup_handler(ev) {
    this.remove_event(ev);
    if(this.evCache.length < 2) {
      this.prevDiff = -1;
    }
  }

  remove_event(ev) {
    // Remove this event from the target's cache
    for(var i = 0; i < this.evCache.length; i++) {
      if(this.evCache[i].pointerId == ev.pointerId) {
        this.evCache.splice(i, 1);
        break;
      }
    }
  }

  /* End Mobile Zoom */
  load() {
    for(let key in this.drawflow.drawflow[this.module].data) {
      this.addNodeImport(this.drawflow.drawflow[this.module].data[key], this.precanvas);
    }

    if(this.reroute) {
      for(let key in this.drawflow.drawflow[this.module].data) {
        this.addRerouteImport(this.drawflow.drawflow[this.module].data[key]);
      }
    }

    for(let key in this.drawflow.drawflow[this.module].data) {
      this.updateConnectionNodes('node-' + key);
    }

    const editor = this.drawflow.drawflow;
    let number = 1;
    Object.keys(editor).map(function(moduleName, index) {
      Object.keys(editor[moduleName].data).map(function(id, index2) {
        if(parseInt(id) >= number) {
          number = parseInt(id) + 1;
        }
      });
    });
    this.nodeId = number;
  }

  removeReouteConnectionSelected() {
    this.dispatch('connectionUnselected', true);
    if(this.reroute_fix_curvature) {
      this.connection_selected.parentElement.querySelectorAll(".main-path").forEach((item, i) => {
        item.classList.remove("selected");
      });
    }
  }

  click(e) {
    this.dispatch('click', e);
    if(this.editor_mode === 'fixed') {
      //return false;
      if(e.target.classList[0] === 'parent-drawflow' || e.target.classList[0] === 'drawflow') {
        this.ele_selected = e.target.closest(".parent-drawflow");
      } else {
        return false;
      }
    } else if(this.editor_mode === 'view') {
      if(e.target.closest(".drawflow") != null || e.target.matches('.parent-drawflow')) {
        this.ele_selected = e.target.closest(".parent-drawflow");
        e.preventDefault();
      }
    } else {
      this.first_click = e.target;
      this.ele_selected = e.target;
      if(e.button === 0) {
        this.contextmenuDel();
      }

      // if(e.target.closest(".drawflow_content_node") != null) {
      //   this.ele_selected = e.target.closest(".drawflow_content_node").parentElement;
      // }

      // Closest element not output/input or connection, then select the node
      if((e.target.closest(".output") == null && e.target.closest(".input") == null && e.target.closest(".connection") == null) && e.target.closest(".drawflow-node") != null) {
        this.ele_selected = e.target.closest(".drawflow-node");
      }
    }
    switch(this.ele_selected.classList[0]) {
      case 'drawflow-node':
        if(this.node_selected != null) {
          this.node_selected.classList.remove("selected");
          if(this.node_selected != this.ele_selected) {
            this.dispatch('nodeUnselected', true);
          }
        }
        if(this.connection_selected != null) {
          this.connection_selected.classList.remove("selected");
          this.removeReouteConnectionSelected();
          this.connection_selected = null;
        }
        if(this.node_selected != this.ele_selected) {
          this.dispatch('nodeSelected', this.ele_selected.id.slice(5));
        }
        this.node_selected = this.ele_selected;
        this.node_selected.classList.add("selected");
        if(!this.draggable_inputs) {
          if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.hasAttribute('contenteditable') !== true) {
            this.drag = true;
          }
        } else {
          if(e.target.tagName !== 'SELECT') {
            this.drag = true;
          }
        }
        break;
      case 'output':
        this.connection = true;
        if(this.node_selected != null) {
          this.node_selected.classList.remove("selected");
          this.node_selected = null;
          this.dispatch('nodeUnselected', true);
        }
        if(this.connection_selected != null) {
          this.connection_selected.classList.remove("selected");
          this.removeReouteConnectionSelected();
          this.connection_selected = null;
        }
        this.drawConnection(e.target);
        break;
      case 'parent-drawflow':
        if(this.node_selected != null) {
          this.node_selected.classList.remove("selected");
          this.node_selected = null;
          this.dispatch('nodeUnselected', true);
        }
        if(this.connection_selected != null) {
          this.connection_selected.classList.remove("selected");
          this.removeReouteConnectionSelected();
          this.connection_selected = null;
        }
        this.editor_selected = true;
        break;
      case 'drawflow':
        if(this.node_selected != null) {
          this.node_selected.classList.remove("selected");
          this.node_selected = null;
          this.dispatch('nodeUnselected', true);
        }
        if(this.connection_selected != null) {
          this.connection_selected.classList.remove("selected");
          this.removeReouteConnectionSelected();
          this.connection_selected = null;
        }
        this.editor_selected = true;
        break;
      case 'main-path':
        if(this.node_selected != null) {
          this.node_selected.classList.remove("selected");
          this.node_selected = null;
          this.dispatch('nodeUnselected', true);
        }
        if(this.connection_selected != null) {
          this.connection_selected.classList.remove("selected");
          this.removeReouteConnectionSelected();
          this.connection_selected = null;
        }
        this.connection_selected = this.ele_selected;
        this.connection_selected.classList.add("selected");
        const listclassConnection = this.connection_selected.parentElement.classList;
        this.dispatch('connectionSelected', { output_id: listclassConnection[2].slice(14), input_id: listclassConnection[1].slice(13), output_class: listclassConnection[3], input_class: listclassConnection[4] });
        if(this.reroute_fix_curvature) {
          this.connection_selected.parentElement.querySelectorAll(".main-path").forEach((item, i) => {
            item.classList.add("selected");
          });
        }
        break;
      case 'point':
        this.drag_point = true;
        this.ele_selected.classList.add("selected");
        break;
      case 'drawflow-delete':
        if(this.node_selected) {
          this.removeNodeId(this.node_selected.id);
        }

        if(this.connection_selected) {
          this.removeConnection();
        }

        if(this.node_selected != null) {
          this.node_selected.classList.remove("selected");
          this.node_selected = null;
          this.dispatch('nodeUnselected', true);
        }
        if(this.connection_selected != null) {
          this.connection_selected.classList.remove("selected");
          this.removeReouteConnectionSelected();
          this.connection_selected = null;
        }

        break;
      default:
    }
    if(e.type === "touchstart") {
      this.pos_x = e.touches[0].clientX;
      this.pos_x_start = e.touches[0].clientX;
      this.pos_y = e.touches[0].clientY;
      this.pos_y_start = e.touches[0].clientY;
    } else {
      this.pos_x = e.clientX;
      this.pos_x_start = e.clientX;
      this.pos_y = e.clientY;
      this.pos_y_start = e.clientY;
    }
    this.dispatch('clickEnd', e);
  }

  position(e) {
    let e_pos_x, e_pos_y;
    if(e.type === "touchmove") {
      e_pos_x = e.touches[0].clientX;
      e_pos_y = e.touches[0].clientY;
    } else {
      e_pos_x = e.clientX;
      e_pos_y = e.clientY;
    }

    if(this.connection) {
      this.updateConnection(e_pos_x, e_pos_y);
    }

    if(this.editor_selected) {
      /*if (e.ctrlKey) {
        this.selectElements(e_pos_x, e_pos_y);
      } else { */
      const x = this.canvas_x + (-(this.pos_x - e_pos_x));
      const y = this.canvas_y + (-(this.pos_y - e_pos_y));
      // console.log(canvas_x +' - ' +pos_x + ' - '+ e_pos_x + ' - ' + x);
      this.dispatch('translate', { x: x, y: y });
      this.precanvas.style.transform = "translate(" + x + "px, " + y + "px) scale(" + this.zoom + ")";
      //}
    }

    if(this.drag) {

      const x = (this.pos_x - e_pos_x) * this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom);
      const y = (this.pos_y - e_pos_y) * this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom);
      this.pos_x = e_pos_x;
      this.pos_y = e_pos_y;

      this.ele_selected.style.top = (this.ele_selected.offsetTop - y) + "px";
      this.ele_selected.style.left = (this.ele_selected.offsetLeft - x) + "px";

      this.drawflow.drawflow[this.module].data[this.ele_selected.id.slice(5)].pos_x = (this.ele_selected.offsetLeft - x);
      this.drawflow.drawflow[this.module].data[this.ele_selected.id.slice(5)].pos_y = (this.ele_selected.offsetTop - y);

      this.updateConnectionNodes(this.ele_selected.id);
    }

    if(this.drag_point) {

      // const x = (this.pos_x - e_pos_x) * this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom);
      // const y = (this.pos_y - e_pos_y) * this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom);
      this.pos_x = e_pos_x;
      this.pos_y = e_pos_y;

      var pos_x = this.pos_x * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom)) - (this.precanvas.getBoundingClientRect().x * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom)));
      var pos_y = this.pos_y * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom)) - (this.precanvas.getBoundingClientRect().y * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom)));

      this.ele_selected.setAttributeNS(null, 'cx', pos_x);
      this.ele_selected.setAttributeNS(null, 'cy', pos_y);

      const nodeUpdate = this.ele_selected.parentElement.classList[2].slice(9);
      const nodeUpdateIn = this.ele_selected.parentElement.classList[1].slice(13);
      const output_class = this.ele_selected.parentElement.classList[3];
      const input_class = this.ele_selected.parentElement.classList[4];

      let numberPointPosition = Array.from(this.ele_selected.parentElement.children).indexOf(this.ele_selected) - 1;

      if(this.reroute_fix_curvature) {
        const numberMainPath = this.ele_selected.parentElement.querySelectorAll(".main-path").length - 1;

        numberPointPosition -= numberMainPath;
        if(numberPointPosition < 0) {
          numberPointPosition = 0;
        }
      }

      const nodeId = nodeUpdate.slice(5);
      const searchConnection = this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections.findIndex(function(item, i) {
        return item.node === nodeUpdateIn && item.output === input_class;
      });

      this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points[numberPointPosition] = { pos_x: pos_x, pos_y: pos_y };

      const parentSelected = this.ele_selected.parentElement.classList[2].slice(9);

      /*this.drawflow.drawflow[this.module].data[this.ele_selected.id.slice(5)].pos_x = (this.ele_selected.offsetLeft - x);
      this.drawflow.drawflow[this.module].data[this.ele_selected.id.slice(5)].pos_y = (this.ele_selected.offsetTop - y);
      */
      this.updateConnectionNodes(parentSelected);
    }

    if(e.type === "touchmove") {
      this.mouse_x = e_pos_x;
      this.mouse_y = e_pos_y;
    }
    this.dispatch('mouseMove', { x: e_pos_x, y: e_pos_y });
  }

  dragEnd(e) {
    let e_pos_x, e_pos_y, ele_last;
    if(this.select_elements != null) {
      this.select_elements.remove();
      this.select_elements = null;
    }

    if(e.type === "touchend") {
      e_pos_x = this.mouse_x;
      e_pos_y = this.mouse_y;
      ele_last = document.elementFromPoint(e_pos_x, e_pos_y);
    } else {
      e_pos_x = e.clientX;
      e_pos_y = e.clientY;
      ele_last = e.target;
    }

    if(this.drag) {
      if(this.pos_x_start != e_pos_x || this.pos_y_start != e_pos_y) {
        this.dispatch('nodeMoved', this.ele_selected.id.slice(5));
      }
    }

    if(this.drag_point) {
      this.ele_selected.classList.remove("selected");
    }

    if(this.editor_selected) {
      this.canvas_x = this.canvas_x + (-(this.pos_x - e_pos_x));
      this.canvas_y = this.canvas_y + (-(this.pos_y - e_pos_y));
      this.editor_selected = false;
    }
    if(this.connection === true) {
      //console.log(ele_last)
      let input_id, input_class;
      if(ele_last.classList[0] === 'input' || (this.force_first_input && (ele_last.closest(".drawflow_content_node") != null || ele_last.classList[0] === 'drawflow-node'))) {

        if(this.force_first_input && (ele_last.closest(".drawflow_content_node") != null || ele_last.classList[0] === 'drawflow-node')) {
          if(ele_last.closest(".drawflow_content_node") != null) {
            input_id = ele_last.closest(".drawflow_content_node").parentElement.id;
          } else {
            input_id = ele_last.id;
          }
          if(Object.keys(this.getNodeFromId(input_id.slice(5)).inputs).length === 0) {
            input_class = false;
          } else {
            input_class = "input_1";
          }

        } else {
          // Fix connection (get input node id if none)
          // input_id = ele_last.closest('.drawflow-node').id;
          input_id = ele_last.parentElement.parentElement.parentElement.id;
          input_class = ele_last.classList[1];
        }
        // Get ouput node id
        // var output_id = this.ele_selected.closest('.drawflow-node').id;
        var output_id = this.ele_selected.parentElement.parentElement.parentElement.id;
        var output_class = this.ele_selected.classList[1];

        if(output_id !== input_id && input_class !== false) {
          // This checks if there is already a connection between the same ouput/input
          if(this.container.querySelectorAll('.connection.node_in_' + input_id + '.node_out_' + output_id + '.' + output_class + '.' + input_class).length === 0) {
            var id_input = input_id.slice(5);
            var id_output = output_id.slice(5);
            // Test connection type matches between input and output
            if((this.checkInOutType && this.checkConnectionTypes(id_input, input_class, id_output, output_class)) || !this.checkInOutType) {
              var alreadyLinked = false;
              // If there is a type and singleConnectionForTypedInput = true, then we must check if there is already a link here
              if(this.drawflow.drawflow[this.module].data[id_input].inputs[input_class].type && this.singleConnectionForTypedInput) {
                if(this.container.querySelectorAll('.node_in_' + input_id + '.' + input_class).length > 0) {
                  alreadyLinked = true;
                }
              }
              // If not already linked to something, we can add the connection
              if(!alreadyLinked) {
                // Conection no exist save connection          
                this.connection_ele.classList.add("node_in_" + input_id);
                this.connection_ele.classList.add("node_out_" + output_id);
                this.connection_ele.classList.add(output_class);
                this.connection_ele.classList.add(input_class);
                this.connection_ele.setAttribute("type", this.drawflow.drawflow[this.module].data[id_output].outputs[output_class].type);

                this.drawflow.drawflow[this.module].data[id_output].outputs[output_class].connections.push({ "node": id_input, "output": input_class });
                this.drawflow.drawflow[this.module].data[id_input].inputs[input_class].connections.push({ "node": id_output, "input": output_class });

                // Add "linked" style to both input/output element
                var output = document.querySelector('#' + output_id + ' .' + output_class);
                if(output && !output.classList.contains('linked')) {
                  output.classList.add("linked");
                }

                var input = document.querySelector('#' + input_id + ' .' + input_class);
                if(input && !input.classList.contains('linked')) {
                  input.classList.add("linked");
                }

                this.updateConnectionNodes('node-' + id_output);
                this.updateConnectionNodes('node-' + id_input);
                this.dispatch('connectionCreated', { output_id: id_output, input_id: id_input, output_class: output_class, input_class: input_class });
              } else {
                console.log("There is already an output linked to the input: " + input_class + " for node: " + id_input);
                this.dispatch('connectionCancel', true);
                this.connection_ele.remove();
              }
            } else {
              console.log("Input and output type don't match");
              this.dispatch('connectionCancel', true);
              this.connection_ele.remove();
            }

          } else {
            this.dispatch('connectionCancel', true);
            this.connection_ele.remove();
          }

          this.connection_ele = null;
        } else {
          // Connection exists Remove Connection;
          this.dispatch('connectionCancel', true);
          this.connection_ele.remove();
          this.connection_ele = null;
        }

      } else {
        // Remove Connection;
        this.dispatch('connectionCancel', true);
        this.connection_ele.remove();
        this.connection_ele = null;
      }
    }

    this.drag = false;
    this.drag_point = false;
    this.connection = false;
    this.ele_selected = null;
    this.editor_selected = false;

  }

  // Can be overriden with custom logic in order to constraint connection between outputs/inputs
  checkConnectionTypes(input_id, input_class, output_id, output_class) {
    return this.drawflow.drawflow[this.module].data[output_id].outputs[output_class].type == this.drawflow.drawflow[this.module].data[input_id].inputs[input_class].type;
  }

  contextmenu(e) {
    this.dispatch('contextmenu', e);
    e.preventDefault();
    if(this.editor_mode === 'fixed' || this.editor_mode === 'view') {
      return false;
    }
    if(this.precanvas.getElementsByClassName("drawflow-delete").length) {
      this.precanvas.getElementsByClassName("drawflow-delete")[0].remove();
    }
    if(this.node_selected || this.connection_selected) {
      var deletebox = document.createElement('div');
      deletebox.classList.add("drawflow-delete");
      deletebox.innerHTML = "x";
      if(this.node_selected) {
        this.node_selected.appendChild(deletebox);
      }
      if(this.connection_selected) {
        deletebox.style.top = e.clientY * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom)) - (this.precanvas.getBoundingClientRect().y * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom))) + "px";
        deletebox.style.left = e.clientX * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom)) - (this.precanvas.getBoundingClientRect().x * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom))) + "px";

        this.precanvas.appendChild(deletebox);
      }
    }
  }

  contextmenuDel() {
    if(this.precanvas.getElementsByClassName("drawflow-delete").length) {
      this.precanvas.getElementsByClassName("drawflow-delete")[0].remove();
    }
  }

  key(e) {
    this.dispatch('keydown', e);
    if(this.editor_mode === 'fixed' || this.editor_mode === 'view') {
      return false;
    }
    if(e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) {
      if(this.node_selected != null) {
        if(this.first_click.tagName !== 'INPUT' && this.first_click.tagName !== 'TEXTAREA' && this.first_click.hasAttribute('contenteditable') !== true) {
          this.removeNodeId(this.node_selected.id);
        }
      }
      if(this.connection_selected != null) {
        this.removeConnection();
      }
    }
  }

  zoom_enter(event, delta) {
    if(event.ctrlKey) {
      event.preventDefault();
      if(event.deltaY > 0) {
        // Zoom Out
        this.zoom_out();
      } else {
        // Zoom In
        this.zoom_in();
      }
      //this.precanvas.style.transform = "translate("+this.canvas_x+"px, "+this.canvas_y+"px) scale("+this.zoom+")";
    }
  }

  zoom_refresh() {
    this.dispatch('zoom', this.zoom);
    this.canvas_x = (this.canvas_x / this.zoom_last_value) * this.zoom;
    this.canvas_y = (this.canvas_y / this.zoom_last_value) * this.zoom;
    this.zoom_last_value = this.zoom;
    this.precanvas.style.transform = "translate(" + this.canvas_x + "px, " + this.canvas_y + "px) scale(" + this.zoom + ")";
  }

  zoom_in() {
    if(this.zoom < this.zoom_max) {
      this.zoom += this.zoom_value;
      this.zoom_refresh();
    }
  }

  zoom_out() {
    if(this.zoom > this.zoom_min) {
      this.zoom -= this.zoom_value;
      this.zoom_refresh();
    }
  }

  zoom_reset() {
    if(this.zoom != 1) {
      this.zoom = 1;
      this.zoom_refresh();
    }
  }

  createCurvature(start_pos_x, start_pos_y, end_pos_x, end_pos_y, curvature_value, type) {
    var line_x = start_pos_x;
    var line_y = start_pos_y;
    var x = end_pos_x;
    var y = end_pos_y;
    var curvature = curvature_value;
    //type openclose open close other
    let hx1, hx2;

    switch(type) {
      case 'open':
        if(start_pos_x >= end_pos_x) {
          hx1 = line_x + Math.abs(x - line_x) * curvature;
          hx2 = x - Math.abs(x - line_x) * (curvature * -1);
        } else {
          hx1 = line_x + Math.abs(x - line_x) * curvature;
          hx2 = x - Math.abs(x - line_x) * curvature;
        }
        return ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + hx2 + ' ' + y + ' ' + x + '  ' + y;
      // break;

      case 'close':
        if(start_pos_x >= end_pos_x) {
          hx1 = line_x + Math.abs(x - line_x) * (curvature * -1);
          hx2 = x - Math.abs(x - line_x) * curvature;
        } else {
          hx1 = line_x + Math.abs(x - line_x) * curvature;
          hx2 = x - Math.abs(x - line_x) * curvature;
        }
        return ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + hx2 + ' ' + y + ' ' + x + '  ' + y;
      // break;

      case 'other':
        if(start_pos_x >= end_pos_x) {
          hx1 = line_x + Math.abs(x - line_x) * (curvature * -1);
          hx2 = x - Math.abs(x - line_x) * (curvature * -1);
        } else {
          hx1 = line_x + Math.abs(x - line_x) * curvature;
          hx2 = x - Math.abs(x - line_x) * curvature;
        }
        return ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + hx2 + ' ' + y + ' ' + x + '  ' + y;
      // break;

      default:

        hx1 = line_x + Math.abs(x - line_x) * curvature;
        hx2 = x - Math.abs(x - line_x) * curvature;

        return ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + hx2 + ' ' + y + ' ' + x + '  ' + y;
    }

  }

  drawConnection(ele) {
    var connection = document.createElementNS('http://www.w3.org/2000/svg', "svg");
    this.connection_ele = connection;
    var path = document.createElementNS('http://www.w3.org/2000/svg', "path");
    path.classList.add("main-path");
    path.setAttributeNS(null, 'd', '');
    // path.innerHTML = 'a';
    connection.classList.add("connection");
    connection.appendChild(path);
    this.precanvas.appendChild(connection);
    // Retrieve output node Id
    // var id_output = ele.closest('.drawflow-node').id.slice(5);
    var id_output = ele.parentElement.parentElement.parentElement.id.slice(5);
    var output_class = ele.classList[1];
    // Apply same type to connection from 'output'
    connection.setAttribute("type", this.drawflow.drawflow[this.module].data[id_output].outputs[output_class].type);
    this.dispatch('connectionStart', { output_id: id_output, output_class: output_class });

  }

  updateConnection(eX, eY) {
    const precanvas = this.precanvas;
    const zoom = this.zoom;
    let precanvasWitdhZoom = precanvas.clientWidth / (precanvas.clientWidth * zoom);
    precanvasWitdhZoom = precanvasWitdhZoom || 0;
    let precanvasHeightZoom = precanvas.clientHeight / (precanvas.clientHeight * zoom);
    precanvasHeightZoom = precanvasHeightZoom || 0;
    var path = this.connection_ele.children[0];

    /*var line_x = this.ele_selected.offsetWidth/2 + this.line_path/2 + this.ele_selected.parentElement.parentElement.offsetLeft + this.ele_selected.offsetLeft;
    var line_y = this.ele_selected.offsetHeight/2 + this.line_path/2 + this.ele_selected.parentElement.parentElement.offsetTop + this.ele_selected.offsetTop;*/

    var line_x = this.ele_selected.offsetWidth / 2 + (this.ele_selected.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
    var line_y = this.ele_selected.offsetHeight / 2 + (this.ele_selected.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

    var x = eX * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom)) - (this.precanvas.getBoundingClientRect().x * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom)));
    var y = eY * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom)) - (this.precanvas.getBoundingClientRect().y * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom)));

    /*
    var curvature = 0.5;
    var hx1 = line_x + Math.abs(x - line_x) * curvature;
    var hx2 = x - Math.abs(x - line_x) * curvature;
    */

    //path.setAttributeNS(null, 'd', 'M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y);
    var curvature = this.curvature;
    var lineCurve = this.createCurvature(line_x, line_y, x, y, curvature, 'openclose');
    path.setAttributeNS(null, 'd', lineCurve);

  }

  addConnection(id_output, id_input, output_class, input_class) {
    var nodeOneModule = this.getModuleFromNodeId(id_output);
    var nodeTwoModule = this.getModuleFromNodeId(id_input);
    if(nodeOneModule === nodeTwoModule) {

      var dataNode = this.getNodeFromId(id_output);
      var exist = false;
      for(var checkOutput in dataNode.outputs[output_class].connections) {
        var connectionSearch = dataNode.outputs[output_class].connections[checkOutput];
        if(connectionSearch.node == id_input && connectionSearch.output == input_class) {
          exist = true;
        }
      }
      // Check connection exist
      if(exist === false) {
        //Create Connection
        this.drawflow.drawflow[nodeOneModule].data[id_output].outputs[output_class].connections.push({ "node": id_input.toString(), "output": input_class });
        this.drawflow.drawflow[nodeOneModule].data[id_input].inputs[input_class].connections.push({ "node": id_output.toString(), "input": output_class });

        if(this.module === nodeOneModule) {
          // Check type matches
          if((this.checkInOutType && this.checkConnectionTypes(id_input, input_class, id_output, output_class)) || !this.checkInOutType) {
            //Draw connection
            var connection = document.createElementNS('http://www.w3.org/2000/svg', "svg");
            var path = document.createElementNS('http://www.w3.org/2000/svg', "path");
            path.classList.add("main-path");
            path.setAttributeNS(null, 'd', '');
            // path.innerHTML = 'a';
            connection.classList.add("connection");
            connection.classList.add("node_in_node-" + id_input);
            connection.classList.add("node_out_node-" + id_output);
            connection.classList.add(output_class);
            connection.classList.add(input_class);
            // Apply output type to connection
            connection.setAttribute("type", this.drawflow.drawflow[this.module].data[id_output].outputs[output_class].type);
            connection.appendChild(path);

            // Add "linked" style to both input/output element
            var output = document.querySelector('#node-' + id_output + ' .' + output_class);
            if(output && !output.classList.contains('linked')) {
              output.classList.add("linked");
            }

            var input = document.querySelector('#node-' + id_input + ' .' + input_class);
            if(input && !input.classList.contains('linked')) {
              input.classList.add("linked");
            }

            this.precanvas.appendChild(connection);
            this.updateConnectionNodes('node-' + id_output);
            this.updateConnectionNodes('node-' + id_input);

            this.dispatch('connectionCreated', { output_id: id_output, input_id: id_input, output_class: output_class, input_class: input_class });
          }
          else
            console.log("Input " + id_input + input_class + " and ouput " + id_output + output_class + " types don't match");
        }
      }
    }
  }

  updateConnectionNodes(id) {

    // Aquí nos quedamos;
    const idSearch = 'node_in_' + id;
    const idSearchOut = 'node_out_' + id;
    // var line_path = this.line_path/2;
    const container = this.container;
    const precanvas = this.precanvas;
    const curvature = this.curvature;
    const createCurvature = this.createCurvature;
    const reroute_curvature = this.reroute_curvature;
    const reroute_curvature_start_end = this.reroute_curvature_start_end;
    const reroute_fix_curvature = this.reroute_fix_curvature;
    const rerouteWidth = this.reroute_width;
    const zoom = this.zoom;
    let precanvasWitdhZoom = precanvas.clientWidth / (precanvas.clientWidth * zoom);
    precanvasWitdhZoom = precanvasWitdhZoom || 0;
    let precanvasHeightZoom = precanvas.clientHeight / (precanvas.clientHeight * zoom);
    precanvasHeightZoom = precanvasHeightZoom || 0;

    const elemsOut = container.querySelectorAll(`.${idSearchOut}`);

    Object.keys(elemsOut).map(function(item, index) {
      if(elemsOut[item].querySelector('.point') === null) {

        var elemtsearchId_out = container.querySelector(`#${id}`);

        var id_search = elemsOut[item].classList[1].replace('node_in_', '');
        var elemtsearchId = container.querySelector(`#${id_search}`);

        var elemtsearch = elemtsearchId.querySelectorAll('.' + elemsOut[item].classList[4])[0];

        /*var eX = elemtsearch.offsetWidth/2 + line_path + elemtsearch.parentElement.parentElement.offsetLeft + elemtsearch.offsetLeft;
        var eY = elemtsearch.offsetHeight/2 + line_path + elemtsearch.parentElement.parentElement.offsetTop + elemtsearch.offsetTop;*/
        var eX = elemtsearch.offsetWidth / 2 + (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
        var eY = elemtsearch.offsetHeight / 2 + (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

        var elemtsearchOut = elemtsearchId_out.querySelectorAll('.' + elemsOut[item].classList[3])[0];
        /*var line_x = elemtsearchId_out.offsetLeft + elemtsearchId_out.querySelectorAll('.'+elemsOut[item].classList[3])[0].offsetLeft + elemtsearchId_out.querySelectorAll('.'+elemsOut[item].classList[3])[0].offsetWidth/2 + line_path;
        var line_y = elemtsearchId_out.offsetTop + elemtsearchId_out.querySelectorAll('.'+elemsOut[item].classList[3])[0].offsetTop + elemtsearchId_out.querySelectorAll('.'+elemsOut[item].classList[3])[0].offsetHeight/2 + line_path;*/
        var line_x = elemtsearchOut.offsetWidth / 2 + (elemtsearchOut.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
        var line_y = elemtsearchOut.offsetHeight / 2 + (elemtsearchOut.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

        var x = eX;
        var y = eY;
        /*
        var curvature = 0.5;
        var hx1 = line_x + Math.abs(x - line_x) * curvature;
        var hx2 = x - Math.abs(x - line_x) * curvature;
        // console.log('M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y );
        elemsOut[item].children[0].setAttributeNS(null, 'd', 'M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y );
        */

        const lineCurve = createCurvature(line_x, line_y, x, y, curvature, 'openclose');
        elemsOut[item].children[0].setAttributeNS(null, 'd', lineCurve);
      } else {
        const points = elemsOut[item].querySelectorAll('.point');
        let linecurve = '';
        const reoute_fix = [];
        points.forEach((item, i) => {
          if(i === 0 && ((points.length - 1) === 0)) {
            // M line_x line_y C hx1 line_y hx2 y x y
            let elemtsearchId_out = container.querySelector(`#${id}`);
            let elemtsearch = item;

            let eX = (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            let eY = (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;

            /*var line_x = elemtsearchId_out.offsetLeft + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetLeft + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetWidth/2 + line_path;
            var line_y = elemtsearchId_out.offsetTop + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetTop + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetHeight/2 + line_path;*/
            let elemtsearchOut = elemtsearchId_out.querySelectorAll('.' + item.parentElement.classList[3])[0];
            let line_x = elemtsearchOut.offsetWidth / 2 + (elemtsearchOut.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            let line_y = elemtsearchOut.offsetHeight / 2 + (elemtsearchOut.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;
            let x = eX;
            let y = eY;

            /*var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'open');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

            //var elemtsearchId_out = document.getElementById(id);
            elemtsearchId_out = item;
            let id_search = item.parentElement.classList[1].replace('node_in_', '');
            let elemtsearchId = container.querySelector(`#${id_search}`);
            elemtsearch = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[4])[0];

            /*var eX = elemtsearch.offsetWidth/2 + line_path + elemtsearch.parentElement.parentElement.offsetLeft + elemtsearch.offsetLeft;
            var eY = elemtsearch.offsetHeight/2 + line_path + elemtsearch.parentElement.parentElement.offsetTop + elemtsearch.offsetTop;*/
            let elemtsearchIn = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[4])[0];
            eX = elemtsearchIn.offsetWidth / 2 + (elemtsearchIn.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            eY = elemtsearchIn.offsetHeight / 2 + (elemtsearchIn.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

            line_x = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            line_y = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            x = eX;
            y = eY;
            /*
            var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;
            */
            lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'close');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

          } else if(i === 0) {
            //console.log("Primero");
            // M line_x line_y C hx1 line_y hx2 y x y
            // FIRST
            let elemtsearchId_out = container.querySelector(`#${id}`);
            let elemtsearch = item;

            let eX = (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            let eY = (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;

            /*var line_x = elemtsearchId_out.offsetLeft + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetLeft + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetWidth/2 + line_path;
            var line_y = elemtsearchId_out.offsetTop + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetTop + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[3])[0].offsetHeight/2 + line_path;*/
            let elemtsearchOut = elemtsearchId_out.querySelectorAll('.' + item.parentElement.classList[3])[0];
            let line_x = elemtsearchOut.offsetWidth / 2 + (elemtsearchOut.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            let line_y = elemtsearchOut.offsetHeight / 2 + (elemtsearchOut.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

            let x = eX;
            let y = eY;
            /*
            var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'open');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

            // SECOND
            elemtsearchId_out = item;
            elemtsearch = points[i + 1];

            eX = (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            eY = (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            line_x = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            line_y = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            x = eX;
            y = eY;
            /*
            var curvature = reroute_curvature;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature, 'other');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

          } else if(i === (points.length - 1)) {
            //console.log("Final");
            let elemtsearchId_out = item;

            let id_search = item.parentElement.classList[1].replace('node_in_', '');
            let elemtsearchId = container.querySelector(`#${id_search}`);
            let elemtsearch = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[4])[0];

            /*var eX = elemtsearch.offsetWidth/2 + line_path + elemtsearch.parentElement.parentElement.offsetLeft + elemtsearch.offsetLeft;
            var eY = elemtsearch.offsetHeight/2 + line_path + elemtsearch.parentElement.parentElement.offsetTop + elemtsearch.offsetTop;*/
            let elemtsearchIn = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[4])[0];
            let eX = elemtsearchIn.offsetWidth / 2 + (elemtsearchIn.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            let eY = elemtsearchIn.offsetHeight / 2 + (elemtsearchIn.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;
            let line_x = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * (precanvas.clientWidth / (precanvas.clientWidth * zoom)) + rerouteWidth;
            let line_y = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * (precanvas.clientHeight / (precanvas.clientHeight * zoom)) + rerouteWidth;
            let x = eX;
            let y = eY;

            /*
            var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'close');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

          } else {
            let elemtsearchId_out = item;
            let elemtsearch = points[i + 1];

            let eX = (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * (precanvas.clientWidth / (precanvas.clientWidth * zoom)) + rerouteWidth;
            let eY = (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * (precanvas.clientHeight / (precanvas.clientHeight * zoom)) + rerouteWidth;
            let line_x = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * (precanvas.clientWidth / (precanvas.clientWidth * zoom)) + rerouteWidth;
            let line_y = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * (precanvas.clientHeight / (precanvas.clientHeight * zoom)) + rerouteWidth;
            let x = eX;
            let y = eY;
            /*
            var curvature = reroute_curvature;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature, 'other');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);
          }

        });
        if(reroute_fix_curvature) {
          reoute_fix.forEach((itempath, i) => {
            elemsOut[item].children[i].setAttributeNS(null, 'd', itempath);
          });

        } else {
          elemsOut[item].children[0].setAttributeNS(null, 'd', linecurve);
        }

      }
    });

    const elems = container.querySelectorAll(`.${idSearch}`);
    Object.keys(elems).map(function(item, index) {
      // console.log("In")
      if(elems[item].querySelector('.point') === null) {
        var elemtsearchId_in = container.querySelector(`#${id}`);

        var id_search = elems[item].classList[2].replace('node_out_', '');
        var elemtsearchId = container.querySelector(`#${id_search}`);
        var elemtsearch = elemtsearchId.querySelectorAll('.' + elems[item].classList[3])[0];

        /*var line_x = elemtsearch.offsetWidth/2 + line_path + elemtsearch.parentElement.parentElement.offsetLeft + elemtsearch.offsetLeft;
        var line_y = elemtsearch.offsetHeight/2 + line_path + elemtsearch.parentElement.parentElement.offsetTop + elemtsearch.offsetTop;*/

        var line_x = elemtsearch.offsetWidth / 2 + (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
        var line_y = elemtsearch.offsetHeight / 2 + (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

        /*var x = elemtsearchId_in.offsetLeft + elemtsearchId_in.querySelectorAll('.'+elems[item].classList[4])[0].offsetLeft + elemtsearchId_in.querySelectorAll('.'+elems[item].classList[4])[0].offsetWidth/2 + line_path;
        var y = elemtsearchId_in.offsetTop + elemtsearchId_in.querySelectorAll('.'+elems[item].classList[4])[0].offsetTop + elemtsearchId_in.querySelectorAll('.'+elems[item].classList[4])[0].offsetHeight/2 + line_path;*/
        elemtsearchId_in = elemtsearchId_in.querySelectorAll('.' + elems[item].classList[4])[0];
        var x = elemtsearchId_in.offsetWidth / 2 + (elemtsearchId_in.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
        var y = elemtsearchId_in.offsetHeight / 2 + (elemtsearchId_in.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

        /*
        var curvature = 0.5;
        var hx1 = line_x + Math.abs(x - line_x) * curvature;
        var hx2 = x - Math.abs(x - line_x) * curvature;
        // console.log('M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y );
        elems[item].children[0].setAttributeNS(null, 'd', 'M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y );*/
        const lineCurve = createCurvature(line_x, line_y, x, y, curvature, 'openclose');
        elems[item].children[0].setAttributeNS(null, 'd', lineCurve);

      } else {
        const points = elems[item].querySelectorAll('.point');
        let linecurve = '';
        const reoute_fix = [];
        points.forEach((item, i) => {
          if(i === 0 && ((points.length - 1) === 0)) {
            // M line_x line_y C hx1 line_y hx2 y x y
            let elemtsearchId_out = container.querySelector(`#${id}`);
            let elemtsearch = item;

            let line_x = (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            let line_y = (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;

            let elemtsearchIn = elemtsearchId_out.querySelectorAll('.' + item.parentElement.classList[4])[0];
            let eX = elemtsearchIn.offsetWidth / 2 + (elemtsearchIn.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            let eY = elemtsearchIn.offsetHeight / 2 + (elemtsearchIn.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

            /*var eX = elemtsearchId_out.offsetLeft + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[4])[0].offsetLeft + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[4])[0].offsetWidth/2 + line_path;
            var eY = elemtsearchId_out.offsetTop + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[4])[0].offsetTop + elemtsearchId_out.querySelectorAll('.'+item.parentElement.classList[4])[0].offsetHeight/2 + line_path;*/

            let x = eX;
            let y = eY;
            /*
            var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'close');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

            //var elemtsearchId_out = document.getElementById(id);
            elemtsearchId_out = item;
            let id_search = item.parentElement.classList[2].replace('node_out_', '');
            let elemtsearchId = container.querySelector(`#${id_search}`);
            elemtsearch = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[3])[0];

            /*var line_x = elemtsearch.offsetWidth/2 + line_path + elemtsearch.parentElement.parentElement.offsetLeft + elemtsearch.offsetLeft;
            var line_y = elemtsearch.offsetHeight/2 + line_path + elemtsearch.parentElement.parentElement.offsetTop + elemtsearch.offsetTop;*/
            let elemtsearchOut = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[3])[0];
            line_x = elemtsearchOut.offsetWidth / 2 + (elemtsearchOut.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            line_y = elemtsearchOut.offsetHeight / 2 + (elemtsearchOut.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

            eX = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            eY = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            x = eX;
            y = eY;
            /*
            var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'open');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

          } else if(i === 0) {
            // M line_x line_y C hx1 line_y hx2 y x y
            // FIRST
            let elemtsearchId_out = item;
            let id_search = item.parentElement.classList[2].replace('node_out_', '');
            let elemtsearchId = container.querySelector(`#${id_search}`);
            let elemtsearch = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[3])[0];

            /*var line_x = elemtsearch.offsetWidth/2 + line_path + elemtsearch.parentElement.parentElement.offsetLeft + elemtsearch.offsetLeft;
            var line_y = elemtsearch.offsetHeight/2 + line_path + elemtsearch.parentElement.parentElement.offsetTop + elemtsearch.offsetTop;*/
            let elemtsearchOut = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[3])[0];
            let line_x = elemtsearchOut.offsetWidth / 2 + (elemtsearchOut.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            let line_y = elemtsearchOut.offsetHeight / 2 + (elemtsearchOut.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

            let eX = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            let eY = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            let x = eX;
            let y = eY;
            /*
            var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'open');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

            // SECOND
            elemtsearchId_out = item;
            elemtsearch = points[i + 1];

            eX = (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            eY = (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            line_x = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            line_y = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            x = eX;
            y = eY;

            /*
            var curvature = reroute_curvature;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature, 'other');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

          } else if(i === (points.length - 1)) {

            let elemtsearchId_out = item;

            let id_search = item.parentElement.classList[1].replace('node_in_', '');
            let elemtsearchId = container.querySelector(`#${id_search}`);
            let elemtsearch = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[4])[0];

            /*var eX = elemtsearch.offsetWidth/2 + line_path + elemtsearch.parentElement.parentElement.offsetLeft + elemtsearch.offsetLeft;
            var eY = elemtsearch.offsetHeight/2 + line_path + elemtsearch.parentElement.parentElement.offsetTop + elemtsearch.offsetTop;*/
            let elemtsearchIn = elemtsearchId.querySelectorAll('.' + item.parentElement.classList[4])[0];
            let eX = elemtsearchIn.offsetWidth / 2 + (elemtsearchIn.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom;
            let eY = elemtsearchIn.offsetHeight / 2 + (elemtsearchIn.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom;

            let line_x = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            let line_y = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            let x = eX;
            let y = eY;
            /*
            var curvature = 0.5;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;*/
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature_start_end, 'close');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);

          } else {

            let elemtsearchId_out = item;
            let elemtsearch = points[i + 1];

            let eX = (elemtsearch.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            let eY = (elemtsearch.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            let line_x = (elemtsearchId_out.getBoundingClientRect().x - precanvas.getBoundingClientRect().x) * precanvasWitdhZoom + rerouteWidth;
            let line_y = (elemtsearchId_out.getBoundingClientRect().y - precanvas.getBoundingClientRect().y) * precanvasHeightZoom + rerouteWidth;
            let x = eX;
            let y = eY;
            /*
            var curvature = reroute_curvature;
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            linecurve += ' M '+ line_x +' '+ line_y +' C '+ hx1 +' '+ line_y +' '+ hx2 +' ' + y +' ' + x +'  ' + y;
            */
            let lineCurveSearch = createCurvature(line_x, line_y, x, y, reroute_curvature, 'other');
            linecurve += lineCurveSearch;
            reoute_fix.push(lineCurveSearch);
          }

        });
        if(reroute_fix_curvature) {
          reoute_fix.forEach((itempath, i) => {
            elems[item].children[i].setAttributeNS(null, 'd', itempath);
          });

        } else {
          elems[item].children[0].setAttributeNS(null, 'd', linecurve);
        }

      }
    });
  }

  dblclick(e) {
    if(this.connection_selected != null && this.reroute) {
      this.createReroutePoint(this.connection_selected);
    }

    if(e.target.classList[0] === 'point') {
      this.removeReroutePoint(e.target);
    }

    if(e.target.classList[0] === 'title-box') {
      var close = e.target.closest(".drawflow-node");
      this.dispatch('dblclick', close.id.slice(5));
    }
  }

  createReroutePoint(ele) {
    this.connection_selected.classList.remove("selected");
    const nodeUpdate = this.connection_selected.parentElement.classList[2].slice(9);
    const nodeUpdateIn = this.connection_selected.parentElement.classList[1].slice(13);
    const output_class = this.connection_selected.parentElement.classList[3];
    const input_class = this.connection_selected.parentElement.classList[4];
    this.connection_selected = null;
    const point = document.createElementNS('http://www.w3.org/2000/svg', "circle");
    point.classList.add("point");
    var pos_x = this.pos_x * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom)) - (this.precanvas.getBoundingClientRect().x * (this.precanvas.clientWidth / (this.precanvas.clientWidth * this.zoom)));
    var pos_y = this.pos_y * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom)) - (this.precanvas.getBoundingClientRect().y * (this.precanvas.clientHeight / (this.precanvas.clientHeight * this.zoom)));

    point.setAttributeNS(null, 'cx', pos_x);
    point.setAttributeNS(null, 'cy', pos_y);
    point.setAttributeNS(null, 'r', this.reroute_width);

    let position_add_array_point = 0;
    if(this.reroute_fix_curvature) {

      const numberPoints = ele.parentElement.querySelectorAll(".main-path").length;
      var path = document.createElementNS('http://www.w3.org/2000/svg', "path");
      path.classList.add("main-path");
      path.setAttributeNS(null, 'd', '');

      ele.parentElement.insertBefore(path, ele.parentElement.children[numberPoints]);
      if(numberPoints === 1) {
        ele.parentElement.appendChild(point);
      } else {
        const search_point = Array.from(ele.parentElement.children).indexOf(ele);
        position_add_array_point = search_point;
        ele.parentElement.insertBefore(point, ele.parentElement.children[search_point + numberPoints + 1]);
      }
    } else {
      ele.parentElement.appendChild(point);
    }

    const nodeId = nodeUpdate.slice(5);
    const searchConnection = this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections.findIndex(function(item, i) {
      return item.node === nodeUpdateIn && item.output === input_class;
    });

    if(this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points === undefined) {
      this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points = [];
    }
    //this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points.push({ pos_x: pos_x, pos_y: pos_y });

    if(this.reroute_fix_curvature) {
      //console.log(position_add_array_point)
      if(position_add_array_point > 0) {
        this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points.splice(position_add_array_point, 0, { pos_x: pos_x, pos_y: pos_y });
      } else {
        this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points.push({ pos_x: pos_x, pos_y: pos_y });
      }

      ele.parentElement.querySelectorAll(".main-path").forEach((item, i) => {
        item.classList.remove("selected");
      });

    } else {
      this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points.push({ pos_x: pos_x, pos_y: pos_y });
    }

    /*
    this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points.sort((a,b) => (a.pos_x > b.pos_x) ? 1 : (b.pos_x > a.pos_x ) ? -1 : 0 );
    this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points.forEach((item, i) => {

        ele.parentElement.children[i+1].setAttributeNS(null, 'cx', item.pos_x);
        ele.parentElement.children[i+1].setAttributeNS(null, 'cy', item.pos_y);
    });*/

    this.dispatch('addReroute', nodeId);
    this.updateConnectionNodes(nodeUpdate);
  }

  removeReroutePoint(ele) {
    const nodeUpdate = ele.parentElement.classList[2].slice(9);
    const nodeUpdateIn = ele.parentElement.classList[1].slice(13);
    const output_class = ele.parentElement.classList[3];
    const input_class = ele.parentElement.classList[4];

    let numberPointPosition = Array.from(ele.parentElement.children).indexOf(ele) - 1;

    const nodeId = nodeUpdate.slice(5);
    const searchConnection = this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections.findIndex(function(item, i) {
      return item.node === nodeUpdateIn && item.output === input_class;
    });

    if(this.reroute_fix_curvature) {

      const numberMainPath = ele.parentElement.querySelectorAll(".main-path").length;
      ele.parentElement.children[numberMainPath - 1].remove();
      numberPointPosition -= numberMainPath;
      if(numberPointPosition < 0) {
        numberPointPosition = 0;
      }
    }
    //console.log(numberPointPosition);
    this.drawflow.drawflow[this.module].data[nodeId].outputs[output_class].connections[searchConnection].points.splice(numberPointPosition, 1);

    ele.remove();
    this.dispatch('removeReroute', nodeId);
    this.updateConnectionNodes(nodeUpdate);

  }

  registerNode(name, html, props = null, options = null) {
    this.noderegister[name] = { html: html, props: props, options: options };
  }

  getNodeFromId(id) {
    var moduleName = this.getModuleFromNodeId(id);
    return JSON.parse(JSON.stringify(this.drawflow.drawflow[moduleName].data[id]));
  }

  getNodesFromName(name) {
    var nodes = [];
    const editor = this.drawflow.drawflow;
    Object.keys(editor).map(function(moduleName, index) {
      for(var node in editor[moduleName].data) {
        if(editor[moduleName].data[node].name == name) {
          nodes.push(editor[moduleName].data[node].id);
        }
      }
    });
    return nodes;
  }

  // nodeContents should follow this data struct {'header': '<p>Node title</p>', 'html': '<div>It s content</div>', 'footer': '<p>Node footer content</p>'}
  addNode(name, inputsData, outputsData, ele_pos_x, ele_pos_y, classoverride, data, nodeContents, typenode = false) {
    var newNodeId;
    if(this.useuuid) {
      newNodeId = this.getUuid();
    } else {
      newNodeId = this.nodeId;
    }
    const parent = document.createElement('div');
    parent.classList.add("parent-node");

    const node = document.createElement('div');
    node.innerHTML = "";
    node.setAttribute("id", "node-" + newNodeId);
    node.classList.add("drawflow-node");
    if(classoverride != '') {
      node.classList.add(classoverride);
    }

    // HEADER - Can be used to define a node header
    const nodeHeader = document.createElement('div');
    nodeHeader.innerHTML = nodeContents.header ? nodeContents.header : "";
    nodeHeader.classList.add("drawflow-node-header");

    // CONTENT - flex column that contains inputs/outputs and content divs
    const nodeContent = document.createElement('div');
    nodeContent.classList.add("drawflow-node-content");

    // Inputs div
    const inputs = document.createElement('div');
    inputs.classList.add("inputs");

    // Outputs div
    const outputs = document.createElement('div');
    outputs.classList.add("outputs");

    const json_inputs = {};
    for(let x = 0; x < inputsData.length; x++) {
      const inputData = inputsData[x];
      // Input hook div
      const input = document.createElement('div');
      input.classList.add("input");
      input.classList.add("input_" + (x + 1));
      if(inputData.type != "") {
        input.setAttribute("type", inputData.type);
      }
      json_inputs["input_" + (x + 1)] = { "label": inputData.label, "type": inputData.type, "connections": [] };
      inputs.appendChild(input);

      // Input label div
      const inputLabel = document.createElement('div');
      inputLabel.classList.add("input-label");
      inputLabel.classList.add("input-label_input_" + (x + 1));
      if(inputData.type) {
        inputLabel.setAttribute("type", inputData.type);
      }
      if(inputData.label) {
        inputLabel.innerHTML = inputData.label;
      }
      inputs.appendChild(inputLabel);
    }

    const json_outputs = {};
    for(let x = 0; x < outputsData.length; x++) {
      const outputData = outputsData[x];
      // Output label div
      const outputLabel = document.createElement('div');
      outputLabel.classList.add("output-label");
      outputLabel.classList.add("output-label_output_" + (x + 1));
      if(outputData.type) {
        outputLabel.setAttribute("type", outputData.type);
      }
      if(outputData.label) {
        outputLabel.innerHTML = outputData.label;
      }
      outputs.appendChild(outputLabel);

      // Output hook div
      const output = document.createElement('div');
      output.classList.add("output");
      output.classList.add("output_" + (x + 1));
      if(outputData.type) {
        output.setAttribute("type", outputData.type);
      }
      json_outputs["output_" + (x + 1)] = { "label": outputData.label, "type": outputData.type, "connections": [] };
      outputs.appendChild(output);
    }

    // Content in between inputs and outputs
    const content = document.createElement('div');
    content.classList.add("drawflow_content_node");

    if(typenode === false) {
      content.innerHTML = nodeContents.html;
    } else if(typenode === true) {
      content.appendChild(this.noderegister[nodeContents.html].html.cloneNode(true));
    } else {
      if(parseInt(this.render.version) === 3) {
        //Vue 3
        let wrapper = this.render.createApp({
          render: h => this.render.h(this.noderegister[nodeContents.html].html, this.noderegister[nodeContents.html].props, this.noderegister[nodeContents.html].options)
        }).mount(content);
      } else {
        // Vue 2
        let wrapper = new this.render({
          render: h => h(this.noderegister[nodeContents.html].html, { props: this.noderegister[nodeContents.html].props }), ...this.noderegister[nodeContents.html].options
        }).$mount();
        //
        content.appendChild(wrapper.$el);
      }
    }

    // Handle any values that need to be assigned
    Object.entries(data).forEach(function(key, value) {
      if(typeof key[1] === "object") {
        insertObjectkeys(null, key[0], key[0]);
      } else {
        var elems = content.querySelectorAll('[df-' + key[0] + ']');
        for(var i = 0; i < elems.length; i++) {
          elems[i].value = key[1];
        }
      }
    });

    function insertObjectkeys(object, name, completname) {
      let objectData;
      if(object === null) {
        objectData = data[name];
      } else {
        objectData = object[name];
      }
      if(objectData !== null) {
        Object.entries(objectData).forEach(function(key, value) {
          if(typeof key[1] === "object") {
            insertObjectkeys(objectData, key[0], completname + '-' + key[0]);
          } else {
            var elems = content.querySelectorAll('[df-' + completname + '-' + key[0] + ']');
            for(var i = 0; i < elems.length; i++) {
              elems[i].value = key[1];
            }
          }
        });
      }
    }

    // FOOTER - Can be used to define a node header
    const nodeFooter = document.createElement('div');
    nodeFooter.innerHTML = nodeContents.footer ? nodeContents.footer : "";
    nodeFooter.classList.add("drawflow-node-footer");

    // Add header to node
    node.appendChild(nodeHeader);

    // Add content to node
    node.appendChild(nodeContent);
    // Add inputs/ouputs and middle content to content div
    nodeContent.appendChild(inputs);
    nodeContent.appendChild(content);
    nodeContent.appendChild(outputs);

    // Add footer to node
    node.appendChild(nodeFooter);

    // Position node
    node.style.top = ele_pos_y + "px";
    node.style.left = ele_pos_x + "px";

    // Add node to parent-node div
    parent.appendChild(node);
    // Add parent-node to drawflow div
    this.precanvas.appendChild(parent);

    // Save the node data in drawflow json
    var json = {
      id: newNodeId,
      name: name,
      data: data,
      class: classoverride,
      header: nodeContents.header,
      html: nodeContents.html,
      footer: nodeContents.footer,
      typenode: typenode,
      inputs: json_inputs,
      outputs: json_outputs,
      pos_x: ele_pos_x,
      pos_y: ele_pos_y,
    };
    this.drawflow.drawflow[this.module].data[newNodeId] = json;
    this.dispatch('nodeCreated', newNodeId);
    if(!this.useuuid) {
      this.nodeId++;
    }
    return newNodeId;
  }

  addNodeImport(dataNode, precanvas) {
    const parent = document.createElement('div');
    parent.classList.add("parent-node");

    const node = document.createElement('div');
    node.innerHTML = "";
    node.setAttribute("id", "node-" + dataNode.id);
    node.classList.add("drawflow-node");
    if(dataNode.class != '') {
      node.classList.add(dataNode.class);
    }

    // HEADER - Can be used to define a node header
    const nodeHeader = document.createElement('div');
    nodeHeader.innerHTML = dataNode.header ? dataNode.header : "";
    nodeHeader.classList.add("drawflow-node-header");

    // CONTENT - flex column that contains inputs/outputs and content divs
    const nodeContent = document.createElement('div');
    nodeContent.classList.add("drawflow-node-content");

    // Inputs div
    const inputs = document.createElement('div');
    inputs.classList.add("inputs");

    // Outputs div
    const outputs = document.createElement('div');
    outputs.classList.add("outputs");

    // Inputs parsing
    Object.keys(dataNode.inputs).map(function(input_item, index) {
      // Input hook div
      const input = document.createElement('div');
      input.classList.add("input");
      input.classList.add(input_item);
      if(dataNode.inputs[input_item].type) {
        input.setAttribute("type", dataNode.inputs[input_item].type);
      }
      // Test is there is a connection then add the "linked" class
      if(dataNode.inputs[input_item].connections.length > 0) {
        input.classList.add("linked");
      }
      inputs.appendChild(input);

      // Input label div
      const inputLabel = document.createElement('div');
      inputLabel.classList.add("input-label");
      inputLabel.classList.add("input-label_input_" + (index + 1));
      if(dataNode.inputs[input_item].type) {
        inputLabel.setAttribute("type", dataNode.inputs[input_item].type);
      }
      if(dataNode.inputs[input_item].label) {
        inputLabel.innerHTML = dataNode.inputs[input_item].label;
      }
      inputs.appendChild(inputLabel);

      Object.keys(dataNode.inputs[input_item].connections).map(function(output_item, index) {

        var connection = document.createElementNS('http://www.w3.org/2000/svg', "svg");
        var path = document.createElementNS('http://www.w3.org/2000/svg', "path");
        path.classList.add("main-path");
        path.setAttributeNS(null, 'd', '');
        // path.innerHTML = 'a';
        connection.classList.add("connection");
        connection.classList.add("node_in_node-" + dataNode.id);
        connection.classList.add("node_out_node-" + dataNode.inputs[input_item].connections[output_item].node);
        connection.classList.add(dataNode.inputs[input_item].connections[output_item].input);
        connection.classList.add(input_item);
        connection.setAttribute("type", dataNode.inputs[input_item].type);

        connection.appendChild(path);
        precanvas.appendChild(connection);

      });
    });
    // Add a dummy div to inputs to have min width on inputs grid
    const inputDummy = document.createElement('div');
    inputDummy.classList.add("input-dummy");
    inputs.appendChild(inputDummy);

    // Outputs parsing
    Object.keys(dataNode.outputs).map((function(output_item, i) {
      // Output label div
      const outputLabel = document.createElement('div');
      outputLabel.classList.add("output-label");
      outputLabel.classList.add("output-label_output_" + (i++));
      if(dataNode.outputs[output_item].type) {
        outputLabel.setAttribute("type", dataNode.outputs[output_item].type);
      }
      if(dataNode.outputs[output_item].label) {
        outputLabel.innerHTML = dataNode.outputs[output_item].label;
      }
      outputs.appendChild(outputLabel);

      // Output hook div
      const output = document.createElement("div");
      output.classList.add("output");
      output.classList.add(output_item);
      //Making sure to add the type
      if(dataNode.outputs[output_item].type) {
        output.setAttribute("type", dataNode.outputs[output_item].type);
      }
      // Test is there is a connection then add the "linked" class
      if(dataNode.outputs[output_item].connections.length > 0) {
        output.classList.add("linked");
      }
      outputs.appendChild(output);
    }));
    // Add a dummy div to outputs to have min width on outputs grid
    const outputDummy = document.createElement('div');
    outputDummy.classList.add("output-dummy");
    outputs.appendChild(outputDummy);

    // Content in between inputs and outputs
    const content = document.createElement('div');
    content.classList.add("drawflow_content_node");

    if(dataNode.typenode === false) {
      content.innerHTML = dataNode.html;
    } else if(dataNode.typenode === true) {
      content.appendChild(this.noderegister[dataNode.html].html.cloneNode(true));
    } else {
      if(parseInt(this.render.version) === 3) {
        //Vue 3
        let wrapper = this.render.createApp({
          render: h => this.render.h(this.noderegister[dataNode.html].html, this.noderegister[dataNode.html].props, this.noderegister[dataNode.html].options)
        }).mount(content);
      } else {
        //Vue 2
        let wrapper = new this.render({
          render: h => h(this.noderegister[dataNode.html].html, { props: this.noderegister[dataNode.html].props }), ...this.noderegister[dataNode.html].options
        }).$mount();
        content.appendChild(wrapper.$el);
      }
    }

    // Handle any data values registered for this node
    Object.entries(dataNode.data).forEach(function(key, value) {
      if(typeof key[1] === "object") {
        insertObjectkeys(null, key[0], key[0]);
      } else {
        var elems = content.querySelectorAll('[df-' + key[0] + ']');
        for(var i = 0; i < elems.length; i++) {
          elems[i].value = key[1];
        }
      }
    });

    function insertObjectkeys(object, name, completname) {
      let objectData;
      if(object === null) {
        objectData = dataNode.data[name];
      } else {
        objectData = object[name];
      }
      if(objectData !== null) {
        Object.entries(objectData).forEach(function(key, value) {
          if(typeof key[1] === "object") {
            insertObjectkeys(objectData, key[0], completname + '-' + key[0]);
          } else {
            var elems = content.querySelectorAll('[df-' + completname + '-' + key[0] + ']');
            for(var i = 0; i < elems.length; i++) {
              elems[i].value = key[1];
            }
          }
        });
      }
    }

    // FOOTER - Can be used to define a node header
    const nodeFooter = document.createElement('div');
    nodeFooter.innerHTML = dataNode.footer ? dataNode.footer : "";
    nodeFooter.classList.add("drawflow-node-footer");

    // Add header to node
    node.appendChild(nodeHeader);

    // Add content to node
    node.appendChild(nodeContent);
    // Add inputs/ouputs and middle content to content div
    nodeContent.appendChild(inputs);
    nodeContent.appendChild(content);
    nodeContent.appendChild(outputs);

    // Add footer to node
    node.appendChild(nodeFooter);

    // Move node to right positions
    node.style.top = dataNode.pos_y + "px";
    node.style.left = dataNode.pos_x + "px";

    // Add node to parent-node div
    parent.appendChild(node);
    // Add parent-node to drawflow
    this.precanvas.appendChild(parent);
  }

  addRerouteImport(dataNode) {
    const reroute_width = this.reroute_width;
    const reroute_fix_curvature = this.reroute_fix_curvature;
    const container = this.container;

    Object.keys(dataNode.outputs).map(function(output_item, index) {
      Object.keys(dataNode.outputs[output_item].connections).map(function(input_item, index) {
        const points = dataNode.outputs[output_item].connections[input_item].points;
        if(points !== undefined) {

          points.forEach((item, i) => {
            const input_id = dataNode.outputs[output_item].connections[input_item].node;
            const input_class = dataNode.outputs[output_item].connections[input_item].output;
            //console.log('.connection.node_in_'+input_id+'.node_out_'+dataNode.id+'.'+output_item+'.'+input_class);
            const ele = container.querySelector('.connection.node_in_node-' + input_id + '.node_out_node-' + dataNode.id + '.' + output_item + '.' + input_class);

            if(reroute_fix_curvature) {
              if(i === 0) {
                for(var z = 0; z < points.length; z++) {
                  var path = document.createElementNS('http://www.w3.org/2000/svg', "path");
                  path.classList.add("main-path");
                  path.setAttributeNS(null, 'd', '');
                  ele.appendChild(path);

                }
              }
            }

            const point = document.createElementNS('http://www.w3.org/2000/svg', "circle");
            point.classList.add("point");
            var pos_x = item.pos_x;
            var pos_y = item.pos_y;

            point.setAttributeNS(null, 'cx', pos_x);
            point.setAttributeNS(null, 'cy', pos_y);
            point.setAttributeNS(null, 'r', reroute_width);

            ele.appendChild(point);

          });
        }
      });
    });
  }

  updateNodeValue(event) {
    var attr = event.target.attributes;
    for(var i = 0; i < attr.length; i++) {
      if(attr[i].nodeName.startsWith('df-')) {
        var keys = attr[i].nodeName.slice(3).split("-");
        var target = this.drawflow.drawflow[this.module].data[event.target.closest(".drawflow_content_node").parentElement.id.slice(5)].data;
        for(var index = 0; index < keys.length - 1; index += 1) {
          if(target[keys[index]] == null) {
            target[keys[index]] = {};
          }
          target = target[keys[index]];
        }
        target[keys[keys.length - 1]] = event.target.value;
      }
    }
  }

  updateNodeDataFromId(id, data) {
    var moduleName = this.getModuleFromNodeId(id);
    this.drawflow.drawflow[moduleName].data[id].data = data;
    if(this.module === moduleName) {
      const content = this.container.querySelector('#node-' + id);

      let insertObjectkeys = function(object, name, completname) {
        // function insertObjectkeys(object, name, completname) {
        let objectData;
        if(object === null) {
          objectData = data[name];
        } else {
          objectData = object[name];
        }

        if(objectData !== null) {
          Object.entries(objectData).forEach(function(key, value) {
            if(typeof key[1] === "object") {
              insertObjectkeys(objectData, key[0], completname + '-' + key[0]);
            } else {
              var elems = content.querySelectorAll('[df-' + completname + '-' + key[0] + ']');
              for(var i = 0; i < elems.length; i++) {
                elems[i].value = key[1];
              }
            }
          });
        }
      };

      Object.entries(data).forEach(function(key, value) {
        if(typeof key[1] === "object") {
          insertObjectkeys(null, key[0], key[0]);
        } else {
          var elems = content.querySelectorAll('[df-' + key[0] + ']');
          for(var i = 0; i < elems.length; i++) {
            elems[i].value = key[1];
          }
        }
      });
    }
  }

  addNodeInput(id, type = undefined, label = '') {
    var moduleName = this.getModuleFromNodeId(id);
    const infoNode = this.getNodeFromId(id);
    const numInputs = Object.keys(infoNode.inputs).length;
    if(this.module === moduleName) {
      //Draw input
      const input = document.createElement('div');
      input.classList.add("input");
      input.classList.add("input_" + (numInputs + 1));
      if(type) {
        input.setAttribute("type", type);
      }

      // Input label div
      const inputLabel = document.createElement('div');
      inputLabel.classList.add("input-label");
      inputLabel.classList.add("input-label_input_" + (numInputs + 1));
      if(type) {
        inputLabel.setAttribute("type", type);
      }
      if(label) {
        inputLabel.innerHTML = label;
      }

      const parent = this.container.querySelector('#node-' + id + ' .inputs');
      parent.appendChild(input);
      parent.appendChild(inputLabel);
      this.updateConnectionNodes('node-' + id);
    }
    this.drawflow.drawflow[moduleName].data[id].inputs["input_" + (numInputs + 1)] = {
      "label": label,
      "type": type,
      "connections": []
    };
  }

  changeNodeInputType(node_id, input_class, newType, newLabel) {
    this.drawflow.drawflow[this.module].data[node_id].inputs[input_class].type = newType;
    this.drawflow.drawflow[this.module].data[node_id].inputs[input_class].label = newLabel;

    var divInput = document.querySelector("#node-" + node_id + " ." + input_class);
    divInput.setAttribute("type", newType);

    var divInputLabel = document.querySelector("#node-" + node_id + " .input-label_" + input_class);
    divInputLabel.innerHTML = newLabel;
    // TODO Check connections

    var connections = this.drawflow.drawflow[this.module].data[node_id].inputs[input_class].connections[0]; // FIX

    if(connections && !this.checkConnectionTypes(node_id, input_class, connections.node, connections.input)) {
      console.log("Removeing invalid connection");
      this.removeSingleConnection(connections.node, node_id, connections.input, input_class);
    }
  }

  addNodeOutput(id, type = undefined, label = '') {
    var moduleName = this.getModuleFromNodeId(id);
    const infoNode = this.getNodeFromId(id);
    const numOutputs = Object.keys(infoNode.outputs).length;
    if(this.module === moduleName) {
      // Output label div
      const outputLabel = document.createElement('div');
      outputLabel.classList.add("output-label");
      outputLabel.classList.add("output-label_output_" + (numOutputs + 1));
      if(type) {
        outputLabel.setAttribute("type", type);
      }
      if(label) {
        outputLabel.innerHTML = label;
      }

      //Draw output
      const output = document.createElement('div');
      output.classList.add("output");
      output.classList.add("output_" + (numOutputs + 1));
      if(type) {
        output.setAttribute("type", type);
      }

      const parent = this.container.querySelector('#node-' + id + ' .outputs');
      parent.appendChild(outputLabel);
      parent.appendChild(output);
      this.updateConnectionNodes('node-' + id);
    }
    this.drawflow.drawflow[moduleName].data[id].outputs["output_" + (numOutputs + 1)] = {
      "label": label,
      "type": type,
      "connections": []
    };
  }

  changeNodeOutputType(node_id, output_class, newType, newLabel) {
    this.drawflow.drawflow[this.module].data[node_id].outputs[output_class].type = newType;
    this.drawflow.drawflow[this.module].data[node_id].outputs[output_class].type = newLabel;

    var divOutput = document.querySelector("#node-" + node_id + " ." + output_class);
    divOutput.setAttribute("type", newType);

    var divOutputLabel = document.querySelector("#node-" + node_id + " .output-label_" + output_class);
    divOutputLabel.innerHTML = newLabel;

    var connections = this.drawflow.drawflow[this.module].data[node_id].outputs[output_class].connections[0]; // FIX

    if(connections && !this.checkConnectionTypes(node_id, output_class, connections.node, connections.output)) {
      console.log("Removing invalid connection");
      this.removeSingleConnection(connections.node, node_id, connections.output, output_class);
    }
  }

  removeNodeInput(id, input_class) {
    var moduleName = this.getModuleFromNodeId(id);
    const infoNode = this.getNodeFromId(id);
    if(this.module === moduleName) {
      this.container.querySelector('#node-' + id + ' .inputs .input.' + input_class).remove();
      this.container.querySelector('#node-' + id + ' .inputs .input-label.input-label_' + input_class).remove();
    }
    const removeInputs = [];
    Object.keys(infoNode.inputs[input_class].connections).map(function(key, index) {
      const id_output = infoNode.inputs[input_class].connections[index].node;
      const output_class = infoNode.inputs[input_class].connections[index].input;
      removeInputs.push({ id_output, id, output_class, input_class });
    });
    // Remove connections
    removeInputs.forEach((item, i) => {
      this.removeSingleConnection(item.id_output, item.id, item.output_class, item.input_class);
    });

    delete this.drawflow.drawflow[moduleName].data[id].inputs[input_class];

    // Update connection
    const connections = [];
    const connectionsInputs = this.drawflow.drawflow[moduleName].data[id].inputs;
    Object.keys(connectionsInputs).map(function(key, index) {
      connections.push(connectionsInputs[key]);
    });
    this.drawflow.drawflow[moduleName].data[id].inputs = {};
    const input_class_id = input_class.slice(6);
    let nodeUpdates = [];
    connections.forEach((item, i) => {
      item.connections.forEach((itemx, f) => {
        nodeUpdates.push(itemx);
      });
      this.drawflow.drawflow[moduleName].data[id].inputs['input_' + (i + 1)] = item;
    });
    nodeUpdates = new Set(nodeUpdates.map(e => JSON.stringify(e)));
    nodeUpdates = Array.from(nodeUpdates).map(e => JSON.parse(e));

    if(this.module === moduleName) {
      const eles = this.container.querySelectorAll("#node-" + id + " .inputs .input");
      eles.forEach((item, i) => {
        const id_class = item.classList[1].slice(6);
        if(parseInt(input_class_id) < parseInt(id_class)) {
          item.classList.remove('input_' + id_class);
          item.classList.add('input_' + (id_class - 1));
        }
      });

    }

    nodeUpdates.forEach((itemx, i) => {
      this.drawflow.drawflow[moduleName].data[itemx.node].outputs[itemx.input].connections.forEach((itemz, g) => {
        if(itemz.node == id) {
          const output_id = itemz.output.slice(6);
          if(parseInt(input_class_id) < parseInt(output_id)) {
            if(this.module === moduleName) {
              const ele = this.container.querySelector(".connection.node_in_node-" + id + ".node_out_node-" + itemx.node + "." + itemx.input + ".input_" + output_id);
              ele.classList.remove('input_' + output_id);
              ele.classList.add('input_' + (output_id - 1));
            }
            if(itemz.points) {
              this.drawflow.drawflow[moduleName].data[itemx.node].outputs[itemx.input].connections[g] = { node: itemz.node, output: 'input_' + (output_id - 1), points: itemz.points };
            } else {
              this.drawflow.drawflow[moduleName].data[itemx.node].outputs[itemx.input].connections[g] = { node: itemz.node, output: 'input_' + (output_id - 1) };
            }
          }
        }
      });
    });
    this.updateConnectionNodes('node-' + id);
  }

  removeNodeOutput(id, output_class) {
    var moduleName = this.getModuleFromNodeId(id);
    const infoNode = this.getNodeFromId(id);
    if(this.module === moduleName) {
      this.container.querySelector('#node-' + id + ' .outputs .output.' + output_class).remove();
      this.container.querySelector('#node-' + id + ' .outputs .output-label.output-label_' + output_class).remove();
    }
    const removeOutputs = [];
    Object.keys(infoNode.outputs[output_class].connections).map(function(key, index) {
      const id_input = infoNode.outputs[output_class].connections[index].node;
      const input_class = infoNode.outputs[output_class].connections[index].output;
      removeOutputs.push({ id, id_input, output_class, input_class });
    });
    // Remove connections
    removeOutputs.forEach((item, i) => {
      this.removeSingleConnection(item.id, item.id_input, item.output_class, item.input_class);
    });

    delete this.drawflow.drawflow[moduleName].data[id].outputs[output_class];

    // Update connection
    const connections = [];
    const connectionsOuputs = this.drawflow.drawflow[moduleName].data[id].outputs;
    Object.keys(connectionsOuputs).map(function(key, index) {
      connections.push(connectionsOuputs[key]);
    });
    this.drawflow.drawflow[moduleName].data[id].outputs = {};
    const output_class_id = output_class.slice(7);
    let nodeUpdates = [];
    connections.forEach((item, i) => {
      item.connections.forEach((itemx, f) => {
        nodeUpdates.push({ node: itemx.node, output: itemx.output });
      });
      this.drawflow.drawflow[moduleName].data[id].outputs['output_' + (i + 1)] = item;
    });
    nodeUpdates = new Set(nodeUpdates.map(e => JSON.stringify(e)));
    nodeUpdates = Array.from(nodeUpdates).map(e => JSON.parse(e));

    if(this.module === moduleName) {
      const eles = this.container.querySelectorAll("#node-" + id + " .outputs .output");
      eles.forEach((item, i) => {
        const id_class = item.classList[1].slice(7);
        if(parseInt(output_class_id) < parseInt(id_class)) {
          item.classList.remove('output_' + id_class);
          item.classList.add('output_' + (id_class - 1));
        }
      });

    }

    nodeUpdates.forEach((itemx, i) => {
      this.drawflow.drawflow[moduleName].data[itemx.node].inputs[itemx.output].connections.forEach((itemz, g) => {
        if(itemz.node == id) {
          const input_id = itemz.input.slice(7);
          if(parseInt(output_class_id) < parseInt(input_id)) {
            if(this.module === moduleName) {

              const ele = this.container.querySelector(".connection.node_in_node-" + itemx.node + ".node_out_node-" + id + ".output_" + input_id + "." + itemx.output);
              ele.classList.remove('output_' + input_id);
              ele.classList.remove(itemx.output);
              ele.classList.add('output_' + (input_id - 1));
              ele.classList.add(itemx.output);
            }
            if(itemz.points) {
              this.drawflow.drawflow[moduleName].data[itemx.node].inputs[itemx.output].connections[g] = { node: itemz.node, input: 'output_' + (input_id - 1), points: itemz.points };
            } else {
              this.drawflow.drawflow[moduleName].data[itemx.node].inputs[itemx.output].connections[g] = { node: itemz.node, input: 'output_' + (input_id - 1) };
            }
          }
        }
      });
    });

    this.updateConnectionNodes('node-' + id);
  }

  removeNodeId(id) {
    this.removeConnectionNodeId(id);
    var moduleName = this.getModuleFromNodeId(id.slice(5));
    if(this.module === moduleName) {
      this.container.querySelector(`#${id}`).remove();
    }
    delete this.drawflow.drawflow[moduleName].data[id.slice(5)];
    this.dispatch('nodeRemoved', id.slice(5));
  }

  removeConnection() {
    if(this.connection_selected != null) {
      var listclass = this.connection_selected.parentElement.classList;
      this.connection_selected.parentElement.remove();
      //console.log(listclass);
      var index_out = this.drawflow.drawflow[this.module].data[listclass[2].slice(14)].outputs[listclass[3]].connections.findIndex(function(item, i) {
        return item.node === listclass[1].slice(13) && item.output === listclass[4];
      });
      this.drawflow.drawflow[this.module].data[listclass[2].slice(14)].outputs[listclass[3]].connections.splice(index_out, 1);

      var index_in = this.drawflow.drawflow[this.module].data[listclass[1].slice(13)].inputs[listclass[4]].connections.findIndex(function(item, i) {
        return item.node === listclass[2].slice(14) && item.input === listclass[3];
      });
      this.drawflow.drawflow[this.module].data[listclass[1].slice(13)].inputs[listclass[4]].connections.splice(index_in, 1);

      // Retrieve output/input linked to the connection and remove "linked" class
      var output = document.querySelector('#node-' + listclass[2].slice(14) + ' .' + listclass[3]);
      if(output && output.classList.contains('linked') && document.querySelectorAll('.node_out_node-' + listclass[2].slice(14) + '.' + listclass[3]).length == 0) {
        output.classList.remove("linked");
      }

      var input = document.querySelector('#node-' + listclass[1].slice(13) + ' .' + listclass[4]);
      if(input && input.classList.contains('linked') && document.querySelectorAll('.node_in_node-' + listclass[1].slice(13) + '.' + listclass[4]).length == 0) {
        input.classList.remove("linked");
      }

      this.dispatch('connectionRemoved', { output_id: listclass[2].slice(14), input_id: listclass[1].slice(13), output_class: listclass[3], input_class: listclass[4] });
      this.connection_selected = null;
    }
  }

  removeSingleConnection(id_output, id_input, output_class, input_class) {
    var nodeOneModule = this.getModuleFromNodeId(id_output);
    var nodeTwoModule = this.getModuleFromNodeId(id_input);
    if(nodeOneModule === nodeTwoModule) {
      // Check nodes in same module.

      // Check connection exist
      var exists = this.drawflow.drawflow[nodeOneModule].data[id_output].outputs[output_class].connections.findIndex(function(item, i) {
        return item.node == id_input && item.output === input_class;
      });
      if(exists > -1) {

        if(this.module === nodeOneModule) {
          // In same module with view.
          this.container.querySelector('.connection.node_in_node-' + id_input + '.node_out_node-' + id_output + '.' + output_class + '.' + input_class).remove();
        }

        var index_out = this.drawflow.drawflow[nodeOneModule].data[id_output].outputs[output_class].connections.findIndex(function(item, i) {
          return item.node == id_input && item.output === input_class;
        });
        this.drawflow.drawflow[nodeOneModule].data[id_output].outputs[output_class].connections.splice(index_out, 1);

        var index_in = this.drawflow.drawflow[nodeOneModule].data[id_input].inputs[input_class].connections.findIndex(function(item, i) {
          return item.node == id_output && item.input === output_class;
        });
        this.drawflow.drawflow[nodeOneModule].data[id_input].inputs[input_class].connections.splice(index_in, 1);

        var output = document.querySelector('#node-' + id_output + ' .' + output_class);
        if(output && output.classList.contains('linked') && document.querySelectorAll('.node_out_node-' + id_output + '.' + output_class).length == 0) {
          output.classList.remove("linked");
        }

        var input = document.querySelector('#node-' + id_input + ' .' + input_class);
        if(input && input.classList.contains('linked') && document.querySelectorAll('.node_in_node-' + id_input + '.' + input_class).length == 0) {
          input.classList.remove("linked");
        }

        this.dispatch('connectionRemoved', { output_id: id_output, input_id: id_input, output_class: output_class, input_class: input_class });
        return true;

      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  removeConnectionNodeId(id) {
    const idSearchIn = 'node_in_' + id;
    const idSearchOut = 'node_out_' + id;

    const elemsOut = this.container.querySelectorAll(`.${idSearchOut}`);
    for(let i = elemsOut.length - 1; i >= 0; i--) {
      const listclass = elemsOut[i].classList;

      const index_in = this.drawflow.drawflow[this.module].data[listclass[1].slice(13)].inputs[listclass[4]].connections.findIndex(function(item, i) {
        return item.node === listclass[2].slice(14) && item.input === listclass[3];
      });
      this.drawflow.drawflow[this.module].data[listclass[1].slice(13)].inputs[listclass[4]].connections.splice(index_in, 1);

      const index_out = this.drawflow.drawflow[this.module].data[listclass[2].slice(14)].outputs[listclass[3]].connections.findIndex(function(item, i) {
        return item.node === listclass[1].slice(13) && item.output === listclass[4];
      });
      this.drawflow.drawflow[this.module].data[listclass[2].slice(14)].outputs[listclass[3]].connections.splice(index_out, 1);

      elemsOut[i].remove();

      const output = document.querySelector('#node-' + listclass[2].slice(14) + ' .' + listclass[3]);
      if(output && output.classList.contains('linked') && document.querySelectorAll('.node_out_node-' + listclass[2].slice(14) + '.' + listclass[3]).length == 0) {
        output.classList.remove("linked");
      }

      const input = document.querySelector('#node-' + listclass[1].slice(13) + ' .' + listclass[4]);
      if(input && input.classList.contains('linked') && document.querySelectorAll('.node_in_node-' + listclass[1].slice(13) + '.' + listclass[4]).length == 0) {
        input.classList.remove("linked");
      }

      this.dispatch('connectionRemoved', { output_id: listclass[2].slice(14), input_id: listclass[1].slice(13), output_class: listclass[3], input_class: listclass[4] });
    }

    const elemsIn = this.container.querySelectorAll(`.${idSearchIn}`);
    for(let i = elemsIn.length - 1; i >= 0; i--) {

      const listclass = elemsIn[i].classList;

      const index_out = this.drawflow.drawflow[this.module].data[listclass[2].slice(14)].outputs[listclass[3]].connections.findIndex(function(item, i) {
        return item.node === listclass[1].slice(13) && item.output === listclass[4];
      });
      this.drawflow.drawflow[this.module].data[listclass[2].slice(14)].outputs[listclass[3]].connections.splice(index_out, 1);

      const index_in = this.drawflow.drawflow[this.module].data[listclass[1].slice(13)].inputs[listclass[4]].connections.findIndex(function(item, i) {
        return item.node === listclass[2].slice(14) && item.input === listclass[3];
      });
      this.drawflow.drawflow[this.module].data[listclass[1].slice(13)].inputs[listclass[4]].connections.splice(index_in, 1);

      elemsIn[i].remove();

      const output = document.querySelector('#node-' + listclass[2].slice(14) + ' .' + listclass[3]);
      if(output && output.classList.contains('linked') && document.querySelectorAll('.node_out_node-' + listclass[2].slice(14) + '.' + listclass[3]).length == 0) {
        output.classList.remove("linked");
      }

      const input = document.querySelector('#node-' + listclass[1].slice(13) + ' .' + listclass[4]);
      if(input && input.classList.contains('linked') && document.querySelectorAll('.node_in_node-' + listclass[1].slice(13) + '.' + listclass[4]).length == 0) {
        input.classList.remove("linked");
      }

      this.dispatch('connectionRemoved', { output_id: listclass[2].slice(14), input_id: listclass[1].slice(13), output_class: listclass[3], input_class: listclass[4] });
    }
  }

  getModuleFromNodeId(id) {
    var nameModule;
    const editor = this.drawflow.drawflow;
    Object.keys(editor).map(function(moduleName, index) {
      Object.keys(editor[moduleName].data).map(function(node, index2) {
        if(node == id) {
          nameModule = moduleName;
        }
      });
    });
    return nameModule;
  }

  addModule(name) {
    this.drawflow.drawflow[name] = { "data": {} };
    this.dispatch('moduleCreated', name);
  }

  changeModule(name) {
    this.dispatch('moduleChanged', name);
    this.module = name;
    this.precanvas.innerHTML = "";
    this.canvas_x = 0;
    this.canvas_y = 0;
    this.pos_x = 0;
    this.pos_y = 0;
    this.mouse_x = 0;
    this.mouse_y = 0;
    this.zoom = 1;
    this.zoom_last_value = 1;
    this.precanvas.style.transform = '';
    this.import(this.drawflow);
  }

  removeModule(name) {
    if(this.module === name) {
      this.changeModule('Home');
    }
    delete this.drawflow.drawflow[name];
    this.dispatch('moduleRemoved', name);
  }

  clearModuleSelected() {
    this.precanvas.innerHTML = "";
    this.drawflow.drawflow[this.module] = { "data": {} };
  }

  clear() {
    this.precanvas.innerHTML = "";
    this.drawflow = { "drawflow": { "Home": { "data": {} } } };
  }

  export() {
    // const dataExport = JSON.parse(JSON.stringify(this.drawflow));
    const dataExport = { ...this.drawflow };
    this.dispatch('export', dataExport);
    return dataExport;
  }

  import(data) {
    this.clear();
    // this.drawflow = JSON.parse(JSON.stringify(data));
    this.drawflow = { ...data };
    this.load();
    this.dispatch('import', 'import');
  }

  /* Events */
  on(event, callback) {
    // Check if the callback is not a function
    if(typeof callback !== 'function') {
      console.error(`The listener callback must be a function, the given type is ${typeof callback}`);
      return false;
    }

    // Check if the event is not a string
    if(typeof event !== 'string') {
      console.error(`The event name must be a string, the given type is ${typeof event}`);
      return false;
    }

    // Check if this event not exists
    if(this.events[event] === undefined) {
      this.events[event] = {
        listeners: []
      };
    }

    this.events[event].listeners.push(callback);
  }

  removeListener(event, callback) {
    // Check if this event not exists
    if(this.events[event] === undefined) {
      //console.error(`This event: ${event} does not exist`);
      return false;
    }

    this.events[event].listeners = this.events[event].listeners.filter(listener => {
      return listener.toString() !== callback.toString();
    });
  }

  dispatch(event, details) {
    // Check if this event not exists
    if(this.events[event] === undefined) {
      // console.error(`This event: ${event} does not exist`);
      return false;
    }

    this.events[event].listeners.forEach((listener) => {
      listener(details);
    });
  }

  getUuid() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for(var i = 0; i < 36; i++) {
      s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
  }

}
