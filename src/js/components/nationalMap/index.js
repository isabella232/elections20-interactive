import { h, Component, createRef } from "preact";
import gopher from "../gopher.js";
import "./nationalMap.less";
import states from "states.sheet.json";

export default class NationalMap extends Component {
  constructor(props) {
    super();

    this.state = {};
    this.svgRef = createRef();
  }

  // Lifecycle: Called whenever our component is created
  async componentDidMount() {
    var response = await fetch("./assets/_map-geo.svg");
    var text = await response.text();
    var svg = await this.loadSVG(text);
    this.setState({ svg: svg });
  }

  // Lifecycle: Called just before our component will be destroyed
  componentWillUnmount() {
    // stop when not renderable
  }

  shouldComponentUpdate(props) {
    this.paint(props);
  }

  render() {
    return (
      <div class="map">
        <div ref={this.svgRef}></div>
      </div>
    );
  }

  async loadSVG(svgText) {
    this.svgRef.current.innerHTML = svgText;
    this.paint(this.props);
    this.initLabels();

    var svg = this.svgRef.current.querySelector("svg");
    svg.addEventListener("mousemove", e => this.onMove(e));
  }

  onMove(e) {
    var svg = this.svgRef.current.querySelector("svg");
    var currentHover = svg.querySelector(".hover");
    if (currentHover) { currentHover.classList.remove("hover") };

    if (!e.target.hasAttribute("data-postal")) return;

    var group = e.target.closest("svg > g");
    svg.appendChild(group);

    var state = e.target.getAttribute("data-postal");
    e.target.classList.add("hover");

  }

  initLabels() {
    var svg = this.svgRef.current.querySelector("svg");
    var groups = svg.querySelectorAll("g");
    
    groups.forEach(function(g) {
      var stateOutline = g.querySelector("path");
      var stateLabel = g.querySelector("text");

      // ignore NE and ME
      if (!stateOutline) return;
      if (!stateOutline.hasAttribute("data-postal")) return;

      var bounds = stateOutline.getBBox();
      var labelBox = stateLabel.getBBox();

      var positionX = (bounds.x + (bounds.width / 2));
      stateLabel.setAttribute("x", positionX);

      var positionY = (bounds.y + (bounds.height / 2) + (labelBox.height / 3)) - 1;
      stateLabel.setAttribute("y", positionY)

      var state = stateOutline.getAttribute("data-postal");
      var offsetX = states[state].geo_offset_x;
      var offsetY = states[state].geo_offset_y;
      if (offsetX) { stateLabel.setAttribute("dx", offsetX); }
      if (offsetY) { stateLabel.setAttribute("dy", offsetY); }
    });
  }

  paint(props) {
    var mapData = props.races;
    if (!this.svgRef.current) return;
    var svg = this.svgRef.current.querySelector("svg");

    mapData.forEach(function(r) {
      var eevp = r.eevp;
      var district = r.district;
      var state = r.state.toLowerCase() + (district ? "-" + district : "");
      var leader = r.candidates[0].party;
      var winner = r.winnerParty;
      var stateGroup = svg.querySelector(`.${state}`);
      if (!stateGroup) return;

      if (eevp > 0.5) {
        stateGroup.classList.add("leader");
        stateGroup.classList.add(leader);
      }
      if (winner) {
        stateGroup.classList.remove("leader");
        stateGroup.classList.remove(leader);
        stateGroup.classList.add("winner");
        stateGroup.classList.add(winner);
      }

      var stateOutline = stateGroup.querySelector("path");
      var stateLabel = stateGroup.querySelector("text");
      

    })
  }
}
