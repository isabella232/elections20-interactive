// Polyfills that aren't covered by `babel-preset-env`

// import { h, createProjector } from 'maquette';
import { h, Component, createRef } from "preact";
import { buildDataURL, getHighestPymEmbed } from "./helpers.js";
import gopher from "../gopher.js";

var specialStates = new Set(['IA', 'MA', 'OK', 'WA']);
var guid = 0;

export class CountyMap extends Component {
  constructor(props) {
    super();

    this.fipsLookup = [];
    this.palette = {'Dem': '#237bbd', 'Rep': '#d62021' }

    this.state = {};
    this.svgRef = createRef();
    this.tooltipRef = createRef();
    this.guid = guid++;

    this.onData = this.onData.bind(this);
  }

  onData(json) {
    this.setState(json);
  }

  // Lifecycle: Called whenever our component is created
  async componentDidMount() {
    var response = await fetch(
      "../../assets/counties/" + this.props.state + ".svg"
    );
    var text = await response.text();
    var svg = await this.loadSVG(text);
    this.setState({ svg: svg });
  }

  // Lifecycle: Called just before our component will be destroyed
  componentWillUnmount() {
    // stop when not renderable
  }

  render() {
    var isChonky = specialStates.has(this.props.state);

    return (
      <div class= {"county-map" + (isChonky ? " chonky" : "")} data-as="map" aria-hidden="true">
        <div class="container horizontal" data-as="container">
          <svg
            class="patterns"
            style="opacity: 0; position: absolute; left: -1000px"
          >
            <pattern
              id="pending-0"
              class="stripes"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-45)"
            >
              <path
                d="M5,0L5,10"
                stroke="rgba(0, 0, 0, .2)"
                stroke-width="4"
              ></path>
            </pattern>
          </svg>
          <div class="key" data-as="key">
            <div class="key-grid">
              <div class="key-row">
                <div class="swatch" style="background: #d62021;"></div>
                <div class="name"></div>
              </div>
              <div class="key-row">
                <div class="swatch" style="background: #237bbd;"></div>
                <div class="name"></div>
              </div>
            </div>
          </div>
          <div
            class="map-container"
            data-as="mapContainer"
            style="height: 65vh; width: 55.794vh;"
          >
            <div class="map" data-as="map">
              <div ref={this.svgRef}></div>
            </div>
            <div class="tooltip" ref={this.tooltipRef}>
            </div>
          </div>
        </div>
      </div>
    );
  }

  async loadSVG(svgText) {
    this.svgRef.current.innerHTML = svgText;
    var svg = this.svgRef.current.getElementsByTagName('svg')[0];

    svg.setAttribute("preserveAspectRatio", "xMaxYMid meet");

    var paths = svg.querySelectorAll("path");
    paths.forEach((p, i) => {
      p.setAttribute("vector-effect", "non-scaling-stroke");
    });

    var width = svg.getAttribute("width") * 1;
    var height = svg.getAttribute("height") * 1;

    svg.addEventListener("click", e => this.onClick(e));
    svg.addEventListener("mousemove", e => this.onMove(e));
    svg.addEventListener("mouseleave", e => this.onMove(e));
    // var embedded = document.body.classList.contains("embedded");

    // Move this to own function called in render?
    // if (width > height * 1.4) {
    //   var ratio = height / width;
    //   elements.mapContainer.style.width = "100%";
    //   elements.mapContainer.style.paddingBottom = `${100 * ratio}%`;
    // } //else {
    //   var ratio = width / height;
    //   if (embedded) {
    //     var w = 500;
    //     var h = w * ratio;
    //     if (w > window.innerWidth) {
    //       w = window.innerWidth - 32;
    //       h = w * ratio;
    //     }
    //     elements.mapContainer.style.height = w + "px";
    //     elements.mapContainer.style.width = h + "px";
    //   } else {
    //     var basis = height > width * 1.1 ? 65 : 55;
    //     elements.mapContainer.style.height = basis + "vh";
    //     elements.mapContainer.style.width = `${basis * ratio}vh`;
    //   }
    // }
    // // elements.aspect.style.paddingBottom = height / width * 100 + "%";
    // elements.container.classList.toggle("horizontal", width < height);

    this.svg = svg;

    this.paint();

    return svg;
  }

  paint() {
    var mapData = this.props.data;
    if (!this.svg) return;

    var incomplete = false;

    // Need to get the data in here first
    var winners = new Set();
    var hasVotes = false;
    for (var d of Object.keys(mapData)) {
      var [top] = mapData[d].sort((a, b) => b.votepct - a.votepct);
      if (top.votecount) {
        winners.add(top.party in this.palette ? top.party: "other");
        hasVotes = true;
      }
      this.fipsLookup[top.fipscode] = mapData[d];
    }

    var lookup = {};
    for (var d of Object.keys(mapData)) {
      var fips = d;
      var candidates = mapData[d];
      var [top] = candidates.sort((a, b) => b.percentage - a.percentage);
      // if (!top.votecount) continue;

      var path = this.svg.querySelector(`[id="fips-${fips}"]`);
      if (!path) continue;
      path.classList.add("painted");
      var pigment = this.palette[top.party];
      var hitThreshold = top.precinctsreportingpct > 50;
      var paint = "#bbb";
      if (hitThreshold) {
        paint = pigment ? pigment : "#bbb";
      } else {
        paint = `url(#pending-${this.guid})`;
        incomplete = true;
      }

      path.style.fill = paint;
    }

    if (hasVotes) {
      var pKeys = Object.keys(this.palette);
      var keyData = pKeys
        .map(p => this.palette[p])
        .sort((a, b) => (a.order < b.order ? -1 : 1));
      var filtered = keyData.filter(p => winners.has(p.id));
      keyData = filtered.length < 2 ? keyData.slice(0, 2) : filtered;
      elements.key.innerHTML = key({ keyData, incomplete, guid: this.guid });
    }
  }

  highlightCounty(fips) {
    if (!this.svg) return;
    var county = this.svg.querySelector(`[id="fips-${fips}"]`);
    if (county == this.lastClicked) return;
    if (this.lastClicked) this.lastClicked.classList.remove("clicked");
    county.parentElement.appendChild(county);
    county.classList.add("clicked");
    this.lastClicked = county;
  }

  onClick(e) {
    var county = e.target;
    var fips = county.id.replace("fips-", "");

    if (fips.length > 0) {
      // TODO: add back in some version of this to communicate county change
      // this.dispatch("map-click", { fips });
      this.highlightCounty(fips);
    }
  }

  onMove(e) {
    var tooltip = this.tooltipRef.current;
    var fips = e.target.id.replace("fips-", "");
    if (!fips || e.type == "mouseleave") {
      return tooltip.classList.remove("shown");
    }

    var result = this.fipsLookup[fips];
    if (result) {
      var candText = "";
      if (result.reportingPercentage > 25) {
        var leadingCandidate = result[0];
        var prefix = leadingCandidate.winner ? "Winner: " : "Leading: ";
        var candText = prefix + leadingCandidate.last + " (" + (leadingCandidate.percentage || 0).toFixed(1) + "%)";
      }

      var countyDisplay = result[0].reportingunitname.replace(/\s[a-z]/g, match =>
        match.toUpperCase()
      );
      tooltip.innerHTML = `
        <div class="name">${countyDisplay}</div>
        <div class="result">${ candText }</div>
        <div class="reporting">${result[0].precinctsreportingpct.toFixed(1)}% reporting</div>
      `;
    }
    // Add population back in
    // <div class="pop">Pop. ${result[0].population.toLocaleString()}</div>

    var bounds = this.svgRef.current.getBoundingClientRect();
    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;
    if (x > bounds.width / 2) {
      x -= tooltip.offsetWidth + 10;
    } else {
      x += 20;
    }
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";

    tooltip.classList.add("shown");
  }
}