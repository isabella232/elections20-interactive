import { h, Component, Fragment } from "preact";
import gopher from "../gopher.js";
import ResultsTableCandidates from "../resultsTableCandidates";
import Strings from "strings.sheet.json";

const STATES_WITHOUT_COUNTY_INFO = ["AK"];

export default class KeyRaces extends Component {
  constructor(props) {
    super();

    this.showHousesIfMoreThanN = 10;
    this.state = {};
    this.onData = this.onData.bind(this);
  }

  onData(data) {
    var updated = Math.max(...data.results.map(r => r.updated));
    var event = new CustomEvent("updatedtime", {
      detail: updated,
      bubbles: true,
    });
    this.base.dispatchEvent(event);

    var grouped = {};
    for (var r of data.results) {
      if (!grouped[r.office]) grouped[r.office] = [];
      grouped[r.office].push(r);
    }

    this.setState({ races: data.results, grouped });
  }

  componentDidMount() {
    gopher.watch(`./data/states/${this.props.state}.json`, this.onData);
  }

  componentWillUnmount() {
    gopher.unwatch(`./data/states/${this.props.state}.json`, this.onData);
  }

  render() {
    var { races, grouped } = this.state;
    if (!races) {
      return "";
    }

    var offices = "PGSHI".split("").filter(o => o in grouped);

    return offices.map(o => {
      var data = grouped[o];
      // Filter house races for keyRaces
      if (o == "H") {
        data = data.filter(d => d.keyRace);
        if (!data.length) return;
      }
      if (o == "I") {
        data = data.filter(d => d.featured);
        if (!data.length) return;
      }

      var label = Strings[`office-${o}`];
      var noCountyResults = STATES_WITHOUT_COUNTY_INFO.includes(
        this.props.state
      );
      var linkText =
        o == "H" || o == "I"
          ? `All ${label} results ›`
          : noCountyResults
          ? ""
          : "County-level results ›";

      return (
        <div class="key-race-group">
          <h2>
            {label}
            <a
              class="county-results"
              href={`#/states/${this.props.state}/${o}`}>
              {linkText}
            </a>
          </h2>
          <div class="races">
            {data.map(r => (
              <ResultsTableCandidates data={r} />
            ))}
          </div>
        </div>
      );
    });
  }
}
