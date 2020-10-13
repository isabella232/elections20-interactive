import { h, Fragment } from "preact";
import { reportingPercentage } from "../util";
import states from "states.sheet.json";

import "../resultsBoardNamed/resultsBoard.less";

var sortParty = function(p) {
  return p == "GOP" ? Infinity : p == "Dem" ? -Infinity : 0;
};

function CandidateCells(race) {
  var sorted = race.candidates.slice(0, 2).sort((a, b) => sortParty(a.party) - sortParty(b.party));
  var leading = race.candidates[0];
  var reporting = race.eevp || race.reportingPercent;

  return sorted.map(function(c) {
    var className = ["candidate", c.party];
    if (reporting > .5 && c == leading) className.push("leading");
    if (c.winner == "X") className.push("winner");
    if (race.runoff) className.push("runoff");

    return (
      <td class={className.join(" ")}>
        <div class="perc">{Math.round(c.percent*100)}%</div>
      </td>
    );
  });
}

export default function ResultsBoardPresident(props) {
  // console.log("props",props)

  return (
    <>
      <div>
        <h3 class="board-hed">{props.hed}</h3>
        <table class="president results table">
        	<tr>
        		<th colspan="2" class="state-hed">State</th>
        		<th>Dem.</th>
        		<th>GOP</th>
        		<th>E.V.</th>
        	</tr>

          {props.races.map(function(r) {
            var hasResult = r.eevp || r.reporting || r.called || r.runoff;
            var reporting = r.eevp || r.reportingPercent;
            var percentIn = reporting ? reportingPercentage(reporting) + "% in" : "";
            var winner = r.candidates.filter(c => c.winner == "X");
            var stateDetail = states[r.state] || {};

            return (
              <tr class={hasResult ? "closed" : "open"}>

                {/* State */}
                <td class={"state " + (winner[0] ? ("winner " + winner[0].party) : "")}>
                  <a href={"#/states/" + r.state + "/" + r.office}>
                    {stateDetail.ap} {r.district && r.district !== "AL" ? r.district : ""}
                  </a>
                </td>

                {/* Open */}
                <td class="open-label" colspan="4">Last polls close at {stateDetail.closingTime} ET</td>

                {/* EEVP */}
                <td class="reporting">{percentIn}</td>
                
                {/* Candidates */}
                {CandidateCells(r)}

                {/* Electoral votes */}
                <td class={"electoral " + (winner[0] ? ("winner " + winner[0].party) : "")}>{r.electoral}</td>

                {/* Runoff */}
                <td class="runoff-label">{r.runoff ? "Runoff" : ""}</td>
              </tr>
            );
        })}
        </table>
      </div>
    </>
  )
}