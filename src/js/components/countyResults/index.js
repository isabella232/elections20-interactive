import { h, Component, Fragment } from "preact";
import gopher from "../gopher.js";
import {
  determineResults,
  decideLabel,
  getMetaData,
  calculatePrecinctsReporting,
} from "../util.js";
import { RacewideTable } from "../racewideTable";
import { CountyMap } from "../countyMap";
var fmtComma = n => n.toLocaleString();

const availableMetrics = [
  {
    name: "Population",
    key: "population",
    census: true,
    comma_filter: true,
  },
  {
    name: "2016 Presidential Margin",
    key: "past_margin",
    census: false,
  },
  {
    name: "Unemployment",
    key: "unemployment",
    census: false,
    append: "%",
  },
  {
    name: "% White",
    key: "percent_white",
    census: true,
    percent_filter: true,
  },
  {
    name: "% Black",
    key: "percent_black",
    census: true,
    percent_filter: true,
  },
  {
    name: "% Hispanic",
    key: "percent_hispanic",
    census: true,
    percent_filter: true,
  },
  {
    name: "Median Income",
    key: "median_income",
    census: true,
    comma_filter: true,
    prepend: "$",
  },
  {
    name: "% College-Educated",
    key: "percent_bachelors",
    census: true,
    percent_filter: true,
  },
];

export class CountyResults extends Component {
  constructor(props) {
    super();

    // TODO: Split this out into a map/table reusable component
    this.statesWithoutCountyInfo = ["AK"]; // Get me passed in

    let sortMetric = availableMetrics[0];

    let dataFile = `/data/counties/${props.state}-${props.raceid}.json`;

    this.state = { dataFile, activeView: props.view, sortMetric };
    this.onCountyData = this.onCountyData.bind(this);
    this.onStateData = this.onStateData.bind(this);
  }

  onCountyData(json) {
    var office = json[0].office;
    this.setState({ data: json, office });
  }

  onStateData(json) {
    this.setState({ stateData: json });
  }

  // Lifecycle: Called whenever our component is created
  async componentDidMount() {
    gopher.watch(
      `/data/counties/${this.props.state}-${this.props.raceid}.json`,
      this.onCountyData
    );
    gopher.watch(`/data/states/${this.props.state}.json`, this.onStateData);
  }

  // Lifecycle: Called just before our component will be destroyed
  componentWillUnmount() {
    // stop when not renderable
    gopher.unwatch(
      `/data/counties/${this.props.state}-${this.props.raceid}.json`,
      this.onData
    );
    gopher.unwatch(`/data/states/${this.props.state}.json`, this.onStateData);
  }

  render() {
    if (!this.state.data || !this.state.stateData) {
      return "";
    }
    // const stateResults = this.state.data.filter(
    //   c => !(c.first === "" && c.last === "Other")
    // );
    // Render a county-level table below

    // TODO: get table working if we decide to use it.
    // var countyLevel = this.getCountyLevelTable();
    var race = "";
    return (
      <div class="results-elements">
        <h1>County results for {race}</h1>
        <h2>Statewide Results</h2>
        {
          <RacewideTable
            data={
              this.state.stateData.filter(r => r.office == this.state.office)[0]
            }
            className={
              this.state.activeView === "senate"
                ? "results-senate"
                : "results-gubernatorial"
            }
          />
        }
        <CountyMap
          state={this.props.state.toUpperCase()}
          data={this.state.data}
        />
        {/*{countyLevel}*/}
      </div>
    );
  }

  getCountyLevelTable() {
    const sortKeys = this.sortCountyResults();
    const availableCandidates = this.state.data[0].candidates.slice(0, 2);

    let countyLevel = "";
    countyLevel = (
      <div
        class={
          "results-counties " +
          this.state.sortMetric["key"].split("_").join("-")
        }>
        <h2>Results By County</h2>
        <table class={`results-table candidates-${availableCandidates.length}`}>
          <thead>
            <tr>
              <th class="county">
                <div>
                  <span>County</span>
                </div>
              </th>
              <th class="amt precincts">
                <div>
                  <span></span>
                </div>
              </th>
              {availableCandidates.map(cand => this.renderCandidateTH(cand))}
              <th class="vote margin" key="margin">
                <div>
                  <span>Vote margin</span>
                </div>
              </th>
              <th class="comparison" key="margin">
                <div>
                  <span>{this.state.sortMetric["name"]}</span>
                </div>
              </th>
            </tr>
            {sortKeys.map(key =>
              this.renderCountyRow(
                this.state.data.filter(a => a.fips == key),
                availableCandidates
              )
            )}
          </thead>
        </table>
      </div>
    );
    return countyLevel;
  }

  renderMetricLi(metric) {
    //this.onMetricClick add me back in
    return (
      <li
        class={
          "sortButton " + metric === this.state.sortMetric ? "selected" : ""
        }>
        <span class="metric">{[metric["name"]]}</span>
        {metric.name !== "% College-Educated" ? (
          <span class="pipe">|</span>
        ) : (
          ""
        )}
      </li>
    );
  }

  renderCandidateTH(candidate) {
    return (
      <th class="vote" key={candidate}>
        <div>
          <span>{candidate}</span>
        </div>
      </th>
    );
  }

  renderCountyRow(results, availableCandidates) {
    const keyedResults = availableCandidates.reduce((obj, lastName) => {
      obj[lastName] = results.find(c => c.last === lastName);
      return obj;
    }, {});

    const winner = this.determineWinner(keyedResults);

    let extraMetric;
    if (this.state.sortMetric["census"]) {
      extraMetric = this.state.data.census[this.state.sortMetric["key"]];
    } else {
      extraMetric = this.state.extraData[results[0].fipscode][
        this.state.sortMetric["key"]
      ];
    }

    if (this.state.sortMetric["comma_filter"]) {
      extraMetric = fmtComma(extraMetric);
    }

    if (this.state.sortMetric["percent_filter"]) {
      extraMetric = (extraMetric * 100).toFixed(1) + "%";
    }

    if (this.state.sortMetric["prepend"]) {
      extraMetric = sortMetric["prepend"] + extraMetric;
    }

    if (this.state.sortMetric["append"]) {
      extraMetric = extraMetric.toFixed(1) + this.state.sortMetric["append"];
    }

    // Correct issue where New England counties are all-uppercase
    // This will be fixed eventually upstream in Elex, as it's a bug therein
    // https://github.com/newsdev/elex/pull/337
    return (
      <tr>
        <td class="county">
          <span class="precincts mobile">{results[0].reportingunitname}</span>
        </td>
        <td class="precincts amt">
          {calculatePrecinctsReporting(results[0].precinctsreportingpct) +
            "% in"}
        </td>
        {availableCandidates.map(key =>
          this.renderCountyCell(keyedResults[key], winner)
        )}
        {this.renderMarginCell(keyedResults, winner)}
      </tr>
    );
    //{calculateVoteMargin(keyedResults)}
    //{renderComparison(extraMetric)}
  }

  renderCountyCell(result, winner) {
    // TODO: add in independent class
    return (
      <td
        class={`vote ${result.party.toLowerCase()} ${
          winner === result ? "winner" : ""
        }`}
        key={result.candidateid}>
        {(result.votepct * 100).toFixed(1) + "%"}
      </td>
    );
  }

  renderMarginCell(result, winner) {
    var party;
    if (winner) {
      party = ["Dem", "GOP"].includes(winner.party)
        ? winner.party.toLowerCase()
        : "ind";
    }

    var cell = (
      <td class={`vote margin ${party}`}>{this.calculateVoteMargin(result)}</td>
    );
    return cell;
  }

  determineWinner(keyedResults) {
    let winner = null;
    let winningPct = 0;
    for (var key in keyedResults) {
      let result = keyedResults[key];

      if (result.precinctsreportingpct < 1) {
        return winner;
      }

      if (result.votepct > winningPct) {
        winningPct = result.votepct;
        winner = result;
      }
    }
    return winner;
  }

  sortCountyResults() {
    if (!this.state) {
      return;
    }
    var sortMetric = this.state.sortMetric;
    var values = [];

    for (let county of this.state.data) {
      let sorter;
      if (sortMetric["census"]) {
        sorter = county.county.census[sortMetric["key"]];
      } else {
        sorter = county.county[sortMetric["key"]];
      }
      values.push([county.fips, sorter]);
    }

    values.sort(function (a, b) {
      // TODO: get this working
      if (sortMetric["key"] === "past_margin") {
        // always put Democratic wins on top
        if (a[1][0] === "D" && b[1][0] === "R") return -1;
        if (a[1][0] === "R" && b[1][0] === "D") return 1;

        const aMargin = parseInt(a[1].split("+")[1]);
        const bMargin = parseInt(b[1].split("+")[1]);

        // if Republican, sort in ascending order
        // if Democratic, sort in descending order
        if (a[1][0] === "R") {
          return aMargin - bMargin;
        } else {
          return bMargin - aMargin;
        }
      }

      return b[1] - a[1];
    });
    return values;
  }

  calculateVoteMargin(keyedResults) {
    let winnerVotePct = 0;
    let winner = null;
    for (let key in keyedResults) {
      let result = keyedResults[key];

      if (result.votepct > winnerVotePct) {
        winnerVotePct = result.votepct;
        winner = result;
      }
    }

    if (!winner) {
      return "";
    }
    let winnerMargin = 100;
    for (let key in keyedResults) {
      let result = keyedResults[key];

      if (winner.votepct - result.votepct < winnerMargin && winner !== result) {
        winnerMargin = winner.votepct - result.votepct;
      }
    }

    let prefix;
    if (winner.party === "Dem") {
      prefix = "D";
    } else if (winner.party === "GOP") {
      prefix = "R";
    } else {
      prefix = "I";
    }

    return prefix + " +" + Math.round(winnerMargin * 100);
  }
}
