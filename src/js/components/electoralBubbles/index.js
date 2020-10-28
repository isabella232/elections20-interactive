import { h, Fragment, Component, createRef } from "preact";
import { reportingPercentage, winnerIcon, groupCalled } from "../util";
import track from "../../lib/tracking";
import stateSheet from "states.sheet.json";

// d3 is weird about imports, apparently
var d3 = require("d3-force/dist/d3-force.min.js");

var { sqrt, PI, cos, sin } = Math;

const Y_FORCE = .03;
const X_FORCE = .4;
const COLLIDE_FORCE = 1;
const VISUAL_DOMAIN = .5;
const DATA_DOMAIN = .3;
const POLAR_OFFSET = .05;
const MIN_TEXT = 10;
const MIN_RADIUS = 3;
const FROZEN = .001;
const HEIGHT_STEP = 50;

var nextTick = function(f) {
  requestAnimationFrame(f);
}

export default class ElectoralBubbles extends Component {

  constructor(props) {
    super();
    this.state = {
      nodes: [],
      lookup: {},
      width: 1600,
      height: 900
    };
    this.svg = createRef();
    this.tooltip = createRef();
    this.lastHover = null;

    this.collisionRadius = this.collisionRadius.bind(this);
    this.intersect = this.intersect.bind(this);
    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    this.xAccess = this.xAccess.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onExit = this.onExit.bind(this);

    var simulation = d3.forceSimulation();
    simulation.stop(); // only run when visible

    var xForce = d3.forceX().x(this.xAccess).strength(X_FORCE);
    var yForce = d3.forceY().strength(Y_FORCE);
    var collider = d3.forceCollide().strength(COLLIDE_FORCE);
    collider.radius(this.collisionRadius);

    simulation.force("x", xForce);
    simulation.force("y", yForce);
    simulation.force("collide", collider);

    this.simulation = simulation;

    this.observer = new IntersectionObserver(this.intersect);
    this.running = false;

    window.addEventListener("resize", this.resize);
  }

  xAccess(d) {
    var centerX = this.state.width / 2;
    var { mx, margin, party } = d;
    // generate log position
    var offset = party == "Dem" ? -POLAR_OFFSET : POLAR_OFFSET;
    var pole = centerX + (centerX * offset);
    var x = mx * centerX + pole;
    return x;
  }

  nodeRadius(d) {
    var a = d.electoral;
    var r = Math.sqrt(a / PI);
    return Math.max(r * (this.state.width / 60), MIN_RADIUS);
  }

  collisionRadius(d) {
    return this.nodeRadius(d) + 4;
  }

  resize() {
    var svg = this.svg.current;
    if (!svg) return;
    var bounds = svg.getBoundingClientRect();
    var { width, height } = bounds;
    this.setState({ width });
    this.simulation.alpha(1);
  }

  intersect([e]) {
    if (e.isIntersecting) {
      if (!this.running) {
        console.log("Starting force sim...");
        this.running = true;
        this.simulation.alpha(1);
        requestAnimationFrame(this.tick);
      }
    } else {
      console.log("Pausing force sim...");
      this.running = false;
    }
  }

  tick(t) {
    if (!this.running) return;
    // schedule updates
    nextTick(this.tick);

    var svg = this.svg.current;
    if (!svg) return;
    var bounds = svg.getBoundingClientRect();
    var { width } = bounds;
    if (!width) return;
    if (width != this.state.width) {
      this.setState({ width });
    }

    var { nodes } = this.state;

    // update node state, like radius if newly added

    // run the simulation against the nodes
    var alpha = this.simulation.alpha();
    if (alpha > FROZEN) {
      this.simulation.nodes(nodes);
      this.simulation.tick();

      // render with new positions
      this.setState({ nodes });
    }

  }

  createNode(r, dataDomain) {
    var [ winner, loser ] = r.candidates;
    var margin = winner.percent - loser.percent;
    var party = winner.party;
    // normalize margin
    var mx = Math.log(margin / dataDomain + 1);
    if (party == "Dem") mx *= -1;
    var x = mx;
    var { state, district, called, electoral } = r;
    var key = r.district ? r.state + r.district : r.state;
    return {
      key,
      state,
      district,
      called,
      electoral,
      margin,
      mx,
      party,
      original: r
    };
  }

  updateNodes(results) {
    var { nodes } = this.state;

    var touched = new Set();
    var lookup = {};
    results.forEach(r => lookup[r.state + (r.district || "")] = r);

    var uncalled = results.filter(r => r.eevp < .5 && !r.called);
    var called = results.filter(r => r.called || r.eevp >= .5);

    var dataDomain = Math.max(...called.map(function(r) {
      var [ winner, loser ] = r.candidates;
      return Math.abs(winner.percent - loser.percent);
    }));
    dataDomain = Math.max(Math.ceil(dataDomain * 10) / 10, .1);

    for (var r of called) {
      // find an existing node?
      var upsert = this.createNode(r, dataDomain);
      var existing = nodes.find(n => n.key == upsert.key);
      if (existing) {
        upsert = Object.assign(existing, upsert);
        touched.add(upsert);
      } else {
        // add the node
        upsert.x = this.xAccess(upsert);
        upsert.y = 0;
        nodes.push(upsert);
        touched.add(upsert);
      }
      lookup[upsert.key] = r;
    }

    // remove missing results
    nodes = nodes.filter(n => touched.has(n));

    this.simulation.alpha(1);

    this.setState({ nodes, lookup, uncalled });
  }

  shouldComponentUpdate(props, state) {
    var { results = [] } = props || this.props;
    if (props.results != this.props.results) this.updateNodes(results);
  }

  componentDidMount() {
    this.resize();
    this.observer.observe(this.base);
    if (this.props.results) this.updateNodes(this.props.results);
  }

  componentWillUnmount() {
    this.observer.disconnect();
  }

  goToState(state) {
    track("clicked-bubble", state);
    window.location.href = `#/states/${state}/P`;
  }

  onMove(e) {
    var bounds = this.base.getBoundingClientRect();
    var offsetX = e.clientX - bounds.left;
    var offsetY = e.clientY - bounds.top;
    var tooltip = this.tooltip.current;

    var key = e.target.dataset.key;
    var data = this.state.lookup[key];
    if (!key || !data) {
      return tooltip.classList.remove("show");
    }

    tooltip.classList.add("show");

    if (this.lastHover != key) {
      var stateName = stateSheet[data.state].name;
      var districtDisplay = data.district == "AL" ? "At-Large" : data.district;
      var h3 = data.district ? `${stateName} ${districtDisplay}` : stateName;
      tooltip.innerHTML = `
        <h3>${h3} (${data.electoral})</h3>
        <div class="candidates">${data.candidates.map(c =>
          `<div class="row">
              <div class="party ${c.party}"></div>
              <div class="name">${c.last}</div> ${c.winner == "X" ? winnerIcon : ""}
              <div class="perc">${c.percent ? Math.round(c.percent * 1000) / 10 : "0"}%</div>
          </div>`
        ).join("")}</div>
        <div class="reporting">${reportingPercentage(
          data.eevp || data.reportingPercent
        )}% in</div>
      `;
      this.lastHover = key;
    }

    var left = offsetX < bounds.width / 2 ? offsetX + 10 : offsetX - 4 - tooltip.offsetWidth;

    tooltip.style.left = left + "px";
    tooltip.style.top = offsetY + 10 + "px";
  }

  onExit(e) {
    this.tooltip.current.classList.remove("show");
  }

  render(props, state) {
    var { buckets } = props;
    var { nodes, width, uncalled = [] } = state;

    var distance = 0;
    nodes.forEach(n => {
      n.r = this.nodeRadius(n);
      var outerBounds = Math.abs(n.y) + n.r;
      if (outerBounds > distance) {
        distance = outerBounds;
      }
    });

    var height = Math.ceil(distance / HEIGHT_STEP) * HEIGHT_STEP * 2;

    var uncalled = {};
    for (var k in props.buckets) {
      uncalled[k] = props.buckets[k].filter(r => !r.called && r.eevp < .5);
    }

    var hasUncalled = [...uncalled.likelyD, ...uncalled.tossup, ...uncalled.likelyR].length;

    var titles = {
      likelyD: "Likely Democratic",
      tossup: "Competitive states",
      likelyR: "Likely Republican"
    };

    return <div class="electoral-bubbles" onMousemove={this.onMove} onMouseleave={this.onExit}>
      <div class="key-above">
        Current tabulation
      </div>
      <div class="aspect-ratio">
        <svg class="bubble-svg" ref={this.svg}
          role="img"
          aria-label="Bubble plot of state margins"
          preserveAspectRatio="none"
          width={width} height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          <text class="leading-cue dem" x={width / 2 - 10} y="20">
            &lt; Biden leading
          </text>
          <text class="leading-cue gop" x={width / 2 + 10} y="20">
            Trump leading &gt;
          </text>
          {nodes.map(n => {
            // remove the max to let text shrink and vanish
            // var textSize = Math.max(this.nodeRadius(n) * .5, MIN_TEXT);
            var textSize = this.nodeRadius(n) * .5;
            return (<>
              <circle
                class={`${n.party} ${n.called ? "called" : "pending"}`}
                vector-effect="non-scaling-stroke"
                data-key={n.key}
                key={n.key}
                cx={n.x}
                cy={(n.y || 0) + height / 2}
                r={n.r}
                onClick={() => this.goToState(n.state)}
              />
              {textSize > MIN_TEXT && <text 
                class={`${n.party} ${n.called ? "called" : "pending"}`}
                x={n.x} 
                y={n.y + (height / 2) + (textSize * .4)}
                font-size={textSize + "px"}>{n.state}</text>}
            </>);
          })}
        </svg>
      </div>
      {hasUncalled && <div class="uncalled">
        <h3>No results yet / early results</h3>
        <div class="triplets">
          {["likelyD", "tossup", "likelyR"].map(rating => (
            !uncalled[rating].length ? "" : <div class="uncalled">
              <h4>{titles[rating]}</h4>
              <div class="circles">
                {uncalled[rating].sort((a, b) => b.electoral - a.electoral).map(result => {
                  var reporting = result.eevp || result.reportingPercent;
                  var r = Math.max(this.nodeRadius(result), MIN_RADIUS);
                  var size = r * .5;
                  return <svg width={r * 2} height={r * 2} class="uncalled-race">
                    <circle
                      class={"uncalled-race " + `${reporting ? "early" : "open"}`}
                      cx={r} cy={r} r={r - 1}
                      data-key={result.district ? result.state + result.district : result.state}
                      onClick={() => this.goToState(result.state)}
                    />
                    {size > MIN_TEXT && (
                      <text x={r} y={r + size * .4} font-size={size + "px"}>{result.state}</text>
                    )}
                  </svg>
                })}
              </div>
            </div>
          ))}
        </div>
      </div>}
      <div class="tooltip" ref={this.tooltip}></div>
    </div>
  }
}